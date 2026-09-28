const express = require('express');
const { authenticate } = require('../middleware/auth');
const universitiesRepo = require('../repositories/universitiesRepo');
const cafesRepo = require('../repositories/cafesRepo');
const db = require('../config/db');

const router = express.Router();
router.use(authenticate);

// List universities with café counts
router.get('/', async (req, res, next) => {
    try {
        const universities = await universitiesRepo.list(req.user.uid);

        const enriched = await Promise.all(universities.map(async u => {
            const cafes = await cafesRepo.list(req.user.uid, u.id);
            return { ...u, cafeCount: cafes.length };
        }));

        res.json({ success: true, data: enriched });
    } catch (err) { next(err); }
});

// Create university
router.post('/', async (req, res, next) => {
    try {
        const { name, code, country, timezone, currency, icon, address } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Name required' });

        const university = await universitiesRepo.create(req.user.uid, {
            name, code, country, timezone, currency, icon, address
        });

        db.logAudit({ uid: req.user.uid, universityId: university.id, action: 'university_created' });

        res.status(201).json({ success: true, data: university });
    } catch (err) { next(err); }
});

// Update university
router.put('/:id', async (req, res, next) => {
    try {
        const owned = await universitiesRepo.ownsUniversity(req.user.uid, req.params.id);
        if (!owned) return res.status(404).json({ success: false, error: 'Not found' });

        const updated = await universitiesRepo.update(req.user.uid, req.params.id, req.body);
        res.json({ success: true, data: updated });
    } catch (err) { next(err); }
});

// Delete university
router.delete('/:id', async (req, res, next) => {
    try {
        const universities = await universitiesRepo.list(req.user.uid);
        if (universities.length <= 1) {
            return res.status(400).json({ success: false, error: 'Cannot delete your only university' });
        }

        await universitiesRepo.remove(req.user.uid, req.params.id);
        res.json({ success: true, message: 'University deleted' });
    } catch (err) { next(err); }
});

// List cafés within a university
router.get('/:id/cafes', async (req, res, next) => {
    try {
        const owned = await universitiesRepo.ownsUniversity(req.user.uid, req.params.id);
        if (!owned) return res.status(404).json({ success: false, error: 'Not found' });

        const cafes = await cafesRepo.list(req.user.uid, req.params.id);
        res.json({ success: true, data: cafes });
    } catch (err) { next(err); }
});

module.exports = router;
