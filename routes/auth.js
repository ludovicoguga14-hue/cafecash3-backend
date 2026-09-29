/**
 * ═══════════════════════════════════════════════════════════════════
 * CafeCash — Auth Routes
 * ═══════════════════════════════════════════════════════════════════
 *
 * POST /api/auth/sync  → Create/repair user profile + café
 * GET  /api/auth/me    → Get current user
 *
 * Safe to call /sync on every login — repairs missing data.
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { firestore, admin } = require('../firebase');
const db = require('../config/db');

const router = express.Router();

/**
 * ═══════════════════════════════════════════════════════════════════
 * POST /api/auth/sync
 * ═══════════════════════════════════════════════════════════════════
 * Syncs the Firebase user with Firestore.
 * - Creates user profile if missing
 * - Creates default university if missing
 * - Creates default café if missing
 * - Ensures lastActiveCafeId is set
 */
router.post('/sync', async (req, res, next) => {
    try {
        // ─── 1. Verify Firebase ID token ───
        const header = req.headers.authorization;
        if (!header || !header.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'No token provided'
            });
        }

        let decoded;
        try {
            decoded = await admin.auth().verifyIdToken(header.slice(7));
        } catch (err) {
            console.error('❌ Token verification failed:', {
                code: err.code,
                message: err.message
            });
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired token: ' + err.message
            });
        }

        const { name, universityName, cafeteriaName, timezone, currency } = req.body || {};

        const userRef = firestore.collection('users').doc(decoded.uid);
        let userDoc = await userRef.get();

        let isNew = false;

        // ─── 2. Create user profile if missing ───
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

            console.log('✅ Created user profile:', decoded.uid);

            db.logAudit({
                uid: decoded.uid,
                action: 'user_created'
            });

            userDoc = await userRef.get();
        }

        // ─── 3. Ensure user has at least one university ───
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

            console.log('✅ Created university:', universityRef.id);

            db.logAudit({
                uid: decoded.uid,
                universityId: universityRef.id,
                action: 'university_created'
            });
        } else {
            universityRef = unisSnap.docs[0].ref;
        }

        // ─── 4. Ensure university has at least one café ───
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
                address: null,
                isActive: true,
                createdAt: new Date()
            });

            console.log('✅ Created café:', cafeRef.id);

            db.logAudit({
                uid: decoded.uid,
                universityId: universityRef.id,
                cafeId: cafeRef.id,
                action: 'cafe_created'
            });
        } else {
            cafeRef = cafesSnap.docs[0].ref;
        }

        // ─── 5. Ensure lastActiveCafeId is set ───
        const freshUserDoc = await userRef.get();
        const freshUser = freshUserDoc.data();

        if (!freshUser.lastActiveCafeId) {
            await userRef.update({ lastActiveCafeId: cafeRef.id });
            console.log('✅ Set lastActiveCafeId:', cafeRef.id);
        }

        // ─── 6. Return fresh user data ───
        const finalDoc = await userRef.get();

        res.json({
            success: true,
            data: {
                uid: decoded.uid,
                ...finalDoc.data(),
                isNew
            }
        });

    } catch (err) {
        console.error('❌ Sync error:', {
            message: err.message,
            stack: err.stack,
            uid: req.user ? req.user.uid : 'unknown'
        });
        next(err);
    }
});

/**
 * ═══════════════════════════════════════════════════════════════════
 * GET /api/auth/me
 * ═══════════════════════════════════════════════════════════════════
 */
router.get('/me', authenticate, (req, res) => {
    res.json({
        success: true,
        data: req.user
    });
});

module.exports = router;
