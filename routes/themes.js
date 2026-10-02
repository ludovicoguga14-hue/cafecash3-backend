const express = require('express');
const { authenticate } = require('../middleware/auth');
const { firestore } = require('../firebase');

const router = express.Router();
router.use(authenticate);

const PREMIUM_THEMES = ['green-dark', 'green-light', 'blue-dark', 'blue-light', 'basic'];
const BASIC_THEMES = ['basic'];

function themeRef(uid) {
    return firestore.collection('users').doc(uid).collection('preferences').doc('current');
}

router.get('/available', async (req, res, next) => {
    try {
        const doc = await themeRef(req.user.uid).get();
        const theme = doc.data()?.theme || 'basic';
        const isPremium = req.user.plan === 'premium';

        res.json({
            success: true,
            data: {
                plan: req.user.plan,
                isPremium,
                themes: isPremium ? PREMIUM_THEMES : BASIC_THEMES,
                active: theme
            }
        });
    } catch (err) { next(err); }
});

router.put('/active', async (req, res, next) => {
    try {
        const { theme } = req.body;
        if (!theme) return res.status(400).json({ success: false, error: 'Theme required' });

        const allowed = req.user.plan === 'premium' ? PREMIUM_THEMES : BASIC_THEMES;
        if (!allowed.includes(theme)) {
            return res.status(403).json({
                success: false,
                error: 'Theme requires Premium',
                upgrade: true
            });
        }

        await themeRef(req.user.uid).set({ theme, updatedAt: new Date() }, { merge: true });
        res.json({ success: true, data: { theme } });
    } catch (err) { next(err); }
});

module.exports = router;
