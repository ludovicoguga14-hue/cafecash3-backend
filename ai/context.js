const itemsRepo = require('../repositories/itemsRepo');
const salesRepo = require('../repositories/salesRepo');
const wasteRepo = require('../repositories/wasteRepo');
const cafesRepo = require('../repositories/cafesRepo');
const universitiesRepo = require('../repositories/universitiesRepo');
const {
    aggregateSales, aggregateByItem, calcInventoryValue,
    isLowStock, isExpiringSoon, calcTotalExpenses
} = require('../utils/calc');
const { ranges } = require('../utils/time');
const { firestore } = require('../firebase');

async function buildContext(uid, cafeId = null) {
    const cafes = await cafesRepo.listAll(uid);
    if (!cafes.length) return null;

    const activeCafe = cafeId
        ? cafes.find(c => c.id === cafeId)
        : (cafes.find(c => c.isActive) || cafes[0]);

    if (!activeCafe) return null;

    const universityId = activeCafe.universityId;
    const r = ranges(activeCafe);
    const to = new Date().toISOString().slice(0, 10);

    const [items, sales30, waste30, expensesDoc, universities] = await Promise.all([
        itemsRepo.list(uid, universityId, activeCafe.id),
        salesRepo.salesInRange(uid, universityId, activeCafe.id, r.month, to),
        wasteRepo.inRange(uid, universityId, activeCafe.id, r.month, to),
        firestore.collection('users').doc(uid)
            .collection('universities').doc(universityId)
            .collection('cafes').doc(activeCafe.id)
            .collection('expenses').doc('current').get(),
        universitiesRepo.list(uid)
    ]);

    const totals = aggregateSales(sales30);
    const byItem = aggregateByItem(sales30);

    const topItems = [...byItem].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    const worstItems = [...byItem].sort((a, b) => a.margin - b.margin).slice(0, 5);

    const lowStock = items.filter(isLowStock);
    const expiring = items.filter(i => isExpiringSoon(i, 7));

    const wasteMap = {};
    waste30.forEach(w => {
        const key = `${w.itemName}|${w.reason}`;
        if (!wasteMap[key]) wasteMap[key] = { name: w.itemName, reason: w.reason, qty: 0, cost: 0 };
        wasteMap[key].qty += w.qty || 0;
        wasteMap[key].cost += w.cost || 0;
    });
    const waste = Object.values(wasteMap).sort((a, b) => b.cost - a.cost).slice(0, 10);

    // Daily trend
    const dailyMap = {};
    sales30.forEach(s => {
        dailyMap[s.date] = dailyMap[s.date] || { revenue: 0, profit: 0, units: 0 };
        dailyMap[s.date].revenue += s.revenue || 0;
        dailyMap[s.date].profit += s.profit || 0;
        dailyMap[s.date].units += s.qty || 0;
    });
    const dailyTrend = Object.entries(dailyMap)
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date));

    // Weekday pattern
    const dowMap = {};
    dailyTrend.forEach(d => {
        const dow = new Date(d.date).getDay();
        if (!dowMap[dow]) dowMap[dow] = { sum: 0, count: 0 };
        dowMap[dow].sum += d.revenue;
        dowMap[dow].count++;
    });
    const weekdayPattern = Object.entries(dowMap).map(([dow, v]) => ({
        dow: Number(dow),
        avg_revenue: v.sum / v.count
    }));

    const expenses = expensesDoc.exists ? expensesDoc.data() : {};

    return {
        cafe: activeCafe,
        university: universities.find(u => u.id === universityId),
        universities,
        cafes,
        period: { days: 30, since: r.month },
        totals,
        topItems,
        worstItems,
        items,
        lowStock,
        expiring,
        waste,
        expenses,
        totalExpenses: calcTotalExpenses(expenses),
        inventoryValue: calcInventoryValue(items),
        dailyTrend,
        weekdayPattern,
        generatedAt: new Date().toISOString()
    };
}

module.exports = { buildContext };
