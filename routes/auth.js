const express = require('express');
const { authenticate } = require('../middleware/auth');
const { firestore, admin } = require('../firebase');
const db = require('../config/db');

const router = express.Router();

/**
 * Sync user after Firebase Auth.
 * Creates/repairs user profile + first university + first cafeteria.
 *
 * Safe to call on EVERY login — it heals missing data.
 */
router.post('/sync', async (req, res, next) => {
    try {
        const header = req.headers.authorization;

        if (!header?.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'No token'
            });
        }

        const decoded = await admin.auth().verifyIdToken(header.slice(7));

        const {
            name,
            universityName,
            cafeteriaName,
            timezone,
            currency
        } = req.body || {};

        const userRef = firestore.collection('users').doc(decoded.uid);
        let userDoc = await userRef.get();

        let isNew = false;

        // ─────────────────────────────────────────────────────────
        // 1. Create user profile if missing
        // ─────────────────────────────────────────────────────────
        if (!userDoc.exists) {
            isNew = true;

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

            db.logAudit({
                uid: decoded.uid,
                action: 'user_created'
            });

            // Refresh userDoc
            userDoc = await userRef.get();
        }

        // ─────────────────────────────────────────────────────────
        // 2. Ensure user has at least one university
        // ─────────────────────────────────────────────────────────
        const unisSnap = await userRef.collection('universities').limit(1).get();

        let universityRef;

        if (unisSnap.empty) {
            // Create default university
            universityRef = await userRef.collection('universities').add({
                name: universityName || 'My University',
                country: 'South Africa',
                timezone: timezone || 'Africa/Johannesburg',
                currency: currency || 'ZAR',
                icon: '🎓',
                createdAt: new Date()
            });

            db.logAudit({
                uid: decoded.uid,
                universityId: universityRef.id,
                action: 'university_created'
            });
        } else {
            universityRef = unisSnap.docs[0].ref;
        }

        // ─────────────────────────────────────────────────────────
        // 3. Ensure university has at least one café
        // ─────────────────────────────────────────────────────────
        const cafesSnap = await universityRef.collection('cafes').limit(1).get();

        let cafeRef;

        if (cafesSnap.empty) {
            // Create default café
            cafeRef = await universityRef.collection('cafes').add({
                name: cafeteriaName || 'Main Cafeteria',
                type: 'cafeteria',
                timezone: timezone || 'Africa/Johannesburg',
                currency: currency || 'ZAR',
                icon: '🍽️',
                isActive: true,
                createdAt: new Date()
            });

            db.logAudit({
                uid: decoded.uid,
                universityId: universityRef.id,
                cafeId: cafeRef.id,
                action: 'cafe_created'
            });
        } else {
            cafeRef = cafesSnap.docs[0].ref;
        }

        // ─────────────────────────────────────────────────────────
        // 4. Ensure user's lastActiveCafeId is set
        // ─────────────────────────────────────────────────────────
        const userData = userDoc.data();
        if (!userData.lastActiveCafeId) {
            await userRef.update({
                lastActiveCafeId: cafeRef.id
            });
        }

        // ─────────────────────────────────────────────────────────
        // 5. Return fresh user data
        // ─────────────────────────────────────────────────────────
        const updatedDoc = await userRef.get();

        res.json({
            success: true,
            data: {
                uid: decoded.uid,
                ...updatedDoc.data(),
                isNew
            }
        });

    } catch (err) {
        console.error('Sync error:', err);
        next(err);
    }
});

router.get('/me', authenticate, (req, res) => {
    res.json({
        success: true,
        data: req.user
    });
});

module.exports = router;
