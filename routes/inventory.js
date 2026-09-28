const express = require('express');
const { authenticate, requireCafe } = require('../middleware/auth');
const itemsRepo = require('../repositories/itemsRepo');
const { calcInventoryValue, isLowStock, isExpiringSoon } = require('../utils/calc');
const db = require('../config/db');

const router = express.Router();
router.use(authenticate, requireCafe);

const FREE_ITEM_LIMIT = 20;

// ── LIST ──
router.get('/', async (req, res, next) => {
    try {
        const items = await itemsRepo.list(req.user.uid, req.user.universityId, req.user.cafeId);

        // Enrich with computed fields
        const enriched = items.map(i => ({
            ...i,
            isLowStock: isLowStock(i),
            isOutOfStock: (i.qty || 0) <= 0,
            isExpiringSoon: isExpiringSoon(i),
            stockValue: (i.cost || 0) * (i.qty || 0)
        }));

        const summary = {
            totalItems: items.length,
            lowStockCount: enriched.filter(i => i.isLowStock).length,
            outOfStockCount: enriched.filter(i => i.isOutOfStock).length,
            expiringCount: enriched.filter(i => i.isExpiringSoon).length,
            inventoryValue: calcInventoryValue(items)
        };

        res.json({ success: true, data: enriched, summary });
    } catch (err) { next(err); }
});

// ── GET ONE ──
router.get('/:id', async (req, res, next) => {
    try {
        const item = await itemsRepo.get(req.user.uid, req.user.universityId, req.user.cafeId, req.params.id);
        if (!item) return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true, data: item });
    } catch (err) { next(err); }
});

// ── CREATE ──
router.post('/', async (req, res, next) => {
    try {
        const { name, sku, category, icon, cost, price, qty, low_stock_threshold, expiry_date } = req.body;

        // ── INPUT validation ──
        if (!name?.trim()) return res.status(400).json({ success: false, error: 'Name required' });
        if (Number(cost) < 0 || Number(price) < 0)
            return res.status(400).json({ success: false, error: 'Cost/price cannot be negative' });
        if (Number(cost) > Number(price))
            return res.status(400).json({ success: false, error: 'Selling price must be ≥ cost' });

        if (req.user.plan !== 'premium') {
            const count = await itemsRepo.count(req.user.uid, req.user.universityId, req.user.cafeId);
            if (count >= FREE_ITEM_LIMIT) {
                return res.status(403).json({
                    success: false,
                    error: `Free plan limited to ${FREE_ITEM_LIMIT} items`,
                    upgrade: true
                });
            }
        }

        // ── OUTPUT ──
        const item = await itemsRepo.create(req.user.uid, req.user.universityId, req.user.cafeId, {
            name: name.trim(),
            sku, category, icon,
            cost: Number(cost) || 0,
            price: Number(price) || 0,
            qty: parseInt(qty) || 0,
            lowStockThreshold: parseInt(low_stock_threshold) || 5,
            expiryDate: expiry_date || null
        });

        db.logAudit({
            uid: req.user.uid,
            universityId: req.user.universityId,
            cafeId: req.user.cafeId,
            action: 'item_created',
            resource: 'items',
            resourceId: item.id,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(201).json({ success: true, data: item });
    } catch (err) { next(err); }
});

// ── UPDATE ──
router.put('/:id', async (req, res, next) => {
    try {
        const updated = await itemsRepo.update(
            req.user.uid, req.user.universityId, req.user.cafeId,
            req.params.id, req.body
        );
        res.json({ success: true, data: updated });
    } catch (err) { next(err); }
});

// ── DELETE ──
router.delete('/:id', async (req, res, next) => {
    try {
        await itemsRepo.remove(req.user.uid, req.user.universityId, req.user.cafeId, req.params.id);
        db.logAudit({
            uid: req.user.uid,
            universityId: req.user.universityId,
            cafeId: req.user.cafeId,
            action: 'item_deleted',
            resourceId: req.params.id
        });
        res.json({ success: true, message: 'Item deleted' });
    } catch (err) { next(err); }
});

module.exports = router;
