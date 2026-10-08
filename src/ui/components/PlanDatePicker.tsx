import { useEffect, useRef, useState } from 'react';

/** Date selection is a local draft. Occupancy is advisory here and rechecked by the save transaction. */
export function PlanDatePicker({ locale, today, selected, onChange, occupied, onSelectDate, mode = 'arrange', maxDates = 14, focusDate }: {
  locale: 'zh' | 'en'; today: string; selected: string[]; onChange: (dates: string[]) => void;
  occupied: string[]; onSelectDate?: (date: string) => void; mode?: 'view' | 'arrange'; maxDates?: number; focusDate?: string;
}) {
  const zh = locale === 'zh';
  const [month, setMonth] = useState(today.slice(0, 7));
  const [touchDrag, setTouchDrag] = useState(false);
  const [feedback, setFeedback] = useState('');
  useEffect(() => { if (focusDate && /^\d{4}-\d{2}-\d{2}$/.test(focusDate)) setMonth(focusDate.slice(0, 7)); }, [focusDate]);
  const grid = useRef<HTMLDivElement>(null);
  const current = useRef(selected); current.current = selected;
  const drag = useRef<{ before: string[]; add: boolean; seen: Set<string> } | null>(null);
  const suppress = useRef(false);
  const first = new Date(`${month}-01T12:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) => { const date = new Date(first); date.setUTCDate(1 - offset + index); return date.toISOString().slice(0, 10); });
  function select(date: string, add = !current.current.includes(date)) {
    onSelectDate?.(date);
    if (mode === 'view') return;
    if (occupied.includes(date) && add) { setFeedback(zh ? `${date} 已被占用，请选择其他日期。` : `${date} is occupied. Choose another date.`); return; }
    if (add && !current.current.includes(date) && current.current.length >= maxDates) { setFeedback(zh ? `最多选择 ${maxDates} 个日期。` : `Choose up to ${maxDates} dates.`); return; }
    const next = add ? [...new Set([...current.current, date])].sort() : current.current.filter(value => value !== date);
    current.current = next; onChange(next); setFeedback('');
  }
  function paint(date: string) { const value = drag.current; if (!value || value.seen.has(date)) return; value.seen.add(date); select(date, value.add); }
  function stop() { drag.current = null; }
  function cancel() { if (drag.current) { current.current = drag.current.before; onChange(drag.current.before); } stop(); suppress.current = false; }
  useEffect(() => { function escape(event: KeyboardEvent) { if (event.key === 'Escape') cancel(); } window.addEventListener('pointerup', stop); window.addEventListener('pointercancel', cancel); window.addEventListener('keydown', escape); return () => { window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', escape); }; }, [onChange]);
  useEffect(() => { if (mode === 'view') { stop(); setTouchDrag(false); } }, [mode]);
  function shift(delta: number) { const next = new Date(first); next.setUTCMonth(next.getUTCMonth() + delta); setMonth(next.toISOString().slice(0, 7)); }
  return <div className="v31-date-picker">
    <div className="v31-calendar-header"><h3>{new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(first)}</h3><div className="v31-button-row"><button type="button" aria-label={zh ? '上个月' : 'Previous month'} onClick={() => shift(-1)}>‹</button><button type="button" aria-label={zh ? '下个月' : 'Next month'} onClick={() => shift(1)}>›</button></div></div>
    {mode === 'arrange' && <div className="v31-button-row"><button type="button" className="v31-touch-drag" aria-pressed={touchDrag} onClick={() => { stop(); setTouchDrag(value => !value); }}>{touchDrag ? (zh ? '结束拖选' : 'Finish drag selection') : (zh ? '开启拖选' : 'Enable drag selection')}</button><p className="v31-help">{zh ? `可跨月选择 1–${maxDates} 个不连续日期。选择不会保存计划。` : `Choose 1–${maxDates} exact dates across months. Selection does not save a plan.`}</p></div>}
    <div className={`v31-calendar-grid ${touchDrag ? 'v31-touch-paint' : ''}`} ref={grid} aria-label={zh ? '训练日期日历' : 'Training dates calendar'}
      onPointerMove={event => { if (!drag.current) return; const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-plan-date]'); if (cell && grid.current?.contains(cell)) paint(cell.dataset.planDate!); }}>
      {(zh ? ['一','二','三','四','五','六','日'] : ['M','T','W','T','F','S','S']).map((day, i) => <span className="v31-weekday" key={i}>{day}</span>)}
      {days.map((date, index) => <button type="button" key={date} data-plan-date={date} aria-label={`${date}${occupied.includes(date) ? (zh ? ' 已占用' : ' occupied') : ''}`} aria-pressed={mode === 'arrange' ? selected.includes(date) : undefined} aria-current={date === today ? 'date' : undefined}
        className={`${date.slice(0, 7) !== month ? 'outside-month' : ''} ${occupied.includes(date) ? 'occupied' : ''}`}
        onPointerDown={event => { suppress.current = false; if (mode !== 'arrange' || event.button !== 0 || (event.pointerType === 'touch' && !touchDrag)) return; suppress.current = true; drag.current = { before: [...current.current], add: !current.current.includes(date), seen: new Set() }; paint(date); }}
        onClick={event => { if (event.detail !== 0 && suppress.current) { suppress.current = false; return; } select(date); }}
        onKeyDown={event => { const delta = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[event.key]; if (delta !== undefined && days[index + delta]) { event.preventDefault(); grid.current?.querySelector<HTMLButtonElement>(`[data-plan-date="${days[index + delta]}"]`)?.focus(); } }}>
        <b>{Number(date.slice(8))}</b>{occupied.includes(date) && <span aria-hidden="true" className="v31-occupied-dot">●</span>}
      </button>)}
    </div>
    <p className="v31-help">{zh ? '● 已占用（包括隐藏的已完成训练）' : '● Occupied (including hidden completed training)'}</p>
    {feedback && <p role="status">{feedback}</p>}
  </div>;
}
