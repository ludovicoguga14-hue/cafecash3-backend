function analyzeBakeryProduction(ctx) {
    const tomorrow = new Date(Date.now() + 86400000);
    const tomorrowDow = tomorrow.getDay();
    const dowNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const dowAvg = ctx.weekdayPattern.find(d => d.dow === tomorrowDow)?.avg_revenue || 0;
    const overall = ctx.weekdayPattern.reduce((s, d) => s + d.avg_revenue, 0) /
                    (ctx.weekdayPattern.length || 1);

    const weekendFactor = [0, 6].includes(tomorrowDow) ? 1.25 : 1.0;
    const dowFactor = overall > 0 ? (dowAvg / overall) : 1;

    const plan = ctx.topItems.slice(0, 10).map(item => {
        const dailyAvg = item.units / 30;
        const suggested = Math.ceil(dailyAvg * dowFactor * weekendFactor * 1.05);
        return {
            name: item.name,
            units: suggested,
            reason: `${dailyAvg.toFixed(1)}/day × ${dowFactor.toFixed(2)} × ${weekendFactor}`
        };
    });

    return {
        title: `🥐 Tomorrow's Baking Plan — ${dowNames[tomorrowDow]}`,
        summary: plan.length
            ? `Prepare ${plan.reduce((s, p) => s + p.units, 0)} units across ${plan.length} products.`
            : 'Not enough history.',
        data: plan,
        confidence: plan.length >= 5 ? 'high' : 'medium'
    };
}

function analyzeBakeryWaste(ctx) {
    if (!ctx.waste.length) {
        return { title: '🥐 Waste Analysis', summary: 'No waste logged.', confidence: 'low' };
    }
    const totalCost = ctx.waste.reduce((s, w) => s + (w.cost || 0), 0);
    const worst = ctx.waste[0];

    const insights = [];
    if (worst.reason === 'expired') {
        insights.push(`${worst.name} mostly wasted due to expiry — likely over-baking.`);
    }
    if (totalCost > 0 && ctx.totals.revenue > 0 && totalCost / ctx.totals.revenue > 0.05) {
        insights.push(`Waste is ${(totalCost / ctx.totals.revenue * 100).toFixed(1)}% of revenue (above 3-5% target).`);
    }

    return {
        title: '🥐 Bakery Waste Intelligence',
        summary: `Lost ${ctx.cafe?.currency === 'ZAR' ? 'R' : '$'}${totalCost.toFixed(2)}. ${insights[0] || ''}`,
        data: ctx.waste.slice(0, 5).map(w => ({
            label: w.name,
            value: `$${w.cost.toFixed(2)}`,
            meta: `${w.qty} units · ${w.reason}`
        })),
        insights,
        confidence: 'high'
    };
}

module.exports = { analyzeBakeryProduction, analyzeBakeryWaste };
