import { useCallback, useEffect, useState } from 'react';
import type { BodyWeightObservation } from '../../../domain/models';
import {
  bodyFatTrend,
  monthKey,
  monthSummary,
  previousMonth,
  sessionsByMonth,
  strengthTrends,
  weightTrend,
  type Trend,
} from '../../../application/my-changes';
import { bodyWeightService } from '../../../application/body-weight';
import { activityDate } from '../../../application/v8-activity';
import { changesCopy } from '../../../i18n/features/me/changes';
import { fill } from '../../../i18n/features/onboarding/entry';
import { AnatomyMap, Card, PrimaryButton, StatTile } from '../../components/kit';
import { TrendChart } from '../../components/TrendChart';
import { useMainline } from '../../mainline/context';
import { figureSex, figureShape, ghostWeight, monthLabel } from '../plan-upgrade/logic';
import { lastFigureSex, outlineEvent, outlineShown } from '../plan-upgrade/prefs';
import { useWidth } from '../plan-upgrade/useWidth';
import { planPagesCopy } from '../../../i18n/features/plan-upgrade/pages';
import { fillLine } from '../../../i18n/features/coach/yaya-v5';
import type { FutureLetter } from '../../../domain/plan-upgrade';
import { listFutureLetters } from '../../../persistence/plan-upgrade-store';
import '../plan-upgrade/plan-upgrade.css';
import './my-changes.css';
import { DEFAULT_TIME_ZONE } from '../../../domain/local-date';
import { bodyWeightInputSchema } from '../../../domain/schemas';

type Locale = 'zh' | 'en';
const listSeparator = (locale: 'zh' | 'en') => (locale === 'zh' ? '，' : ', ');
const signed = (value: number) => `${value > 0 ? '+' : ''}${value}`;
const dateText = (date: string, locale: Locale) => {
  const [, m, d] = date.split('-').map(Number);
  return locale === 'zh'
    ? `${m}月${d}日`
    : `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${d}`;
};
const monthText = (month: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en', { timeZone: 'UTC', month: 'short' }).format(
    new Date(`${month}-01T00:00:00Z`),
  );

/** Loads the device's body measurements; refreshes after a save. */
function useBodyMeasurements() {
  const [rows, setRows] = useState<BodyWeightObservation[]>([]),
    [loaded, setLoaded] = useState(false);
  const reload = useCallback(async () => {
    try {
      setRows(await bodyWeightService.listBodyWeights());
    } catch {
      setRows([]);
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { rows, loaded, reload };
}

function TrendLine({ trend, unit, locale }: { trend: Trend; unit: string; locale: Locale }) {
  const t = changesCopy[locale];
  if (!trend.last) return null;
  return (
    <p className="v9-change-line">
      <span className="v9-num v9-change-value">
        {trend.last.value}
        <small>{unit}</small>
      </span>
      {trend.change !== undefined && trend.first ? (
        <span
          className="v9-num v9-change-delta"
          data-direction={trend.change > 0 ? 'up' : trend.change < 0 ? 'down' : 'flat'}
        >
          {signed(trend.change)}
          {unit} · {fill(t.since, { date: dateText(trend.first.date, locale) })}
        </span>
      ) : (
        <span className="v9-change-note">{t.noChange}</span>
      )}
    </p>
  );
}

/** 我的 › 自记录 (Bo 2026-10-22): periodic body record inline, then body fat, strength and sessions; this device only. */
export function MyChangesPage() {
  const c = useMainline(),
    locale = c.locale,
    t = changesCopy[locale];
  const zone = c.data?.profile?.timeZone ?? DEFAULT_TIME_ZONE,
    today = activityDate(zone);
  const body = useBodyMeasurements(),
    workouts = c.data?.workouts ?? [];
  const weight = weightTrend(body.rows),
    fat = bodyFatTrend(body.rows),
    lifts = strengthTrends(workouts);
  const month = monthKey(today),
    current = monthSummary(workouts, body.rows, month),
    previous = monthSummary(workouts, body.rows, previousMonth(month));
  const perMonth = sessionsByMonth(workouts, month);
  const [form, setForm] = useState<{ date: string; weight: string; fat: string; error?: boolean; saved?: boolean }>();
  const [letters, setLetters] = useState<FutureLetter[]>([]);
  useEffect(() => {
    void listFutureLetters()
      .then(setLetters)
      .catch(() => setLetters([]));
  }, []);
  // The form starts from today and the last logged weight once the records have loaded.
  useEffect(() => {
    if (body.loaded && !form) setForm({ date: today, weight: weight.last ? String(weight.last.value) : '', fat: '' });
  }, [body.loaded]);
  const existing = form ? body.rows.find(row => row.localDate === form.date) : undefined;
  const save = async () => {
    if (!form) return;
    const percent = form.fat.trim() === '' ? undefined : Number(form.fat);
    const values = {
      weightGrams: form.weight.trim() === '' ? NaN : Math.round(Number(form.weight) * 1000),
      ...(percent !== undefined ? { bodyFatPercent: Math.round(percent * 10) / 10 } : {}),
    };
    if (
      !bodyWeightInputSchema.pick({ weightGrams: true, bodyFatPercent: true }).safeParse(values).success ||
      !form.date ||
      form.date > today ||
      form.date < '2000-01-01'
    )
      return setForm({ ...form, error: true, saved: false });
    let saved = false;
    await c.run(async () => {
      await bodyWeightService.saveBodyWeight(
        { ...(existing ? { id: existing.id } : {}), localDate: form.date, timeZone: zone, ...values },
        existing?.revision,
      );
      saved = true;
    });
    if (saved) {
      await body.reload();
      setForm({ ...form, fat: '', error: false, saved: true });
    }
  };
  const edit = (patch: Partial<NonNullable<typeof form>>) =>
    form && setForm({ ...form, ...patch, error: false, saved: false });
  return (
    <main className="v9-changes">
      <header className="v9-changes-head">
        <PrimaryButton tone="text" size="sm" onClick={() => c.navigate('/settings')}>
          {t.back}
        </PrimaryButton>
        <h1 className="v9-display">{t.pageTitle}</h1>
        <p>{t.local}</p>
      </header>
      <Card variant="raised" padding="md" as="section" className="v9-change-card" aria-labelledby="v9-change-weight">
        <h2 id="v9-change-weight">{t.addTitle}</h2>
        {weight.last ? (
          <TrendLine trend={weight} unit={t.kg} locale={locale} />
        ) : (
          body.loaded && <p className="v9-change-note">{t.emptyBody}</p>
        )}
        {form && (
          <div className="v9-change-form">
            <label>
              <span>{t.date}</span>
              <input
                type="date"
                value={form.date}
                min="2000-01-01"
                max={today}
                onChange={event => edit({ date: event.currentTarget.value })}
              />
            </label>
            <label>
              <span>{t.weightLabel}</span>
              <input
                type="number"
                inputMode="decimal"
                min={20}
                max={300}
                step={0.1}
                value={form.weight}
                onChange={event => edit({ weight: event.currentTarget.value })}
              />
            </label>
            <label>
              <span>{t.fatLabel}</span>
              <input
                type="number"
                inputMode="decimal"
                min={3}
                max={70}
                step={0.1}
                value={form.fat}
                onChange={event => edit({ fat: event.currentTarget.value })}
              />
            </label>
            {existing && !form.saved && <p className="v9-change-note">{t.sameDay}</p>}
            {form.error && (
              <p role="alert" className="v9-change-error">
                {t.invalid}
              </p>
            )}
            {form.saved && (
              <p role="status" className="v9-change-note">
                {t.saved}
              </p>
            )}
            <PrimaryButton disabled={c.busy} onClick={() => void save()}>
              {t.save}
            </PrimaryButton>
          </div>
        )}
      </Card>
      <Card variant="raised" padding="md" as="section" className="v9-change-card" aria-labelledby="v9-change-fat">
        <h2 id="v9-change-fat">{t.bodyFat}</h2>
        {fat.last ? (
          <>
            <TrendLine trend={fat} unit={t.percent} locale={locale} />
            <TrendChart
              points={fat.points}
              tone={2}
              label={`${t.bodyFat} · ${fat.points.map(point => `${dateText(point.date, locale)} ${point.value}%`).join(listSeparator(locale))}`}
            />
          </>
        ) : (
          body.loaded && <p className="v9-change-note">{t.emptyFat}</p>
        )}
      </Card>
      <Card variant="raised" padding="md" as="section" className="v9-change-card" aria-labelledby="v9-change-strength">
        <h2 id="v9-change-strength">{t.strength}</h2>
        {lifts.length ? (
          <>
            <ul className="v9-change-lifts">
              {lifts.map((lift, index) => (
                <li key={lift.exerciseId}>
                  <strong>{c.name(lift.exerciseId)}</strong>
                  <TrendLine trend={lift} unit={t.kg} locale={locale} />
                  <TrendChart
                    points={lift.points}
                    tone={(3 + (index % 2)) as 3 | 4}
                    label={`${c.name(lift.exerciseId)} · ${lift.points.map(point => `${dateText(point.date, locale)} ${point.value}${t.kg}`).join(listSeparator(locale))}`}
                  />
                </li>
              ))}
            </ul>
            <p className="v9-change-note">{t.strengthHint}</p>
          </>
        ) : (
          <p className="v9-change-note">{t.emptyStrength}</p>
        )}
      </Card>
      <Card variant="raised" padding="md" as="section" className="v9-change-card" aria-labelledby="v9-change-month">
        <h2 id="v9-change-month">{t.month}</h2>
        <div className="v9-change-months">
          {(
            [
              [t.thisMonth, current],
              [t.lastMonth, previous],
            ] as const
          ).map(([label, row]) => (
            <div
              key={label}
              className="v9-change-month"
              data-testid={label === t.thisMonth ? 'month-current' : 'month-previous'}
            >
              <StatTile label={label} value={row.sessions} unit={t.times} emphasis={label === t.thisMonth} />
              <ul>
                <li>{fill(t.monthMinutes, { count: row.minutes })}</li>
                <li>{fill(t.monthSets, { count: row.sets })}</li>
                {row.weightChange !== undefined && <li>{fill(t.monthWeight, { value: signed(row.weightChange) })}</li>}
              </ul>
            </div>
          ))}
        </div>
        <h3>{t.perMonth}</h3>
        <TrendChart
          points={perMonth}
          variant="bars"
          tone={1}
          label={`${t.perMonth} · ${perMonth.map(point => `${monthText(point.date, locale)} ${point.value}`).join(listSeparator(locale))}`}
        />
        <ol className="v9-change-axis" aria-hidden="true">
          {perMonth.map(point => (
            <li key={point.date}>
              <span className="v9-num">{point.value}</span>
              {monthText(point.date, locale)}
            </li>
          ))}
        </ol>
        <div className="v9-change-actions">
          <PrimaryButton
            tone="quiet"
            size="sm"
            onClick={() => {
              c.setReviewKind('month');
              c.navigate('/review');
            }}
          >
            {t.monthReview}
          </PrimaryButton>
          <PrimaryButton
            tone="text"
            size="sm"
            onClick={() => {
              c.setReviewKind('week');
              c.navigate('/review');
            }}
          >
            {t.review}
          </PrimaryButton>
        </div>
      </Card>
      {letters.length > 0 && (
        <Card variant="raised" padding="md" as="section" className="v9-change-card" aria-labelledby="v9-change-letter">
          <h2 id="v9-change-letter">{planPagesCopy[locale].letterTitle}</h2>
          {[...letters]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map(letter => (
              <p key={letter.id} className="pu-letter">
                {letter.text}
              </p>
            ))}
        </Card>
      )}
    </main>
  );
}

/** Summary on 我的: this month vs last month and the body outline drawn from the latest 自记录 weight and body fat (Bo 2026-10-22). */
export function MyChangesCard() {
  const c = useMainline(),
    locale = c.locale,
    t = changesCopy[locale];
  const zone = c.data?.profile?.timeZone ?? DEFAULT_TIME_ZONE,
    month = monthKey(activityDate(zone));
  const body = useBodyMeasurements(),
    workouts = c.data?.workouts ?? [];
  const weight = weightTrend(body.rows),
    current = monthSummary(workouts, body.rows, month),
    previous = monthSummary(workouts, body.rows, previousMonth(month));
  const lift = strengthTrends(workouts, 1)[0],
    fat = bodyFatTrend(body.rows);
  const values = c.data?.profile?.bodyDetails?.values,
    p = planPagesCopy[locale];
  const [mapRef, width] = useWidth<HTMLDivElement>();
  const ghost = ghostWeight(body.rows) as BodyWeightObservation | undefined;
  const shape = {
    ...figureShape(values, figureSex(values?.biologicalSex, lastFigureSex()), weight.last?.value),
    ...(fat.last ? { bodyFatPercent: fat.last.value } : {}),
  };
  // Compare like with like: with a body-fat reading the earlier outline needs one too.
  const ghostProps = !ghost
    ? {}
    : fat.last
      ? ghost.bodyFatPercent !== undefined
        ? { ghostBodyFatPercent: ghost.bodyFatPercent }
        : {}
      : { ghostWeightKg: ghost.weightGrams / 1000 };
  const [outline, setOutline] = useState(outlineShown);
  useEffect(() => {
    const update = () => setOutline(outlineShown());
    window.addEventListener(outlineEvent, update);
    return () => window.removeEventListener(outlineEvent, update);
  }, []);
  const showFigure = body.loaded && outline;
  return (
    <Card
      variant="raised"
      padding="md"
      as="section"
      className="v9-change-card v9-change-summary"
      aria-labelledby="v9-change-summary-title"
    >
      <h3 id="v9-change-summary-title">{t.title}</h3>
      <div className="v9-change-tiles">
        <StatTile label={t.thisMonth} value={current.sessions} unit={t.times} emphasis />
        <StatTile label={t.lastMonth} value={previous.sessions} unit={t.times} />
        {weight.last && (
          <StatTile
            label={t.weight}
            value={weight.change !== undefined ? signed(weight.change) : weight.last.value}
            unit={t.kg}
          />
        )}
        {lift?.last && (
          <StatTile
            label={c.name(lift.exerciseId)}
            value={lift.change !== undefined ? signed(lift.change) : lift.last.value}
            unit={t.kg}
          />
        )}
      </div>
      {showFigure && (
        <div className="pu-map" ref={mapRef}>
          <AnatomyMap locale={locale} width={width} primary={[]} secondary={[]} shape={shape} {...ghostProps} />
        </div>
      )}
      {showFigure && ghost && Object.keys(ghostProps).length > 0 && (
        <div className="pu-legend" aria-hidden="true">
          <span>
            <i className="pu-dot" />
            {p.now}
          </span>
          <span>
            <i className="pu-dot" data-role="ghost" />
            {fillLine(p.before, { month: monthLabel(ghost.localDate, locale) })}
          </span>
        </div>
      )}
      {showFigure && <p className="pu-note">{t.outlineNote}</p>}
      {body.loaded && !weight.last && <p className="v9-change-note">{t.emptyBody}</p>}
    </Card>
  );
}
