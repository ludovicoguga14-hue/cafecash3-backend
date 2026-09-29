const REQUIRED_PROD = ['FIREBASE_PROJECT_ID', 'CORS_ORIGIN', 'JWT_SECRET'];
const RECOMMENDED_PROD = ['OPENAI_API_KEY', 'STRIPE_SECRET_KEY'];

function validateEnv() {
    const isProd = process.env.NODE_ENV === 'production';
    const missing = REQUIRED_PROD.filter(k => !process.env[k]);

    const hasB64 = !!process.env.FIREBASE_SERVICE_ACCOUNT_B64;
    const hasPath = !!process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const hasInline = !!process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!hasB64 && !hasPath && !hasInline) {
        missing.push('FIREBASE_SERVICE_ACCOUNT_B64 (or _PATH or _ACCOUNT)');
    }

    if (isProd && missing.length) {
        console.error('❌ FATAL: Missing env vars:');
        missing.forEach(k => console.error('   • ' + k));
        process.exit(1);
    }

    if (!isProd && missing.length) {
        missing.forEach(k => console.warn('⚠️  ' + k + ' not set (dev)'));
    }

    if (isProd && process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        console.error('❌ JWT_SECRET must be 32+ chars');
        process.exit(1);
    }

    const rec = RECOMMENDED_PROD.filter(k => !process.env[k]);
    if (isProd && rec.length) {
        console.warn('💡 Recommended: ' + rec.join(', '));
    }

    console.log('✅ Env validated (' + (isProd ? 'production' : 'development') + ')');
    if (hasB64) console.log('   Firebase: Base64 env var');
    else if (hasPath) console.log('   Firebase: file path');
    else if (hasInline) console.log('   Firebase: inline JSON');
}

module.exports = { validateEnv };
