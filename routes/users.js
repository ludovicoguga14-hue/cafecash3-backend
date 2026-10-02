const express = require('express');
const { authenticate } = require('../middleware/auth');
const { firestore } = require('../firebase');

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

module.exports = router;
