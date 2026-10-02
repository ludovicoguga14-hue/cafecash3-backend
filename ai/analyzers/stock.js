const { fmt } = require('./sales');

function analyzeStock(ctx, params = {}) {
    const view = params.view || 'low';

    if (view === 'low') {
        const low = ctx.lowStock.slice(0, 8);
        return {
            title: 'Stock Alerts',
            summary: low.length
                ? `${low.length} item(s) need attention. ${low[0].name} lowest at ${low[0].qty}.`
                : 'All stock healthy. ✅',
            data: low.map(i => ({
                label: i.name,
                value: `${i.qty} left`,
                meta: `Threshold: ${i.lowStockThreshold || 5}`
            })),
            confidence: 'high'
        };
    }

    if (view === 'forecast') {
        const forecast = ctx.items.map(item => {
            const sold = ctx.topItems.find(t => t.name === item.name)?.units || 0;
            const dailyUse = sold / 30;
            const daysLeft = dailyUse > 0 ? Math.floor((item.qty || 0) / dailyUse) : null;
            return { ...item, dailyUse, daysLeft };
        })
        .filter(i => i.daysLeft !== null && i.daysLeft <= 14)
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, 8);

        return {
            title: 'Stock Forecast (14 days)',
            summary: forecast.length
                ? `${forecast[0].name} will run out in ~${forecast[0].daysLeft} day(s).`
                : 'No shortages predicted.',
            data: forecast.map(i => ({
                label: i.name,
                value: `${i.daysLeft} day(s) left`,
                meta: `~${i.dailyUse.toFixed(1)}/day · ${i.qty} in stock`
            })),
            confidence: 'medium'
        };
    }

    return { title: 'Stock', summary: 'Select a view.', data: [], confidence: 'low' };
}

module.exports = { analyzeStock };
