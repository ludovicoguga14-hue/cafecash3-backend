const express = require('express');
const { authenticate, requireCafe } = require('../middleware/auth');
const salesRepo = require('../repositories/salesRepo');
const itemsRepo = require('../repositories/itemsRepo');
const wasteRepo = require('../repositories/wasteRepo');
const {
    aggregateSales, aggregateByItem, calcGrowth,
    calcTotalExpenses, calcProfit, calcInventoryValue, round2
} = require('../utils/calc');
const { todayForCafe, ranges } = require('../utils/time');
const { firestore } = require('../firebase');

const router = express.Router();
router.use(authenticate, requireCafe);

// ═══ ANALYTICS ═══
router.get('/analytics', async (req, res, next) => {
    try {
        const { uid, universityId, cafeId, activeCafe: cafe } = req.user;
        const r = ranges(cafe);
        const to = todayForCafe(cafe);

        const [sales, items, waste] = await Promise.all([
            salesRepo.salesInRange(uid, universityId, cafeId, r.month, to),
            itemsRepo.list(uid, universityId, cafeId),
            wasteRepo.inRange(uid, universityId, cafeId, r.month, to)
        ]);

        const totals = aggregateSales(sales);
        const byItem = aggregateByItem(sales)
            .sort((a, b) => b.revenue - a.revenue);

        const topItems = byItem.slice(0, 5);
        const worstItems = [...byItem].sort((a, b) => a.revenue - b.revenue).slice(0, 5);
        const topMargins = [...byItem].sort((a, b) => b.margin - a.margin).slice(0, 5);

        // Categories
        const catMap = {};
        items.forEach(i => {
            const cat = i.category || 'Other';
            if (!catMap[cat]) catMap[cat] = { category: cat, itemCount: 0, totalCost: 0, totalPrice: 0 };
            catMap[cat].itemCount++;
            catMap[cat].totalCost += i.cost || 0;
            catMap[cat].totalPrice += i.price || 0;
        });

        const categories = Object.values(catMap).map(c => ({
            ...c,
            avgCost: round2(c.totalCost / c.itemCount),
            avgPrice: round2(c.totalPrice / c.itemCount),
            avgMargin: c.totalPrice > 0
                ? round2(((c.totalPrice - c.totalCost) / c.totalPrice) * 100)
                : 0
        }));

        const totalWasteCost = waste.reduce((s, w) => s + (w.cost || 0), 0);

        res.json({
            success: true,
            data: {
                revenue: totals.revenue,
                profit: totals.profit,
                itemsSold: totals.units,
                orders: totals.orders,
                avgMargin: totals.revenue > 0 ? round2(totals.profit / totals.revenue * 100) : 0,
                topItems,
                worstItems,
                topMargins,
                categories,
                wasteCost: totalWasteCost,
                wasteRatio: totals.revenue > 0 ? round2(totalWasteCost / totals.revenue * 100) : 0
            }
        });
    } catch (err) { next(err); }
});

// ═══ EXPENSES ═══
router.get('/expenses', async (req, res, next) => {
    try {
        const ref = firestore.collection('users').doc(req.user.uid)
            .collection('universities').doc(req.user.universityId)
            .collection('cafes').doc(req.user.cafeId)
            .collection('expenses').doc('current');

        const doc = await ref.get();
        if (!doc.exists) {
            const defaults = {
                rent: 0, electricity: 0, wages: 0,
                marketing: 0, transport: 0, supplies: 0
            };
            await ref.set(defaults);
            return res.json({ success: true, data: defaults });
        }
        res.json({ success: true, data: doc.data() });
    } catch (err) { next(err); }
});

router.put('/expenses', async (req, res, next) => {
    try {
        const { rent, electricity, wages, marketing, transport, supplies } = req.body;
        const ref = firestore.collection('users').doc(req.user.uid)
            .collection('universities').doc(req.user.universityId)
            .collection('cafes').doc(req.user.cafeId)
            .collection('expenses').doc('current');

        const patch = {};
        if (rent != null) patch.rent = Number(rent);
        if (electricity != null) patch.electricity = Number(electricity);
        if (wages != null) patch.wages = Number(wages);
        if (marketing != null) patch.marketing = Number(marketing);
        if (transport != null) patch.transport = Number(transport);
        if (supplies != null) patch.supplies = Number(supplies);
        patch.updatedAt = new Date();

        await ref.set(patch, { merge: true });
        const doc = await ref.get();
        res.json({ success: true, data: doc.data() });
    } catch (err) { next(err); }
});

// ═══ MONTHLY REPORT ═══
router.get('/monthly', async (req, res, next) => {
    try {
        const { uid, universityId, cafeId, activeCafe: cafe } = req.user;
        const r = ranges(cafe);
        const to = todayForCafe(cafe);

        const [sales, items, waste, expensesDoc] = await Promise.all([
            salesRepo.salesInRange(uid, universityId, cafeId, r.month, to),
            itemsRepo.list(uid, universityId, cafeId),
            wasteRepo.inRange(uid, universityId, cafeId, r.month, to),
            firestore.collection('users').doc(uid)
                .collection('universities').doc(universityId)
                .collection('cafes').doc(cafeId)
                .collection('expenses').doc('current').get()
        ]);

        const totals = aggregateSales(sales);
        const expenses = expensesDoc.exists ? expensesDoc.data() : {};
        const totalExpenses = calcTotalExpenses(expenses);
        const profitCalc = calcProfit({
            revenue: totals.revenue,
            cogs: totals.cost,
            expenses: totalExpenses
        });

        const byItem = aggregateByItem(sales);
        const topProduct = byItem.sort((a, b) => b.revenue - a.revenue)[0] || null;
        const lowStock = items.filter(i => (i.qty || 0) <= (i.lowStockThreshold || 5));

        res.json({
            success: true,
            data: {
                period: { from: r.month, to },
                revenue: totals.revenue,
                expenses: totalExpenses,
                costOfGoods: totals.cost,
                grossProfit: profitCalc.grossProfit,
                netProfit: profitCalc.netProfit,
                grossMargin: profitCalc.grossMargin,
                netMargin: profitCalc.netMargin,
                orders: totals.orders,
                units: totals.units,
                topProduct,
                lowStock: lowStock.slice(0, 10),
                wasteCost: waste.reduce((s, w) => s + (w.cost || 0), 0),
                inventoryValue: calcInventoryValue(items)
            }
        });
    } catch (err) { next(err); }
});

// ═══ CSV EXPORT ═══
router.get('/export/sales.csv', async (req, res, next) => {
    try {
        const { uid, universityId, cafeId, activeCafe: cafe } = req.user;
        const r = ranges(cafe);
        const to = todayForCafe(cafe);

        const sales = await salesRepo.salesInRange(uid, universityId, cafeId, r.year, to);

        const headers = ['Date', 'Item', 'Qty', 'Subtotal', 'Discount', 'Revenue', 'Cost', 'Profit', 'Margin %'];
        const rows = sales.map(s => [
            s.date,
            `"${(s.itemName || '').replace(/"/g, '""')}"`,
            s.qty,
            (s.subtotal || 0).toFixed(2),
            (s.discount || 0).toFixed(2),
            (s.revenue || 0).toFixed(2),
            (s.cost || 0).toFixed(2),
            (s.profit || 0).toFixed(2),
            (s.margin || 0).toFixed(2)
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="sales-${Date.now()}.csv"`);
        res.send(csv);
    } catch (err) { next(err); }
});

module.exports = router;
