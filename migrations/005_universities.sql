ALTER TABLE audit_log ADD COLUMN university_id TEXT;
CREATE INDEX IF NOT EXISTS idx_audit_university ON audit_log(university_id, created_at DESC);
