import { financeLabel, financeCopy, type FinanceLanguage } from './copy';
import './finance.css';
export function aggregateTaskCosts(rows: { task: string; settledFen: number; pendingFen: number }[]) {
  const tasks = new Map<string, { task: string; settledFen: number; pendingFen: number }>();
  for (const row of rows) {
    const value = tasks.get(row.task) ?? { task: row.task, settledFen: 0, pendingFen: 0 };
    value.settledFen += row.settledFen;
    value.pendingFen += row.pendingFen;
    tasks.set(row.task, value);
  }
  return [...tasks.values()].sort((a, b) => a.task.localeCompare(b.task));
}
export function TaskCostChart({
  rows,
  language,
}: {
  rows: { task: string; settledFen: number; pendingFen: number }[];
  language: FinanceLanguage;
}) {
  const totals = aggregateTaskCosts(rows),
    max = Math.max(1, ...totals.map(r => r.settledFen + r.pendingFen)),
    t = financeCopy[language];
  if (!totals.length) return null;
  return (
    <figure className="finance-task-chart">
      <figcaption>{language === 'zh' ? '按任务费用' : 'Costs by task'}</figcaption>
      {totals.map(r => (
        <div key={r.task}>
          <p>
            {financeLabel(r.task, language)} · {t.settled} ¥ {(r.settledFen / 100).toFixed(2)} · {t.pending} ¥{' '}
            {(r.pendingFen / 100).toFixed(2)}
          </p>
          <svg
            viewBox="0 0 400 20"
            role="img"
            aria-label={`${financeLabel(r.task, language)}: ${t.settled} ${r.settledFen / 100}, ${t.pending} ${r.pendingFen / 100}`}
          >
            <rect className="finance-chart-settled" x="0" y="0" width={(400 * r.settledFen) / max} height="20" />
            <rect
              className="finance-chart-pending"
              x={(400 * r.settledFen) / max}
              y="0"
              width={(400 * r.pendingFen) / max}
              height="20"
            />
          </svg>
        </div>
      ))}
    </figure>
  );
}
