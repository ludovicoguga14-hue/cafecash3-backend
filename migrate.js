const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

require('dotenv').config();
const DB_PATH = process.env.DB_PATH || './foodmarket.db';
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
`);

const migrationsDir = path.join(__dirname, 'migrations');
if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found.');
    process.exit(0);
}

const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
const applied = new Set(db.prepare('SELECT id FROM _migrations').all().map(r => r.id));

let ranCount = 0;
for (const file of files) {
    if (applied.has(file)) {
        console.log(`✓ ${file} (skipped)`);
        continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
        db.transaction(() => {
            db.exec(sql);
            db.prepare('INSERT INTO _migrations (id) VALUES (?)').run(file);
        })();
        console.log(`✅ Applied ${file}`);
        ranCount++;
    } catch (err) {
        console.error(`❌ Failed ${file}:`, err.message);
        process.exit(1);
    }
}

console.log(`\n✨ Migrations complete (${ranCount} applied, ${files.length - ranCount} skipped)`);
