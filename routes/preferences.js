const express = require('express');
const { authenticate } = require('../middleware/auth');
const { firestore } = require('../firebase');

const router = express.Router();
router.use(authenticate);

const ALLOWED = [
    'text_size', 'high_contrast', 'reduced_motion', 'read_aloud',
    'keyboard_mode', 'dyslexic_font', 'large_targets', 'captions',
    'theme', 'accent', 'dashboard_layout', 'color_mode', 'visible_cards',
    'notif_low_stock', 'notif_daily_summary', 'notif_email', 'notif_push',
    'last_active_cafe_id', 'last_active_university_id'
];

function prefsRef(uid) {
    return firestore.collection('users').doc(uid).collection('preferences').doc('current');
}

router.get('/', async (req, res, next) => {
    try {
        const doc = await prefsRef(req.user.uid).get();
        if (!doc.exists) {
            const defaults = {
                text_size: 'normal',
                high_contrast: 0,
                reduced_motion: 0,
                read_aloud: 0,
                keyboard_mode: 0,
                dyslexic_font: 0,
                large_targets: 0,
                captions: 0,
                theme: 'basic',
                accent: 'green',
                dashboard_layout: 'comfortable',
                color_mode: 'system',
                visible_cards: ['sales', 'revenue', 'stock', 'orders', 'customers'],
                notif_low_stock: 1,
                notif_daily_summary: 0,
                notif_email: 0,
                notif_push: 1
            };
            await prefsRef(req.user.uid).set(defaults);
            return res.json({ success: true, data: defaults });
        }
        res.json({ success: true, data: doc.data() });
    } catch (err) { next(err); }
});

router.put('/', async (req, res, next) => {
    try {
        const patch = {};
        for (const k of ALLOWED) {
            if (k in req.body) patch[k] = req.body[k];
        }
        if (!Object.keys(patch).length) {
            return res.status(400).json({ success: false, error: 'No valid fields' });
        }
        patch.updatedAt = new Date();

        await prefsRef(req.user.uid).set(patch, { merge: true });
        const doc = await prefsRef(req.user.uid).get();
        res.json({ success: true, data: doc.data() });
    } catch (err) { next(err); }
});

router.post('/reset', async (req, res, next) => {
    try {
        await prefsRef(req.user.uid).delete();
        const doc = await prefsRef(req.user.uid).get();
        res.json({ success: true, data: doc.data() || {} });
    } catch (err) { next(err); }
});

module.exports = router;
