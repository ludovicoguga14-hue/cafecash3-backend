📄 1. Backend/firebase.js

javascript
/**
 * ═══════════════════════════════════════════════════════════════════
 * CafeCash — Firebase Admin SDK Initialization
 * ═══════════════════════════════════════════════════════════════════
 *
 * Loads credentials in this priority order:
 *   1. FIREBASE_SERVICE_ACCOUNT_PATH env var (file path — works on Render)
 *   2. FIREBASE_SERVICE_ACCOUNT env var (inline JSON — alternative)
 *   3. ADC fallback (Application Default Credentials — dev only)
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
    const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;

    console.log('   NODE_ENV                     : ' + (process.env.NODE_ENV || '(not set)'));
    console.log('   FIREBASE_PROJECT_ID          : ' + (process.env.FIREBASE_PROJECT_ID || '(not set)'));
    console.log('   FIREBASE_SERVICE_ACCOUNT_PATH: ' + (saPath || '(not set)'));
    console.log('   FIREBASE_SERVICE_ACCOUNT     : ' + (saJson ? '(set, ' + saJson.length + ' chars)' : '(not set)'));

    let serviceAccount = null;
    let sourceUsed = 'none';

    // ═══════════════════════════════════════════════════════════════
    // METHOD 1: File path (preferred)
    // ═══════════════════════════════════════════════════════════════
    if (saPath) {
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
                sourceUsed = 'file';
                console.log('   ✅ Loaded service account from file');
            }
        } catch (err) {
            console.error('   ❌ Failed to load from path: ' + err.message);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // METHOD 2: Inline JSON (fallback)
    // ═══════════════════════════════════════════════════════════════
    if (!serviceAccount && saJson) {
        try {
            const trimmed = saJson.trim();
            if (!trimmed.startsWith('{')) {
                console.warn('   ⚠️  FIREBASE_SERVICE_ACCOUNT is not JSON (missing "{")');
            } else {
                serviceAccount = JSON.parse(trimmed);
                sourceUsed = 'env (inline JSON)';
                console.log('   ✅ Parsed JSON from env var');
            }
        } catch (err) {
            console.error('   ❌ Failed to parse FIREBASE_SERVICE_ACCOUNT: ' + err.message);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // SANITY CHECK
    // ═══════════════════════════════════════════════════════════════
    if (serviceAccount) {
        const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
        const missing = requiredFields.filter(f => !serviceAccount[f]);

        if (missing.length) {
            console.error('   ❌ Service account is missing fields: ' + missing.join(', '));
            serviceAccount = null;
        } else {
            const keyOk = serviceAccount.private_key.includes('BEGIN PRIVATE KEY');
            console.log('   Project ID    : ' + serviceAccount.project_id);
            console.log('   Client email  : ' + serviceAccount.client_email);
            console.log('   Key chars     : ' + serviceAccount.private_key.length);
            console.log('   Key valid     : ' + (keyOk ? '✅ yes' : '❌ NO'));

            if (!keyOk) {
                console.error('   ❌ Private key is corrupted — re-download from Firebase Console');
                serviceAccount = null;
            }

            // Check for project ID casing mismatch
            const envProjectId = process.env.FIREBASE_PROJECT_ID;
            if (envProjectId && envProjectId !== serviceAccount.project_id) {
                console.warn('   ⚠️  PROJECT ID MISMATCH:');
                console.warn('   ⚠️    env: ' + envProjectId);
                console.warn('   ⚠️    JSON: ' + serviceAccount.project_id);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZE
    // ═══════════════════════════════════════════════════════════════
    if (serviceAccount) {
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
        try {
            admin.initializeApp({
                credential: admin.credential.applicationDefault(),
                projectId: process.env.FIREBASE_PROJECT_ID
            });
            console.log('🔥 ⚠️  Firebase Admin initialized (ADC fallback)');
            console.warn('   ⚠️  Token verification will fail on Render');
            if (isProd) {
                console.error('❌ FATAL: Cannot start in production without credentials');
                process.exit(1);
            }
        } catch (err) {
            console.error('❌ Firebase Admin initialization failed: ' + err.message);
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
