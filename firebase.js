/**
 * ═══════════════════════════════════════════════════════════════════
 * Firebase Admin SDK — Robust multi-source initialization
 * ═══════════════════════════════════════════════════════════════════
 *
 * Loads credentials in this priority order:
 *   1. Base64 env var (FIREBASE_SERVICE_ACCOUNT_B64) — best for hosting
 *   2. File path (FIREBASE_SERVICE_ACCOUNT_PATH) — best for localhost
 *   3. Inline JSON (FIREBASE_SERVICE_ACCOUNT) — fallback
 *
 * Repairs mangled newlines in the private key (fixes 16 UNAUTHENTICATED).
 */
console.log('🔥🔥🔥 CAFECASH DEPLOY CHECK v1 - ' + new Date().toISOString());
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

    // ═══════════════════════════════════════════════════════════
    // Method 1: Base64 env var (BEST for hosting platforms)
    // ═══════════════════════════════════════════════════════════
    if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
        try {
            const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64.trim();
            const json = Buffer.from(b64, 'base64').toString('utf8');
            serviceAccount = JSON.parse(json);
            source = 'Base64 env';
            console.log('   ✅ Decoded Base64 env var (' + b64.length + ' chars)');
        } catch (err) {
            console.error('   ❌ Base64 decode failed: ' + err.message);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Method 2: File path
    // ═══════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════
    // Method 3: Inline JSON
    // ═══════════════════════════════════════════════════════════
    if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
            if (raw.startsWith('{')) {
                serviceAccount = JSON.parse(raw);
                source = 'inline JSON env';
                console.log('   ✅ Parsed inline JSON');
            } else {
                console.warn('   ⚠️  FIREBASE_SERVICE_ACCOUNT does not start with "{" — skipping');
            }
        } catch (err) {
            console.error('   ❌ Inline JSON parse failed: ' + err.message);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // CRITICAL FIX: Repair mangled newlines in the private key
    // This fixes the 16 UNAUTHENTICATED error on Render/hosting.
    // Git and hosting platforms often convert \n to real newlines,
    // breaking the PEM format that Google requires.
    // ═══════════════════════════════════════════════════════════
    if (serviceAccount && serviceAccount.private_key) {
        const originalKey = serviceAccount.private_key;

        serviceAccount.private_key = originalKey
            .replace(/\\n/g, '\n')   // literal \n (2 chars) → real newline
            .replace(/\r\n/g, '\n')  // Windows CRLF → Unix LF
            .trim() + '\n';          // ensure trailing newline for PEM

        if (originalKey !== serviceAccount.private_key) {
            console.log('   🔧 Repaired private key newlines');
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Validate the loaded credentials
    // ═══════════════════════════════════════════════════════════
    if (serviceAccount) {
        const required = ['type', 'project_id', 'private_key', 'client_email'];
        const missing = required.filter(f => !serviceAccount[f]);

        if (missing.length) {
            console.error('   ❌ Missing fields: ' + missing.join(', '));
            serviceAccount = null;
        } else {
            const key = serviceAccount.private_key;
            const hasBegin = key.includes('BEGIN PRIVATE KEY');
            const hasEnd = key.includes('END PRIVATE KEY');
            const hasNewlines = key.includes('\n');

            console.log('   Project      : ' + serviceAccount.project_id);
            console.log('   Client email : ' + serviceAccount.client_email);
            console.log('   Key length   : ' + key.length);
            console.log('   Key starts   : ' + JSON.stringify(key.substring(0, 40)));
            console.log('   Key valid    : ' + ((hasBegin && hasEnd && hasNewlines) ? '✅ yes' : '❌ no'));

            if (!hasBegin || !hasEnd || !hasNewlines) {
                console.error('   ❌ Private key is invalid — cannot use');
                serviceAccount = null;
            }

            // Warn on project ID casing mismatch
            if (process.env.FIREBASE_PROJECT_ID &&
                process.env.FIREBASE_PROJECT_ID !== serviceAccount.project_id) {
                console.warn('   ⚠️  Project ID mismatch:');
                console.warn('   ⚠️    env : ' + process.env.FIREBASE_PROJECT_ID);
                console.warn('   ⚠️    json: ' + serviceAccount.project_id);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Initialize Firebase Admin
    // ═══════════════════════════════════════════════════════════
    if (serviceAccount) {
        try {
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
        } catch (err) {
            console.error('');
            console.error('🔥 ❌ Firebase Admin init failed: ' + err.message);
            console.error('');
            if (isProd) {
                console.error('❌ FATAL: Cannot start without valid credentials');
                process.exit(1);
            }
        }
    } else {
        try {
            admin.initializeApp({
                credential: admin.credential.applicationDefault(),
                projectId: process.env.FIREBASE_PROJECT_ID
            });
            console.log('🔥 ⚠️  Firebase Admin initialized (ADC fallback)');
            console.warn('   ⚠️  Token verification will FAIL on Render');
            if (isProd) {
                console.error('❌ FATAL: No credentials in production');
                process.exit(1);
            }
        } catch (err) {
            console.error('❌ Firebase Admin init failed: ' + err.message);
            if (isProd) process.exit(1);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
// Export Firebase services
// ═══════════════════════════════════════════════════════════════════
const firestore = admin.firestore();
firestore.settings({ ignoreUndefinedProperties: true });

module.exports = {
    admin: admin,
    firestore: firestore,
    auth: admin.auth()
};
