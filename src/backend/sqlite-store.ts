import { DatabaseSync } from 'node:sqlite';
import { initialState, type ControlState, type ControlStore } from './store';
import { serializeLedger, MAX_LEDGER_JSON_BYTES } from './ledger-capacity';

/** Local executable adapter. BEGIN IMMEDIATE serializes writers, including separate connections. */
export class SqliteControlStore implements ControlStore {
  private db: DatabaseSync;
  constructor(filename: string, private readonly maxRowBytes = MAX_LEDGER_JSON_BYTES) {
    this.db = new DatabaseSync(filename);
    this.db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS control_ledger (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, state TEXT NOT NULL CHECK(json_valid(state)))');
    this.db.prepare('INSERT OR IGNORE INTO control_ledger VALUES (1, 0, ?)').run(serializeLedger(initialState(), maxRowBytes));
  }
  async read(): Promise<ControlState> {
    const row = this.db.prepare('SELECT state FROM control_ledger WHERE id=1').get() as { state: string };
    return JSON.parse(row.state) as ControlState;
  }
  async transact<T>(change: (state: ControlState) => T): Promise<T> {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.db.prepare('SELECT state FROM control_ledger WHERE id=1').get() as { state: string };
      const state = JSON.parse(row.state) as ControlState;
      const result = change(state);
      this.db.prepare('UPDATE control_ledger SET state=?, revision=revision+1 WHERE id=1').run(serializeLedger(state, this.maxRowBytes));
      this.db.exec('COMMIT'); return result;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  close() { this.db.close(); }
}
