import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { monthGridDates, monthOf, shiftMonth } from '../../application/plan-calendar';
import { addDays, startDateLabel, weekdayLabel, weekdays } from '../../application/plan-presentation';
import { dateRange, normalizeTrainingDates, selectableDate, type NormalizedDates } from '../../application/training-dates';
import { trainingDaysCopy } from '../../i18n/features/plan/training-days';
import { fill } from '../../i18n/features/onboarding/entry';
import { PrimaryButton } from './kit';
import './training-calendar.css';

export const monthTitle = (month: string, locale: 'zh' | 'en') =>
  new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en', { timeZone: 'UTC', year: 'numeric', month: 'long' }).format(new Date(`${month}-01T00:00:00Z`));

/** Words for a cleaned-up selection: which days were left out and why (conservative, never silent). */
export function droppedNotice(result: Pick<NormalizedDates, 'rest' | 'outside'>, today: string, locale: 'zh' | 'en') {
  const t = trainingDaysCopy[locale], list = (dates: string[]) => dates.map(date => startDateLabel(date, today, locale, false)).join(locale === 'zh' ? '、' : ', ');
  return [result.outside.length ? fill(t.outside, { dates: list(result.outside) }) : '', result.rest.length ? fill(t.rest, { dates: list(result.rest) }) : ''].filter(Boolean).join(' ');
}

interface Drag { anchor: string; current: string; mode: 'add' | 'remove'; pointerId: number }
export interface TrainingCalendarProps {
  locale: 'zh' | 'en';
  /** Today's local date: earlier days cannot be picked. */
  today: string;
  /** Chosen training days (sorted local dates). */
  value: readonly string[];
  onChange: (dates: string[], notice: string) => void;
  disabled?: boolean;
}

/**
 * Month calendar for picking training days: tap toggles one day, press-and-drag picks (or unpicks) a run of
 * days with mouse or touch, arrow keys move between days and Enter/Space toggles (Shift+arrow extends).
 */
export function TrainingCalendar({ locale, today, value, onChange, disabled = false }: TrainingCalendarProps) {
  const t = trainingDaysCopy[locale];
  const [month, setMonth] = useState(() => monthOf(value[0] ?? today));
  const [focus, setFocus] = useState(() => value[0] ?? today);
  const [drag, setDrag] = useState<Drag>();
  const grid = useRef<HTMLOListElement>(null), focusPending = useRef(false);
  const days = useMemo(() => monthGridDates(month), [month]);
  const chosen = useMemo(() => new Set(value), [value]);
  const preview = useMemo(() => new Set(drag ? dateRange(drag.anchor, drag.current) : []), [drag]);
  const minMonth = monthOf(today), maxMonth = monthOf(addDays(today, 14 + 29));
  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focus}"]`)?.focus();
  }, [focus, month]);

  const commit = (next: string[]) => {
    const result = normalizeTrainingDates(next, today);
    onChange(result.dates, droppedNotice(result, today, locale));
  };
  const toggle = (date: string) => {
    if (disabled) return;
    if (chosen.has(date)) commit(value.filter(item => item !== date));
    else if (selectableDate(date, today, value)) commit([...value, date]);
  };
  const dateAt = (x: number, y: number) => {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-date]');
    return element && grid.current?.contains(element) ? element.dataset.date : undefined;
  };
  const down = (event: PointerEvent<HTMLButtonElement>, date: string) => {
    if (disabled || event.button !== 0) return;
    if (!chosen.has(date) && !selectableDate(date, today, value)) return;
    event.preventDefault();
    setDrag({ anchor: date, current: date, mode: chosen.has(date) ? 'remove' : 'add', pointerId: event.pointerId });
    setFocus(date);
  };
  const move = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const date = dateAt(event.clientX, event.clientY);
    if (date && date !== drag.current && date >= today) setDrag({ ...drag, current: date });
  };
  const up = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const range = dateRange(drag.anchor, drag.current);
    setDrag(undefined);
    if (range.length === 1) { toggle(range[0]); return; }
    commit(drag.mode === 'remove' ? value.filter(date => !range.includes(date)) : [...value, ...range.filter(date => date >= today && !chosen.has(date))]);
  };
  useEffect(() => {
    if (!drag) return;
    const end = (event: globalThis.PointerEvent) => up(event as unknown as PointerEvent);
    const cancel = () => setDrag(undefined);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', cancel);
    return () => { window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', cancel); };
  });

  const keyMove = (event: KeyboardEvent<HTMLButtonElement>, date: string) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const next = addDays(date, step);
    if (monthOf(next) < minMonth || monthOf(next) > maxMonth) return;
    focusPending.current = true;
    setFocus(next);
    if (monthOf(next) !== month) setMonth(monthOf(next));
    if (event.shiftKey && !disabled && !chosen.has(next) && selectableDate(next, today, chosen.has(date) ? value : [...value, date])) commit([...value, ...(chosen.has(date) ? [] : [date]), next]);
  };
  const go = (delta: number) => { const next = shiftMonth(month, delta); setMonth(next); setFocus(monthOf(today) === next ? today : `${next}-01`); };
  const sorted = [...value].sort(), title = monthTitle(month, locale);
  const tabDate = days.includes(focus) && monthOf(focus) === month ? focus : days.find(day => monthOf(day) === month)!;
  return <section className="v9-days" aria-label={fill(t.calendar, { month: title })}>
    <div className="v9-days-head">
      <PrimaryButton tone="quiet" size="sm" aria-label={t.prev} disabled={month <= minMonth} onClick={() => go(-1)}><span aria-hidden="true">‹</span></PrimaryButton>
      <h2 className="v9-days-title" aria-live="polite">{title}</h2>
      <PrimaryButton tone="quiet" size="sm" aria-label={t.next} disabled={month >= maxMonth} onClick={() => go(1)}><span aria-hidden="true">›</span></PrimaryButton>
    </div>
    <p className="v9-days-hint">{t.hint}</p>
    <div className="v9-days-weekdays" aria-hidden="true">{weekdays.map(day => <span key={day}>{weekdayLabel(day, locale, true)}</span>)}</div>
    <ol ref={grid} className="v9-days-grid" data-dragging={drag ? 'true' : undefined} onPointerMove={move}>{days.map(date => {
      if (monthOf(date) !== month) return <li key={date}><span className="v9-days-filler v9-num" aria-hidden="true">{Number(date.slice(8))}</span></li>;
      const picked = chosen.has(date), allowed = picked || selectableDate(date, today, value);
      const inPreview = preview.has(date) && (drag?.mode === 'remove' ? picked : allowed || date >= today);
      return <li key={date}><button type="button" className="v9-days-day v8-press" data-date={date} data-preview={inPreview ? drag?.mode : undefined}
        aria-pressed={picked} aria-disabled={!allowed || disabled} aria-current={date === today ? 'date' : undefined} tabIndex={date === tabDate ? 0 : -1}
        aria-label={`${startDateLabel(date, today, locale)} · ${picked ? t.chosen : allowed ? '' : t.unavailable}`.replace(/ · $/, '')}
        onPointerDown={event => down(event, date)}
        onClick={event => { if (event.detail === 0) toggle(date); }}
        onKeyDown={event => keyMove(event, date)} onFocus={() => setFocus(date)}>
        <span className="v9-body v9-days-number">{Number(date.slice(8))}</span>
      </button></li>;
    })}</ol>
    <div className="v9-days-summary">
      <p role="status">{sorted.length ? fill(sorted.length === 1 ? t.selectedOne : t.selected, { count: sorted.length, from: startDateLabel(sorted[0], today, locale), to: startDateLabel(sorted.at(-1)!, today, locale) }) : t.none}</p>
      {sorted.length > 0 && <PrimaryButton tone="text" size="sm" disabled={disabled} onClick={() => onChange([], '')}>{t.clear}</PrimaryButton>}
    </div>
  </section>;
}
