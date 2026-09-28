const { fmt } = require('./sales');

function analyzeProfit(ctx) {
    const top = ctx.topItems;
    if (!top.length) {
        return {
            title: 'Profit Analysis',
            summary: 'No sales yet.',
            data: [],
            confidence: 'low'
        };
    }

    const byMargin = [...top].sort((a, b) => (b.margin || 0) - (a.margin || 0));
    const best = byMargin[0];
    const worst = byMargin[byMargin.length - 1];
    const totalRevenue = top.reduce((s, i) => s + i.revenue, 0);
    const totalProfit = top.reduce((s, i) => s + i.profit, 0);
    const blended = totalRevenue > 0 ? (totalProfit / totalRevenue * 100) : 0;

    const traps = top.filter(i =>
        i.revenue > (totalRevenue / top.length) && i.margin < blended * 0.7
    );

    return {
        title: 'Profit Intelligence',
        summary: `Blended margin: ${blended.toFixed(1)}%. Best: ${best.name} (${Number(best.margin).toFixed(1)}%). Worst: ${worst.name} (${Number(worst.margin).toFixed(1)}%).`,
        data: [
            { label: '🏆 Best margin', value: `${best.name} — ${Number(best.margin).toFixed(1)}%`, meta: fmt(best.profit, ctx) },
            { label: '⚠️ Lowest margin', value: `${worst.name} — ${Number(worst.margin).toFixed(1)}%`, meta: fmt(worst.profit, ctx) },
            ...traps.slice(0, 3).map(t => ({
                label: '🔍 Watch',
                value: t.name,
                meta: `High revenue, only ${Number(t.margin).toFixed(1)}% margin`
            }))
        ],
        confidence: top.length >= 5 ? 'high' : 'medium'
    };
}

module.exports = { analyzeProfit };
