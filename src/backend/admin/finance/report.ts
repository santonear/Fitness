import type { ControlState } from '../../store';
import type { AdminDatabase, AdminTodo } from '../core/contracts';
import { z } from 'zod';
import { addDays, todayIn } from '../../../domain/local-date';
import { csvRow } from '../../csv';

const eventSchema = z.strictObject({
  eventKey: z.string().regex(/^[a-f0-9]{64}$/),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  task: z.enum(['generate', 'adjust', 'modify', 'review', 'understand', 'summary']),
  status: z.enum(['settled', 'pending', 'fallback', 'released']),
  costFen: z.number().int().nonnegative(),
  reservedFen: z.number().int().nonnegative(),
  at: z.number().int().nonnegative(),
});
/** Caller hashes a stable request identifier; payload and subject identities are rejected. */
export async function recordFinanceEvent(db: AdminDatabase, input: z.infer<typeof eventSchema>) {
  const e = eventSchema.parse(input);
  if (e.status === 'released') {
    const result = await db
      .prepare(
        "UPDATE admin_finance_events SET status='released',cost_fen=0,reserved_fen=0 WHERE event_key=? AND status='pending'",
      )
      .bind(e.eventKey)
      .run();
    if (!result.success) throw new Error('FINANCE_EVENT_UNAVAILABLE');
    return;
  }
  if (
    (e.status === 'pending' && e.costFen !== 0) ||
    (e.status === 'settled' && e.reservedFen !== 0) ||
    (e.status === 'fallback' && (e.costFen !== 0 || e.reservedFen !== 0))
  )
    throw new Error('INVALID_FINANCE_AMOUNTS');
  const result = await db
    .prepare(
      "INSERT INTO admin_finance_events(event_key,day,task,status,cost_fen,reserved_fen,at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(event_key) DO UPDATE SET status=excluded.status,cost_fen=excluded.cost_fen,reserved_fen=excluded.reserved_fen WHERE admin_finance_events.status='pending' AND excluded.status='settled'",
    )
    .bind(e.eventKey, e.day, e.task, e.status, e.costFen, e.reservedFen, e.at)
    .run();
  if (!result.success) throw new Error('FINANCE_EVENT_UNAVAILABLE');
}
export async function dailyCosts(db: AdminDatabase, month: string) {
  return (
    await db
      .prepare(
        "SELECT day,task,COUNT(*) AS calls,SUM(CASE WHEN status='settled' THEN cost_fen ELSE 0 END) AS settledFen,SUM(CASE WHEN status='pending' THEN reserved_fen ELSE 0 END) AS pendingFen,SUM(CASE WHEN status='fallback' THEN 1 ELSE 0 END) AS fallbacks,MIN(CASE WHEN status='fallback' THEN at END) AS firstAt,MAX(CASE WHEN status='fallback' THEN at END) AS lastAt FROM admin_finance_events WHERE status<>'released' AND day LIKE ? GROUP BY day,task ORDER BY day,task",
      )
      .bind(`${month}-%`)
      .all()
  ).results;
}
export async function recentCosts(db: AdminDatabase, now: number) {
  const end = todayIn('UTC', now),
    start = addDays(end, -6);
  const rows = (
    await db
      .prepare(
        "SELECT day,SUM(CASE WHEN status='settled' THEN cost_fen ELSE 0 END) AS settledFen,SUM(CASE WHEN status='pending' THEN reserved_fen ELSE 0 END) AS pendingFen,SUM(CASE WHEN status='fallback' THEN 1 ELSE 0 END) AS fallbacks,COUNT(*) AS calls FROM admin_finance_events WHERE status<>'released' AND day>=? AND day<=? GROUP BY day ORDER BY day",
      )
      .bind(start, end)
      .all<{ day: string; settledFen: number; pendingFen: number; fallbacks: number; calls: number }>()
  ).results;
  return { start, end, timeZone: 'UTC', rows, historicalDailyCoverage: 'unavailable' as const };
}
/** No paused claim can be inferred from pending rows: approved planning may continue. */
export function reconciliationTodos(state: ControlState): AdminTodo[] {
  const pending = Object.values(state.requests).filter(r => r.status === 'pending').length;
  return pending || state.recoveryRequired
    ? [
        {
          id: 'finance-ledger-reconciliation',
          level: 'alert',
          title: '账本需要核对',
          text: pending
            ? `有 ${pending} 笔调用等待按供应商账单核算。调用是否可用以当前准入状态为准。`
            : '账本标记为需要核对。请检查供应商账单和现有费用记录。',
          actions: [{ label: '逐笔核对', href: '/admin/ledger', key: 'reconcile' }],
          key: pending ? 'ledgerPending' : 'ledgerFlagged',
          params: { count: pending },
        },
      ]
    : [];
}
export const financeLocalDate = (at: number, timeZone: string): string => todayIn(timeZone, at);
const taskOf = (r: ControlState['requests'][string]) =>
  ({ ONBOARD_PLAN: 'generate', ADJUST_TODAY: 'adjust', MODIFY_PLAN: 'modify', PERIOD_REVIEW: 'review' })[
    r.coachContract?.task ?? ''
  ] ?? r.operation;
function ledgerRows(state: ControlState, timeZone: string) {
  return Object.values(state.requests)
    .filter(r => r.status !== 'released')
    .map(r => ({
      subjectShortId: r.subjectId.slice(0, 8),
      requestShortId: r.requestId.slice(0, 8),
      operation: r.operation,
      task: taskOf(r),
      status: r.status,
      period: r.period,
      day: r.createdAt === undefined ? null : financeLocalDate(r.createdAt, timeZone),
      reservedFen: ['reserved', 'submitted', 'pending'].includes(r.status) ? r.bound : 0,
      settledFen: r.status === 'settled' ? (r.actualCost ?? 0) : 0,
    }));
}
export function ledgerProjection(state: ControlState, month: string, timeZone = 'UTC') {
  const rows = ledgerRows(state, timeZone).filter(r => (r.day ? r.day.startsWith(month) : r.period === month));
  const recorded = Object.values(state.requests)
    .filter(r => r.period === month)
    .reduce((sum, r) => sum + (r.status === 'settled' ? (r.actualCost ?? 0) : 0), 0);
  const unattributedFen = Math.max(0, (state.budgets[month]?.spent ?? 0) - recorded);
  return {
    month,
    timeZone,
    settledFen: rows.reduce((sum, r) => sum + r.settledFen, 0) + unattributedFen,
    pendingFen: rows.reduce((sum, r) => sum + r.reservedFen, 0),
    unattributedFen,
    rows,
    historicalDailyCoverage: 'unavailable',
  };
}
export function ledgerDailyCosts(
  state: ControlState,
  timeZone: string,
  fallbacks: readonly { task: string; at: number }[] = [],
) {
  const days = new Map<
    string,
    {
      day: string;
      task: string;
      calls: number;
      settledFen: number;
      pendingFen: number;
      fallbacks: number;
      firstAt: number;
      lastAt: number;
    }
  >();
  for (const row of ledgerRows(state, timeZone)) {
    if (!row.day) continue;
    const key = row.day + ':' + row.task;
    const bucket = days.get(key) ?? {
      day: row.day,
      task: row.task,
      calls: 0,
      settledFen: 0,
      pendingFen: 0,
      fallbacks: 0,
      firstAt: 0,
      lastAt: 0,
    };
    bucket.calls++;
    bucket.settledFen += row.settledFen;
    bucket.pendingFen += row.reservedFen;
    days.set(key, bucket);
  }
  for (const event of fallbacks) {
    const day = financeLocalDate(event.at, timeZone),
      key = day + ':' + event.task,
      bucket = days.get(key) ?? {
        day,
        task: event.task,
        calls: 0,
        settledFen: 0,
        pendingFen: 0,
        fallbacks: 0,
        firstAt: event.at,
        lastAt: event.at,
      };
    bucket.calls++;
    bucket.fallbacks++;
    bucket.firstAt = bucket.firstAt ? Math.min(bucket.firstAt, event.at) : event.at;
    bucket.lastAt = Math.max(bucket.lastAt, event.at);
    days.set(key, bucket);
  }
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day) || a.task.localeCompare(b.task));
}
export function ledgerRecentCosts(
  state: ControlState,
  now: number,
  timeZone: string,
  fallbacks: readonly { task: string; at: number }[] = [],
) {
  const end = financeLocalDate(now, timeZone),
    start = addDays(end, -6);
  const rows = ledgerDailyCosts(state, timeZone, fallbacks).filter(row => row.day >= start && row.day <= end);
  const days = new Map<
    string,
    { day: string; settledFen: number; pendingFen: number; fallbacks: number; calls: number }
  >();
  for (const row of rows) {
    const day = days.get(row.day) ?? { day: row.day, settledFen: 0, pendingFen: 0, fallbacks: 0, calls: 0 };
    day.settledFen += row.settledFen;
    day.pendingFen += row.pendingFen;
    day.calls += row.calls;
    day.fallbacks += row.fallbacks;
    days.set(row.day, day);
  }
  return { start, end, timeZone, rows: [...days.values()], historicalDailyCoverage: 'unavailable' as const };
}
export function financeTodos(spent: number, pending: number, budget: number, month: string): AdminTodo[] {
  const ratio = (spent + pending) / budget,
    threshold = ratio >= 1 ? 100 : ratio >= 0.8 ? 80 : ratio >= 0.5 ? 50 : 0;
  return threshold
    ? [
        {
          id: `finance-budget-${month}-${threshold}`,
          level: threshold === 100 ? 'alert' : threshold === 80 ? 'warn' : 'info',
          title: `本月预算已用 ${Math.round(ratio * 100)}%（¥${((spent + pending) / 100).toFixed(2)} / ¥${(budget / 100).toFixed(2)}）`,
          text: '包含已核算费用与待核算预留；不改变当前调用准入规则。',
          actions: [{ label: '查看费用', href: '/admin/ledger', key: 'viewCosts' }],
          key: 'budgetUsed',
          params: {
            percent: Math.round(ratio * 100),
            spent: ((spent + pending) / 100).toFixed(2),
            budget: (budget / 100).toFixed(2),
          },
        },
      ]
    : [];
}
export function ledgerCsv(value: ReturnType<typeof ledgerProjection>) {
  const rows = [
    ['month', 'subject', 'request', 'task', 'status', 'reserved_fen', 'settled_fen'],
    ...value.rows.map(r => [
      value.month,
      r.subjectShortId,
      r.requestShortId,
      r.task,
      r.status,
      r.reservedFen,
      r.settledFen,
    ]),
    [value.month, '', '', '', 'unattributed', 0, value.unattributedFen],
  ];
  return '\uFEFF' + rows.map(csvRow).join('');
}
