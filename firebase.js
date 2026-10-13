
const admin = require("firebase-admin");

const projectId = process.env.FIREBASE_PROJECT_ID;
const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!admin.apps.length) {
    if (!rawCredentials) {
        throw new Error(
            "Missing FIREBASE_SERVICE_ACCOUNT environment variable"
        );
    }

    let serviceAccount;

    try {
        serviceAccount = JSON.parse(rawCredentials);
    } catch (error) {
        throw new Error(
            "FIREBASE_SERVICE_ACCOUNT is not valid JSON"
        );
    }

    // Normalize private-key line endings.
    if (serviceAccount.private_key) {
        serviceAccount.private_key =
            serviceAccount.private_key
                .replace(/\\n/g, "\n")
                .replace(/\r\n/g, "\n")
                .trim() + "\n";
    }

    if (
        !serviceAccount.project_id ||
        !serviceAccount.client_email ||
        !serviceAccount.private_key
    ) {
        throw new Error(
            "Firebase service account is missing required fields"
        );
    }

    if (
        projectId &&
        projectId !== serviceAccount.project_id
    ) {
        throw new Error(
            "FIREBASE_PROJECT_ID does not match the service account project"
        );
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId || serviceAccount.project_id
    });

    console.log("Firebase Admin initialized successfully.");
}

const firestore = admin.firestore();

firestore.settings({
    ignoreUndefinedProperties: true
});

module.exports = {
    admin,
    firestore,
    auth: admin.auth()
};
