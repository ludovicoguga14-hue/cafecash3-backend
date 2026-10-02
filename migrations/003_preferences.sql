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
