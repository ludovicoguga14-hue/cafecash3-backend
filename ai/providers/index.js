const local = require('./local');
const openai = require('./openai');

async function generate(args) {
    const useCloud = process.env.AI_PROVIDER === 'openai' && process.env.OPENAI_API_KEY;

    if (useCloud) {
        try {
            return await openai.generate(args);
        } catch (err) {
            console.warn('☁️ Cloud AI failed, falling back to local:', err.message);
        }
    }

    return local.generate(args);
}

module.exports = { generate, SYSTEM_PROMPT: openai.SYSTEM_PROMPT };
