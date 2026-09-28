const express = require('express');
const { authenticate } = require('../middleware/auth');
const { firestore, admin } = require('../firebase');
const db = require('../config/db');

const router = express.Router();

/**
 * Sync user after Firebase Auth.
 * Creates user profile + first university + first cafeteria.
 */
router.post('/sync', async (req, res, next) => {
    try {
        const header = req.headers.authorization;
        if (!header?.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'No token' });
        }

        const decoded = await admin.auth().verifyIdToken(header.slice(7));
        const { name, universityName, cafeteriaName, timezone, currency } = req.body;

        const userRef = firestore.collection('users').doc(decoded.uid);
        const userDoc = await userRef.get();

        let isNew = false;

        if (!userDoc.exists) {
            isNew = true;

            // Create user profile
            await userRef.set({
                name: name || decoded.name || 'User',
                email: decoded.email,
                plan: 'basic',
                planExpiresAt: null,
                avatar: '👤',
                currency: currency || 'ZAR',
                role: 'manager',
                createdAt: new Date()
            });

            // Create first university
            const uniRef = await userRef.collection('universities').add({
                name: universityName || 'My University',
                country: 'South Africa',
                timezone: timezone || 'Africa/Johannesburg',
                currency: currency || 'ZAR',
                icon: '🎓',
                createdAt: new Date()
            });

            // Create first cafeteria
            const cafeRef = await uniRef.collection('cafes').add({
                name: cafeteriaName || 'Main Cafeteria',
                type: 'cafeteria',
                timezone: timezone || 'Africa/Johannesburg',
                currency: currency || 'ZAR',
                icon: '🍽️',
                isActive: true,
                createdAt: new Date()
            });

            await userRef.update({ lastActiveCafeId: cafeRef.id });

            db.logAudit({ uid: decoded.uid, action: 'user_created' });
        }

        const updatedDoc = await userRef.get();
        res.json({ success: true, data: { uid: decoded.uid, ...updatedDoc.data(), isNew } });
    } catch (err) { next(err); }
});

router.get('/me', authenticate, (req, res) => {
    res.json({ success: true, data: req.user });
});

module.exports = router;
