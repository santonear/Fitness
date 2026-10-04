-- Local SQLite / D1-ready control-only aggregate. Production migration is not authorized.
-- One CAS covers quota + budget + request identity atomically; no training/result bodies.
CREATE TABLE IF NOT EXISTS control_ledger (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL CHECK (revision >= 0),
  state TEXT NOT NULL CHECK (json_valid(state))
);
INSERT OR IGNORE INTO control_ledger (id, revision, state) VALUES
(1, 0, '{"version":1,"aiEnabled":false,"recoveryRequired":false,"invites":{},"subjects":{},"sessions":{},"usages":{},"budgets":{},"requests":{},"audit":[]}');
