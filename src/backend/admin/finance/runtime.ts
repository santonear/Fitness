import { z } from 'zod';
import { checkCoachLanguage } from '../../../application/rules/coach-language';
import type { AdminDatabase } from '../core/contracts';
import { AdminError } from '../core/contracts';
import { DAY_MS } from '../../../domain/local-date';

const integer = (min: number, max: number) => z.number().int().min(min).max(max);
export const runtimeSchema = z
  .strictObject({
    dailyMessageLimit: integer(1, 1000).optional(),
    quotaUnderstand: integer(0, 10000),
    quotaGenerate: integer(0, 10000),
    quotaSummary: integer(0, 10000).optional(),
    monthlyBudgetFen: integer(1, 100000000),
    reservationFen: integer(1, 1000000),
    maxConcurrent: integer(1, 100),
    retentionDays: integer(1, 365),
  })
  .refine(v => v.reservationFen <= v.monthlyBudgetFen);
export type RuntimeConfig = z.infer<typeof runtimeSchema>;
export interface FinanceEnv {
  ADMIN_DB?: AdminDatabase;
  CONTROL_POLICY?: string;
  APPLICATION_RETENTION_DAYS?: string;
}
export interface ConfigVersion {
  version: number;
  config: RuntimeConfig;
  actor: string;
  at: number;
  requestId: string;
}
export interface Announcement {
  text: string;
  start: number;
  end: number;
}
interface FinanceState {
  versions: ConfigVersion[];
  announcement: Announcement | null;
  receipts: Record<string, string>;
  dismissedBudgetMonths?: string[];
}
export function environmentDefaults(env: FinanceEnv): RuntimeConfig {
  const p = JSON.parse(env.CONTROL_POLICY ?? '{}');
  return runtimeSchema.parse({
    dailyMessageLimit: 30,
    quotaUnderstand: p.quotas?.understand ?? 3,
    quotaGenerate: p.quotas?.generate ?? 3,
    ...(p.quotas?.summary === undefined ? {} : { quotaSummary: p.quotas.summary }),
    monthlyBudgetFen: p.budgetLimit ?? 3000,
    reservationFen: p.maximumRequestCost ?? 300,
    maxConcurrent: p.maxConcurrent ?? 1,
    retentionDays: Number(env.APPLICATION_RETENTION_DAYS ?? 30),
  });
}
export class FinanceStore {
  constructor(private db: AdminDatabase) {}
  async read(): Promise<FinanceState> {
    const row = await this.db.prepare('SELECT state FROM admin_finance WHERE id=1').first<{ state: string }>();
    if (!row) throw new AdminError('FINANCE_UNAVAILABLE', 503);
    return JSON.parse(row.state);
  }
  async mutate<T>(change: (state: FinanceState) => T): Promise<T> {
    for (let i = 0; i < 8; i++) {
      const session = this.db;
      const row = await session
        .prepare('SELECT revision,state FROM admin_finance WHERE id=1')
        .first<{ revision: number; state: string }>();
      if (!row) throw new AdminError('FINANCE_UNAVAILABLE', 503);
      const state: FinanceState = JSON.parse(row.state),
        result = change(state);
      const updated = await session
        .prepare('UPDATE admin_finance SET state=?,revision=revision+1 WHERE id=1 AND revision=?')
        .bind(JSON.stringify(state), row.revision)
        .run();
      if (!updated.success) throw new AdminError('FINANCE_UNAVAILABLE', 503);
      if (updated.meta.changes === 1) return result;
    }
    throw new AdminError('FINANCE_CONTENTION', 503);
  }
}
export function validateAnnouncement(value: unknown): Announcement {
  const a = z
    .strictObject({
      text: z
        .string()
        .trim()
        .min(1)
        .max(160)
        .refine(t => !/[\r\n]/.test(t)),
      start: z.number().int().nonnegative(),
      end: z.number().int().nonnegative(),
    })
    .parse(value);
  if (a.end <= a.start || a.end - a.start > 7 * DAY_MS || checkCoachLanguage(a.text).length)
    throw new AdminError('INVALID_ANNOUNCEMENT', 400);
  return a;
}
export async function activeAnnouncement(env: FinanceEnv, now = Date.now()): Promise<Announcement | null> {
  if (!env.ADMIN_DB) return null;
  const a = (await new FinanceStore(env.ADMIN_DB).read()).announcement;
  return a && a.start <= now && now < a.end ? a : null;
}
/** Snapshot once at request admission. Never updates existing ledgers or quota history. */
export async function resolveRuntimeEnv<T extends FinanceEnv>(env: T): Promise<T> {
  if (!env.ADMIN_DB) return env;
  const state = await new FinanceStore(env.ADMIN_DB).read(),
    current = state.versions.at(-1);
  if (!current) return env;
  const c = runtimeSchema.parse(current.config),
    p = JSON.parse(env.CONTROL_POLICY ?? '{}');
  return {
    ...env,
    APPLICATION_RETENTION_DAYS: String(c.retentionDays),
    CONTROL_POLICY: JSON.stringify({
      ...p,
      quotas: {
        ...p.quotas,
        understand: c.quotaUnderstand,
        generate: c.quotaGenerate,
        ...(c.quotaSummary === undefined ? {} : { summary: c.quotaSummary }),
      },
      budgetLimit: c.monthlyBudgetFen,
      maximumRequestCost: c.reservationFen,
      requestBounds: Object.fromEntries(
        Object.keys(p.requestBounds ?? { understand: 0, generate: 0 }).map(k => [k, c.reservationFen]),
      ),
      maxConcurrent: c.maxConcurrent,
    }),
  };
}
