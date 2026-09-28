function fmt(v, ctx) {
    const cur = ctx.cafe?.currency || 'ZAR';
    const sym = cur === 'ZAR' ? 'R' : cur === 'USD' ? '$' : cur === 'EUR' ? '€' : '£';
    return sym + Number(v || 0).toFixed(2);
}

function analyzeSales(ctx, params = {}) {
    const view = params.view || 'summary';
    const range = params.range || 'month';
    const days = { today: 1, week: 7, month: 30 }[range] || 30;

    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const trend = ctx.dailyTrend.filter(d => d.date >= cutoff);

    const revenue = trend.reduce((s, d) => s + (d.revenue || 0), 0);
    const profit = trend.reduce((s, d) => s + (d.profit || 0), 0);
    const units = trend.reduce((s, d) => s + (d.units || 0), 0);
    const avgDaily = revenue / (trend.length || 1);

    if (view === 'top') {
        const top = ctx.topItems.slice(0, 5);
        return {
            title: 'Top Selling Products',
            summary: top.length ? `${top[0].name} leads with ${fmt(top[0].revenue, ctx)}.` : 'No sales yet.',
            data: top.map(i => ({
                label: i.name,
                value: fmt(i.revenue, ctx),
                meta: `${i.units} sold · ${Number(i.margin).toFixed(1)}% margin`
            })),
            confidence: top.length > 3 ? 'high' : 'medium'
        };
    }

    if (view === 'worst') {
        const worst = ctx.worstItems.slice(0, 5);
        return {
            title: 'Lowest Performing',
            summary: worst.length ? `${worst[0].name} has the lowest margin.` : 'Nothing underperforming.',
            data: worst.map(i => ({
                label: i.name,
                value: `${Number(i.margin).toFixed(1)}% margin`,
                meta: `${i.units} sold`
            })),
            confidence: 'high'
        };
    }

    const rangeLabel = { today: 'today', week: 'this week', month: 'the last 30 days' }[range];
    return {
        title: `Sales — ${rangeLabel}`,
        summary: revenue > 0
            ? `You made ${fmt(revenue, ctx)} from ${units} units across ${trend.length} day(s). Profit: ${fmt(profit, ctx)}.`
            : `No sales ${rangeLabel}.`,
        data: [
            { label: 'Revenue', value: fmt(revenue, ctx) },
            { label: 'Profit', value: fmt(profit, ctx) },
            { label: 'Units sold', value: units.toLocaleString() },
            { label: 'Avg/day', value: fmt(avgDaily, ctx) }
        ],
        confidence: trend.length >= 7 ? 'high' : 'medium'
    };
}

module.exports = { analyzeSales, fmt };
