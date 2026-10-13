
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { firestore, admin } = require('../firebase');
const db = require('../config/db');

const router = express.Router();

router.post('/sync', async (req, res, next) => {
    try {
        console.log('SYNC: request received');
        console.log('SYNC: project:', admin.app().options.projectId);

        const header = req.headers.authorization;

        if (!header || !header.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Missing or invalid Authorization header'
            });
        }

        const token = header.slice(7).trim();

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Empty authentication token'
            });
        }

        let decoded;

        try {
            console.log('SYNC: verifying token');
            decoded = await admin.auth().verifyIdToken(token);
            console.log('SYNC: token verified');
        } catch (err) {
            console.error('SYNC TOKEN ERROR:', err.code, err.message);
            return res.status(401).json({
                success: false,
                error: 'Firebase authentication failed',
                code: err.code || 'UNKNOWN',
                message: err.message || 'Token verification failed'
            });
        }

        console.log('SYNC: checking Firestore');

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

            console.log('SYNC: user created');

            try {
                db.logAudit({
                    uid: decoded.uid,
                    action: 'user_created'
                });
            } catch (err) {
                console.warn('SYNC: audit log failed:', err.message);
            }
        }

        const universitiesRef = userRef.collection('universities');
        const universities = await universitiesRef.limit(1).get();

        let universityRef;

        if (universities.empty) {
            universityRef = await universitiesRef.add({
                name: universityName || 'My University',
                country: 'South Africa',
                timezone: timezone || 'Africa/Johannesburg',
                currency: currency || 'ZAR',
                icon: '🎓',
                createdAt: new Date()
            });
            console.log('SYNC: university created');
        } else {
            universityRef = universities.docs[0].ref;
        }

        const cafes = await universityRef
            .collection('cafes')
            .limit(1)
            .get();

        let cafeRef;

        if (cafes.empty) {
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
            console.log('SYNC: cafe created');
        } else {
            cafeRef = cafes.docs[0].ref;
        }

        const latestUser = await userRef.get();
        const userData = latestUser.data() || {};

        if (!userData.lastActiveCafeId) {
            await userRef.update({
                lastActiveCafeId: cafeRef.id
            });
        }

        const finalSnapshot = await userRef.get();
        const finalUser = finalSnapshot.data() || {};

        console.log('SYNC: complete');

        return res.json({
            success: true,
            data: {
                uid: decoded.uid,
                ...finalUser,
                isNew
            }
        });
    } catch (err) {
        console.error('SYNC SERVER ERROR:', err.code, err.message);
        return next(err);
    }
});

router.get('/me', authenticate, (req, res) => {
    return res.json({
        success: true,
        data: req.user
    });
});

module.exports = router;
```
