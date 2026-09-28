const { detectIntent } = require('./intents');
const { buildContext } = require('./context');
const { getProfile, enhanceSystemPrompt } = require('./cafeProfiles');
const bakery = require('./analyzers/bakery');
const providers = require('./providers');
const db = require('../config/db');

async function ask({ uid, cafeId, message, history = [] }) {
    if (!message?.trim()) throw new Error('Empty message');

    const t0 = Date.now();
    const context = await buildContext(uid, cafeId);
    if (!context) throw new Error('No cafeteria available');

    const profile = getProfile(context.cafe?.type);
    const intent = detectIntent(message);

    let response;
    if (profile.label === 'Bakery' && intent.analyzer === 'production') {
        const r = bakery.analyzeBakeryProduction(context);
        response = {
            text: r.summary, title: r.title, data: r.data,
            confidence: r.confidence, provider: 'local-bakery'
        };
    } else if (profile.label === 'Bakery' && intent.analyzer === 'waste') {
        const r = bakery.analyzeBakeryWaste(context);
        response = {
            text: r.summary, title: r.title, data: r.data,
            insights: r.insights, confidence: r.confidence, provider: 'local-bakery'
        };
    } else {
        response = await providers.generate({
            intent, context, message, history,
            systemPrompt: enhanceSystemPrompt(providers.SYSTEM_PROMPT, context.cafe)
        });
    }

    const elapsed = Date.now() - t0;

    try {
        db.prepare(`INSERT INTO ai_queries (uid, cafe_id, message, intent, provider, response_ms)
                    VALUES (?, ?, ?, ?, ?, ?)`)
            .run(uid, context.cafe.id, message.slice(0, 500), intent.id, response.provider || 'local', elapsed);
    } catch {}

    return {
        intent: intent.id,
        analyzer: intent.analyzer,
        cafe: context.cafe.name,
        cafeType: profile.label,
        ...response,
        generatedAt: new Date().toISOString()
    };
}

module.exports = { ask };
