const express = require('express');
const { authenticate } = require('../middleware/auth');
const { firestore } = require('../firebase');
const db = require('../config/db');

const router = express.Router();

router.get('/plans', (req, res) => {
    res.json({
        success: true,
        data: [
            {
                id: 'basic',
                name: 'Basic',
                price: 0,
                currency: 'ZAR',
                features: [
                    'Up to 20 inventory items',
                    'Single cafeteria',
                    'Basic dashboard',
                    'Basic theme only',
                    'Community support'
                ]
            },
            {
                id: 'premium',
                name: 'Premium',
                price: 299,
                currency: 'ZAR',
                period: 'month',
                popular: true,
                features: [
                    'Unlimited inventory items',
                    'Multiple universities',
                    'Multiple cafeterias per university',
                    'All 5 premium themes',
                    'Advanced analytics',
                    'AI business assistant',
                    'CSV export',
                    'Priority support'
                ]
            }
        ]
    });
});

router.post('/upgrade', authenticate, async (req, res, next) => {
    try {
        // In production: create a Stripe checkout session here
        const expiresAt = new Date(Date.now() + 30 * 86400000);

        await firestore.collection('users').doc(req.user.uid).update({
            plan: 'premium',
            planExpiresAt: expiresAt,
            updatedAt: new Date()
        });

        db.prepare('INSERT INTO billing_events (uid, event_type, plan, amount_cents, currency) VALUES (?, ?, ?, ?, ?)')
            .run(req.user.uid, 'upgrade', 'premium', 29900, 'ZAR');

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

        await firestore.collection('users').doc(req.user.uid)
            .collection('preferences').doc('current')
            .set({ theme: 'basic' }, { merge: true });

        db.prepare('INSERT INTO billing_events (uid, event_type, plan) VALUES (?, ?, ?)')
            .run(req.user.uid, 'cancel', 'basic');

        res.json({ success: true, message: 'Downgraded to Basic' });
    } catch (err) { next(err); }
});

module.exports = router;
