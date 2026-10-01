const express = require('express');
const { authenticate } = require('../middleware/auth');
const { firestore, admin } = require('../firebase');
const db = require('../config/db');

const router = express.Router();

/**
 * POST /api/auth/sync — Self-healing user + café setup
 */
router.post('/sync', async (req, res, next) => {
    try {
        const header = req.headers.authorization;
        if (!header || !header.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'No token' });
        }

        let decoded;
        try {
            decoded = await admin.auth().verifyIdToken(header.slice(7));
        } catch (err) {
            console.error('❌ Token verify failed:', err.message);
            return res.status(401).json({
                success: false,
                error: 'Token invalid: ' + err.message
            });
        }

        const { name, universityName, cafeteriaName, timezone, currency } = req.body || {};

        const userRef = firestore.collection('users').doc(decoded.uid);
        let userDoc = await userRef.get();
        let isNew = false;

        if (!userDoc.exists) {
            isNew = true;
            await userRef.set({
                name: name || decoded.name || 'User',
                email: decoded.email || '',
                plan: 'basic',
                planExpiresAt: null,
                avatar: '👤',
                currency: currency || 'ZAR',
                role: 'manager',
                createdAt: new Date()
            });
            console.log('✅ User created:', decoded.uid);
            try { db.logAudit({ uid: decoded.uid, action: 'user_created' }); } catch (e) {}
        }

        // Ensure university
        const unisSnap = await userRef.collection('universities').limit(1).get();
        let universityRef;

        if (unisSnap.empty) {
            universityRef = await userRef.collection('universities').add({
                name: universityName || 'My University',
                country: 'South Africa',
                timezone: timezone || 'Africa/Johannesburg',
                currency: currency || 'ZAR',
                icon: '🎓',
                createdAt: new Date()
            });
            console.log('✅ University created');
        } else {
            universityRef = unisSnap.docs[0].ref;
        }

        // Ensure café
        const cafesSnap = await universityRef.collection('cafes').limit(1).get();
        let cafeRef;

        if (cafesSnap.empty) {
            cafeRef = await universityRef.collection('cafes').add({
                name: cafeteriaName || 'Main Cafeteria',
                type: 'cafeteria',
                campus: null,
                timezone: timezone || 'Africa/Johannesburg',
                currency: currency || 'ZAR',
                icon: '🍽️',
                isActive: true,
                createdAt: new Date()
            });
            console.log('✅ Café created');
        } else {
            cafeRef = cafesSnap.docs[0].ref;
        }

        const freshUser = (await userRef.get()).data();
        if (!freshUser.lastActiveCafeId) {
            await userRef.update({ lastActiveCafeId: cafeRef.id });
        }

        const finalDoc = await userRef.get();
        res.json({
            success: true,
            data: { uid: decoded.uid, ...finalDoc.data(), isNew }
        });
    } catch (err) {
        console.error('❌ Sync error:', err.message);
        next(err);
    }
});

router.get('/me', authenticate, (req, res) => {
    res.json({ success: true, data: req.user });
});

module.exports = router;
