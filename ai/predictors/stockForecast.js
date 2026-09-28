const itemsRepo = require('../../repositories/itemsRepo');
const salesRepo = require('../../repositories/salesRepo');
const { daysAgoForCafe } = require('../../utils/time');

async function forecastStock(uid, cafe) {
    const from = daysAgoForCafe(cafe, 30);
    const to = new Date().toISOString().slice(0, 10);

    const [items, sales] = await Promise.all([
        itemsRepo.list(uid, cafe.universityId, cafe.id),
        salesRepo.salesInRange(uid, cafe.universityId, cafe.id, from, to)
    ]);

    const byItem = {};
    sales.forEach(s => {
        byItem[s.itemName] = byItem[s.itemName] || [];
        byItem[s.itemName].push(s.qty || 0);
    });

    return items.map(item => {
        const history = byItem[item.name] || [];
        const dailyUse = ewma(history);
        const daysLeft = dailyUse > 0 ? Math.floor((item.qty || 0) / dailyUse) : null;

        let status = 'healthy';
        if ((item.qty || 0) <= 0) status = 'out';
        else if (daysLeft !== null && daysLeft <= 2) status = 'critical';
        else if (daysLeft !== null && daysLeft <= 5) status = 'warning';

        return {
            id: item.id,
            name: item.name,
            qty: item.qty,
            dailyUse: Number(dailyUse.toFixed(2)),
            daysLeft,
            status
        };
    }).sort((a, b) => {
        if (a.daysLeft == null) return 1;
        if (b.daysLeft == null) return -1;
        return a.daysLeft - b.daysLeft;
    });
}

function ewma(values, alpha = 0.3) {
    if (!values.length) return 0;
    let v = values[0];
    for (let i = 1; i < values.length; i++) v = alpha * values[i] + (1 - alpha) * v;
    return v;
}

module.exports = { forecastStock };
