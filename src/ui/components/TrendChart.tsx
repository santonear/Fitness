import type { CSSProperties } from 'react';
import type { TrendPoint } from '../../application/my-changes';
import './trend-chart.css';

interface TrendChartProps {
  points: readonly TrendPoint[];
  /** Accessible summary of the chart (the numbers are also shown as text next to it). */
  label: string;
  /** Chart color slot 1–4 (`--chart-N`). */
  tone?: 1 | 2 | 3 | 4;
  variant?: 'line' | 'bars';
}
const W = 300,
  H = 96,
  PAD = 8;
/** Small trend chart for 我的变化: a line of dated values or monthly bars. Tokens only; values are listed in text by the caller. */
export function TrendChart({ points, label, tone = 1, variant = 'line' }: TrendChartProps) {
  if (!points.length) return null;
  const values = points.map(point => point.value),
    min = variant === 'bars' ? 0 : Math.min(...values),
    max = Math.max(...values);
  const span = max - min || 1,
    y = (value: number) => H - PAD - ((value - min) / span) * (H - PAD * 2);
  const x = (index: number) => (points.length === 1 ? W / 2 : PAD + (index / (points.length - 1)) * (W - PAD * 2));
  const style = { '--trend-color': `var(--chart-${tone})` } as CSSProperties;
  if (variant === 'bars') {
    const slot = (W - PAD * 2) / points.length,
      bar = Math.max(4, slot * 0.55);
    return (
      <svg className="v9-trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={style}>
        <line className="v9-trend-base" x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} />
        {points.map((point, index) => {
          const top = max ? y(point.value) : H - PAD;
          return (
            <rect
              key={point.date}
              className="v9-trend-bar"
              x={PAD + slot * index + (slot - bar) / 2}
              y={top}
              width={bar}
              height={Math.max(0, H - PAD - top)}
              rx={2}
            />
          );
        })}
      </svg>
    );
  }
  const path = points
    .map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`)
    .join(' ');
  return (
    <svg className="v9-trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={style}>
      <line className="v9-trend-base" x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} />
      {points.length > 1 && <path className="v9-trend-line" d={path} vectorEffect="non-scaling-stroke" />}
      {points.map((point, index) => (
        <circle
          key={point.date}
          className="v9-trend-dot"
          cx={x(index)}
          cy={y(point.value)}
          r={3}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
