const express = require('express');
const { authenticate, requireCafe } = require('../middleware/auth');
const salesRepo = require('../repositories/salesRepo');
const itemsRepo = require('../repositories/itemsRepo');
const { calcSale } = require('../utils/calc');
const { todayForCafe } = require('../utils/time');
const db = require('../config/db');

const router = express.Router();
router.use(authenticate, requireCafe);

// ── LIST ──
router.get('/', async (req, res, next) => {
    try {
        const { limit, from, to } = req.query;
        const rows = await salesRepo.list(
            req.user.uid, req.user.universityId, req.user.cafeId,
            { limit: parseInt(limit) || 100, from, to }
        );
        res.json({ success: true, data: rows });
    } catch (err) { next(err); }
});

// ── RECORD SALE ──
router.post('/', async (req, res, next) => {
    try {
        const { item_id, qty, discount = 0, payment_method, customer_id, date } = req.body;
        const quantity = parseInt(qty);

        // ── INPUT validation ──
        if (!quantity || quantity <= 0)
            return res.status(400).json({ success: false, error: 'Quantity must be > 0' });

        const item = await itemsRepo.get(
            req.user.uid, req.user.universityId, req.user.cafeId, item_id
        );
        if (!item) return res.status(404).json({ success: false, error: 'Item not found' });
        if ((item.qty || 0) < quantity)
            return res.status(400).json({ success: false, error: `Only ${item.qty} left` });

        // ── PROCESSING ──
        const { subtotal, revenue, cost, profit, margin } = calcSale({
            price: item.price,
            cost: item.cost,
            qty: quantity,
            discount: Number(discount) || 0
        });

        const saleDate = date || todayForCafe(req.user.activeCafe);

        // ── OUTPUT ──
        const sale = await salesRepo.create(
            req.user.uid, req.user.universityId, req.user.cafeId,
            {
                itemId: item.id,
                itemName: item.name,
                qty: quantity,
                price: item.price,
                subtotal,
                discount: Number(discount) || 0,
                revenue,
                cost,
                profit,
                margin,
                paymentMethod: payment_method || 'cash',
                customerId: customer_id || null,
                date: saleDate
            }
        );

        await itemsRepo.decrementStock(
            req.user.uid, req.user.universityId, req.user.cafeId, item.id, quantity
        );

        db.logAudit({
            uid: req.user.uid,
            universityId: req.user.universityId,
            cafeId: req.user.cafeId,
            action: 'sale_recorded',
            resourceId: sale.id
        });

        res.status(201).json({ success: true, data: sale });
    } catch (err) { next(err); }
});

// ── DELETE SALE (restores stock) ──
router.delete('/:id', async (req, res, next) => {
    try {
        const sale = await salesRepo.remove(
            req.user.uid, req.user.universityId, req.user.cafeId, req.params.id
        );
        if (!sale) return res.status(404).json({ success: false, error: 'Not found' });

        if (sale.itemId) {
            await itemsRepo.incrementStock(
                req.user.uid, req.user.universityId, req.user.cafeId,
                sale.itemId, sale.qty
            );
        }

        res.json({ success: true, message: 'Sale deleted, stock restored' });
    } catch (err) { next(err); }
});

module.exports = router;
