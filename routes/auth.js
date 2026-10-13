const express = require('express');
const { authenticate } = require('../middleware/auth');
const { firestore, admin } = require('../firebase');
const db = require('../config/db');

const router = express.Router();

/**
 * POST /api/auth/sync
 *
 * Firebase authentication + self-healing:
 * User → University → Café
 */
router.post('/sync', async (req, res, next) => {
    try {
        // ---------------------------------------------------------
        // 1. Get Authorization header
        // ---------------------------------------------------------
        const header = req.headers.authorization;

        if (!header) {
            console.warn('⚠️ /auth/sync called without Authorization header');

            return res.status(401).json({
                success: false,
                error: 'No authentication token provided'
            });
        }

        if (!header.startsWith('Bearer ')) {
            console.warn('⚠️ Invalid Authorization header format');

            return res.status(401).json({
                success: false,
                error: 'Invalid authentication header format'
            });
        }

        const token = header.slice(7).trim();

        if (!token) {
            console.warn('⚠️ Empty Firebase token');

            return res.status(401).json({
                success: false,
                error: 'Empty authentication token'
            });
        }

        // ---------------------------------------------------------
        // 2. Verify Firebase ID token
        // ---------------------------------------------------------
        let decoded;

        try {
            decoded = await admin.auth().verifyIdToken(token);

            console.log('✅ Firebase token verified');
            console.log('👤 UID:', decoded.uid);
            console.log('📧 Email:', decoded.email || 'No email');

        } catch (err) {
            console.error('❌ Firebase token verification failed');
            console.error('❌ Error code:', err.code || 'UNKNOWN');
            console.error('❌ Error message:', err.message || 'Unknown error');

            return res.status(401).json({
                success: false,
                error: 'Firebase authentication failed',
                code: err.code || 'UNKNOWN_AUTH_ERROR',
                message: err.message || 'Invalid Firebase authentication token'
            });
        }

        // ---------------------------------------------------------
        // 3. Get information sent by frontend
        // ---------------------------------------------------------
        const {
            name,
            universityName,
            cafeteriaName,
            timezone,
            currency
        } = req.body || {};

        // ---------------------------------------------------------
        // 4. Get/create user
        // ---------------------------------------------------------
        const userRef = firestore
            .collection('users')
            .doc(decoded.uid);

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

            // Audit logging should never break authentication
            try {
                db.logAudit({
                    uid: decoded.uid,
                    action: 'user_created'
                });
            } catch (auditError) {
                console.warn(
                    '⚠️ Audit log failed:',
                    auditError.message
                );
            }
        } else {
            console.log('✅ Existing user:', decoded.uid);
        }

        // ---------------------------------------------------------
        // 5. Ensure university exists
        // ---------------------------------------------------------
        const unisSnap = await userRef
            .collection('universities')
            .limit(1)
            .get();

        let universityRef;

        if (unisSnap.empty) {
            universityRef = await userRef
                .collection('universities')
                .add({
                    name: universityName || 'My University',
                    country: 'South Africa',
                    timezone: timezone || 'Africa/Johannesburg',
                    currency: currency || 'ZAR',
                    icon: '🎓',
                    createdAt: new Date()
                });

            console.log('✅ University created:', universityRef.id);

        } else {
            universityRef = unisSnap.docs[0].ref;

            console.log(
                '✅ Existing university:',
                universityRef.id
            );
        }

        // ---------------------------------------------------------
        // 6. Ensure café exists
        // ---------------------------------------------------------
        const cafesSnap = await universityRef
            .collection('cafes')
            .limit(1)
            .get();

        let cafeRef;

        if (cafesSnap.empty) {
            cafeRef = await universityRef
                .collection('cafes')
                .add({
                    name: cafeteriaName || 'Main Cafeteria',
                    type: 'cafeteria',
                    campus: null,
                    timezone: timezone || 'Africa/Johannesburg',
                    currency: currency || 'ZAR',
                    icon: '🍽️',
                    isActive: true,
                    createdAt: new Date()
                });

            console.log('✅ Café created:', cafeRef.id);

        } else {
            cafeRef = cafesSnap.docs[0].ref;

            console.log(
                '✅ Existing café:',
                cafeRef.id
            );
        }

        // ---------------------------------------------------------
        // 7. Set active café if one isn't already selected
        // ---------------------------------------------------------
        const freshUserSnapshot = await userRef.get();
        const freshUser = freshUserSnapshot.data() || {};

        if (!freshUser.lastActiveCafeId) {
            await userRef.update({
                lastActiveCafeId: cafeRef.id
            });

            console.log(
                '✅ Active café set:',
                cafeRef.id
            );
        } else {
            console.log(
                '✅ Existing active café:',
                freshUser.lastActiveCafeId
            );
        }

        // ---------------------------------------------------------
        // 8. Get final user document
        // ---------------------------------------------------------
        const finalSnapshot = await userRef.get();
        const finalUser = finalSnapshot.data() || {};

        // ---------------------------------------------------------
        // 9. Send successful response
        // ---------------------------------------------------------
        console.log('✅ CafeCash authentication sync complete');
        console.log('👤 UID:', decoded.uid);
        console.log('🏫 University:', universityRef.id);
        console.log('🍽️ Café:', cafeRef.id);

        return res.json({
            success: true,
            data: {
                uid: decoded.uid,
                ...finalUser,
                isNew
            }
        });

    } catch (err) {
        // ---------------------------------------------------------
        // 10. Unexpected server error
        // ---------------------------------------------------------
        console.error('❌ Auth sync server error');
        console.error('❌ Error:', err.message);
        console.error('❌ Stack:', err.stack);

        next(err);
    }
});


/**
 * GET /api/auth/me
 *
 * Returns the currently authenticated CafeCash user.
 */
router.get('/me', authenticate, (req, res) => {
    try {
        return res.json({
            success: true,
            data: req.user
        });

    } catch (err) {
        console.error('❌ /auth/me error:', err.message);

        return res.status(500).json({
            success: false,
            error: 'Unable to retrieve authenticated user'
        });
    }
});


module.exports = router;
