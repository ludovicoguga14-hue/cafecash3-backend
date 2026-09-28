/**
 * SQLite database for auxiliary data:
 *   - audit log
 *   - billing events
 *   - migration tracking
 *
 * Business data lives in Firestore.
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'foodmarket.db');
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL,
    university_id TEXT,
    cafe_id TEXT,
    action TEXT NOT NULL,
    resource TEXT,
    resource_id TEXT,
    ip TEXT,
    user_agent TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_audit_uid ON audit_log(uid, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_cafe ON audit_log(cafe_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_university ON audit_log(university_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS billing_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL,
    event_type TEXT NOT NULL,
    plan TEXT,
    amount_cents INTEGER,
    currency TEXT DEFAULT 'ZAR',
    stripe_event_id TEXT UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_billing_uid ON billing_events(uid, created_at DESC);

  CREATE TABLE IF NOT EXISTS ai_queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL,
    cafe_id TEXT,
    message TEXT,
    intent TEXT,
    provider TEXT,
    response_ms INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_ai_uid ON ai_queries(uid, created_at DESC);
`);

db.logAudit = function ({ uid, universityId, cafeId, action, resource, resourceId, ip, userAgent }) {
    try {
        db.prepare(`
            INSERT INTO audit_log (uid, university_id, cafe_id, action, resource, resource_id, ip, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            uid,
            universityId || null,
            cafeId || null,
            action,
            resource || null,
            resourceId || null,
            ip || null,
            userAgent || null
        );
    } catch (err) {
        console.error('Audit log failed:', err.message);
    }
};

module.exports = db;
