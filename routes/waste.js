const express = require('express');
const { authenticate, requireCafe } = require('../middleware/auth');
const wasteRepo = require('../repositories/wasteRepo');
const itemsRepo = require('../repositories/itemsRepo');
const { todayForCafe, daysAgoForCafe } = require('../utils/time');

const router = express.Router();
router.use(authenticate, requireCafe);

router.get('/', async (req, res, next) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const from = daysAgoForCafe(req.user.activeCafe, days);
        const rows = await wasteRepo.list(
            req.user.uid, req.user.universityId, req.user.cafeId, { from }
        );
        res.json({ success: true, data: rows });
    } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
    try {
        const { item_id, qty, cost, reason, date } = req.body;
        const quantity = Number(qty);
        if (!quantity || quantity <= 0) {
            return res.status(400).json({ success: false, error: 'Quantity must be > 0' });
        }

        let itemName = 'Unknown';
        let itemCost = Number(cost) || 0;

        if (item_id) {
            const item = await itemsRepo.get(
                req.user.uid, req.user.universityId, req.user.cafeId, item_id
            );
            if (item) {
                itemName = item.name;
                if (!itemCost) itemCost = (item.cost || 0) * quantity;
                await itemsRepo.update(
                    req.user.uid, req.user.universityId, req.user.cafeId, item_id,
                    { qty: Math.max(0, (item.qty || 0) - quantity) }
                );
            }
        }

        const entry = await wasteRepo.create(
            req.user.uid, req.user.universityId, req.user.cafeId,
            {
                itemId: item_id || null,
                itemName,
                qty: quantity,
                cost: itemCost,
                reason: reason || 'expired',
                date: date || todayForCafe(req.user.activeCafe)
            }
        );

        res.status(201).json({ success: true, data: entry });
    } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
    try {
        await wasteRepo.remove(
            req.user.uid, req.user.universityId, req.user.cafeId, req.params.id
        );
        res.json({ success: true, message: 'Deleted' });
    } catch (err) { next(err); }
});

router.get('/summary', async (req, res, next) => {
    try {
        const from = daysAgoForCafe(req.user.activeCafe, 30);
        const to = todayForCafe(req.user.activeCafe);

        const waste = await wasteRepo.inRange(
            req.user.uid, req.user.universityId, req.user.cafeId, from, to
        );

        const byItem = {};
        waste.forEach(w => {
            const key = `${w.itemName}|${w.reason}`;
            if (!byItem[key]) byItem[key] = { name: w.itemName, reason: w.reason, qty: 0, cost: 0 };
            byItem[key].qty += w.qty || 0;
            byItem[key].cost += w.cost || 0;
        });

        res.json({
            success: true,
            data: {
                total: waste.reduce((s, w) => s + (w.cost || 0), 0),
                byItem: Object.values(byItem).sort((a, b) => b.cost - a.cost)
            }
        });
    } catch (err) { next(err); }
});

module.exports = router;
