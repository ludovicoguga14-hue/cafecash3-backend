const express = require('express');
const { authenticate, requirePremium } = require('../middleware/auth');
const cafesRepo = require('../repositories/cafesRepo');
const universitiesRepo = require('../repositories/universitiesRepo');
const salesRepo = require('../repositories/salesRepo');
const wasteRepo = require('../repositories/wasteRepo');
const { daysAgoForCafe } = require('../utils/time');
const db = require('../config/db');

const router = express.Router();
router.use(authenticate);

// List all cafés across all universities
router.get('/', async (req, res, next) => {
    try {
        const cafes = await cafesRepo.listAll(req.user.uid);
        res.json({ success: true, data: cafes });
    } catch (err) { next(err); }
});

// Get active café
router.get('/active', async (req, res, next) => {
    try {
        if (!req.user.activeCafe) return res.status(404).json({ success: false, error: 'No café' });
        res.json({ success: true, data: req.user.activeCafe });
    } catch (err) { next(err); }
});

// Switch active café
router.post('/:id/switch', async (req, res, next) => {
    try {
        const cafe = await cafesRepo.ownsCafe(req.user.uid, req.params.id);
        if (!cafe) return res.status(404).json({ success: false, error: 'Café not found' });

        await cafesRepo.setActive(req.user.uid, cafe.id);

        db.logAudit({
            uid: req.user.uid,
            universityId: cafe.universityId,
            cafeId: cafe.id,
            action: 'cafe_switched'
        });

        res.json({ success: true, data: cafe });
    } catch (err) { next(err); }
});

// Create café (Premium)
router.post('/', async (req, res, next) => {
    try {
        const { universityId, name, type, campus, timezone, currency, icon, address } = req.body;

        if (!universityId) return res.status(400).json({ success: false, error: 'University required' });
        if (!name) return res.status(400).json({ success: false, error: 'Name required' });

        const ownedUni = await universitiesRepo.ownsUniversity(req.user.uid, universityId);
        if (!ownedUni) return res.status(404).json({ success: false, error: 'University not found' });

        const existing = await cafesRepo.listAll(req.user.uid);
        if (existing.length >= 1 && req.user.plan !== 'premium') {
            return res.status(403).json({
                success: false,
                error: 'Multiple cafeterias require Premium',
                upgrade: true
            });
        }

        const cafe = await cafesRepo.create(req.user.uid, universityId, {
            name, type, campus, timezone, currency, icon, address
        });

        db.logAudit({
            uid: req.user.uid,
            universityId,
            cafeId: cafe.id,
            action: 'cafe_created'
        });

        res.status(201).json({ success: true, data: cafe });
    } catch (err) { next(err); }
});

// Update café
router.put('/:id', async (req, res, next) => {
    try {
        const cafe = await cafesRepo.ownsCafe(req.user.uid, req.params.id);
        if (!cafe) return res.status(404).json({ success: false, error: 'Not found' });

        const updated = await cafesRepo.update(
            req.user.uid, cafe.universityId, req.params.id, req.body
        );
        res.json({ success: true, data: updated });
    } catch (err) { next(err); }
});

// Delete café
router.delete('/:id', async (req, res, next) => {
    try {
        const cafes = await cafesRepo.listAll(req.user.uid);
        if (cafes.length <= 1) {
            return res.status(400).json({ success: false, error: 'Cannot delete your only cafeteria' });
        }

        const target = cafes.find(c => c.id === req.params.id);
        if (!target) return res.status(404).json({ success: false, error: 'Not found' });

        await cafesRepo.remove(req.user.uid, target.universityId, req.params.id);

        if (target.isActive) {
            const remaining = cafes.filter(c => c.id !== req.params.id);
            if (remaining.length) await cafesRepo.setActive(req.user.uid, remaining[0].id);
        }

        res.json({ success: true, message: 'Cafeteria deleted' });
    } catch (err) { next(err); }
});

// Compare cafés (Premium)
router.get('/compare', requirePremium, async (req, res, next) => {
    try {
        const cafes = await cafesRepo.listAll(req.user.uid);

        const comparison = await Promise.all(cafes.map(async c => {
            const from = daysAgoForCafe(c, 7);
            const to = new Date().toISOString().slice(0, 10);

            const sales = await salesRepo.salesInRange(
                req.user.uid, c.universityId, c.id, from, to
            );
            const waste = await wasteRepo.inRange(
                req.user.uid, c.universityId, c.id, from, to
            );

            return {
                id: c.id,
                name: c.name,
                icon: c.icon,
                universityName: c.universityName,
                revenue: sales.reduce((s, x) => s + (x.revenue || 0), 0),
                profit: sales.reduce((s, x) => s + (x.profit || 0), 0),
                orders: sales.length,
                waste: waste.reduce((s, x) => s + (x.cost || 0), 0)
            };
        }));

        const best = [...comparison].sort((a, b) => b.revenue - a.revenue)[0];
        const worstWaste = [...comparison].sort((a, b) => b.waste - a.waste)[0];

        res.json({
            success: true,
            data: {
                cafes: comparison,
                best,
                worstWaste,
                summary: best
                    ? `${best.name} (${best.universityName}) leads with ${best.orders} orders. ${worstWaste.name} has highest waste.`
                    : 'Not enough data.'
            }
        });
    } catch (err) { next(err); }
});

module.exports = router;
