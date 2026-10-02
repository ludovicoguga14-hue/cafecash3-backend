
/**
 * SQLite for audit logs + billing (business data lives in Firestore)
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'cafecash.db');
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL,
    university_id TEXT,
    cafe_id TEXT,
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_audit_uid ON audit_log(uid, created_at DESC);

  CREATE TABLE IF NOT EXISTS billing_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL,
    event_type TEXT NOT NULL,
    plan TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

db.logAudit = function ({ uid, universityId, cafeId, action, details }) {
    try {
        db.prepare(`
            INSERT INTO audit_log (uid, university_id, cafe_id, action, details)
            VALUES (?, ?, ?, ?, ?)
        `).run(uid, universityId || null, cafeId || null, action, details || null);
    } catch (err) {
        console.error('Audit log failed:', err.message);
    }
};

module.exports = db;
