
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { firestore, admin } = require('../firebase');

const router = express.Router();

router.post('/sync', async (req, res) => {
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

        console.log('SYNC: verifying token');

        const decoded = await admin.auth().verifyIdToken(token);

        console.log('SYNC: token verified');
        console.log('SYNC: checking Firestore');

        const userRef = firestore.collection('users').doc(decoded.uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            await userRef.set({
                name: req.body?.name || decoded.name || 'User',
                email: decoded.email || '',
                plan: 'basic',
                planExpiresAt: null,
                avatar: '👤',
                currency: req.body?.currency || 'ZAR',
                role: 'manager',
                createdAt: new Date()
            });
        }

        const finalDoc = await userRef.get();

        console.log('SYNC: complete');

        return res.json({
            success: true,
            data: {
                uid: decoded.uid,
                ...finalDoc.data()
            }
        });
    } catch (err) {
        console.error('SYNC ERROR:', err.code || 'UNKNOWN', err.message);

        return res.status(500).json({
            success: false,
            error: err.message || 'Authentication sync failed',
            code: err.code || 'UNKNOWN'
        });
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
