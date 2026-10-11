CREATE TABLE IF NOT EXISTS admin_finance (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL);
INSERT OR IGNORE INTO admin_finance(id,revision,state) VALUES(1,0,'{"versions":[],"announcement":null,"receipts":{}}');
CREATE TABLE IF NOT EXISTS admin_finance_events (event_key TEXT PRIMARY KEY, day TEXT NOT NULL, task TEXT NOT NULL, status TEXT NOT NULL, cost_fen INTEGER NOT NULL, reserved_fen INTEGER NOT NULL, at INTEGER NOT NULL);
