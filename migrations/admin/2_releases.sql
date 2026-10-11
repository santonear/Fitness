CREATE TABLE IF NOT EXISTS admin_feature_flags (
 environment TEXT NOT NULL CHECK(environment IN ('preview','production')),
 name TEXT NOT NULL, enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
 pending INTEGER NOT NULL DEFAULT 0 CHECK(pending IN (0,1)),
 changed_by TEXT NOT NULL, changed_at TEXT NOT NULL,
 PRIMARY KEY(environment,name)
);
CREATE TABLE IF NOT EXISTS admin_release_history (
 request_id TEXT PRIMARY KEY, environment TEXT NOT NULL, kind TEXT NOT NULL,
 object_id TEXT NOT NULL, before_value TEXT, after_value TEXT NOT NULL,
 actor TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_prompt_selection (
 environment TEXT NOT NULL, task TEXT NOT NULL, version TEXT NOT NULL,
 changed_by TEXT NOT NULL, changed_at TEXT NOT NULL,
 PRIMARY KEY(environment,task)
);
CREATE TABLE IF NOT EXISTS admin_release_state (
 environment TEXT PRIMARY KEY, current_id TEXT NOT NULL, previous_id TEXT,
 changed_at TEXT NOT NULL, operation_id TEXT
);
CREATE TABLE IF NOT EXISTS admin_release_smoke (
 environment TEXT NOT NULL, release_id TEXT NOT NULL, check_id TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('passed','failed','unavailable')), checked_at TEXT NOT NULL,
 PRIMARY KEY(environment,release_id,check_id)
);
