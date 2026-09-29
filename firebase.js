/**
 * ═══════════════════════════════════════════════════════════════════
 * CafeCash — Firebase Admin SDK Initialization
 * ═══════════════════════════════════════════════════════════════════
 *
 * Loads credentials in this priority order:
 *   1. FIREBASE_SERVICE_ACCOUNT env var (inline JSON — for Render/hosting)
 *   2. FIREBASE_SERVICE_ACCOUNT_PATH env var (file path — for localhost)
 *   3. ADC fallback (Application Default Credentials — dev only)
 *
 * The service account JSON contains the private key that lets the backend
 * verify Firebase ID tokens from the frontend.
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
    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    console.log('   NODE_ENV                     : ' + (process.env.NODE_ENV || '(not set)'));
    console.log('   FIREBASE_PROJECT_ID          : ' + (process.env.FIREBASE_PROJECT_ID || '(not set)'));
    console.log('   FIREBASE_SERVICE_ACCOUNT     : ' + (saJson ? 'set (' + saJson.length + ' chars)' : '(not set)'));
    console.log('   FIREBASE_SERVICE_ACCOUNT_PATH: ' + (saPath || '(not set)'));

    let serviceAccount = null;
    let sourceUsed = 'none';

    // ═══════════════════════════════════════════════════════════════
    // METHOD 1: Inline JSON env var (preferred on hosting platforms)
    // ═══════════════════════════════════════════════════════════════
    if (saJson) {
        try {
            const trimmed = saJson.trim();

            // Guard: if it starts with "{" it's JSON, otherwise probably a path mistakenly
            if (!trimmed.startsWith('{')) {
                console.warn('   ⚠️  FIREBASE_SERVICE_ACCOUNT does not look like JSON (missing leading "{")');
                console.warn('   ⚠️  Value preview: ' + trimmed.substring(0, 40));
            } else {
                serviceAccount = JSON.parse(trimmed);
                sourceUsed = 'env (inline JSON)';
                console.log('   ✅ Parsed JSON from FIREBASE_SERVICE_ACCOUNT env var');
            }
        } catch (err) {
            console.error('   ❌ Failed to parse FIREBASE_SERVICE_ACCOUNT: ' + err.message);
            console.error('   ⚠️  JSON must be on ONE line with no real line breaks.');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // METHOD 2: File path env var (preferred on localhost)
    // ═══════════════════════════════════════════════════════════════
    if (!serviceAccount && saPath) {
        try {
            const fullPath = path.isAbsolute(saPath)
                ? saPath
                : path.resolve(process.cwd(), saPath);

            console.log('   Resolving path: ' + fullPath);

            if (!fs.existsSync(fullPath)) {
                console.error('   ❌ File does NOT exist at: ' + fullPath);
            } else {
                const raw = fs.readFileSync(fullPath, 'utf8');
                serviceAccount = JSON.parse(raw);
                sourceUsed = 'file (' + fullPath + ')';
                console.log('   ✅ Loaded service account from file');
            }
        } catch (err) {
            console.error('   ❌ Failed to load from path: ' + err.message);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // METHOD 3: ADC fallback (only works locally with gcloud auth)
    // ═══════════════════════════════════════════════════════════════
    if (!serviceAccount && !saJson && !saPath) {
        console.warn('   ⚠️  No service account configured — attempting ADC fallback');
        console.warn('   ⚠️  On Render/hosting, ADC will FAIL token verification.');
    }

    // ═══════════════════════════════════════════════════════════════
    // SANITY CHECK: Verify the JSON has required fields
    // ═══════════════════════════════════════════════════════════════
    if (serviceAccount) {
        const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
        const missing = requiredFields.filter(f => !serviceAccount[f]);

        if (missing.length) {
            console.error('   ❌ Service account JSON is missing fields: ' + missing.join(', '));
            console.error('   ❌ The file may be corrupt. Re-download from Firebase Console.');
            serviceAccount = null;
        } else {
            console.log('   Project ID    : ' + serviceAccount.project_id);
            console.log('   Client email  : ' + serviceAccount.client_email);
            console.log('   Private key   : ' + (serviceAccount.private_key ? 'present (' + serviceAccount.private_key.length + ' chars)' : 'MISSING'));

            // Warn if project_id casing looks wrong
            const envProjectId = process.env.FIREBASE_PROJECT_ID;
            if (envProjectId && envProjectId !== serviceAccount.project_id) {
                console.warn('   ⚠️  Project ID mismatch:');
                console.warn('   ⚠️    env FIREBASE_PROJECT_ID = ' + envProjectId);
                console.warn('   ⚠️    JSON project_id        = ' + serviceAccount.project_id);
                console.warn('   ⚠️  These MUST match (Firebase project IDs are lowercase).');
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZE FIREBASE ADMIN
    // ═══════════════════════════════════════════════════════════════
    if (serviceAccount) {
        try {
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
        } catch (err) {
            console.error('');
            console.error('🔥 ❌ Failed to initialize with service account: ' + err.message);
            console.error('🔥 ═══════════════════════════════════════════════════════');
            console.error('');

            if (isProd) {
                console.error('❌ FATAL: Refusing to start in production without valid credentials.');
                process.exit(1);
            }
        }
    } else {
        // Fallback: ADC
        try {
            admin.initializeApp({
                credential: admin.credential.applicationDefault(),
                projectId: process.env.FIREBASE_PROJECT_ID
            });

            console.log('');
            console.log('🔥 ⚠️  Firebase Admin initialized (ADC fallback)');
            console.log('🔥 ⚠️  Token verification WILL FAIL on hosting platforms.');
            console.log('🔥 ⚠️  Fix: set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT');
            console.log('🔥 ═══════════════════════════════════════════════════════');
            console.log('');

            if (isProd) {
                console.warn('⚠️  Running in production with ADC — this will not work.');
            }
        } catch (err) {
            console.error('');
            console.error('🔥 ❌ Failed to initialize with ADC: ' + err.message);
            console.error('🔥 ═══════════════════════════════════════════════════════');
            console.error('');

            if (isProd) {
                console.error('❌ FATAL: Cannot start without any Firebase credentials.');
                process.exit(1);
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════
const firestore = admin.firestore();
firestore.settings({ ignoreUndefinedProperties: true });

module.exports = {
    admin: admin,
    firestore: firestore,
    auth: admin.auth()
};
