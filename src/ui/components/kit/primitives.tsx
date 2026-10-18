import { useId, type ButtonHTMLAttributes, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import './kit.css';

/**
 * V9 themeable primitives (docs/design/v9). Every visual value comes from var(--…) tokens,
 * so the same markup renders as pop / vivid / gentle / data / fire.
 */
const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export interface PrimaryButtonProps extends ButtonProps {
  /** primary: theme paint (yellow jelly, sage clay, lime, cyan jelly, red jelly); quiet: raised surface; text: inline link. */
  tone?: 'primary' | 'quiet' | 'text' | 'warn';
  size?: 'lg' | 'md' | 'sm';
  /** Stretch to the container width (default for lg). */
  block?: boolean;
}
export function PrimaryButton({ tone = 'primary', size = 'lg', block, className, type = 'button', ...props }: PrimaryButtonProps) {
  return <button {...props} type={type} className={cx('v9-btn', 'v8-press', className)} data-tone={tone} data-size={size} data-block={(block ?? size === 'lg') ? 'true' : 'false'} />;
}

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** raised: theme card; inset: recessed well; hero: large signature card; flat: no elevation. */
  variant?: 'raised' | 'inset' | 'hero' | 'flat';
  as?: 'div' | 'section' | 'article' | 'li' | 'aside';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}
export function Card({ variant = 'raised', as: Tag = 'div', padding = 'md', className, ...props }: CardProps) {
  return <Tag {...props} className={cx('v9-card', className)} data-variant={variant} data-padding={padding} />;
}

export interface ChoiceChipProps extends Omit<ButtonProps, 'aria-pressed'> { selected: boolean; size?: 'md' | 'sm' }
/** Pill choice (onboarding options, quick replies). Uses aria-pressed for multi-select groups. */
export function ChoiceChip({ selected, size = 'md', className, type = 'button', ...props }: ChoiceChipProps) {
  return <button {...props} type={type} aria-pressed={selected} className={cx('v9-chip', 'v8-press', className)} data-size={size} />;
}

export interface BigChoiceProps extends Omit<ButtonProps, 'aria-pressed' | 'role'> {
  selected: boolean;
  label: ReactNode;
  description?: ReactNode;
  /** radio: single choice inside a radiogroup; check: independent toggle. */
  kind?: 'radio' | 'check';
}
/** One-question-per-screen answer: large tap target with optional explanation. */
export function BigChoice({ selected, label, description, kind = 'radio', className, type = 'button', ...props }: BigChoiceProps) {
  const state = kind === 'radio' ? { role: 'radio', 'aria-checked': selected } : { 'aria-pressed': selected };
  return <button {...props} {...state} type={type} className={cx('v9-choice', 'v8-press', className)} data-kind={kind}>
    <span className="v9-choice-mark" aria-hidden="true" />
    <span className="v9-choice-text"><span className="v9-choice-label">{label}</span>{description && <span className="v9-choice-description">{description}</span>}</span>
  </button>;
}

export interface SegmentedTabsProps {
  label: string;
  options: readonly { value: string; label: ReactNode }[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}
/** Recessed tray with one raised segment (plan weeks, review metric). */
export function SegmentedTabs({ label, options, value, onChange, disabled }: SegmentedTabsProps) {
  return <div className="v9-segmented" role="radiogroup" aria-label={label}>{options.map(option =>
    <button key={option.value} type="button" role="radio" aria-checked={option.value === value} disabled={disabled}
      className="v9-segment v8-press" onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}

export interface ProgressRingProps {
  /** 0–1. */
  value: number;
  size?: number;
  stroke?: number;
  /** meter: theme gradient; 1–4: chart series colors (for stacked data rings). */
  tone?: 'meter' | 1 | 2 | 3 | 4;
  /** Accessible description; omit for decorative rings next to visible numbers. */
  label?: string;
  children?: ReactNode;
  /** Raised dial behind the ring (pop) is drawn by the theme card; set false for bare rings. */
  dial?: boolean;
  className?: string;
}
export function ProgressRing({ value, size = 84, stroke = 7, tone = 'meter', label, children, dial = true, className }: ProgressRingProps) {
  const id = useId().replace(/:/g, '');
  const ratio = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const r = (size - stroke) / 2 - 1, c = 2 * Math.PI * r;
  const paint = tone === 'meter' ? `url(#${id})` : `var(--chart-${tone})`;
  const semantics = label ? { role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(ratio * 100) } : {};
  return <div {...semantics} className={cx('v9-ring', className)} data-dial={dial ? 'on' : 'off'} data-tone={String(tone)} style={{ '--ring-size': `${size}px` } as CSSProperties}>
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true" focusable="false">
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" className="v9-ring-from" /><stop offset="1" className="v9-ring-to" /></linearGradient></defs>
      <circle className="v9-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
      {ratio > 0 && <circle className="v9-ring-value" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} stroke={paint}
        strokeDasharray={`${c * ratio} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />}
    </svg>
    {children !== undefined && <div className="v9-ring-center">{children}</div>}
  </div>;
}

export const formatClock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
export interface CountdownRingProps extends Omit<ProgressRingProps, 'value' | 'children' | 'label'> {
  remaining: number;
  total: number;
  /** Visible caption under the time, e.g. 秒后继续 / 保持. */
  caption?: ReactNode;
  label: string;
}
/**
 * Timed hold or user-started timer. Pages must keep AGENTS §3: no automatic next set,
 * and no countdown announced every second (role=timer is polite by default and not live-updated).
 */
export function CountdownRing({ remaining, total, caption, label, size = 190, stroke = 10, ...props }: CountdownRingProps) {
  return <ProgressRing {...props} size={size} stroke={stroke} value={total > 0 ? remaining / total : 0}>
    <span className="v9-ring-time v9-num" role="timer" aria-label={label}>{formatClock(remaining)}</span>
    {caption && <span className="v9-ring-caption">{caption}</span>}
  </ProgressRing>;
}

export interface StatTileProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  /** Optional 0–1 progress drawn as a ring around the value. */
  progress?: number;
  emphasis?: boolean;
}
export function StatTile({ label, value, unit, progress, emphasis, className, ...props }: StatTileProps) {
  const number = <span className="v9-stat-value v9-num" data-emphasis={emphasis ? 'true' : 'false'}>{value}{unit && <span className="v9-stat-unit">{unit}</span>}</span>;
  return <div {...props} className={cx('v9-stat', className)}>
    {progress === undefined ? number : <ProgressRing value={progress} size={84} stroke={7}>{number}</ProgressRing>}
    <span className="v9-stat-label">{label}</span>
  </div>;
}

export type WeekDayState = 'done' | 'partial' | 'planned' | 'rest' | 'missed';
export interface WeekStripDay { key: string; label: ReactNode; state: WeekDayState; today?: boolean; /** Optional 0–1 bar height (planned minutes). */ level?: number; description?: string }
export interface WeekStripProps { label: string; days: readonly WeekStripDay[]; variant?: 'dots' | 'bars'; onSelect?: (key: string) => void }
/** Seven-day strip used by home, plan and review. States are text-described for screen readers. */
export function WeekStrip({ label, days, variant = 'dots', onSelect }: WeekStripProps) {
  return <ol className="v9-week" aria-label={label} data-variant={variant}>{days.map(day => {
    const content = <>
      <span className="v9-week-mark" aria-hidden="true" style={day.level === undefined ? undefined : { '--level': Math.min(1, Math.max(0, day.level)) } as CSSProperties}><span /></span>
      <span className="v9-week-label">{day.label}</span>
    </>;
    return <li key={day.key} className="v9-week-day" data-state={day.state} data-today={day.today ? 'true' : 'false'} aria-current={day.today ? 'date' : undefined} aria-label={day.description}>
      {onSelect ? <button type="button" className="v9-week-button" onClick={() => onSelect(day.key)}>{content}</button> : content}
    </li>;
  })}</ol>;
}

