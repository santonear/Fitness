-- Additive. Legacy control_ledger, cost history and operation records are untouched.
CREATE TABLE IF NOT EXISTS assistant_daily (subject_id TEXT PRIMARY KEY, day TEXT NOT NULL, time_zone TEXT NOT NULL, reset_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0, active_request TEXT, lease_until INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS assistant_requests (subject_id TEXT NOT NULL, request_id TEXT NOT NULL, at INTEGER NOT NULL, result TEXT NOT NULL, PRIMARY KEY(subject_id,request_id));
CREATE TABLE IF NOT EXISTS assistant_usage (id TEXT PRIMARY KEY, at INTEGER NOT NULL, subject_short_id TEXT NOT NULL, task TEXT NOT NULL, stage TEXT NOT NULL, input_tokens INTEGER, output_tokens INTEGER, estimated_fen REAL, result TEXT NOT NULL, pricing_version TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS assistant_usage_at ON assistant_usage(at);
CREATE TABLE IF NOT EXISTS assistant_legacy_archive (request_key TEXT PRIMARY KEY, archived_at INTEGER NOT NULL, label TEXT NOT NULL);
