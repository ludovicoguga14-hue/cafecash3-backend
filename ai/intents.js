const INTENTS = [
    { id: 'sales_today', patterns: [/how much.*(sell|sold|sales?).*today/i, /today.*(sales?|revenue)/i],
      analyzer: 'sales', params: { range: 'today' } },
    { id: 'sales_week', patterns: [/sales?.*(week)/i, /this week/i],
      analyzer: 'sales', params: { range: 'week' } },
    { id: 'sales_month', patterns: [/sales?.*(month|30 days)/i, /this month/i],
      analyzer: 'sales', params: { range: 'month' } },
    { id: 'top_products', patterns: [/best.?sell/i, /top.*(product|item|seller)/i, /most popular/i],
      analyzer: 'sales', params: { view: 'top' } },
    { id: 'worst_products', patterns: [/worst.?sell/i, /least popular/i],
      analyzer: 'sales', params: { view: 'worst' } },
    { id: 'low_stock', patterns: [/running low/i, /low.?stock/i, /out of stock/i, /reorder/i],
      analyzer: 'stock', params: { view: 'low' } },
    { id: 'stock_forecast', patterns: [/when.*(run out|deplete)/i, /predict.*stock/i, /forecast.*stock/i],
      analyzer: 'stock', params: { view: 'forecast' } },
    { id: 'waste_analysis', patterns: [/wast(e|ing)/i, /thrown away/i, /spoiled/i],
      analyzer: 'waste', params: {} },
    { id: 'profit_analysis', patterns: [/profit/i, /margin/i, /making money/i],
      analyzer: 'profit', params: {} },
    { id: 'production_plan', patterns: [/production/i, /what.*(prep|bake|make|produce).*tomorrow/i],
      analyzer: 'production', params: {} },
    { id: 'compare_cafes', patterns: [/compare.*(cafe|cafeterias?|location)/i, /which.*(cafe|cafeteria).*best/i],
      analyzer: 'multi_cafe', params: {} },
    { id: 'greeting', patterns: [/^(hi|hello|hey|good (morning|afternoon|evening))/i, /who are you/i],
      analyzer: 'greeting', params: {} },
    { id: 'help', patterns: [/help/i, /what can you do/i],
      analyzer: 'help', params: {} }
];

function detectIntent(message) {
    const text = String(message || '').trim();
    for (const intent of INTENTS) {
        if (intent.patterns.some(p => p.test(text))) return intent;
    }
    return { id: 'unknown', analyzer: 'fallback', params: {} };
}

module.exports = { detectIntent, INTENTS };
