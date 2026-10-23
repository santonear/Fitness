import { z } from 'zod';
import type { D1Binding } from './d1-store';
import { anonymousEventSchema, safeErrorEventSchema } from '../application/monitoring';
import { addDays } from '../domain/local-date';

export const anonymousBatchSchema = z.strictObject({
  optedIn: z.literal(true),
  event: anonymousEventSchema,
  count: z.number().int().min(1).max(1000).default(1),
});
/** A bucket stops growing at this daily count, so a flood cannot push the aggregates arbitrarily high. */
export const TELEMETRY_DAILY_BUCKET_CAP = 100000;
/** Only aggregate enum buckets are retained. No user IDs, raw records or timestamps. */
export const telemetryDDL =
  'CREATE TABLE IF NOT EXISTS ops_telemetry_counts (day TEXT NOT NULL, bucket TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,bucket))';
const anonymousNames = anonymousEventSchema.options;
export class TelemetryStore {
  constructor(private readonly db: D1Binding) {}
  async count(day: string, raw: unknown, kind: 'errors' | 'counts') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('INVALID_DAY');
    let bucket: string, count: number;
    if (kind === 'errors') {
      const event = safeErrorEventSchema.parse(raw);
      bucket = `error:${event.type}:${event.page}:${event.version}:${event.browser}`;
      count = 1;
    } else {
      const event = anonymousBatchSchema.parse(raw);
      bucket = `usage:${event.event}`;
      count = event.count;
    }
    const result = await this.db
      .withSession('first-primary')
      .prepare(
        'INSERT INTO ops_telemetry_counts(day,bucket,count) VALUES(?,?,?) ON CONFLICT(day,bucket) DO UPDATE SET count=MIN(count+excluded.count,?)',
      )
      .bind(day, bucket, count, TELEMETRY_DAILY_BUCKET_CAP)
      .run();
    if (!result.success || result.meta.changes !== 1) throw new Error('TELEMETRY_UNAVAILABLE');
  }
  async usage(day: string) {
    const counts: Record<string, number> = {};
    for (const name of anonymousNames) {
      const row = await this.db
        .withSession('first-primary')
        .prepare('SELECT count FROM ops_telemetry_counts WHERE day=? AND bucket=?')
        .bind(day, `usage:${name}`)
        .first<{ count: number }>();
      counts[name] = row?.count ?? 0;
    }
    return { day, timeZone: 'UTC', counts, retention: await this.retention(day) };
  }
  /**
   * Cohort = devices that opened one in days 28–55 ago; week 1 is counted over the same days, week 4 shifted 24 days
   * later, to where those devices reach their fourth week.
   * shortcut: daily totals only, so the cohorts are aligned by day ranges, not per device; good enough for a trend.
   */
  async retention(day: string) {
    const sum = async (name: string, from: number, to: number) =>
      (
        await this.db
          .withSession('first-primary')
          .prepare(
            'SELECT COALESCE(SUM(count),0) AS count FROM ops_telemetry_counts WHERE bucket=? AND day BETWEEN ? AND ?',
          )
          .bind(`usage:${name}`, addDays(day, from), addDays(day, to))
          .first<{ count: number }>()
      )?.count ?? 0;
    return {
      from: addDays(day, -55),
      to: addDays(day, -28),
      start: await sum('retention_start', -55, -28),
      week1: await sum('retention_week1', -55, -28),
      week4: await sum('retention_week4', -31, -4),
    };
  }
}
