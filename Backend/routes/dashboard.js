const express = require('express');
const { authenticate, requireCafe } = require('../middleware/auth');
const salesRepo = require('../repositories/salesRepo');
const itemsRepo = require('../repositories/itemsRepo');
const wasteRepo = require('../repositories/wasteRepo');
const {
    aggregateSales, aggregateByItem, calcGrowth,
    calcTotalExpenses, calcProfit, calcInventoryValue,
    isLowStock
} = require('../utils/calc');
const { todayForCafe, daysAgoForCafe, ranges } = require('../utils/time');
const { firestore } = require('../firebase');

const router = express.Router();
router.use(authenticate, requireCafe);

// ═══ MAIN DASHBOARD ═══
router.get('/', async (req, res, next) => {
    try {
        const { uid, universityId, cafeId, activeCafe: cafe } = req.user;
        const r = ranges(cafe);
        const today = todayForCafe(cafe);

        // ── INPUT ──
        const [sales30, sales7, salesPrev7, items, waste30, expensesDoc] = await Promise.all([
            salesRepo.salesInRange(uid, universityId, cafeId, r.month, today),
            salesRepo.salesInRange(uid, universityId, cafeId, r.week, today),
            salesRepo.salesInRange(uid, universityId, cafeId, r.twoWeeks, r.week),
            itemsRepo.list(uid, universityId, cafeId),
            wasteRepo.inRange(uid, universityId, cafeId, r.month, today),
            firestore.collection('users').doc(uid)
                .collection('universities').doc(universityId)
                .collection('cafes').doc(cafeId)
                .collection('expenses').doc('current').get()
        ]);

        // ── PROCESSING ──
        const totals = aggregateSales(sales30);
        const weekly = aggregateSales(sales7);
        const prevWeekly = aggregateSales(salesPrev7);

        const revenueGrowth = calcGrowth(weekly.revenue, prevWeekly.revenue);
        const profitGrowth = calcGrowth(weekly.profit, prevWeekly.profit);
        const orderGrowth = calcGrowth(weekly.orders, prevWeekly.orders);

        const expenses = expensesDoc.exists ? expensesDoc.data() : {};
        const totalExpenses = calcTotalExpenses(expenses);
        const profitCalc = calcProfit({
            revenue: totals.revenue,
            cogs: totals.cost,
            expenses: totalExpenses
        });

        const todaySales = sales30.filter(s => s.date === today);
        const todayTotals = aggregateSales(todaySales);

        const lowStock = items.filter(isLowStock);
        const inventoryValue = calcInventoryValue(items);
        const wasteCost = waste30.reduce((s, w) => s + (w.cost || 0), 0);

        const customers = new Set(sales30.map(s => s.customerId).filter(Boolean));

        // ── OUTPUT ──
        res.json({
            success: true,
            data: {
                // Headline numbers
                totalRevenue: totals.revenue,
                totalProfit: totals.profit,
                grossProfit: profitCalc.grossProfit,
                netProfit: profitCalc.netProfit,
                totalCost: totals.cost,
                totalExpenses,
                totalOrders: totals.orders,
                totalUnits: totals.units,
                totalItems: items.length,
                inventoryValue,
                customers: customers.size,
                wasteCost,

                // Today
                todayRevenue: todayTotals.revenue,
                todayOrders: todayTotals.orders,

                // Growth
                revenueGrowth,
                profitGrowth,
                orderGrowth,

                // Margins
                grossMargin: profitCalc.grossMargin,
                netMargin: profitCalc.netMargin,

                // Alerts
                lowStock: lowStock.slice(0, 5),
                lowStockCount: lowStock.length,

                // Recent activity
                recentActivity: sales30.slice(-5).reverse()
            }
        });
    } catch (err) { next(err); }
});

// ═══ CHART DATA ═══
router.get('/chart', async (req, res, next) => {
    try {
        const { uid, universityId, cafeId, activeCafe: cafe } = req.user;
        const range = req.query.range || '15d';
        const days = { '7d': 7, '15d': 15, '1m': 30, '1y': 365 }[range] || 15;

        const from = daysAgoForCafe(cafe, days);
        const to = todayForCafe(cafe);

        const sales = await salesRepo.salesInRange(uid, universityId, cafeId, from, to);

        // Group by date
        const map = {};
        sales.forEach(s => {
            map[s.date] = map[s.date] || { revenue: 0, profit: 0, orders: 0 };
            map[s.date].revenue += s.revenue || 0;
            map[s.date].profit += s.profit || 0;
            map[s.date].orders++;
        });

        const series = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
            series.push({
                date: d,
                revenue: map[d]?.revenue || 0,
                profit: map[d]?.profit || 0,
                orders: map[d]?.orders || 0
            });
        }

        res.json({ success: true, data: series });
    } catch (err) { next(err); }
});

module.exports = router;
