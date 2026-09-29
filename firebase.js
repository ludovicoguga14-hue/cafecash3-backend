const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

if (!admin.apps.length) {
    console.log('🔥 [firebase.js] Starting...');

    let serviceAccount = null;
    let source = 'none';

    // Method 1: Base64 encoded JSON (safest for hosting)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
        try {
            const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8');
            serviceAccount = JSON.parse(json);
            source = 'env (Base64)';
            console.log('   ✅ Decoded Base64 service account');
        } catch (err) {
            console.error('   ❌ Base64 decode failed:', err.message);
        }
    }

    // Method 2: Inline JSON
    if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            source = 'env (inline JSON)';
            console.log('   ✅ Parsed inline JSON');
        } catch (err) {
            console.error('   ❌ Inline JSON parse failed:', err.message);
        }
    }

    // Method 3: File path (localhost)
    if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
        try {
            const p = path.isAbsolute(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
                ? process.env.FIREBASE_SERVICE_ACCOUNT_PATH
                : path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
            serviceAccount = JSON.parse(fs.readFileSync(p, 'utf8'));
            source = 'file';
            console.log('   ✅ Loaded from file:', p);
        } catch (err) {
            console.error('   ❌ File load failed:', err.message);
        }
    }

    if (serviceAccount) {
        // Verify the private key survived the transfer
        const keyOk = serviceAccount.private_key && serviceAccount.private_key.includes('BEGIN PRIVATE KEY');
        console.log('   Project   :', serviceAccount.project_id);
        console.log('   Key chars :', serviceAccount.private_key ? serviceAccount.private_key.length : 0);
        console.log('   Key valid :', keyOk ? '✅ yes' : '❌ NO — key is corrupted');

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
    }
}

const firestore = admin.firestore();
firestore.settings({ ignoreUndefinedProperties: true });

module.exports = {
    admin,
    firestore,
    auth: admin.auth()
};
