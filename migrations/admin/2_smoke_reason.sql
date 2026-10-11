CREATE TABLE IF NOT EXISTS admin_release_smoke_reason (
 environment TEXT NOT NULL, release_id TEXT NOT NULL, check_id TEXT NOT NULL,
 reason TEXT, http_status INTEGER, PRIMARY KEY(environment,release_id,check_id)
);
