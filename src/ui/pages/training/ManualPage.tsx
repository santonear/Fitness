import { useEffect, useMemo, useRef, useState } from 'react';
import { exercises } from '../../../catalog/exercises';
import { searchExercises, type ExerciseSearchFilters } from '../../../catalog/catalog-service';
import { exerciseCautionAreas, getExerciseGuide } from '../../../catalog/exercise-guide';
import { exerciseBodyPart } from '../../../catalog/registry';
import { BODY_PARTS, equipmentLabel } from '../../../catalog/taxonomy';
import { basicItems } from '../../../application/rules/basic-items';
import { localProfile } from '../../../application/rules/local-profile';
import { estimatePlannedMinutes } from '../../../application/rules/duration-estimate';
import { manualTrainingItems } from '../../../application/rules/manual-items';
import { Button } from '../../components/common';
import { format, useMainline } from '../../mainline/context';
import { bodyParts, goals, initialFilters, machineEquipment, places, primaryEquipment, recentExerciseIds, toggleSelection } from './manual/selection';
import zh from '../../../i18n/features/manual/zh.json';
import en from '../../../i18n/features/manual/en.json';
import './manual/manual.css';

export function ManualPage() {
  const { locale, data, answers, startManual, busy } = useMainline();
  const copy = locale === 'zh' ? zh : en;
  const saved = data?.state?.coachProfile;
  const source = saved ? [saved.place, ...saved.equipment].join(' ') : answers.placeEquipmentText;
  const initial = initialFilters(source);
  const filtersEdited = useRef(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ExerciseSearchFilters>({ places: initial.places, equipment: initial.equipment });
  const [limit, setLimit] = useState(36);
  const [notice, setNotice] = useState('');
  const [showPlans, setShowPlans] = useState(false);
  useEffect(() => { if (!filtersEdited.current) { const next = initialFilters(source); setFilters({ places: next.places, equipment: next.equipment }); } }, [source]);
  const cautions = saved?.cautions ?? answers.cautions;
  const cautionAreas = cautions.map(area => ({ knee: 'knees', shoulder: 'shoulders', wrist: 'wrists', back: 'back', other: 'other' })[area]);
  const results = useMemo(() => {
    const equipment = filters.equipment?.some(key => (machineEquipment as readonly string[]).includes(key)) ? filters.equipment.filter(key => key !== 'gym-machine') : filters.equipment;
    return searchExercises(query, { ...filters, equipment, cautionAreas });
  }, [query, filters, cautions]);
  const label = (key: string) => copy[key as keyof typeof copy] ?? equipmentLabel(key, locale);
  function toggleFilter(key: 'places' | 'equipment' | 'bodyParts' | 'goals', value: string) {
    filtersEdited.current = true;
    setFilters(current => ({ ...current, [key]: toggleSelection(current[key] ?? [], value) })); setLimit(36);
  }
  function filterGroup(title: string, key: 'places' | 'equipment' | 'bodyParts' | 'goals', values: readonly string[]) {
    return <fieldset className="manual-filter-group"><legend>{title}</legend><div className="manual-chips">{values.map(value => <button type="button" key={value} aria-pressed={(filters[key] as readonly string[] | undefined)?.includes(value) ?? false} onClick={() => toggleFilter(key, value)}>{label(value)}</button>)}</div></fieldset>;
  }
  function choose(ids: string[], message = '') { setSelected([...new Set(ids)].filter(id => exercises.some(exercise => exercise.id === id))); setNotice(message); }
  function localSelection() {
    if (!(saved?.adultConfirmed ?? answers.adultConfirmed)) { setNotice(copy.adultRequired); return; }
    if (!saved && !initialFilters(answers.placeEquipmentText).places.length && !filters.places?.length) { setNotice(copy.placeRequired); return; }
    const profile = saved ?? localProfile({ ...answers, placeEquipmentText: [answers.placeEquipmentText, ...(filters.places ?? [])].join(' ') });
    const pool = new Set(results.map(exercise => exercise.id));
    const selectedEquipment = filters.equipment?.filter(key => key !== 'gym-machine') ?? [];
    const items = basicItems({ ...profile, equipment: selectedEquipment.length ? selectedEquipment : profile.equipment, cautions }, 0).items.filter(item => pool.has(item.exerciseId));
    if (items.length) choose(items.map(item => item.exerciseId), copy.local); else setNotice(copy.helpEmpty);
  }
  const minutes = selected.length ? estimatePlannedMinutes(manualTrainingItems(selected)) : 0;
  return <main className="manual-page">
    <header><h1>{copy.title}</h1><p>{copy.intro}</p></header>
    <label className="manual-search">{copy.search}<input type="search" value={query} placeholder={copy.searchHint} onChange={event => { setQuery(event.target.value); setLimit(36); }} /></label>
    <div className="manual-shortcuts">
      <Button onClick={() => { if (data?.version?.templates.length) setShowPlans(value => !value); else setNotice(copy.noPlan); }}>{copy.plan}</Button>
      <Button onClick={localSelection}>{copy.help}</Button>
      <Button onClick={() => { const recent = recentExerciseIds(data?.workouts ?? []); if (recent.length) choose(recent); else setNotice(copy.noRecent); }}>{copy.recent}</Button>
    </div>
    {showPlans && <section className="manual-plans" aria-label={copy.choosePlan}><h2>{copy.choosePlan}</h2>{data?.version?.templates.map(template => <Button key={template.id} onClick={() => { choose(template.items.map(item => item.exerciseId)); setShowPlans(false); }}>{template.name}</Button>)}<Button onClick={() => setShowPlans(false)}>{copy.close}</Button></section>}
    <p role="status" className="manual-notice">{notice}</p>
    {selected.length > 0 && <section aria-label={format(copy.selected, { count: selected.length })} className="manual-chips">{selected.map(id => <button type="button" key={id} aria-pressed="true" onClick={() => setSelected(current => toggleSelection(current, id))}>{exercises.find(exercise => exercise.id === id)!.name[locale]} ×</button>)}</section>}
    <details className="manual-filters" open><summary>{copy.filters}</summary>
      {(initial.places.length > 0 || initial.equipment.length > 0) && <p>{copy.prefill}</p>}
      {filterGroup(copy.place, 'places', places)}
      {filterGroup(copy.equipment, 'equipment', primaryEquipment)}
      {filters.equipment?.includes('gym-machine') && filterGroup(copy['gym-machine'], 'equipment', machineEquipment)}
      {filterGroup(copy.body, 'bodyParts', bodyParts)}
      {filterGroup(copy.goal, 'goals', goals)}
      {filters.goals?.includes('rehab') && <p role="note">{copy.rehabHint}</p>}
      <Button onClick={() => { filtersEdited.current = true; setFilters({}); setQuery(''); setLimit(36); }}>{copy.clear}</Button>
    </details>
    <div className="manual-results-heading"><h2>{format(copy.results, { count: results.length })}</h2>{selected.length > 0 && <Button onClick={() => choose([])}>{copy.removeAll}</Button>}</div>
    {!results.length && <p>{copy.noMatch}</p>}
    <div className="manual-grid">{results.slice(0, limit).map(exercise => {
      const guide = getExerciseGuide(exercise.id, locale);
      const body = exerciseBodyPart(exercise.id);
      const caution = exerciseCautionAreas(exercise.id).some(area => cautionAreas.includes(area));
      return <article className="manual-card" key={exercise.id} data-selected={selected.includes(exercise.id)}>
        <button type="button" className="manual-pick" aria-pressed={selected.includes(exercise.id)} aria-label={exercise.name[locale]} onClick={() => setSelected(current => toggleSelection(current, exercise.id))}>
          {guide.media ? <img src={guide.media.src} alt="" loading="lazy" /> : <span className="manual-no-image" aria-hidden="true">{copy.noImage}</span>}
          <span className="manual-card-copy"><strong>{exercise.name[locale]}</strong><span>{equipmentLabel(exercise.equipment, locale)} · {BODY_PARTS[body]?.[locale === 'zh' ? 0 : 1] ?? label(body)}</span></span><span className="manual-check" aria-hidden="true">{selected.includes(exercise.id) ? '✓' : '+'}</span>
        </button>
        {caution && <p className="manual-caution">{copy.caution}</p>}
        <details className="manual-guide"><summary>{copy.details}</summary>{guide.cautions.map((caution, index) => <p key={index}>{caution}</p>)}{guide.media && <small>{guide.media.attribution}</small>}</details>
      </article>;
    })}</div>
    {results.length > limit && <Button onClick={() => setLimit(value => value + 36)}>{copy.more}</Button>}
    <footer className="manual-start"><div aria-live="polite"><strong>{format(copy.selected, { count: selected.length })}</strong><span>{format(copy.minutes, { minutes })}</span></div><Button variant="primary" disabled={!selected.length || busy} onClick={() => void startManual(selected)}>{copy.start}</Button></footer>
  </main>;
}
