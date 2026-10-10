-- Dedicated preview database only. No training or account fields.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  keys_json TEXT NOT NULL,
  schedule TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  last_day TEXT,
  retry_at INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0
);
