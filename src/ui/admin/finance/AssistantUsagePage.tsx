import { useEffect, useState } from 'react';
import { useFeature } from '../../useFeature';
import { adminRequest } from '../shared/api';
import type { assistantUsageReport } from '../../../backend/assistant/usage-report';
import { addDays, todayIn } from '../../../domain/local-date';
import { CostChart } from './CostChart';
import { financeLabel, usageResultLabel, usageResultOutcome } from './copy';
type Report = Awaited<ReturnType<typeof assistantUsageReport>>;
type Language = 'zh' | 'en';
const copy = {
  zh: {
    month: '月份',
    user: '用户 ID',
    task: '用途',
    all: '全部',
    day: '日期',
    calls: '调用次数',
    input: '发送量（token）',
    output: '回复量（token）',
    cost: '估算费用',
    unknown: '部分未计价',
    export: '导出 CSV',
    note: '费用按服务商公开价格估算，仅供参考，不影响用户能否使用。',
    archive: '条早期记录没有费用信息，未计入统计；不影响现在的使用。',
    error: '用量暂时无法读取',
    loading: '正在读取',
    result: '结果',
    empty: '这个月还没有 AI 调用记录。',
    summary: '本月芽芽概况',
    summaryNote: '按用途汇总本月调用；只统计次数、结果和费用，不包含对话内容。',
    success: '成功率',
    users: '使用人数',
    failed: '失败',
    total: '合计',
    detail: '逐日明细在「用量」页。',
    today: '今天的 AI 用量',
    todayNote: '只统计调用次数和估算费用，不包含对话内容。',
    week: '近 7 天估算费用',
    weekEmpty: '近 7 天还没有 AI 调用记录。',
  },
  en: {
    month: 'Month',
    user: 'User ID',
    task: 'Purpose',
    all: 'All',
    day: 'Date',
    calls: 'Calls',
    input: 'Sent (tokens)',
    output: 'Replies (tokens)',
    cost: 'Estimated cost',
    unknown: 'some unpriced',
    export: 'Export CSV',
    note: 'Costs are estimated from the provider’s public prices for reference only; they never affect whether a user can use AI.',
    archive: 'early records have no cost information and are not counted. Current use is unaffected.',
    error: 'Unable to load usage',
    loading: 'Loading',
    result: 'Result',
    empty: 'No AI calls recorded this month.',
    summary: 'Yaya this month',
    summaryNote: 'Calls this month grouped by purpose: counts, results and cost only, never conversation content.',
    success: 'Success rate',
    users: 'Users',
    failed: 'Failed',
    total: 'Total',
    detail: 'Daily details are on the Usage page.',
    today: 'AI usage today',
    todayNote: 'Call counts and estimated cost only, never conversation content.',
    week: 'Estimated cost, last 7 days',
    weekEmpty: 'No AI calls recorded in the last 7 days.',
  },
};
const taskLabel = (task: string, language: Language) =>
  task === 'CHAT' ? (language === 'zh' ? '对话' : 'Chat') : financeLabel(task, language);
const currentMonth = () => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit' }).format(Date.now());
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
/** `previous` adds an earlier month's rows, for a 7-day window that crosses a month end. */
function useUsage(month: string, previous = month) {
  const [report, setReport] = useState<Report>(),
    [failed, setFailed] = useState(false);
  const zone = encodeURIComponent(browserTimeZone()),
    query = `month=${month}&timeZone=${zone}`;
  useEffect(() => {
    let live = true;
    setFailed(false);
    setReport(undefined);
    Promise.all(
      [month, ...(previous === month ? [] : [previous])].map(m =>
        adminRequest<Report>(`finance/usage?month=${m}&timeZone=${zone}`),
      ),
    )
      .then(([first, earlier]) => {
        if (live) setReport(earlier ? { ...first, rows: [...first.rows, ...earlier.rows] } : first);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [month, previous, zone]);
  return { report, failed, query };
}
const fen = (value: number, unknown: boolean, t: typeof copy.zh) =>
  `¥${(value / 100).toFixed(2)}${unknown ? ` + ${t.unknown}` : ''}`;
const tokens = (value: number, unknown: boolean, t: typeof copy.zh) =>
  `${value.toLocaleString()}${unknown ? ` + ${t.unknown}` : ''}`;

/** 用量 page: the one place the per-day usage table appears. */
export function AssistantUsagePage({ language = 'zh' }: { language?: Language }) {
  const t = copy[language],
    [month, setMonth] = useState(currentMonth),
    [user, setUser] = useState(''),
    [task, setTask] = useState(''),
    { report, failed, query } = useUsage(month);
  const rows = (report?.rows ?? []).filter(r => (!user || r.subject_short_id === user) && (!task || r.task === task));
  const groups = new Map<
    string,
    {
      day: string;
      user: string;
      task: string;
      calls: number;
      input: number;
      output: number;
      cost: number;
      unknown: boolean;
      result: string;
      unknownInput: boolean;
      unknownOutput: boolean;
    }
  >();
  for (const r of rows) {
    const key = [r.day, r.subject_short_id, r.task, usageResultLabel(r.result, language)].join(':');
    const g = groups.get(key) ?? {
      day: r.day,
      user: r.subject_short_id,
      task: r.task,
      calls: 0,
      input: 0,
      output: 0,
      cost: 0,
      unknown: false,
      result: r.result,
      unknownInput: false,
      unknownOutput: false,
    };
    g.calls++;
    g.unknownInput ||= r.input_tokens === null;
    g.unknownOutput ||= r.output_tokens === null;
    g.input += r.input_tokens ?? 0;
    g.output += r.output_tokens ?? 0;
    g.cost += r.estimated_fen ?? 0;
    g.unknown ||= r.estimated_fen === null;
    groups.set(key, g);
  }
  return (
    <section className="admin-card">
      <p className="admin-muted">{t.note}</p>
      <div className="admin-actions admin-filters">
        <label>
          {t.month}
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
        </label>
        <label>
          {t.user}
          <select value={user} onChange={e => setUser(e.target.value)}>
            <option value="">{t.all}</option>
            {[...new Set(report?.rows.map(r => r.subject_short_id))].map(v => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          {t.task}
          <select value={task} onChange={e => setTask(e.target.value)}>
            <option value="">{t.all}</option>
            {[...new Set(report?.rows.map(r => r.task))].map(v => (
              <option key={v} value={v}>
                {taskLabel(v, language)}
              </option>
            ))}
          </select>
        </label>
        <a
          className="admin-chip-link"
          href={`/api/v1/management/console/finance/usage-export?${query}&user=${encodeURIComponent(user)}&task=${encodeURIComponent(task)}`}
        >
          {t.export}
        </a>
      </div>
      {failed ? (
        <p role="alert">{t.error}</p>
      ) : !report ? (
        <p role="status">{t.loading}</p>
      ) : (
        <>
          {report.archived > 0 && (
            <p className="admin-muted">
              {report.archived} {t.archive}
            </p>
          )}
          <div className="admin-scroll">
            <table>
              <thead>
                <tr>
                  {[t.day, t.user, t.task, t.calls, t.input, t.output, t.cost, t.result].map((h, i) => (
                    <th key={h} scope="col" className={i >= 3 && i <= 6 ? 'admin-num' : undefined}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...groups.values()].map(g => (
                  <tr key={g.day + g.user + g.task + g.result}>
                    <td className="admin-nowrap">{g.day}</td>
                    <td className="admin-id">{g.user}</td>
                    <td>{taskLabel(g.task, language)}</td>
                    <td className="admin-num">{g.calls}</td>
                    <td className="admin-num">{tokens(g.input, g.unknownInput, t)}</td>
                    <td className="admin-num">{tokens(g.output, g.unknownOutput, t)}</td>
                    <td className="admin-num">{fen(g.cost, g.unknown, t)}</td>
                    <td>{usageResultLabel(g.result, language)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!groups.size && <p className="admin-empty">{t.empty}</p>}
        </>
      )}
    </section>
  );
}

/** 芽芽 page: assistant-specific summary for the current month, not the usage table. */
export function AssistantSummary({ language = 'zh' }: { language?: Language }) {
  const t = copy[language],
    { report, failed } = useUsage(currentMonth());
  const byTask = new Map<
    string,
    { task: string; calls: number; ok: number; failed: number; cost: number; unknown: boolean; users: Set<string> }
  >();
  for (const r of report?.rows ?? []) {
    const g = byTask.get(r.task) ?? {
      task: r.task,
      calls: 0,
      ok: 0,
      failed: 0,
      cost: 0,
      unknown: false,
      users: new Set<string>(),
    };
    g.calls++;
    if (usageResultOutcome(r.result) === 'failed') g.failed++;
    else g.ok++;
    g.cost += r.estimated_fen ?? 0;
    g.unknown ||= r.estimated_fen === null;
    g.users.add(r.subject_short_id);
    byTask.set(r.task, g);
  }
  const list = [...byTask.values()].sort((a, b) => b.calls - a.calls);
  const total = list.reduce(
    (s, g) => ({
      calls: s.calls + g.calls,
      ok: s.ok + g.ok,
      failed: s.failed + g.failed,
      cost: s.cost + g.cost,
      unknown: s.unknown || g.unknown,
    }),
    { calls: 0, ok: 0, failed: 0, cost: 0, unknown: false },
  );
  const users = new Set(report?.rows.map(r => r.subject_short_id)).size;
  const rate = (ok: number, calls: number) => (calls ? `${Math.round((ok / calls) * 100)}%` : '—');
  return (
    <section className="admin-card" aria-label={t.summary}>
      <h2>{t.summary}</h2>
      <p className="admin-muted">{t.summaryNote}</p>
      {failed ? (
        <p role="alert">{t.error}</p>
      ) : !report ? (
        <p role="status">{t.loading}</p>
      ) : !list.length ? (
        <p className="admin-empty">{t.empty}</p>
      ) : (
        <>
          <div className="admin-figures">
            <div>
              <span>{t.calls}</span>
              <strong>{total.calls.toLocaleString()}</strong>
            </div>
            <div>
              <span>{t.success}</span>
              <strong>{rate(total.ok, total.calls)}</strong>
            </div>
            <div>
              <span>{t.users}</span>
              <strong>{users}</strong>
            </div>
            <div>
              <span>{t.cost}</span>
              <strong>{fen(total.cost, false, t)}</strong>
              {total.unknown && <small className="admin-muted">{t.unknown}</small>}
            </div>
          </div>
          <div className="admin-scroll">
            <table>
              <thead>
                <tr>
                  {[t.task, t.calls, t.success, t.failed, t.users, t.cost].map((h, i) => (
                    <th key={h} scope="col" className={i ? 'admin-num' : undefined}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map(g => (
                  <tr key={g.task}>
                    <td>{taskLabel(g.task, language)}</td>
                    <td className="admin-num">{g.calls}</td>
                    <td className="admin-num">{rate(g.ok, g.calls)}</td>
                    <td className="admin-num">{g.failed}</td>
                    <td className="admin-num">{g.users.size}</td>
                    <td className="admin-num">{fen(g.cost, g.unknown, t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="admin-muted">{t.detail}</p>
        </>
      )}
    </section>
  );
}

/** Aggregate calls and estimated cost per local day for the 7 days ending `today`; never user content. */
export function recentUsage(
  rows: readonly Pick<Report['rows'][number], 'day' | 'subject_short_id' | 'estimated_fen'>[],
  today: string,
) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map(day => {
    const own = rows.filter(r => r.day === day);
    return {
      day,
      calls: own.length,
      fen: own.reduce((sum, r) => sum + (r.estimated_fen ?? 0), 0),
      unknown: own.some(r => r.estimated_fen === null),
      users: new Set(own.map(r => r.subject_short_id)).size,
    };
  });
  return { days, today: days[6], empty: days.every(d => !d.calls) };
}

/** 待办 page: today's figures and the 7-day estimated-cost chart (UIUX 后台 3、5.3). */
export function TodayUsage({ language = 'zh' }: { language?: Language }) {
  return useFeature('aiAssistantV2') ? <AssistantToday language={language} /> : null;
}
function AssistantToday({ language }: { language: Language }) {
  const t = copy[language],
    today = todayIn(browserTimeZone()),
    { report, failed } = useUsage(today.slice(0, 7), addDays(today, -6).slice(0, 7)),
    usage = report && recentUsage(report.rows, today);
  return (
    <section className="admin-card" aria-label={t.today}>
      <h2>{t.today}</h2>
      <p className="admin-muted">{t.todayNote}</p>
      {failed ? (
        <p role="alert">{t.error}</p>
      ) : !usage ? (
        <p role="status">{t.loading}</p>
      ) : (
        <>
          <div className="admin-figures">
            <div>
              <span>{t.calls}</span>
              <strong>{usage.today.calls.toLocaleString()}</strong>
            </div>
            <div>
              <span>{t.cost}</span>
              <strong>{fen(usage.today.fen, false, t)}</strong>
              {usage.today.unknown && <small className="admin-muted">{t.unknown}</small>}
            </div>
            <div>
              <span>{t.users}</span>
              <strong>{usage.today.users}</strong>
            </div>
          </div>
          {usage.empty ? (
            <p className="admin-empty">{t.weekEmpty}</p>
          ) : (
            <CostChart
              language={language}
              series={{ settled: t.week }}
              rows={usage.days.map(d => ({
                day: d.day,
                settledFen: d.fen,
                pendingFen: 0,
                detail: `${t.calls} ${d.calls}${d.unknown ? ` + ${t.unknown}` : ''}`,
              }))}
            />
          )}
        </>
      )}
    </section>
  );
}
