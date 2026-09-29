/**
 * Firebase Admin SDK initialization.
 * Loads service account from FILE PATH or INLINE JSON.
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

if (!admin.apps.length) {
    console.log('🔥 [firebase.js] Starting initialization...');
    console.log('   cwd:', process.cwd());
    console.log('   __dirname:', __dirname);

    // Try PATH first (preferred), then inline JSON (legacy)
    const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;

    console.log('   env FIREBASE_SERVICE_ACCOUNT_PATH:', saPath || '(not set)');
    console.log('   env FIREBASE_SERVICE_ACCOUNT:', saJson ? '(set)' : '(not set)');

    let serviceAccount = null;

    // ─── Load from file path ───
    if (saPath) {
        try {
            const fullPath = path.isAbsolute(saPath)
                ? saPath
                : path.resolve(process.cwd(), saPath);

            console.log('   Resolved path:', fullPath);

            if (!fs.existsSync(fullPath)) {
                console.error('   ❌ File does NOT exist at:', fullPath);
            } else {
                const raw = fs.readFileSync(fullPath, 'utf8');
                serviceAccount = JSON.parse(raw);
                console.log('   ✅ Loaded service account from file');
                console.log('   Project ID:', serviceAccount.project_id);
                console.log('   Client email:', serviceAccount.client_email);
            }
        } catch (err) {
            console.error('   ❌ Failed to load service account file:', err.message);
        }
    }
    // ─── Fallback: parse inline JSON ───
    else if (saJson) {
        try {
            serviceAccount = JSON.parse(saJson);
            console.log('   ✅ Parsed service account from env JSON');
        } catch (err) {
            console.error('   ❌ Failed to parse FIREBASE_SERVICE_ACCOUNT env:', err.message);
        }
    }

    // ─── Initialize Firebase Admin ───
    if (serviceAccount) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id
        });
        console.log('🔥 Firebase Admin initialized (service account)');
    } else {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: process.env.FIREBASE_PROJECT_ID
        });
        console.log('🔥 Firebase Admin initialized (ADC fallback)');
        console.warn('   ⚠️  Using ADC — API calls that verify tokens WILL FAIL.');
        console.warn('   ⚠️  Fix: ensure serviceAccount.json exists in the Backend folder');
        console.warn('   ⚠️  and .env has FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccount.json');
    }
}

const firestore = admin.firestore();
firestore.settings({ ignoreUndefinedProperties: true });

module.exports = {
    admin,
    firestore,
    auth: admin.auth()
};
