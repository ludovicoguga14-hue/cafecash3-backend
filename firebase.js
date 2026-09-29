/**
 * Firebase Admin — supports Base64, file, or inline JSON
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

if (!admin.apps.length) {
    console.log('🔥 Firebase Admin — Initializing...');

    let serviceAccount = null;
    let source = 'none';

    // ═══ Base64 (best for hosting) ═══
    if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
        try {
            const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64.trim();
            const json = Buffer.from(b64, 'base64').toString('utf8');
            serviceAccount = JSON.parse(json);
            source = 'Base64 env';
            console.log('   ✅ Decoded Base64 (' + b64.length + ' chars)');
        } catch (err) {
            console.error('   ❌ Base64 decode failed:', err.message);
        }
    }

    // ═══ File path ═══
    if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
        try {
            const p = path.isAbsolute(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
                ? process.env.FIREBASE_SERVICE_ACCOUNT_PATH
                : path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
            serviceAccount = JSON.parse(fs.readFileSync(p, 'utf8'));
            source = 'File: ' + p;
            console.log('   ✅ Loaded from file');
        } catch (err) {
            console.error('   ❌ File load failed:', err.message);
        }
    }

    // ═══ Inline JSON ═══
    if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
            if (raw.startsWith('{')) {
                serviceAccount = JSON.parse(raw);
                source = 'Inline JSON';
                console.log('   ✅ Parsed inline JSON');
            }
        } catch (err) {
            console.error('   ❌ Inline JSON parse failed:', err.message);
        }
    }

    if (!serviceAccount) {
        console.error('❌ No Firebase credentials found');
        if (process.env.NODE_ENV === 'production') process.exit(1);
        return;
    }

    const key = serviceAccount.private_key || '';
    console.log('   Project    :', serviceAccount.project_id);
    console.log('   Client     :', serviceAccount.client_email);
    console.log('   Key length :', key.length);
    console.log('   Key starts :', JSON.stringify(key.substring(0, 30)));
    console.log('   Key has \\n :', key.includes('\n') ? 'YES ✅' : 'NO ❌ corrupted');

    if (!key.includes('\n')) {
        console.error('❌ Private key has no newlines — corrupted.');
        if (process.env.NODE_ENV === 'production') process.exit(1);
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id
    });

    console.log('🔥 ✅ Firebase Admin initialized');
    console.log('🔥    Source:', source);
    console.log('🔥    Project:', process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id);
}

const firestore = admin.firestore();
firestore.settings({ ignoreUndefinedProperties: true });

module.exports = {
    admin: admin,
    firestore: firestore,
    auth: admin.auth()
};
