import { useState, type CSSProperties } from 'react';
import { SegmentedTabs } from '../../components/kit';
import type { ChartMetric, ChartPoint } from '../../../application/review/charts';
import './review.css';

export interface ReviewChartCopy { metric: string; sessions: string; volume: string; minutesMetric: string; sessionsUnit: string; volumeUnit: string; minutesUnit: string; chartTotal: string; chartEmpty: string }
const series: Record<ChartMetric, 1 | 2 | 3> = { sessions: 1, volumeKg: 2, minutes: 3 };
const round = (value: number) => Math.round(value * 10) / 10;

/** Bar chart for sessions, total lifted or minutes; the highest bar is highlighted. Colors come from --chart-1..3 only. */
export function ReviewChart({ title, points, labels, copy, current }: { title: string; points: readonly ChartPoint[]; labels: readonly string[]; copy: ReviewChartCopy; current?: string }) {
  const [metric, setMetric] = useState<ChartMetric>('sessions');
  const unit = metric === 'sessions' ? copy.sessionsUnit : metric === 'volumeKg' ? copy.volumeUnit : copy.minutesUnit;
  const values = points.map(point => round(point[metric]));
  const max = Math.max(1, ...values), total = round(values.reduce((sum, value) => sum + value, 0));
  const peak = Math.max(...values);
  const summary = `${title}: ${labels.map((label, index) => `${label} ${values[index]} ${unit}`).join(', ')}`;
  return <section className="rv-chart v9-card" data-variant="raised" data-padding="md" aria-label={title}>
    <div className="rv-chart-head">
      <h2 className="rv-section-title v9-body">{title}</h2>
      <p className="rv-chart-total"><span className="v9-num">{total}</span> <span>{unit}</span></p>
    </div>
    <SegmentedTabs label={copy.metric} value={metric} onChange={value => setMetric(value as ChartMetric)}
      options={[{ value: 'sessions', label: copy.sessions }, { value: 'volumeKg', label: copy.volume }, { value: 'minutes', label: copy.minutesMetric }]} />
    <div className="rv-bars" role="img" aria-label={summary} data-series={series[metric]} style={{ '--rv-count': points.length } as CSSProperties}>
      {points.map((point, index) => <div key={point.key} className="rv-bar" aria-hidden="true"
        data-peak={values[index] > 0 && values[index] === peak ? 'true' : 'false'}
        data-current={current && point.from <= current && current <= point.to ? 'true' : 'false'}>
        <span className="rv-bar-value v9-num">{values[index] || ''}</span>
        <span className="rv-bar-track"><span className="rv-bar-fill" style={{ '--rv-level': values[index] / max } as CSSProperties} /></span>
        <span className="rv-bar-label">{labels[index]}</span>
      </div>)}
    </div>
  </section>;
}
