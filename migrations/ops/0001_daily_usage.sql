-- Separate operations database only. Existing control/admin data are untouched.
CREATE TABLE IF NOT EXISTS ops_daily_usage (
  day TEXT PRIMARY KEY,
  calls INTEGER NOT NULL DEFAULT 0,
  cost_fen INTEGER NOT NULL DEFAULT 0,
  reserved_fen INTEGER NOT NULL DEFAULT 0
);
