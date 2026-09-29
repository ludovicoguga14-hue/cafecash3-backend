
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { firestore, admin } = require('../firebase');
const db = require('../config/db');

const router = express.Router();

/**
 * Sync Firebase user with CafeCash backend.
 * Creates the user profile, university and cafeteria for a new user.
 */
router.post('/sync', async (req, res) => {
    try {
        const header = req.headers.authorization;

        if (!header || !header.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'No token provided'
            });
        }

        const idToken = header.slice(7).trim();

        if (!idToken) {
            return res.status(401).json({
                success: false,
                error: 'Empty authentication token'
            });
        }

        console.log('AUTH SYNC: verifying Firebase token...');

        const decoded = await admin.auth().verifyIdToken(idToken);

        console.log('AUTH SYNC: token verified');
        console.log('Firebase UID:', decoded.uid);
        console.log('Firebase email:', decoded.email || '(none)');
        console.log('Firebase project:', decoded.aud);

        const {
            name,
            universityName,
            cafeteriaName,
            timezone,
            currency
        } = req.body || {};

        const userRef = firestore
            .collection('users')
            .doc(decoded.uid);

        const userDoc = await userRef.get();

        let isNew = false;

        if (!userDoc.exists) {
            isNew = true;

            console.log('AUTH SYNC: creating new user...');

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

            console.log('AUTH SYNC: user created');

            const uniRef = await userRef
                .collection('universities')
                .add({
                    name: universityName || 'My University',
                    country: 'South Africa',
                    timezone: timezone || 'Africa/Johannesburg',
                    currency: currency || 'ZAR',
                    icon: '🎓',
                    createdAt: new Date()
                });

            console.log('AUTH SYNC: university created');

            const cafeRef = await uniRef
                .collection('cafes')
                .add({
                    name: cafeteriaName || 'Main Cafeteria',
                    type: 'cafeteria',
                    timezone: timezone || 'Africa/Johannesburg',
                    currency: currency || 'ZAR',
                    icon: '🍽️',
                    isActive: true,
                    createdAt: new Date()
                });

            console.log('AUTH SYNC: cafeteria created');

            await userRef.update({
                lastActiveCafeId: cafeRef.id
            });

            console.log('AUTH SYNC: active cafeteria saved');

            try {
                if (db && typeof db.logAudit === 'function') {
                    db.logAudit({
                        uid: decoded.uid,
                        action: 'user_created'
                    });
                }
            } catch (auditError) {
                console.warn(
                    'AUTH SYNC: audit log failed:',
                    auditError.message
                );
            }
        } else {
            console.log('AUTH SYNC: existing user');
        }

        const updatedDoc = await userRef.get();

        if (!updatedDoc.exists) {
            throw new Error(
                'User profile could not be loaded after synchronization'
            );
        }

        console.log('AUTH SYNC: SUCCESS');

        return res.json({
            success: true,
            data: {
                uid: decoded.uid,
                ...updatedDoc.data(),
                isNew
            }
        });

    } catch (err) {
        console.error('========================================');
        console.error('AUTH SYNC FAILED');
        console.error('Code:', err.code || '(none)');
        console.error('Name:', err.name || '(none)');
        console.error('Message:', err.message || '(none)');
        console.error('========================================');

        let status = 500;

        if (
            err.code === 'auth/id-token-expired' ||
            err.code === 'auth/invalid-id-token' ||
            err.code === 'auth/argument-error'
        ) {
            status = 401;
        }

        return res.status(status).json({
            success: false,
            error: err.message || 'Authentication synchronization failed',
            code: err.code || 'unknown'
        });
    }
});


/**
 * Return the currently authenticated CafeCash user.
 */
router.get('/me', authenticate, (req, res) => {
    return res.json({
        success: true,
        data: req.user
    });
});


module.exports = router;
```
