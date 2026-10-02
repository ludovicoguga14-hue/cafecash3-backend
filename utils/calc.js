/**
 * Business calculations — the "Processing" layer of the IPO model.
 * Single source of truth for every number shown to the user.
 */

// ═══ Sales ═══
function calcSale({ price, cost, qty, discount = 0 }) {
    const subtotal = price * qty;
    const finalAmount = Math.max(0, subtotal - discount);
    const totalCost = cost * qty;
    const profit = finalAmount - totalCost;
    const margin = finalAmount > 0 ? (profit / finalAmount * 100) : 0;

    return {
        subtotal: round2(subtotal),
        discount: round2(discount),
        revenue: round2(finalAmount),
        cost: round2(totalCost),
        profit: round2(profit),
        margin: round2(margin)
    };
}

// ═══ Inventory ═══
function calcInventoryValue(items) {
    return round2(items.reduce((s, i) => s + (i.cost || 0) * (i.qty || 0), 0));
}

function calcPotentialRevenue(items) {
    return round2(items.reduce((s, i) => s + (i.price || 0) * (i.qty || 0), 0));
}

function isLowStock(item) {
    return (item.qty || 0) <= (item.lowStockThreshold || 5);
}

function isOutOfStock(item) {
    return (item.qty || 0) <= 0;
}

function isExpiringSoon(item, days = 7) {
    if (!item.expiryDate) return false;
    const cutoff = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    return item.expiryDate <= cutoff;
}

// ═══ Expenses ═══
const EXPENSE_KEYS = ['rent', 'electricity', 'wages', 'marketing', 'transport', 'supplies'];

function calcTotalExpenses(expenses) {
    if (!expenses) return 0;
    return round2(EXPENSE_KEYS.reduce((s, k) => s + (expenses[k] || 0), 0));
}

// ═══ Profit ═══
function calcProfit({ revenue, cogs = 0, expenses = 0 }) {
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - expenses;
    return {
        grossProfit: round2(grossProfit),
        netProfit: round2(netProfit),
        grossMargin: revenue > 0 ? round2((grossProfit / revenue) * 100) : 0,
        netMargin: revenue > 0 ? round2((netProfit / revenue) * 100) : 0
    };
}

// ═══ Growth ═══
function calcGrowth(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return round2(((current - previous) / previous) * 100);
}

// ═══ Aggregations ═══
function aggregateSales(sales) {
    return {
        revenue: round2(sales.reduce((s, x) => s + (x.revenue || 0), 0)),
        profit: round2(sales.reduce((s, x) => s + (x.profit || 0), 0)),
        cost: round2(sales.reduce((s, x) => s + (x.cost || 0), 0)),
        units: sales.reduce((s, x) => s + (x.qty || 0), 0),
        orders: sales.length
    };
}

function aggregateByItem(sales) {
    const map = {};
    sales.forEach(s => {
        const key = s.itemName;
        if (!map[key]) {
            map[key] = { name: key, units: 0, revenue: 0, profit: 0, margins: [] };
        }
        map[key].units += s.qty || 0;
        map[key].revenue += s.revenue || 0;
        map[key].profit += s.profit || 0;
        map[key].margins.push(s.margin || 0);
    });

    return Object.values(map).map(i => ({
        ...i,
        revenue: round2(i.revenue),
        profit: round2(i.profit),
        margin: round2(i.margins.reduce((s, m) => s + m, 0) / (i.margins.length || 1))
    }));
}

function round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

module.exports = {
    calcSale,
    calcInventoryValue,
    calcPotentialRevenue,
    isLowStock,
    isOutOfStock,
    isExpiringSoon,
    calcTotalExpenses,
    calcProfit,
    calcGrowth,
    aggregateSales,
    aggregateByItem,
    EXPENSE_KEYS,
    round2
};
