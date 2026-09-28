const SYSTEM_PROMPT = `You are Food Market SA AI, the embedded business assistant for a university cafeteria.
You receive real business data as JSON. Answer concisely using ONLY that data.
Never invent numbers. If data is missing, say so.
Speak in a friendly, owner-to-owner tone. Max 1-2 emojis per response.
Keep answers under 120 words unless asked for detail.`;

async function generate({ intent, context, message, history = [], systemPrompt }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    const messages = [
        { role: 'system', content: systemPrompt || SYSTEM_PROMPT },
        { role: 'system', content: 'Business data:\n' + JSON.stringify(compact(context)) },
        ...history.slice(-6),
        { role: 'user', content: message }
    ];

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages,
            temperature: 0.4,
            max_tokens: 500
        })
    });

    if (!res.ok) throw new Error('OpenAI error: ' + (await res.text()));

    const data = await res.json();
    return {
        text: data.choices?.[0]?.message?.content || 'No response.',
        provider: 'openai'
    };
}

function compact(ctx) {
    return {
        cafe: ctx.cafe,
        university: ctx.university,
        period: ctx.period,
        totals: ctx.totals,
        topItems: ctx.topItems.slice(0, 5),
        lowStock: ctx.lowStock.slice(0, 5),
        waste: ctx.waste.slice(0, 5),
        expenses: ctx.expenses
    };
}

module.exports = { generate, SYSTEM_PROMPT };
