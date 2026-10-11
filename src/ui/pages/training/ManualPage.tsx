import { useEffect, useMemo, useRef, useState } from 'react';
import { exercises } from '../../../catalog/exercises';
import { searchExercises, suggestExercises, type ExerciseSearchFilters } from '../../../catalog/catalog-service';
import { exerciseCautionAreas, getExerciseGuide } from '../../../catalog/exercise-guide';
import { exerciseBodyPart } from '../../../catalog/registry';
import { BODY_PARTS, equipmentLabel } from '../../../catalog/taxonomy';
import { basicProposal } from '../../../application/v8-workflow';
import { localProfile } from '../../../application/rules/local-profile';
import { estimatePlannedMinutes } from '../../../application/rules/duration-estimate';
import { manualTrainingItems } from '../../../application/rules/manual-items';
import { CoachPanel, type CoachApplication } from '../../components/CoachPanel';
import { ExerciseGuidePanel } from '../../components/ExerciseGuide';
import { buildCoachRequest } from '../../../coach/request-builder';
import { adaptCoachResponse } from '../../../coach/response-adapter';
import type { CoachRequest } from '../../../coach/contracts';
import type { ManualSelection } from '../../../application/v8-workflow';
import { repository } from '../../../persistence/repository';
import { targetText } from '../../components/ExerciseTargets';
import { Button } from '../../components/common';
import { format, useMainline } from '../../mainline/context';
import { bodyParts, goals, initialFilters, machineEquipment, places, primaryEquipment, recentExerciseIds, toggleSelection } from './manual/selection';
import zh from '../../../i18n/features/manual/zh.json';
import en from '../../../i18n/features/manual/en.json';
import './manual/manual.css';

export function ManualPage() {
  const { locale, data, answers, startManual, start, busy } = useMainline();
  const copy = locale === 'zh' ? zh : en;
  const saved = data?.state?.coachProfile;
  const override = data?.state?.nextWorkoutOverride;
  const templates = data?.version?.templates.map(item => override && override.planVersionId === data.version?.id && override.templateId === item.id ? { ...override.template, id: item.id } : item) ?? [];
  const source = saved ? [saved.place, ...saved.equipment].join(' ') : answers.placeEquipmentText;
  const initial = initialFilters(source);
  const filtersEdited = useRef(false);
  const guideTrigger = useRef<HTMLElement|null>(null);
  const [guideId, setGuideId] = useState<string>();
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachRequest, setCoachRequest] = useState<CoachRequest>();
  const [coachRevision, setCoachRevision] = useState(0);
  const [manualSelection, setManualSelection] = useState<ManualSelection>();
  const [candidateTemplates, setCandidateTemplates] = useState<ManualSelection[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState<string>();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ExerciseSearchFilters>({ places: initial.places, equipment: initial.equipment });
  const [limit, setLimit] = useState(36);
  const [notice, setNotice] = useState('');
  const [showPlans, setShowPlans] = useState(false);
  useEffect(() => { if (!filtersEdited.current) { const next = initialFilters(source); setFilters({ places: next.places, equipment: next.equipment }); } }, [source]);
  const cautions = saved?.cautions ?? answers.cautions;
  const cautionAreas = cautions.map(area => ({ knee: 'knees', shoulder: 'shoulders', wrist: 'wrists', back: 'back', other: 'other' })[area]);
  const searchFilters = useMemo(() => {
    const equipment = filters.equipment?.some(key => (machineEquipment as readonly string[]).includes(key)) ? filters.equipment.filter(key => key !== 'gym-machine') : filters.equipment;
    return { ...filters, equipment, cautionAreas };
  }, [query, filters, cautions]);
  const results = useMemo(() => searchExercises(query, searchFilters), [query, searchFilters]);
  const suggestions = useMemo(() => results.length ? [] : suggestExercises(query, searchFilters), [query, searchFilters, results]);
  const clearedCount = useMemo(() => results.length ? 0 : searchExercises('', { cautionAreas }).length, [results, cautions]);
  function clearFilters() { filtersEdited.current = true; setFilters({}); setQuery(''); setLimit(36); }
  const shown = results.length ? results : suggestions;
  const label = (key: string) => copy[key as keyof typeof copy] ?? equipmentLabel(key, locale);
  function toggleFilter(key: 'places' | 'equipment' | 'bodyParts' | 'goals', value: string) {
    filtersEdited.current = true;
    setFilters(current => ({ ...current, [key]: toggleSelection(current[key] ?? [], value) })); setLimit(36);
  }
  function filterGroup(title: string, key: 'places' | 'equipment' | 'bodyParts' | 'goals', values: readonly string[]) {
    return <fieldset className="manual-filter-group"><legend>{title}</legend><div className="manual-chips">{values.map(value => <button type="button" key={value} aria-pressed={(filters[key] as readonly string[] | undefined)?.includes(value) ?? false} onClick={() => toggleFilter(key, value)}>{label(value)}</button>)}</div></fieldset>;
  }
  function choose(ids: string[], message = '') { setManualSelection(undefined); setTemplateId(undefined); setSelected([...new Set(ids)].filter(id => exercises.some(exercise => exercise.id === id))); setNotice(message); }
  function toggleExercise(id: string) { setManualSelection(undefined); if (templateId || manualSelection) setNotice(copy.manualDefaults); setTemplateId(undefined); setSelected(current => toggleSelection(current, id)); }
  function localSelection() {
    if (!(saved?.adultConfirmed ?? answers.adultConfirmed)) { setNotice(copy.adultRequired); return; }
    if (!saved && !initialFilters(answers.placeEquipmentText).places.length && !filters.places?.length) { setNotice(copy.placeRequired); return; }
    const profile = saved ?? localProfile({ ...answers, placeEquipmentText: [answers.placeEquipmentText, ...(filters.places ?? [])].join(' ') });
    if (!data) return;
    const proposal = basicProposal(profile, locale);
    setCandidateTemplates((proposal?.templates ?? []).map(template => ({ adultConfirmed: profile.adultConfirmed, template, expectedRevision: data.metadata.dataRevision, restoreGeneration: data.metadata.restoreGeneration ?? 0 })));
    setNotice(proposal?.templates.length ? copy.local : copy.helpEmpty);
  }
  function openHelp() {
    if (!(saved?.adultConfirmed ?? answers.adultConfirmed)) { setNotice(copy.adultRequired); return; }
    if (!data) return;
    const profile = saved ?? localProfile(answers);
    setCoachRequest(buildCoachRequest({ task: 'ONBOARD_PLAN', data, profile }));
    setCoachRevision(data.metadata.dataRevision); setCoachOpen(true);
  }
  async function importCandidate(candidate: CoachApplication) {
    const metadata = await repository.readMetadata();
    if (metadata.dataRevision !== candidate.expectedRevision || (metadata.restoreGeneration ?? 0) !== candidate.request.restoreGeneration) throw new Error('STALE_CANDIDATE');
    const response = adaptCoachResponse(candidate.request, candidate.response);
    if (candidate.request.task !== 'ONBOARD_PLAN' || response.type !== 'plan_proposal') throw new Error('INVALID_CANDIDATE');
    setCandidateTemplates(response.proposal.templates.map(template => ({adultConfirmed: candidate.request.adultConfirmed, template: { ...template, estimatedMinutes: estimatePlannedMinutes(template.items) }, expectedRevision: metadata.dataRevision, restoreGeneration: metadata.restoreGeneration ?? 0})));
    setCoachOpen(false); setNotice(copy.chooseCandidate);
  }
  const template = templates.find(item => item.id === templateId);
  const minutes = selected.length ? estimatePlannedMinutes(template?.items ?? manualSelection?.template.items ?? manualTrainingItems(selected)) : 0;
  return <main className="manual-page">
    <header><h1>{copy.title}</h1><p>{copy.intro}</p></header>
    <label className="manual-search">{copy.search}<input type="search" value={query} placeholder={copy.searchHint} onChange={event => { setQuery(event.target.value); setLimit(36); }} /></label>
    <div className="manual-shortcuts">
      <Button onClick={() => { if (data?.version?.templates.length) setShowPlans(value => !value); else setNotice(copy.noPlan); }}>{copy.plan}</Button>
      <Button onClick={openHelp}>{copy.help}</Button>
      <Button onClick={() => { const recent = recentExerciseIds(data?.workouts ?? []); if (recent.length) choose(recent); else setNotice(copy.noRecent); }}>{copy.recent}</Button>
    </div>
    {showPlans && <section className="manual-plans" aria-label={copy.choosePlan}><h2>{copy.choosePlan}</h2>{templates.map(template => <Button key={template.id} onClick={() => { choose(template.items.map(item => item.exerciseId), copy.planTargets); setTemplateId(template.id); setShowPlans(false); }}>{template.name}</Button>)}<Button onClick={() => setShowPlans(false)}>{copy.close}</Button></section>}
    {!!candidateTemplates.length && <section aria-label={copy.chooseCandidate}><h2>{copy.chooseCandidate}</h2><p>{copy.candidateHint}</p>{candidateTemplates.map(selection => <section key={selection.template.id}><h3>{selection.template.name}</h3><ul>{selection.template.items.map((item,index) => <li key={index}>{exercises.find(e=>e.id===item.exerciseId)?.name[locale]} · {item.sets} {copy.sets} · {targetText(item.target,locale)}</li>)}</ul><Button onClick={() => { choose(selection.template.items.map(item=>item.exerciseId), copy.candidateReady); setManualSelection(selection); }}>{copy.useCandidate}</Button></section>)}</section>}
    <p role="status" className="manual-notice">{notice}</p>
    {selected.length > 0 && <section aria-label={format(copy.selected, { count: selected.length })} className="manual-chips">{selected.map(id => <button type="button" key={id} aria-pressed="true" onClick={() => toggleExercise(id)}>{exercises.find(exercise => exercise.id === id)!.name[locale]} ×</button>)}</section>}
    <details className="manual-filters" open><summary>{copy.filters}</summary>
      {(initial.places.length > 0 || initial.equipment.length > 0) && <p>{copy.prefill}</p>}
      {filterGroup(copy.place, 'places', places)}
      {filterGroup(copy.equipment, 'equipment', primaryEquipment)}
      {filters.equipment?.includes('gym-machine') && filterGroup(copy['gym-machine'], 'equipment', machineEquipment)}
      {filterGroup(copy.body, 'bodyParts', bodyParts)}
      {filterGroup(copy.goal, 'goals', goals)}
      {filters.goals?.includes('rehab') && <p role="note">{copy.rehabHint}</p>}
      {!!results.length && <Button onClick={clearFilters}>{copy.clear}</Button>}
    </details>
    <div className="manual-results-heading"><h2>{format(copy.results, { count: results.length })}</h2>{selected.length > 0 && <Button onClick={() => choose([])}>{copy.removeAll}</Button>}</div>
    {!results.length && <section className="manual-empty"><p>{copy.noMatch}</p><p>{format(copy.clearCount, { count: clearedCount })}</p><p>{copy.clearSearchHint}</p><Button onClick={clearFilters}>{copy.clear}</Button></section>}{!!suggestions.length && <h2>{copy.similar}</h2>}
    <div className="manual-grid">{shown.slice(0, limit).map(exercise => {
      const guide = getExerciseGuide(exercise.id, locale);
      const body = exerciseBodyPart(exercise.id);
      const caution = exerciseCautionAreas(exercise.id).some(area => cautionAreas.includes(area));
      return <article className="manual-card" key={exercise.id} data-selected={selected.includes(exercise.id)}>
        <button type="button" className="manual-pick" aria-pressed={selected.includes(exercise.id)} aria-label={exercise.name[locale]} onClick={() => toggleExercise(exercise.id)}>
          {guide.media ? <img src={guide.media.src} alt="" loading="lazy" /> : <span className="manual-no-image" aria-hidden="true">{copy.noImage}</span>}
          <span className="manual-card-copy"><strong>{exercise.name[locale]}</strong><span>{equipmentLabel(exercise.equipment, locale)} · {BODY_PARTS[body]?.[locale === 'zh' ? 0 : 1] ?? label(body)}</span></span><span className="manual-check" aria-hidden="true">{selected.includes(exercise.id) ? '✓' : '+'}</span>
        </button>
        {caution && <p className="manual-caution">{copy.caution}</p>}
        <Button onClick={event => { guideTrigger.current = event.currentTarget; setGuideId(exercise.id); }}>{copy.details}</Button>
      </article>;
    })}</div>
    {results.length > limit && <Button onClick={() => setLimit(value => value + 36)}>{copy.more}</Button>}
    <footer className="manual-start"><div aria-live="polite"><strong>{format(copy.selected, { count: selected.length })}</strong><span>{format(copy.minutes, { minutes })}</span></div><Button variant="primary" disabled={!selected.length || busy} onClick={() => void (template ? start(template.id) : startManual(selected, manualSelection))}>{copy.start}</Button></footer>
    <ExerciseGuidePanel id={guideId} locale={locale} open={!!guideId} onClose={()=>setGuideId(undefined)} triggerRef={guideTrigger}/>
    <CoachPanel open={coachOpen} onClose={()=>setCoachOpen(false)} request={coachRequest} expectedRevision={coachRevision} onApply={importCandidate} locale={locale} disableNutrition localFallbackOnError templateMinutes={template=>estimatePlannedMinutes(template.items)} applyLabel={copy.importCandidate} successLabel={copy.candidateReady} onLocalPlan={()=>{setCoachOpen(false);localSelection();}}/>
  </main>;
}
