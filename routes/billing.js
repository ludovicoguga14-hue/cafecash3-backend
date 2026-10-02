const express = require('express');
const { authenticate } = require('../middleware/auth');
const { firestore } = require('../firebase');

const router = express.Router();

router.get('/plans', (req, res) => {
    res.json({
        success: true,
        data: [
            { id: 'basic', name: 'Basic', price: 0, currency: 'ZAR' },
            { id: 'premium', name: 'Premium', price: 299, currency: 'ZAR', period: 'month' }
        ]
    });
});

router.post('/upgrade', authenticate, async (req, res, next) => {
    try {
        const expiresAt = new Date(Date.now() + 30 * 86400000);
        await firestore.collection('users').doc(req.user.uid).update({
            plan: 'premium',
            planExpiresAt: expiresAt,
            updatedAt: new Date()
        });
        const doc = await firestore.collection('users').doc(req.user.uid).get();
        res.json({ success: true, data: { uid: req.user.uid, ...doc.data() } });
    } catch (err) { next(err); }
});

router.post('/cancel', authenticate, async (req, res, next) => {
    try {
        await firestore.collection('users').doc(req.user.uid).update({
            plan: 'basic',
            planExpiresAt: null,
            updatedAt: new Date()
        });
        res.json({ success: true, message: 'Downgraded' });
    } catch (err) { next(err); }
});

module.exports = router;
