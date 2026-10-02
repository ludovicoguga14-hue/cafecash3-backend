require('dotenv').config();
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccount.json';
const full = path.resolve(process.cwd(), saPath);

console.log('');
console.log('═══════════════════════════════════════════════════════');
console.log('🔑 Testing Private Key');
console.log('═══════════════════════════════════════════════════════');
console.log('Path:', full);

if (!fs.existsSync(full)) {
    console.error('❌ File does not exist');
    process.exit(1);
}

const sa = JSON.parse(fs.readFileSync(full, 'utf8'));

console.log('');
console.log('Before repair:');
console.log('   Key length   :', sa.private_key.length);
console.log('   Has real \\n  :', sa.private_key.includes('\n') ? 'yes' : 'NO');
console.log('   Has literal  :', sa.private_key.includes('\\n') ? 'yes' : 'NO');
console.log('   Starts with  :', JSON.stringify(sa.private_key.substring(0, 50)));

// Apply the fix
const original = sa.private_key;
sa.private_key = original
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim() + '\n';

console.log('');
console.log('After repair:');
console.log('   Key length   :', sa.private_key.length);
console.log('   Has real \\n  :', sa.private_key.includes('\n') ? 'yes' : 'NO');
console.log('   Changed      :', original !== sa.private_key ? 'yes' : 'no');

admin.initializeApp({
    credential: admin.credential.cert(sa),
    projectId: process.env.FIREBASE_PROJECT_ID || sa.project_id
});

(async () => {
    console.log('');
    console.log('Testing Firestore write...');

    try {
        await admin.firestore().collection('_test_').doc('ping').set({
            timestamp: new Date(),
            test: true
        });
        console.log('✅ ✅ ✅ Firestore WRITE SUCCESS');
        await admin.firestore().collection('_test_').doc('ping').delete();
        console.log('✅ Cleanup done');
        console.log('');
        console.log('🎉 The key WORKS after repair. Your firebase.js is missing the repair line.');
    } catch (err) {
        console.error('❌ Firestore write FAILED');
        console.error('   Error:', err.message);
        console.error('');
        console.error('The key is broken even after repair.');
        console.error('You must re-download serviceAccount.json from Firebase Console.');
    }
    process.exit(0);
})();