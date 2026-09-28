const { fmt } = require('./sales');

function analyzeWaste(ctx) {
    if (!ctx.waste.length) {
        return {
            title: 'Waste Analysis',
            summary: 'No waste logged. Excellent!',
            data: [],
            confidence: 'low'
        };
    }

    const totalCost = ctx.waste.reduce((s, w) => s + (w.cost || 0), 0);
    const worst = ctx.waste[0];

    return {
        title: 'Waste Intelligence',
        summary: `Lost ${fmt(totalCost, ctx)} to waste. Biggest: ${worst.name} (${fmt(worst.cost, ctx)}).`,
        data: ctx.waste.slice(0, 6).map(i => ({
            label: i.name,
            value: fmt(i.cost, ctx),
            meta: `${i.qty} units · ${i.reason}`
        })),
        confidence: 'high'
    };
}

module.exports = { analyzeWaste };
