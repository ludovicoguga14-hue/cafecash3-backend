/**
 * Firebase Admin SDK initialization.
 * Loads service account from env var (preferred) or file path (fallback).
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

if (!admin.apps.length) {
    console.log('🔥 [firebase.js] Starting initialization...');

    const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (saPath) {
        console.log('   FIREBASE_SERVICE_ACCOUNT_PATH: (set)');
    } else {
        console.log('   FIREBASE_SERVICE_ACCOUNT_PATH: (not set)');
    }

    if (saJson) {
        console.log('   FIREBASE_SERVICE_ACCOUNT: (set, ' + saJson.length + ' chars)');
    } else {
        console.log('   FIREBASE_SERVICE_ACCOUNT: (not set)');
    }

    let serviceAccount = null;

    // 1. Try inline JSON first (preferred on Render)
    if (saJson) {
        try {
            serviceAccount = JSON.parse(saJson);
            console.log('   ✅ Parsed service account from env JSON');
        } catch (err) {
            console.error('   ❌ Failed to parse FIREBASE_SERVICE_ACCOUNT:', err.message);
        }
    }

    // 2. Fallback to file path
    if (!serviceAccount && saPath) {
        try {
            const fullPath = path.isAbsolute(saPath)
                ? saPath
                : path.resolve(process.cwd(), saPath);
            const raw = fs.readFileSync(fullPath, 'utf8');
            serviceAccount = JSON.parse(raw);
            console.log('   ✅ Loaded service account from file: ' + fullPath);
        } catch (err) {
            console.error('   ❌ Failed to load from path:', err.message);
        }
    }

    // 3. Initialize Firebase Admin
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
        console.warn('   ⚠️  Using ADC — token verification will FAIL on Render');
    }
}

const firestore = admin.firestore();
firestore.settings({ ignoreUndefinedProperties: true });

module.exports = {
    admin,
    firestore,
    auth: admin.auth()
};
