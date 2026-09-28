/**
 * Environment validation — fails fast in production.
 */
const REQUIRED_PROD = [
    'FIREBASE_SERVICE_ACCOUNT',
    'FIREBASE_PROJECT_ID',
    'CORS_ORIGIN',
    'JWT_SECRET'
];

const RECOMMENDED_PROD = ['OPENAI_API_KEY', 'STRIPE_SECRET_KEY'];

function validateEnv() {
    const isProd = process.env.NODE_ENV === 'production';
    const missing = REQUIRED_PROD.filter(k => !process.env[k]);

    if (isProd && missing.length) {
        console.error('\n❌ FATAL: Missing required env vars in production:');
        missing.forEach(k => console.error('   •', k));
        console.error('\nRefusing to start.\n');
        process.exit(1);
    }

    if (!isProd && missing.length) {
        missing.forEach(k => console.warn(`⚠️  ${k} not set (dev mode OK)`));
    }

    if (isProd && process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        console.error('❌ JWT_SECRET must be at least 32 characters in production');
        process.exit(1);
    }

    const rec = RECOMMENDED_PROD.filter(k => !process.env[k]);
    if (isProd && rec.length) {
        console.warn('💡 Recommended env vars not set:', rec.join(', '));
    }

    console.log(`✅ Env validated (${isProd ? 'production' : 'development'})`);
}

module.exports = { validateEnv };
