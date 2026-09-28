require('dotenv').config();
const fs = require('fs');
const path = require('path');

const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.FIREBASE_SERVICE_ACCOUNT || './serviceAccount.json';
console.log('Looking for:', saPath);

try {
    const fullPath = path.resolve(process.cwd(), saPath);
    console.log('Full path:', fullPath);
    
    if (!fs.existsSync(fullPath)) {
        console.error('❌ File does not exist!');
        process.exit(1);
    }
    
    const raw = fs.readFileSync(fullPath, 'utf8');
    const json = JSON.parse(raw);
    console.log('✅ File loaded');
    console.log('   Project ID:', json.project_id);
    console.log('   Client email:', json.client_email);
    console.log('   Has private key:', !!json.private_key);
} catch (err) {
    console.error('❌ Error:', err.message);
}
