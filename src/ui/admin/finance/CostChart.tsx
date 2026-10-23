import { financeCopy, type FinanceLanguage } from './copy';
import './finance.css';
/** `series` relabels the bars (e.g. one estimated-cost series); `detail` adds per-day text to the bar's tooltip. */
export function CostChart({
  rows,
  language,
  series,
}: {
  rows: { day: string; settledFen: number; pendingFen: number; detail?: string }[];
  language: FinanceLanguage;
  series?: { settled: string; pending?: string };
}) {
  const t = financeCopy[language],
    labels = series ?? { settled: t.settled, pending: t.pending },
    caption = [labels.settled, labels.pending].filter(Boolean).join(' / '),
    days = new Map<string, { settled: number; pending: number; detail?: string }>();
  for (const r of rows) {
    const d = days.get(r.day) ?? { settled: 0, pending: 0 };
    d.settled += r.settledFen;
    d.pending += r.pendingFen;
    d.detail ??= r.detail;
    days.set(r.day, d);
  }
  const entries = [...days.entries()].sort(([a], [b]) => a.localeCompare(b)),
    max = Math.max(1, ...entries.map(([, v]) => v.settled + v.pending));
  if (!entries.length) return null;
  return (
    <figure className="finance-chart">
      <figcaption>{caption}</figcaption>
      <div className="admin-scroll">
        <svg
          viewBox={`0 0 ${Math.max(entries.length * 34, 300)} 160`}
          role="img"
          aria-label={`${t.costs}: ${entries[0][0]} – ${entries.at(-1)![0]}`}
        >
          <title>{caption}</title>
          {entries.map(([day, v], i) => (
            <g key={day}>
              <title>
                {day}: {labels.settled} {v.settled / 100}
                {labels.pending ? `; ${labels.pending} ${v.pending / 100}` : ''}
                {v.detail ? `; ${v.detail}` : ''}
              </title>
              <rect
                className="finance-chart-settled"
                x={i * 34 + 5}
                y={130 - (v.settled / max) * 110}
                width="22"
                height={(v.settled / max) * 110}
              />
              <rect
                className="finance-chart-pending"
                x={i * 34 + 5}
                y={130 - ((v.settled + v.pending) / max) * 110}
                width="22"
                height={(v.pending / max) * 110}
              />
              <text x={i * 34 + 16} y="151" textAnchor="middle">
                {day.slice(-2)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </figure>
  );
}
