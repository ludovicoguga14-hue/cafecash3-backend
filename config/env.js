/**
 * Environment validation — fails fast in production.
 * Accepts EITHER FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_PATH
 */

const REQUIRED_PROD = [
    'FIREBASE_PROJECT_ID',
    'CORS_ORIGIN',
    'JWT_SECRET'
];

const RECOMMENDED_PROD = [
    'OPENAI_API_KEY',
    'STRIPE_SECRET_KEY'
];

function validateEnv() {
    const isProd = process.env.NODE_ENV === 'production';

    // ─── Basic required vars ───
    const missing = REQUIRED_PROD.filter(k => !process.env[k]);

    // ─── Firebase credentials: accept EITHER method ───
    const hasFirebaseInline = !!process.env.FIREBASE_SERVICE_ACCOUNT;
    const hasFirebasePath = !!process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const hasFirebaseB64 = !!process.env.FIREBASE_SERVICE_ACCOUNT_B64;

    if (!hasFirebaseInline && !hasFirebasePath && !hasFirebaseB64) {
        missing.push('FIREBASE_SERVICE_ACCOUNT (or _PATH or _B64)');
    }

    if (isProd && missing.length) {
        console.error('');
        console.error('❌ FATAL: Missing required env vars in production:');
        missing.forEach(k => console.error('   • ' + k));
        console.error('');
        console.error('Refusing to start.');
        console.error('');
        process.exit(1);
    }

    if (!isProd && missing.length) {
        missing.forEach(k => console.warn('⚠️  ' + k + ' not set (dev mode OK)'));
    }

    // ─── JWT secret length check ───
    if (isProd && process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        console.error('❌ JWT_SECRET must be at least 32 characters in production');
        process.exit(1);
    }

    // ─── Recommendations ───
    const rec = RECOMMENDED_PROD.filter(k => !process.env[k]);
    if (isProd && rec.length) {
        console.warn('💡 Recommended env vars not set: ' + rec.join(', '));
    }

    // ─── Firebase credential method ───
    if (hasFirebaseB64) {
        console.log('✅ Env validated (' + (isProd ? 'production' : 'development') + ')');
        console.log('   Firebase: Base64 env var');
    } else if (hasFirebasePath) {
        console.log('✅ Env validated (' + (isProd ? 'production' : 'development') + ')');
        console.log('   Firebase: file path (' + process.env.FIREBASE_SERVICE_ACCOUNT_PATH + ')');
    } else if (hasFirebaseInline) {
        console.log('✅ Env validated (' + (isProd ? 'production' : 'development') + ')');
        console.log('   Firebase: inline JSON env var');
    }
}

module.exports = { validateEnv };
