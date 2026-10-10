import type { D1Binding } from './d1-store';
import type { ExternalSupplier } from './control';
import { ControlError } from './store';
import { assessDailyUsage } from './daily-usage-monitor';

/** Deploy only to the separate optional operations database, never CONTROL_DB. */
export const dailyUsageDDL = 'CREATE TABLE IF NOT EXISTS ops_daily_usage (day TEXT PRIMARY KEY, calls INTEGER NOT NULL DEFAULT 0, cost_fen INTEGER NOT NULL DEFAULT 0, reserved_fen INTEGER NOT NULL DEFAULT 0)';
export class DailyUsageStore {
  constructor(private readonly db: D1Binding) {}
  async get(day: string) {
    const row = await this.db.withSession('first-primary').prepare('SELECT calls, cost_fen, reserved_fen FROM ops_daily_usage WHERE day=?').bind(day).first<{calls:number;cost_fen:number;reserved_fen:number}>();
    return {day,calls:row?.calls ?? 0,costFen:row?.cost_fen ?? 0,reservedFen:row?.reserved_fen ?? 0};
  }
  async reserve(day: string, bound: number, limits: {calls:number;costFen:number}) {
    assessDailyUsage({day,calls:0,costFen:0,reservedFen:bound},limits);
    const result = await this.db.withSession('first-primary').prepare('INSERT INTO ops_daily_usage(day,calls,cost_fen,reserved_fen) SELECT ?,1,0,? WHERE ? >= 1 AND ? <= ? ON CONFLICT(day) DO UPDATE SET calls=calls+1,reserved_fen=reserved_fen+? WHERE calls < ? AND cost_fen+reserved_fen+? <= ?')
      .bind(day,bound,limits.calls,bound,limits.costFen,bound,limits.calls,bound,limits.costFen).run();
    if (!result.success || result.meta.changes !== 1) throw new ControlError('DAILY_USAGE_FALLBACK',503);
  }
  async settle(day: string, bound: number, actual: number) {
    if (!Number.isSafeInteger(actual) || actual < 0 || actual > bound) throw new ControlError('DAILY_USAGE_FALLBACK',503);
    const result = await this.db.withSession('first-primary').prepare('UPDATE ops_daily_usage SET cost_fen=cost_fen+?,reserved_fen=reserved_fen-? WHERE day=? AND reserved_fen>=?').bind(actual,bound,day,bound).run();
    if (!result.success || result.meta.changes !== 1) throw new ControlError('DAILY_USAGE_FALLBACK',503);
  }
}
/** UTC day aggregation; ambiguous failures retain the full reserved bound. No retries. */
export function withDailyUsage(supplier: ExternalSupplier, store: DailyUsageStore, limits: {calls:number;costFen:number}, now = () => new Date()): ExternalSupplier {
  return {...supplier,call:async request => {
    const bound = supplier.costUpperBoundFen?.(request);
    if (bound === undefined || !Number.isSafeInteger(bound) || bound < 0) throw new ControlError('DAILY_USAGE_FALLBACK',503);
    const day = now().toISOString().slice(0,10);
    await store.reserve(day,bound,limits);
    const response = await supplier.call(request);
    if (response.actualCost !== undefined) await store.settle(day,bound,response.actualCost);
    return response;
  }};
}
