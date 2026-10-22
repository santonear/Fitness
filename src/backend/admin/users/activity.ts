import type { AdminDatabase } from '../core/contracts';
import type { ControlState } from '../../store';
import { assistantUsageReport } from '../../assistant/usage-report';
import { shortId } from '../core/short-id';
import { DEFAULT_TIME_ZONE, todayIn } from '../../../domain/local-date';

/**
 * Account and usage metadata only. Derived from existing records (control
 * audit trail, request ledger, assistant usage rows); no training, health or
 * conversation content is read, and no schema change is needed.
 */
export interface UserActivity {
  registeredAt: number | null;
  lastActiveAt: number | null;
  monthCalls: number;
  monthCostFen: number;
  monthCostUnknown: boolean;
}

function policyMonth(now: number, policy = '{}') {
  let timeZone = DEFAULT_TIME_ZONE;
  try {
    timeZone = (JSON.parse(policy) as { timeZone?: string }).timeZone ?? timeZone;
  } catch {
    /* default */
  }
  return { month: todayIn(timeZone, now).slice(0, 7), timeZone };
}

const registrationEvents = new Set(['invite-redeemed', 'subject-directly-activated']);
const activityEvents = new Set(['invite-redeemed']);

export async function userActivity(
  state: ControlState,
  db: AdminDatabase | undefined,
  now: number,
  policy?: string,
): Promise<Map<string, UserActivity>> {
  const { month, timeZone } = policyMonth(now, policy);
  const result = new Map<string, UserActivity>();
  const ids = Object.keys(state.subjects);
  for (const id of ids) {
    const events = state.audit.filter(a => a.subjectId === id);
    const registered = events.filter(a => registrationEvents.has(a.event.split(':')[0])).map(a => a.at);
    const active = [
      ...events.filter(a => activityEvents.has(a.event.split(':')[0])).map(a => a.at),
      ...Object.values(state.requests)
        .filter(r => r.subjectId === id && r.createdAt !== undefined)
        .map(r => r.createdAt!),
    ];
    const legacy = Object.values(state.requests).filter(r => r.subjectId === id && r.period === month);
    result.set(id, {
      registeredAt: registered.length ? Math.min(...registered) : null,
      lastActiveAt: active.length ? Math.max(...active) : null,
      monthCalls: legacy.length,
      monthCostFen: legacy.reduce((sum, r) => sum + (r.actualCost ?? 0), 0),
      monthCostUnknown: legacy.some(r => r.actualCost === undefined && r.status !== 'released'),
    });
  }
  if (!db) return result;
  const byShort = new Map(ids.map(id => [shortId(id), id] as const));
  try {
    const { rows } = await assistantUsageReport(db, month, timeZone);
    for (const row of rows) {
      const id = byShort.get(row.subject_short_id);
      const entry = id ? result.get(id) : undefined;
      if (!entry) continue;
      entry.monthCalls++;
      entry.monthCostFen += row.estimated_fen ?? 0;
      entry.monthCostUnknown ||= row.estimated_fen === null;
      entry.lastActiveAt = Math.max(entry.lastActiveAt ?? 0, row.at);
    }
  } catch {
    /* usage table not present in this environment */
  }
  try {
    const latest = (
      await db
        .prepare('SELECT subject_id,MAX(at) AS at FROM assistant_requests GROUP BY subject_id')
        .all<{ subject_id: string; at: number }>()
    ).results;
    for (const row of latest) {
      const entry = result.get(row.subject_id);
      if (entry && typeof row.at === 'number') entry.lastActiveAt = Math.max(entry.lastActiveAt ?? 0, row.at);
    }
  } catch {
    /* assistant tables not present in this environment */
  }
  return result;
}
