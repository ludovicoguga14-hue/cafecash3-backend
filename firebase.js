/**
 * CafeCash — Firebase Admin SDK Initialization
 * Supports: Base64 env var (preferred), file path, inline JSON
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

if (!admin.apps.length) {
    console.log('');
    console.log('🔥 ═══════════════════════════════════════════════════════');
    console.log('🔥 Firebase Admin SDK — Initializing');
    console.log('🔥 ═══════════════════════════════════════════════════════');

    const isProd = process.env.NODE_ENV === 'production';
    let serviceAccount = null;
    let sourceUsed = 'none';

    // ═══ METHOD 1: Base64 env var (BEST for hosting) ═══
    if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
        try {
            const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64.trim();
            const json = Buffer.from(b64, 'base64').toString('utf8');
            serviceAccount = JSON.parse(json);
            sourceUsed = 'env (Base64)';
            console.log('   ✅ Decoded Base64 service account (' + b64.length + ' chars)');
        } catch (err) {
            console.error('   ❌ Base64 decode failed: ' + err.message);
        }
    }

    // ═══ METHOD 2: File path ═══
    if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
        try {
            const p = path.isAbsolute(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
                ? process.env.FIREBASE_SERVICE_ACCOUNT_PATH
                : path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
            serviceAccount = JSON.parse(fs.readFileSync(p, 'utf8'));
            sourceUsed = 'file (' + p + ')';
            console.log('   ✅ Loaded from file');
        } catch (err) {
            console.error('   ❌ File load failed: ' + err.message);
        }
    }

    // ═══ METHOD 3: Inline JSON ═══
    if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            sourceUsed = 'env (inline JSON)';
            console.log('   ✅ Parsed inline JSON');
        } catch (err) {
            console.error('   ❌ Inline JSON parse failed: ' + err.message);
        }
    }

    // ═══ Validate + Initialize ═══
    if (serviceAccount) {
        console.log('   Project ID    : ' + serviceAccount.project_id);
        console.log('   Client email  : ' + serviceAccount.client_email);

        const key = serviceAccount.private_key || '';
        console.log('   Key chars     : ' + key.length);
        console.log('   Key starts    : ' + key.substring(0, 27));
        console.log('   Key ends      : ' + key.substring(key.length - 25));
        console.log('   Has newlines  : ' + (key.includes('\n') ? 'yes' : 'NO — corrupted!'));

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id
        });

        console.log('');
        console.log('🔥 ✅ Firebase Admin initialized (service account)');
        console.log('🔥    Source: ' + sourceUsed);
        console.log('🔥    Project: ' + (process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id));
        console.log('🔥 ═══════════════════════════════════════════════════════');
        console.log('');
    } else {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: process.env.FIREBASE_PROJECT_ID
        });
        console.log('🔥 ⚠️  Firebase Admin initialized (ADC fallback)');
        if (isProd) {
            console.error('❌ FATAL: No credentials in production');
            process.exit(1);
        }
    }
}

const firestore = admin.firestore();
firestore.settings({ ignoreUndefinedProperties: true });

module.exports = {
    admin,
    firestore,
    auth: admin.auth()
};
