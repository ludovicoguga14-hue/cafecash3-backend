/**
 * Firebase Admin SDK — Robust multi-source initialization
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
    let source = 'none';

    // Method 1: Base64 env var
    if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
        try {
            const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64.trim();
            const json = Buffer.from(b64, 'base64').toString('utf8');
            serviceAccount = JSON.parse(json);
            source = 'Base64 env';
            console.log('   ✅ Decoded Base64 env var');
        } catch (err) {
            console.error('   ❌ Base64 decode failed: ' + err.message);
        }
    }

    // Method 2: File path
    if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
        try {
            const p = path.isAbsolute(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
                ? process.env.FIREBASE_SERVICE_ACCOUNT_PATH
                : path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH);

            if (fs.existsSync(p)) {
                serviceAccount = JSON.parse(fs.readFileSync(p, 'utf8'));
                source = 'file: ' + p;
                console.log('   ✅ Loaded from file');
            } else {
                console.error('   ❌ File not found: ' + p);
            }
        } catch (err) {
            console.error('   ❌ File load failed: ' + err.message);
        }
    }

    // Method 3: Inline JSON
    if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
            if (raw.startsWith('{')) {
                serviceAccount = JSON.parse(raw);
                source = 'inline JSON env';
                console.log('   ✅ Parsed inline JSON');
            }
        } catch (err) {
            console.error('   ❌ Inline JSON parse failed: ' + err.message);
        }
    }

    // Validate
    if (serviceAccount) {
        const required = ['type', 'project_id', 'private_key', 'client_email'];
        const missing = required.filter(f => !serviceAccount[f]);

        if (missing.length) {
            console.error('   ❌ Missing fields: ' + missing.join(', '));
            serviceAccount = null;
        } else {
            const key = serviceAccount.private_key;
            const keyOk = key.includes('BEGIN PRIVATE KEY') && key.includes('\n');

            console.log('   Project      : ' + serviceAccount.project_id);
            console.log('   Client email : ' + serviceAccount.client_email);
            console.log('   Key length   : ' + key.length);
            console.log('   Key valid    : ' + (keyOk ? '✅ yes' : '❌ no'));

            if (!keyOk) {
                console.error('   ❌ Private key is corrupted');
                serviceAccount = null;
            }
        }
    }

    // Initialize
    if (serviceAccount) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id
        });
        console.log('');
        console.log('🔥 ✅ Firebase Admin initialized');
        console.log('🔥    Source : ' + source);
        console.log('🔥    Project: ' + (process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id));
        console.log('🔥 ═══════════════════════════════════════════════════════');
        console.log('');
    } else {
        try {
            admin.initializeApp({
                credential: admin.credential.applicationDefault(),
                projectId: process.env.FIREBASE_PROJECT_ID
            });
            console.log('🔥 ⚠️  Firebase Admin initialized (ADC fallback)');
            if (isProd) {
                console.error('❌ FATAL: Cannot start in production without credentials');
                process.exit(1);
            }
        } catch (err) {
            console.error('❌ Firebase Admin init failed: ' + err.message);
            if (isProd) process.exit(1);
        }
    }
}

const firestore = admin.firestore();
firestore.settings({ ignoreUndefinedProperties: true });

module.exports = {
    admin: admin,
    firestore: firestore,
    auth: admin.auth()
};
