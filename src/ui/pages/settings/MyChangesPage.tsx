import { useCallback, useEffect, useRef, useState } from 'react';
import type { BodyWeightObservation } from '../../../domain/models';
import { bodyFatTrend, monthKey, monthSummary, previousMonth, sessionsByMonth, strengthTrends, weightTrend, type Trend } from '../../../application/my-changes';
import { bodyWeightService } from '../../../application/body-weight';
import { activityDate } from '../../../application/v8-activity';
import { changesCopy } from '../../../i18n/features/me/changes';
import { fill } from '../../../i18n/features/onboarding/entry';
import { Card, PrimaryButton, StatTile } from '../../components/kit';
import { MorphPanel } from '../../components/common/MorphPanel';
import { TrendChart } from '../../components/TrendChart';
import { useMainline } from '../../mainline/context';
import './my-changes.css';

type Locale = 'zh' | 'en';
const signed = (value: number) => `${value > 0 ? '+' : ''}${value}`;
const dateText = (date: string, locale: Locale) => { const [, m, d] = date.split('-').map(Number); return locale === 'zh' ? `${m}月${d}日` : `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${d}`; };
const monthText = (month: string, locale: Locale) => new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en', { timeZone: 'UTC', month: 'short' }).format(new Date(`${month}-01T00:00:00Z`));

/** Loads the device's body measurements; refreshes after a save. */
export function useBodyMeasurements() {
  const [rows, setRows] = useState<BodyWeightObservation[]>([]), [loaded, setLoaded] = useState(false);
  const reload = useCallback(async () => { try { setRows(await bodyWeightService.listBodyWeights()); } catch { setRows([]); } finally { setLoaded(true); } }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { rows, loaded, reload };
}

function TrendLine({ trend, unit, locale }: { trend: Trend; unit: string; locale: Locale }) {
  const t = changesCopy[locale];
  if (!trend.last) return null;
  return <p className="v9-change-line">
    <span className="v9-num v9-change-value">{trend.last.value}<small>{unit}</small></span>
    {trend.change !== undefined && trend.first ? <span className="v9-num v9-change-delta" data-direction={trend.change > 0 ? 'up' : trend.change < 0 ? 'down' : 'flat'}>{signed(trend.change)}{unit} · {fill(t.since, { date: dateText(trend.first.date, locale) })}</span>
      : <span className="v9-change-note">{t.noChange}</span>}
  </p>;
}

/** 我的 › 我的变化: weight, body fat, strength and sessions over time, from this device only. */
export function MyChangesPage() {
  const c = useMainline(), locale = c.locale, t = changesCopy[locale];
  const zone = c.data?.profile?.timeZone ?? 'Asia/Shanghai', today = activityDate(zone);
  const body = useBodyMeasurements(), workouts = c.data?.workouts ?? [];
  const weight = weightTrend(body.rows), fat = bodyFatTrend(body.rows), lifts = strengthTrends(workouts);
  const month = monthKey(today), current = monthSummary(workouts, body.rows, month), previous = monthSummary(workouts, body.rows, previousMonth(month));
  const perMonth = sessionsByMonth(workouts, month);
  const trigger = useRef<HTMLElement | null>(null);
  const [form, setForm] = useState<{ date: string; weight: string; fat: string; error?: boolean; saved?: boolean }>();
  const existing = form ? body.rows.find(row => row.localDate === form.date) : undefined;
  const save = async () => {
    if (!form) return;
    const kg = Number(form.weight), percent = form.fat.trim() === '' ? undefined : Number(form.fat);
    if (!Number.isFinite(kg) || kg < 20 || kg > 300 || (percent !== undefined && (!Number.isFinite(percent) || percent < 3 || percent > 70)) || !form.date || form.date > today) return setForm({ ...form, error: true });
    let saved = false;
    await c.run(async () => {
      await bodyWeightService.saveBodyWeight({ ...(existing ? { id: existing.id } : {}), localDate: form.date, timeZone: zone, weightGrams: Math.round(kg * 1000), ...(percent !== undefined ? { bodyFatPercent: Math.round(percent * 10) / 10 } : {}) }, existing?.revision);
      saved = true;
    });
    if (saved) { await body.reload(); setForm(undefined); }
  };
  const openForm = (target: HTMLElement) => { trigger.current = target; const last = weight.last?.value; setForm({ date: today, weight: last !== undefined ? String(last) : '', fat: '' }); };
  return <main className="v9-changes">
    <header className="v9-changes-head">
      <PrimaryButton tone="text" size="sm" onClick={() => c.navigate('/settings')}>{t.back}</PrimaryButton>
      <h1 className="v9-display">{t.title}</h1><p>{t.local}</p>
    </header>
    <Card variant="raised" padding="md" as="section" className="v9-change-card" aria-labelledby="v9-change-weight">
      <h2 id="v9-change-weight">{t.weight}</h2>
      {weight.last ? <><TrendLine trend={weight} unit={t.kg} locale={locale} /><TrendChart points={weight.points} tone={1} label={`${t.weight} · ${weight.points.map(point => `${dateText(point.date, locale)} ${point.value}${t.kg}`).join('，')}`} /></>
        : body.loaded && <p className="v9-change-note">{t.emptyBody}</p>}
      <PrimaryButton tone="quiet" size="sm" onClick={event => openForm(event.currentTarget)}>{t.add}</PrimaryButton>
    </Card>
    <Card variant="raised" padding="md" as="section" className="v9-change-card" aria-labelledby="v9-change-fat">
      <h2 id="v9-change-fat">{t.bodyFat}</h2>
      {fat.last ? <><TrendLine trend={fat} unit={t.percent} locale={locale} /><TrendChart points={fat.points} tone={2} label={`${t.bodyFat} · ${fat.points.map(point => `${dateText(point.date, locale)} ${point.value}%`).join('，')}`} /></>
        : body.loaded && <p className="v9-change-note">{t.emptyFat}</p>}
    </Card>
    <Card variant="raised" padding="md" as="section" className="v9-change-card" aria-labelledby="v9-change-strength">
      <h2 id="v9-change-strength">{t.strength}</h2>
      {lifts.length ? <><ul className="v9-change-lifts">{lifts.map((lift, index) => <li key={lift.exerciseId}>
        <strong>{c.name(lift.exerciseId)}</strong><TrendLine trend={lift} unit={t.kg} locale={locale} />
        <TrendChart points={lift.points} tone={(3 + (index % 2)) as 3 | 4} label={`${c.name(lift.exerciseId)} · ${lift.points.map(point => `${dateText(point.date, locale)} ${point.value}${t.kg}`).join('，')}`} />
      </li>)}</ul><p className="v9-change-note">{t.strengthHint}</p></> : <p className="v9-change-note">{t.emptyStrength}</p>}
    </Card>
    <Card variant="raised" padding="md" as="section" className="v9-change-card" aria-labelledby="v9-change-month">
      <h2 id="v9-change-month">{t.month}</h2>
      <div className="v9-change-months">{([[t.thisMonth, current], [t.lastMonth, previous]] as const).map(([label, row]) => <div key={label} className="v9-change-month" data-testid={label === t.thisMonth ? 'month-current' : 'month-previous'}>
        <StatTile label={label} value={row.sessions} unit={t.times} emphasis={label === t.thisMonth} />
        <ul><li>{fill(t.monthMinutes, { count: row.minutes })}</li><li>{fill(t.monthSets, { count: row.sets })}</li>{row.weightChange !== undefined && <li>{fill(t.monthWeight, { value: signed(row.weightChange) })}</li>}</ul>
      </div>)}</div>
      <h3>{t.perMonth}</h3>
      <TrendChart points={perMonth} variant="bars" tone={1} label={`${t.perMonth} · ${perMonth.map(point => `${monthText(point.date, locale)} ${point.value}`).join('，')}`} />
      <ol className="v9-change-axis" aria-hidden="true">{perMonth.map(point => <li key={point.date}><span className="v9-num">{point.value}</span>{monthText(point.date, locale)}</li>)}</ol>
      <div className="v9-change-actions">
        <PrimaryButton tone="quiet" size="sm" onClick={() => { c.setReviewKind('month'); c.navigate('/review'); }}>{t.monthReview}</PrimaryButton>
        <PrimaryButton tone="text" size="sm" onClick={() => { c.setReviewKind('week'); c.navigate('/review'); }}>{t.review}</PrimaryButton>
      </div>
    </Card>
    <MorphPanel open={!!form} title={t.addTitle} closeLabel={t.cancel} onClose={() => { if (!c.busy) setForm(undefined); }} triggerRef={trigger}>
      {form && <div className="v9-change-form">
        <label><span>{t.date}</span><input type="date" value={form.date} max={today} onChange={event => setForm({ ...form, date: event.currentTarget.value, error: false })} /></label>
        <label><span>{t.weightLabel}</span><input type="number" inputMode="decimal" min={20} max={300} step={0.1} value={form.weight} onChange={event => setForm({ ...form, weight: event.currentTarget.value, error: false })} /></label>
        <label><span>{t.fatLabel}</span><input type="number" inputMode="decimal" min={3} max={70} step={0.1} value={form.fat} onChange={event => setForm({ ...form, fat: event.currentTarget.value, error: false })} /></label>
        {existing && <p className="v9-change-note">{t.sameDay}</p>}
        {form.error && <p role="alert" className="v9-change-error">{t.invalid}</p>}
        <PrimaryButton disabled={c.busy} onClick={() => void save()}>{t.save}</PrimaryButton>
      </div>}
    </MorphPanel>
  </main>;
}

/** Summary on 我的: latest weight change and this month vs last month, linking to 我的变化. */
export function MyChangesCard() {
  const c = useMainline(), locale = c.locale, t = changesCopy[locale];
  const zone = c.data?.profile?.timeZone ?? 'Asia/Shanghai', month = monthKey(activityDate(zone));
  const body = useBodyMeasurements(), workouts = c.data?.workouts ?? [];
  const weight = weightTrend(body.rows), current = monthSummary(workouts, body.rows, month), previous = monthSummary(workouts, body.rows, previousMonth(month));
  const lift = strengthTrends(workouts, 1)[0];
  return <Card variant="raised" padding="md" as="section" className="v9-change-card v9-change-summary" aria-labelledby="v9-change-summary-title">
    <h3 id="v9-change-summary-title">{t.title}</h3>
    <div className="v9-change-tiles">
      <StatTile label={t.thisMonth} value={current.sessions} unit={t.times} emphasis />
      <StatTile label={t.lastMonth} value={previous.sessions} unit={t.times} />
      {weight.last && <StatTile label={t.weight} value={weight.change !== undefined ? signed(weight.change) : weight.last.value} unit={t.kg} />}
      {lift?.last && <StatTile label={c.name(lift.exerciseId)} value={lift.change !== undefined ? signed(lift.change) : lift.last.value} unit={t.kg} />}
    </div>
    {weight.points.length > 1 && <TrendChart points={weight.points} tone={1} label={`${t.weight} · ${weight.points.map(point => `${dateText(point.date, locale)} ${point.value}${t.kg}`).join('，')}`} />}
    {body.loaded && !weight.last && <p className="v9-change-note">{t.emptyBody}</p>}
  </Card>;
}
