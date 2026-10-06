import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { dateInZone } from '../../../application/progress';
import '../../training-calendar.css';
import type { PlanVersion, ScheduledWorkout } from '../../../domain/models';
import { exercises } from '../../../catalog/exercises';
import { formatGuidedTargets } from './ProgramDashboard';

export function TrainingCalendar({ locale, today, tasks, versions, timeZone }: {
  locale: 'zh' | 'en'; today: string; tasks: ScheduledWorkout[]; versions: PlanVersion[]; timeZone: string;
}) {
  const zh = locale === 'zh';
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [view, setView] = useState<'month' | 'day'>('month');
  const [multi, setMulti] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());
  const grid = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ before: string[]; add: boolean; seen: Set<string> } | null>(null);
  const suppressClick = useRef(false);
  const shiftDate = (date: string, delta: number) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + delta); return value.toISOString().slice(0,10); };
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()),30_000); return () => clearInterval(timer); },[]);
  useEffect(() => {
    const stop = () => { dragging.current = null; };
    const cancel = () => { if (dragging.current) setSelectedDates(dragging.current.before); stop(); suppressClick.current = false; };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    window.addEventListener('pointerup',stop); window.addEventListener('pointercancel',cancel); window.addEventListener('keydown',escape);
    return () => { window.removeEventListener('pointerup',stop); window.removeEventListener('pointercancel',cancel); window.removeEventListener('keydown',escape); };
  },[]);
  function dragDate(date: string) { const gesture = dragging.current; if (!gesture || gesture.seen.has(date)) return; gesture.seen.add(date); setSelected(date); setSelectedDates(values => gesture.add ? [...new Set([...values,date])].sort() : values.filter(value => value !== date)); }
  const clock = new Intl.DateTimeFormat('en-GB',{timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
  const [hours, minutes] = clock.split(':').map(Number);
  const first = new Date(`${month}-01T00:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const dates = Array.from({ length: 42 }, (_, i) => {
    const date = new Date(first); date.setUTCDate(1 - offset + i); return date.toISOString().slice(0, 10);
  });
  const visible = tasks.filter(task => !task.hiddenAt);
  const selectedTasks = visible.filter(task => task.scheduledDate === selected);
  function move(delta: number) {
    if (view === 'day') { const date = shiftDate(selected,delta); setSelected(date); setMonth(date.slice(0,7)); return; }
    const next = new Date(first); next.setUTCMonth(next.getUTCMonth() + delta); setMonth(next.toISOString().slice(0, 7));
  }
  return <section className={`guided-panel guided-training-calendar calendar-journal calendar-view-${view}`} aria-label={zh ? '训练月历' : 'training calendar'}>
    <div className="calendar-primary">
    <div className="guided-calendar-month">
      <header><div><h2>{view === 'day' && `${Number(selected.slice(8))} · `}{new Intl.DateTimeFormat(locale,{timeZone:'UTC',month:'long'}).format(new Date(`${view === 'day' ? selected : month+'-01'}T12:00:00Z`))} <span className="calendar-year">{view === 'day' ? selected.slice(0,4) : month.slice(0,4)}</span></h2></div><div><button aria-label={view === 'month' ? (zh ? '上个月' : 'previous month') : (zh ? '前一天' : 'previous day')} onClick={() => move(-1)}>←</button><button aria-label={view === 'month' ? (zh ? '下个月' : 'next month') : (zh ? '后一天' : 'next day')} onClick={() => move(1)}>→</button></div></header>
      <div className="calendar-toolbar"><div role="group" aria-label={zh ? '日历视图' : 'calendar view'}>{(['month','day'] as const).map(mode => <button key={mode} aria-pressed={view === mode} onClick={() => setView(mode)}>{mode === 'month' ? (zh ? '月视图' : 'month') : (zh ? '日视图' : 'day')}</button>)}</div><button onClick={() => { const date = dateInZone(now,timeZone); setMonth(date.slice(0,7)); setSelected(date); }}>{zh ? '今天' : 'today'}</button></div>
      {view === 'month' && <><button className="calendar-multi" aria-pressed={multi} onClick={() => { setMulti(!multi); dragging.current = null; }}>{zh ? '选择多个日期' : 'select multiple days'}</button>
      <div className="guided-calendar-grid" ref={grid}>
        {(zh ? ['一','二','三','四','五','六','日'] : ['m','t','w','t','f','s','s']).map((day, i) => <span key={i}>{day}</span>)}
        {dates.map(date => {
          const entries = visible.filter(task => task.scheduledDate === date);
          const done = entries.length > 0 && entries.every(task => task.completedSessionId);
          return <button key={date} type="button" data-calendar-date={date} aria-label={`${date}${entries.length ? (zh ? ' · 有训练安排' : ' · training scheduled') : ''}${done ? (zh ? ' · 已完成' : ' · completed') : ''}`} aria-pressed={multi ? selectedDates.includes(date) : selected === date} aria-current={date === today ? 'date' : undefined} className={`${date.slice(0, 7) !== month ? 'outside-month' : ''} ${done ? 'calendar-completed' : ''} ${multi && selectedDates.includes(shiftDate(date,-1)) ? 'calendar-range' : ''}`}
            onPointerDown={event => { suppressClick.current = false; if (multi && event.pointerType === 'mouse' && event.button === 0) { suppressClick.current = true; dragging.current = { before:[...selectedDates],add:!selectedDates.includes(date),seen:new Set() }; dragDate(date); } }} onPointerEnter={event => { if (event.buttons === 1) dragDate(date); }}
            onKeyDown={event => { const delta = ({ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7} as Record<string,number>)[event.key]; if (delta !== undefined) { event.preventDefault(); grid.current?.querySelector<HTMLButtonElement>(`[data-calendar-date="${shiftDate(date,delta)}"]`)?.focus(); } }}
            onClick={event => { if (suppressClick.current && event.detail !== 0) { suppressClick.current = false; return; } setSelected(date); if (multi) setSelectedDates(values => values.includes(date) ? values.filter(value => value !== date) : [...values,date].sort()); }}>{String(Number(date.slice(8))).padStart(2,'0')}{date === today && <span className="calendar-today-mark" aria-hidden="true">{zh ? '今' : 'NOW'}</span>}{entries.length > 0 && <small aria-hidden="true" className={done ? 'calendar-done-mark' : 'calendar-workout-mark'}>{done ? '✓' : '—'}</small>}</button>;
        })}
      </div>
      <p className="guided-calendar-legend">{zh ? '━ 训练日 · 点选查看安排' : '━ training day · select to view'}<br />{timeZone}</p>
      {multi && <p role="status">{zh ? '已选择' : 'selected'} {selectedDates.length} · {selectedDates.filter(date => visible.some(task => task.scheduledDate === date)).length} {zh ? '天已有安排。仅浏览，不覆盖或保存。' : 'days contain plans. browse only; no overwrite or save.'}</p>}</>}
    </div>
    <div className="guided-calendar-agenda"><header><p className="calendar-editorial-label">{selected === today ? (zh ? '今日训练' : "TODAY’S TRAINING") : (zh ? '所选日训练' : 'SELECTED DAY')}</p><h3>{selected}</h3></header>
      {view === 'day' && <p className="calendar-flexible">{zh ? '灵活安排 · 未设置具体时间' : 'flexible · no scheduled time'}</p>}
      {selectedTasks.length === 0 && <div className="calendar-empty"><svg viewBox="0 0 100 70" aria-hidden="true"><path d="M22 48h56M38 20v28m24-28v28M30 25h8m24 0h8M30 43h8m24 0h8M41 32h18" fill="none" stroke="currentColor" strokeWidth="2" /></svg><span className="calendar-empty-label">{zh ? '暂无安排' : 'NO PLAN'}</span><p>{zh ? '这一天没有训练安排。' : 'no training scheduled for this date.'}</p><Link to="/ai">{zh ? '一起制定计划' : 'plan your training'} <span aria-hidden="true">↗</span></Link></div>}
      {selectedTasks.map(task => {
        const day = versions.find(version => version.id === task.planVersionId)?.days.find(item => item.dayId === task.plannedDayId);
        return <article key={task.id}><p className="guided-calendar-status">{task.completedSessionId ? (zh ? '已完成' : 'completed') : task.status === 'skipped' ? (zh ? '已跳过' : 'skipped') : (zh ? '待训练' : 'scheduled')}</p>
          {(day?.exercises ?? []).map(item => <div className="guided-calendar-exercise" key={`${item.exerciseId}-${item.order}`}><h4>{exercises.find(entry => entry.id === item.exerciseId)?.name[locale] ?? item.exerciseId}</h4><ul>{formatGuidedTargets(item.targetSets, locale).map((target, i) => <li key={i}>{target}</li>)}</ul>{item.notes && <p>{item.notes}</p>}</div>)}
          {task.originalDate !== task.scheduledDate && <p>{zh ? '原统计日期' : 'original statistics date'} · {task.originalDate}</p>}
          <Link to={task.completedSessionId ? '/progress' : `/workout?scheduledWorkoutId=${encodeURIComponent(task.id)}`}>{task.completedSessionId ? (zh ? '查看训练历史' : 'view workout history') : (zh ? '查看训练' : 'view workout')}</Link>
        </article>;
      })}
    </div>
    </div>
    <aside className="calendar-date-detail" aria-label={zh ? '所选日期信息' : 'selected date details'}>
      <span className="calendar-year">{selected === today ? (zh ? '今天' : 'TODAY') : (zh ? '所选日期' : 'SELECTED')}</span>
      <strong className="calendar-date-number">{selected.slice(8)}</strong>
      <p className="calendar-date-month">{new Intl.DateTimeFormat(locale,{timeZone:'UTC',month:'long',year:'numeric'}).format(new Date(`${selected}T12:00:00Z`))}</p>
      <p>{new Intl.DateTimeFormat(locale,{timeZone:'UTC',weekday:'long'}).format(new Date(`${selected}T12:00:00Z`))}</p>
      <dl><div><dt>{zh ? '可见安排' : 'Visible plans'}</dt><dd>{selectedTasks.length}</dd></div><div><dt>{zh ? '已完成' : 'Completed'}</dt><dd>{selectedTasks.filter(task => task.completedSessionId).length}</dd></div></dl>
      <p className="calendar-detail-note">{zh ? '按所选日期查看安排。训练历史与原统计日期分别保留。' : 'Plans for your selected date. Training history and original statistics dates remain separate.'}</p>
      <small>{timeZone}</small>
    </aside>
    {view === 'day' && <div className="calendar-timeline" aria-label={zh ? '24小时时间轴' : '24 hour timeline'}>{Array.from({length:24},(_,i) => <div className="calendar-hour" key={i}><time>{String(i).padStart(2,'0')}:00</time><span /></div>)}{selected === dateInZone(now,timeZone) && <div className="calendar-now" style={{top:`${(hours+minutes/60)*48}px`}}><time>{clock}</time><span /></div>}<p>{timeZone}</p></div>}
  </section>;
}
