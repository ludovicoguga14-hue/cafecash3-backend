
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { firestore, admin } = require('../firebase');
const db = require('../config/db');

const router = express.Router();

/**
 * POST /api/auth/sync
 * Firebase authentication + self-healing:
 * User → University → Café
 */
router.post('/sync', async (req, res, next) => {
    try {
        console.log('🔍 /auth/sync request received');
        console.log(
            '🔍 Admin project:',
            admin.app().options.projectId || 'NOT SET'
        );

        // 1. Check Authorization header
        const header = req.headers.authorization;

        if (!header) {
            console.warn('⚠️ Missing Authorization header');
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
            return res.status(401).json({
                success: false,
                error: 'Empty authentication token'
            });
        }

        // 2. Verify Firebase ID token
        let decoded;

        try {
            console.log('🔍 Checking Firebase token...');

            decoded = await admin.auth().verifyIdToken(token);

            console.log('✅ Firebase token verified');
            console.log('👤 UID:', decoded.uid);
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

        // 3. Read frontend data
        const {
            name,
            universityName,
            cafeteriaName,
            timezone,
            currency
        } = req.body || {};

        // 4. Get or create user
        const userRef = firestore.collection('users').doc(decoded.uid);

        console.log('🔍 Token verified. Checking Firestore access...');

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

            console.log('✅ User created');

            try {
                db.logAudit({
                    uid: decoded.uid,
                    action: 'user_created'
                });
            } catch (auditError) {
                console.warn('⚠️ Audit log failed:', auditError.message);
            }
        } else {
            console.log('✅ Existing user found');
        }

        // 5. Ensure university exists
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
            console.log('✅ Existing university:', universityRef.id);
        }

        // 6. Ensure café exists
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
            console.log('✅ Existing café:', cafeRef.id);
        }

        // 7. Set active café if none is selected
        const freshUserSnapshot = await userRef.get();
        const freshUser = freshUserSnapshot.data() || {};

        if (!freshUser.lastActiveCafeId) {
            await userRef.update({
                lastActiveCafeId: cafeRef.id
            });

            console.log('✅ Active café set:', cafeRef.id);
        }

        // 8. Get final user document
        const finalSnapshot = await userRef.get();
        const finalUser = finalSnapshot.data() || {};

        // 9. Success
        console.log('✅ CafeCash authentication sync complete');

        return res.json({
            success: true,
            data: {
                uid: decoded.uid,
                ...finalUser,
                isNew
            }
        });

    } catch (err) {
        console.error('❌ Auth sync server error');
        console.error('❌ Error code:', err.code || 'UNKNOWN');
        console.error('❌ Error message:', err.message || 'Unknown error');
        console.error('❌ Stack:', err.stack);

        next(err);
    }
});

/**
 * GET /api/auth/me
 */
router.get('/me', authenticate, (req, res) => {
    return res.json({
        success: true,
        data: req.user
    });
});

module.exports = router;
```
