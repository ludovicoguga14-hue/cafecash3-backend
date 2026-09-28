function analyzeProduction(ctx) {
    const tomorrow = new Date(Date.now() + 86400000);
    const tomorrowDow = tomorrow.getDay();
    const dowNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const dowAvg = ctx.weekdayPattern.find(d => d.dow === tomorrowDow)?.avg_revenue || 0;
    const overall = ctx.weekdayPattern.reduce((s, d) => s + d.avg_revenue, 0) /
                    (ctx.weekdayPattern.length || 1);

    const multiplier = overall > 0 ? (dowAvg / overall) : 1;
    const weekendFactor = [0, 6].includes(tomorrowDow) ? 1.2 : 1.0;

    const plan = ctx.topItems.slice(0, 8).map(item => {
        const dailyAvg = item.units / 30;
        const suggested = Math.ceil(dailyAvg * multiplier * weekendFactor * 1.05);
        return {
            name: item.name,
            suggested,
            reason: `${dailyAvg.toFixed(1)}/day × ${multiplier.toFixed(2)} × ${weekendFactor}`
        };
    });

    return {
        title: `Suggested Production — ${dowNames[tomorrowDow]}`,
        summary: plan.length
            ? `Prepare ${plan.reduce((s, p) => s + p.suggested, 0)} units across ${plan.length} products.`
            : 'Not enough data.',
        data: plan,
        confidence: ctx.topItems.length >= 5 ? 'medium' : 'low'
    };
}

module.exports = { analyzeProduction };
