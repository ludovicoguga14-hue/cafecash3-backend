/**
 * Firebase Admin SDK initialization.
 * Verifies Firebase ID tokens + accesses Firestore.
 */
const admin = require('firebase-admin');

if (!admin.apps.length) {
    const isProd = process.env.NODE_ENV === 'production';
    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (saJson) {
        try {
            const serviceAccount = JSON.parse(saJson);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id
            });
            console.log('🔥 Firebase Admin initialized (service account)');
        } catch (err) {
            console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT:', err.message);
            if (isProd) process.exit(1);
            throw err;
        }
    } else {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: process.env.FIREBASE_PROJECT_ID
        });
        console.log('🔥 Firebase Admin initialized (ADC)');
    }
}

const firestore = admin.firestore();
firestore.settings({ ignoreUndefinedProperties: true });

module.exports = {
    admin,
    firestore,
    auth: admin.auth()
};
