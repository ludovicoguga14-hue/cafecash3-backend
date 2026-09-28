const { analyzeSales } = require('../analyzers/sales');
const { analyzeStock } = require('../analyzers/stock');
const { analyzeProfit } = require('../analyzers/profit');
const { analyzeWaste } = require('../analyzers/waste');
const { analyzeProduction } = require('../analyzers/production');
const { getProfile } = require('../cafeProfiles');

async function generate({ intent, context, message }) {
    const { analyzer, params } = intent;
    const profile = getProfile(context.cafe?.type);

    let result;
    switch (analyzer) {
        case 'sales':      result = analyzeSales(context, params); break;
        case 'stock':      result = analyzeStock(context, params); break;
        case 'profit':     result = analyzeProfit(context); break;
        case 'waste':      result = analyzeWaste(context); break;
        case 'production': result = analyzeProduction(context); break;
        case 'greeting':   return greeting(context, profile);
        case 'help':       return helpMessage(profile);
        case 'multi_cafe': return multiCafe(context);
        default:
            return fallback(message, profile);
    }

    return {
        text: result.summary,
        title: result.title,
        data: result.data,
        insights: result.insights,
        confidence: result.confidence,
        provider: 'local'
    };
}

function greeting(ctx, profile) {
    return {
        text: `Hi! I'm Food Market SA AI — your ${profile.label} assistant for ${ctx.cafe?.name || 'your business'}. I can see ${ctx.items.length} products and ${ctx.totals.orders} sales. Ask me anything about sales, stock, profit, waste, or production.`,
        provider: 'local'
    };
}

function helpMessage(profile) {
    return {
        text: `Here's what I can help with:`,
        data: [
            { label: '💰 Sales', value: '"How much did I sell today?"' },
            { label: '📈 Products', value: '"What are my best sellers?"' },
            { label: '📦 Stock', value: '"What stock is running low?"' },
            { label: '🗑️ Waste', value: '"What am I wasting the most?"' },
            { label: '💵 Profit', value: '"Which products make the most profit?"' },
            { label: '🥐 Production', value: '"What should I prep tomorrow?"' }
        ],
        provider: 'local'
    };
}

function multiCafe(ctx) {
    if (ctx.cafes.length < 2) {
        return { text: 'You have one cafeteria. Add more in Premium to compare.', provider: 'local' };
    }
    return {
        text: `You have ${ctx.cafes.length} cafeterias across ${ctx.universities.length} university(ies). Ask me to compare them.`,
        data: ctx.cafes.map(c => ({ label: c.name, value: c.universityName || 'cafeteria' })),
        provider: 'local'
    };
}

function fallback(message, profile) {
    return {
        text: `I'm not sure how to answer "${message}". Try asking about sales, stock, profit, waste, or production. Type "help" for examples.`,
        provider: 'local'
    };
}

module.exports = { generate };
