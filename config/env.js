/**
 * Environment validation
 */
const REQUIRED_PROD = ['FIREBASE_PROJECT_ID', 'JWT_SECRET'];

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
        missing.forEach(k => console.warn('⚠️  ' + k + ' not set (dev mode OK)'));
    }

    console.log('✅ Env validated (' + (isProd ? 'production' : 'development') + ')');
    if (hasB64) console.log('   Firebase: Base64 env var');
    else if (hasPath) console.log('   Firebase: file path');
    else if (hasInline) console.log('   Firebase: inline JSON');
}

// ═══ CRITICAL: Export the function ═══
module.exports = { validateEnv };
