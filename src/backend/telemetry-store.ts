import { z } from 'zod';
import type { D1Binding } from './d1-store';
import { safeErrorEventSchema } from '../application/monitoring';

export const anonymousBatchSchema = z.strictObject({optedIn:z.literal(true),event:z.enum(['plan_confirmed','workout_started','workout_completed','review_opened']),count:z.number().int().min(1).max(1000).default(1)});
/** Only aggregate enum buckets are retained. No user IDs, raw records or timestamps. */
export const telemetryDDL = 'CREATE TABLE IF NOT EXISTS ops_telemetry_counts (day TEXT NOT NULL, bucket TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,bucket))';
const anonymousNames = ['plan_confirmed','workout_started','workout_completed','review_opened'] as const;
export class TelemetryStore {
  constructor(private readonly db:D1Binding) {}
  async count(day:string, raw:unknown, kind:'errors'|'counts') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('INVALID_DAY');
    let bucket:string, count:number;
    if (kind === 'errors') { const event = safeErrorEventSchema.parse(raw); bucket = `error:${event.type}:${event.page}:${event.version}:${event.browser}`; count = 1; }
    else { const event = anonymousBatchSchema.parse(raw); bucket = `usage:${event.event}`; count = event.count; }
    const result = await this.db.withSession('first-primary').prepare('INSERT INTO ops_telemetry_counts(day,bucket,count) VALUES(?,?,?) ON CONFLICT(day,bucket) DO UPDATE SET count=count+excluded.count').bind(day,bucket,count).run();
    if (!result.success || result.meta.changes !== 1) throw new Error('TELEMETRY_UNAVAILABLE');
  }
  async usage(day:string) {
    const counts:Record<string,number> = {};
    for (const name of anonymousNames) {
      const row = await this.db.withSession('first-primary').prepare('SELECT count FROM ops_telemetry_counts WHERE day=? AND bucket=?').bind(day,`usage:${name}`).first<{count:number}>();
      counts[name] = row?.count ?? 0;
    }
    return {day,timeZone:'UTC',counts};
  }
}
