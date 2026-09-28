const express = require('express');
const { authenticate } = require('../middleware/auth');
const { firestore } = require('../firebase');
const db = require('../config/db');

const router = express.Router();
router.use(authenticate);

router.put('/me', async (req, res, next) => {
    try {
        const { name, avatar, currency } = req.body;
        const patch = {};
        if (name) patch.name = name;
        if (avatar) patch.avatar = avatar;
        if (currency) patch.currency = currency;
        patch.updatedAt = new Date();

        await firestore.collection('users').doc(req.user.uid).update(patch);
        const doc = await firestore.collection('users').doc(req.user.uid).get();
        res.json({ success: true, data: { uid: req.user.uid, ...doc.data() } });
    } catch (err) { next(err); }
});

router.get('/activity', async (req, res, next) => {
    try {
        const rows = db.prepare(`
            SELECT action, resource, resource_id AS resourceId,
                   university_id AS universityId, cafe_id AS cafeId,
                   created_at AS createdAt
            FROM audit_log WHERE uid = ?
            ORDER BY created_at DESC LIMIT 50
        `).all(req.user.uid);

        res.json({ success: true, data: rows });
    } catch (err) { next(err); }
});

module.exports = router;
