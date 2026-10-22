import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnatomyMap, Card, JourneyTrail, PrimaryButton } from '../../components/kit';
import type { FitnessTestRecord, FutureLetter, Journey } from '../../../domain/plan-upgrade';
import { currentJourney, listFitnessTests, listFutureLetters } from '../../../persistence/plan-upgrade-store';
import { bodyWeightService } from '../../../application/body-weight';
import { activityDate } from '../../../application/v8-activity';
import type { BodyWeightObservation } from '../../../domain/models';
import { planPagesCopy } from '../../../i18n/features/plan-upgrade/pages';
import { fillLine } from '../../../i18n/features/coach/yaya-v5';
import { useMainline } from '../../mainline/context';
import { bodyChangeLine, figureSex, figureShape, ghostWeight, isTestItem, journeyStops, latestWeight, liftHistory, monthLabel, openableLetters, shiftLocalDate, testValueText } from './logic';
import { lastFigureSex, lastSpoken, markSpoken, outlineShown } from './prefs';
import { bodyChangeEvents, personalRecords, personalRecordsAsOf } from '../../../application/rules/plan-upgrade';
import { exercises } from '../../../catalog/exercises';
import { FitnessTestCard, LetterCard, MeetFlow } from './JourneyParts';
import { useWidth } from './useWidth';
import './plan-upgrade.css';

const kg = (grams: number) => Math.round(grams / 100) / 10;

/** 我的山路 (UIUX20261008 V9.14): outline with the earlier weight dashed, the trail, today's weight, mini-test and the letter. All local. */
export function JourneyPage() {
  const { data, locale, busy, run, navigate } = useMainline();
  const c = planPagesCopy[locale];
  const zone = data?.profile?.timeZone ?? 'Asia/Shanghai', today = activityDate(zone);
  const values = data?.profile?.bodyDetails?.values;
  const [journey, setJourney] = useState<Journey>();
  const [loaded, setLoaded] = useState(false);
  const [tests, setTests] = useState<FitnessTestRecord[]>([]);
  const [letters, setLetters] = useState<FutureLetter[]>([]);
  const [weights, setWeights] = useState<BodyWeightObservation[]>([]);
  const [form, setForm] = useState<{ value: string; error?: boolean }>();
  const [mapRef, width] = useWidth<HTMLDivElement>();
  const reload = useCallback(async () => {
    const [nextJourney, nextTests, nextLetters, nextWeights] = await Promise.all([currentJourney(), listFitnessTests(), listFutureLetters(), bodyWeightService.listBodyWeights()]);
    setJourney(nextJourney); setTests(nextTests); setLetters(nextLetters); setWeights(nextWeights); setLoaded(true);
  }, []);
  useEffect(() => { void reload(); }, [reload, data?.metadata.dataRevision]);
  const sex = figureSex(values?.biologicalSex, lastFigureSex());
  const last = latestWeight(weights), ghost = ghostWeight(weights);
  const shape = figureShape(values, sex, last ? kg(last.weightGrams) : undefined);
  const disclosedSex = values?.biologicalSex === '男性' ? 'male' as const : values?.biologicalSex === '女性' ? 'female' as const : undefined;
  const nextCamp = journey?.camps.find(camp => !camp.reachedAt);
  const saveWeight = async () => {
    const value = Number(form?.value);
    if (!form || !/^\d{2,3}(?:\.\d{1,2})?$/.test(form.value.trim()) || !Number.isFinite(value) || value < 20 || value > 300) return setForm({ value: form?.value ?? '', error: true });
    const existing = weights.find(row => row.localDate === today);
    let saved = false;
    await run(async () => {
      await bodyWeightService.saveBodyWeight({ ...(existing ? { id: existing.id } : {}), localDate: today, timeZone: zone, weightGrams: Math.round(value * 1000) }, existing?.revision);
      saved = true;
    });
    if (saved) { setForm(undefined); await reload(); }
  };
  // v5 §19: lines come only from bodyChangeEvents(); the same kind at most once a week (remembered on this device).
  const [spoken] = useState(lastSpoken);
  const change = useMemo(() => {
    if (!loaded) return undefined;
    const lifts = liftHistory(data?.workouts ?? []);
    const event = bodyChangeEvents({
      ...(journey ? { route: journey.route } : {}), ...(values?.heightCm ? { heightCm: values.heightCm } : {}),
      weights: weights.map(row => ({ localDate: row.localDate, weightKg: row.weightGrams / 1000 })),
      records: [...personalRecordsAsOf(lifts, shiftLocalDate(today, -28)), ...personalRecords(lifts)],
      tests, lastSpokenByKind: spoken, today,
    })[0];
    if (!event) return undefined;
    const sorted = [...tests].sort((a, b) => a.localDate.localeCompare(b.localDate));
    const base = sorted.filter(test => test.localDate <= event.sinceLocalDate).at(-1), latest = sorted.at(-1);
    const names = isTestItem(event.metric) && base?.results[event.metric] !== undefined && latest?.results[event.metric] !== undefined
      ? { metric: c.testItems[event.metric].replace(/（.*）|\s*\(.*\)/, ''), from: testValueText(event.metric, base.results[event.metric]!, locale), to: testValueText(event.metric, latest.results[event.metric]!, locale) }
      : { metric: exercises.find(item => item.id === event.metric)?.name[locale] ?? '', month: monthLabel(event.sinceLocalDate, locale) };
    const text = bodyChangeLine(event, locale, names);
    return text ? { kind: event.kind, text } : undefined;
  }, [loaded, journey, weights, tests, data?.workouts, values?.heightCm, today, locale, spoken]);
  useEffect(() => { if (change) markSpoken(change.kind, today); }, [change?.kind, today]);
  const diff = last && ghost ? Math.round((last.weightGrams - ghost.weightGrams) / 100) / 10 : undefined;
  return <main className="pu-page pu-journey">
    <header className="pu-head"><h1 className="v9-display">{c.journeyTitle}</h1></header>
    {outlineShown() && <>
      <div className="pu-map" ref={mapRef}>
        <AnatomyMap locale={locale} width={width} primary={[]} secondary={[]} shape={shape} {...(ghost ? { ghostWeightKg: kg(ghost.weightGrams) } : {})}/>
      </div>
      {ghost && <div className="pu-legend" aria-hidden="true"><span><i className="pu-dot"/>{c.now}</span><span><i className="pu-dot" data-role="ghost"/>{fillLine(c.before, { month: monthLabel(ghost.localDate, locale) })}</span></div>}
    </>}
    {change && <p className="pu-line" role="status">{change.text}</p>}
    {loaded && !journey ? <MeetFlow locale={locale} busy={busy} postpartumChecked={data?.state?.coachProfile?.population?.kind === 'postpartum'} onCheck={() => navigate('/settings/engine')} onSaved={() => void reload()}/>
      : <JourneyTrail locale={locale} stops={journeyStops(journey, locale)}/>}
    <Card variant="raised" padding="md" as="section" className="pu-card" aria-label={c.recordWeight}>
      {last && <div className="pu-weight">
        <span><strong className="v9-num">{kg(last.weightGrams)}</strong> {c.kg}</span>
        {diff !== undefined && ghost && <span className="pu-line"><span className="v9-num">{diff > 0 ? '+' : diff < 0 ? '−' : ''}{Math.abs(diff)}</span> {fillLine(c.weightSince, { month: monthLabel(ghost.localDate, locale) })}{values?.heightCm ? ` · ${fillLine(c.heightCm, { cm: values.heightCm })}` : ''}</span>}
      </div>}
      {form ? <>
        <label className="pu-field"><span>{c.weightLabel}</span><input inputMode="decimal" maxLength={6} value={form.value} aria-invalid={form.error || undefined} onChange={event => setForm({ value: event.target.value })}/></label>
        {form.error && <p className="pu-line" role="alert">{c.weightInvalid}</p>}
        <div className="pu-row"><PrimaryButton size="sm" disabled={busy} onClick={() => void saveWeight()}>{c.save}</PrimaryButton><PrimaryButton tone="quiet" size="sm" onClick={() => setForm(undefined)}>{c.cancel}</PrimaryButton></div>
      </> : <PrimaryButton tone="quiet" onClick={() => setForm({ value: last ? String(kg(last.weightGrams)) : '' })}>{c.recordWeight}</PrimaryButton>}
      {outlineShown() && <p className="pu-note">{c.outlineNote}</p>}
    </Card>
    <FitnessTestCard locale={locale} today={today} {...(values?.age !== undefined ? { age: values.age } : {})} {...(disclosedSex ? { sex: disclosedSex } : {})} tests={tests} onSaved={() => void reload()}/>
    {journey && <LetterCard locale={locale} openable={openableLetters(letters, journey)} {...(nextCamp ? { nextCampId: nextCamp.id } : {})} onSaved={() => void reload()}/>}
  </main>;
}
