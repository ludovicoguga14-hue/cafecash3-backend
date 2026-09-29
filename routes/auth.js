
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { firestore, admin } = require('../firebase');
const db = require('../config/db');

const router = express.Router();

/**
 * Sync Firebase user with CafeCash backend.
 * Creates the user profile + first university + first cafeteria
 * when the Firebase account is new.
 */
router.post('/sync', async (req, res) => {
    try {
        console.log('========================================');
        console.log('AUTH SYNC REQUEST');
        console.log('Origin:', req.headers.origin || '(none)');
        console.log('Authorization header:', req.headers.authorization ? 'PRESENT' : 'MISSING');
        console.log('========================================');

        const header = req.headers.authorization;

        if (!header || !header.startsWith('Bearer ')) {
            console.error('AUTH SYNC ERROR: No Bearer token');
            return res.status(401).json({
                success: false,
                error: 'No token provided'
            });
        }

        const idToken = header.slice(7).trim();

        if (!idToken) {
            console.error('AUTH SYNC ERROR: Empty token');
            return res.status(401).json({
                success: false,
                error: 'Empty authentication token'
            });
        }

        console.log('Verifying Firebase ID token...');

        const decoded = await admin.auth().verifyIdToken(idToken);

        console.log('AUTH SYNC TOKEN VERIFIED');
        console.log('Firebase UID:', decoded.uid);
        console.log('Firebase email:', decoded.email || '(none)');
        console.log('Token audience:', decoded.aud);
        console.log('Token issuer:', decoded.iss);

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

            console.log('Creating new CafeCash user:', decoded.uid);

            // Create user profile
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

            console.log('User profile created');

            // Create first university
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

            console.log('University created:', uniRef.id);

            // Create first cafeteria
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

            console.log('Cafeteria created:', cafeRef.id);

            await userRef.update({
                lastActiveCafeId: cafeRef.id
            });

            console.log('Active cafeteria saved');

            // Audit logging should not prevent account creation
            try {
                if (db && typeof db.logAudit === 'function') {
                    db.logAudit({
                        uid: decoded.uid,
                        action: 'user_created'
                    });
                }
            } catch (auditErr) {
                console.warn(
                    'Audit log failed:',
                    auditErr.message
                );
            }

            console.log('New CafeCash account setup complete');
        } else {
            console.log('Existing CafeCash user:', decoded.uid);
        }

        const updatedDoc = await userRef.get();

        if (!updatedDoc.exists) {
            throw new Error(
                'User profile could not be loaded after synchronization'
            );
        }

        const userData = {
            uid: decoded.uid,
            ...updatedDoc.data(),
            isNew
        };

        console.log('AUTH SYNC SUCCESS');
        console.log('UID:', decoded.uid);
        console.log('New user:', isNew);
        console.log('========================================');

        return res.json({
            success: true,
            data: userData
        });

    } catch (err) {
        console.error('');
        console.error('════════════════════════════════════════');
        console.error('AUTH SYNC FAILED');
        console.error('Code:', err.code || '(none)');
        console.error('Name:', err.name || '(none)');
        console.error('Message:', err.message || '(none)');
        console.error('Stack:', err.stack || '(none)');
        console.error('════════════════════════════════════════');
        console.error('');

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


router.get('/me', authenticate, (req, res) => {
    res.json({
        success: true,
        data: req.user
    });
});


module.exports = router;
```
