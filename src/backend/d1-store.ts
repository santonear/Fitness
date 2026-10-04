import { ControlError, type ControlState, type ControlStore } from './store';
import { serializeLedger } from './ledger-capacity';

export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<{ success: boolean; meta: { changes?: number } }>;
}
export interface D1Binding {
  withSession(mode: 'first-primary'): { prepare(sql: string): D1Statement };
}
/** D1-ready optimistic single-row CAS. No supplier side effects inside retried callbacks.
 * A successful SQL request with zero changed rows grants NOTHING. Requires real D1 verification.
 */
export class D1ControlStore implements ControlStore {
  constructor(private readonly binding: D1Binding, private readonly attempts = 8) {}
  private session() { return this.binding.withSession('first-primary'); }
  async read(): Promise<ControlState> {
    const row = await this.session().prepare('SELECT state FROM control_ledger WHERE id=1').first<{ state: string }>();
    if (!row) throw new ControlError('CONTROL_UNAVAILABLE', 503); return JSON.parse(row.state) as ControlState;
  }
  async transact<T>(change: (state: ControlState) => T): Promise<T> {
    for (let attempt = 0; attempt < this.attempts; attempt++) {
      const session = this.session();
      const row = await session.prepare('SELECT revision, state FROM control_ledger WHERE id=1').first<{ revision: number; state: string }>();
      if (!row) throw new ControlError('CONTROL_UNAVAILABLE', 503);
      const state = JSON.parse(row.state) as ControlState; const result = change(state);
      const update = await session.prepare('UPDATE control_ledger SET state=?, revision=revision+1 WHERE id=1 AND revision=?').bind(serializeLedger(state), row.revision).run();
      if (!update.success) throw new ControlError('CONTROL_UNAVAILABLE', 503);
      if (update.meta.changes === 1) return result;
      if (update.meta.changes !== 0) throw new ControlError('CONTROL_UNAVAILABLE', 503);
    }
    throw new ControlError('CONTROL_CONTENTION', 503);
  }
}
