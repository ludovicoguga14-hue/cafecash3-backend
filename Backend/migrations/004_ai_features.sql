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
