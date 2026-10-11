CREATE TABLE IF NOT EXISTS admin_preview_simulation (
 id INTEGER PRIMARY KEY CHECK(id=1), deployment_id TEXT NOT NULL, changed_at TEXT NOT NULL, request_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_preview_simulation_receipts (
 request_id TEXT PRIMARY KEY, expected_id TEXT NOT NULL, target_id TEXT NOT NULL, result TEXT NOT NULL
);
