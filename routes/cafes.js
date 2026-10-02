const express = require('express');
const { authenticate } = require('../middleware/auth');
const { firestore } = require('../firebase');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
    try {
        const unisSnap = await firestore
            .collection('users').doc(req.user.uid)
            .collection('universities').get();

        const cafes = [];
        for (const uDoc of unisSnap.docs) {
            const cafesSnap = await firestore
                .collection('users').doc(req.user.uid)
                .collection('universities').doc(uDoc.id)
                .collection('cafes').get();

            cafesSnap.forEach(cDoc => {
                cafes.push({
                    id: cDoc.id,
                    ...cDoc.data(),
                    universityId: uDoc.id,
                    universityName: uDoc.data().name
                });
            });
        }

        res.json({ success: true, data: cafes });
    } catch (err) { next(err); }
});

router.get('/active', async (req, res) => {
    if (req.user.activeCafe) {
        res.json({ success: true, data: req.user.activeCafe });
    } else {
        res.status(404).json({ success: false, error: 'No active café' });
    }
});

router.post('/:id/switch', async (req, res, next) => {
    try {
        await firestore.collection('users').doc(req.user.uid).update({
            lastActiveCafeId: req.params.id
        });
        res.json({ success: true, message: 'Switched' });
    } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
    try {
        const { universityId, name, type, campus, timezone, currency, icon } = req.body;
        if (!universityId || !name) {
            return res.status(400).json({ success: false, error: 'University and name required' });
        }

        const doc = await firestore
            .collection('users').doc(req.user.uid)
            .collection('universities').doc(universityId)
            .collection('cafes').add({
                name: name.trim(),
                type: type || 'cafeteria',
                campus: campus || null,
                timezone: timezone || 'Africa/Johannesburg',
                currency: currency || 'ZAR',
                icon: icon || '🍽️',
                isActive: false,
                createdAt: new Date()
            });

        const created = await doc.get();
        res.status(201).json({ success: true, data: { id: doc.id, ...created.data() } });
    } catch (err) { next(err); }
});

module.exports = router;
