import { historyPainState } from '../../../application/engine-profile';
import { CheckinCard } from './CheckinCard';
import { isFeatureEnabled } from '../../../application/feature-flags';
import { engineCopy } from '../../../coach/engine-copy';
import { templateLabel } from '../../../i18n/features/plan/labels';
import { useEffect, useRef, useState } from 'react';
import { exercises } from '../../../catalog/exercises';
import { type ExerciseSearchFilters } from '../../../catalog/catalog-service';
import { basicProposal } from '../../../application/v8-workflow';
import { localProfile } from '../../../application/rules/local-profile';
import { estimatePlannedMinutes } from '../../../domain/duration-estimate';
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
import { ChoiceChip } from '../../components/kit';
import { ExerciseBrowser } from '../../components/ExerciseBrowser';
import { format, useMainline, workflow } from '../../mainline/context';
import { initialFilters, recentExerciseIds, toggleSelection } from './manual/selection';
import zh from '../../../i18n/features/manual/zh.json';
import en from '../../../i18n/features/manual/en.json';
import './manual/manual.css';
import '../plan/week-plan.css';
import { HomeExit } from '../../components/HomeExit';
import { BackButton } from '../../components/BackButton';

export function ManualPage() {
  const { locale, data, answers, startManual, start, busy, navigate } = useMainline();
  const copy = locale === 'zh' ? zh : en;
  const saved = data?.state?.coachProfile;
  const override = data?.state?.nextWorkoutOverride;
  const templates =
    data?.version?.templates.map(item =>
      override && override.planVersionId === data.version?.id && override.templateId === item.id
        ? { ...override.template, id: item.id }
        : item,
    ) ?? [];
  const source = saved ? [saved.place, ...saved.equipment].join(' ') : answers.placeEquipmentText;
  const initial = initialFilters(source);
  const filtersEdited = useRef(false);
  const guideTrigger = useRef<HTMLElement | null>(null);
  const [guideId, setGuideId] = useState<string>();
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachRequest, setCoachRequest] = useState<CoachRequest>();
  const [coachRevision, setCoachRevision] = useState(0);
  const [manualSelection, setManualSelection] = useState<ManualSelection>();
  const [candidateTemplates, setCandidateTemplates] = useState<ManualSelection[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState<string>();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ExerciseSearchFilters>({
    places: initial.places,
    equipment: initial.equipment,
  });
  const [notice, setNotice] = useState('');
  const [showPlans, setShowPlans] = useState(false);
  useEffect(() => {
    if (!filtersEdited.current) {
      const next = initialFilters(source);
      setFilters({ places: next.places, equipment: next.equipment });
    }
  }, [source]);
  const cautions = saved?.cautions ?? answers.cautions;
  const cautionAreas = cautions.map(
    area =>
      ({
        knee: 'knees',
        shoulder: 'shoulders',
        wrist: 'wrists',
        back: 'back',
        hip: 'hips',
        ankle: 'ankles',
        neck: 'neck',
        other: 'other',
      })[area],
  );
  function choose(ids: string[], message = '') {
    setManualSelection(undefined);
    setTemplateId(undefined);
    setSelected([...new Set(ids)].filter(id => exercises.some(exercise => exercise.id === id)));
    setNotice(message);
  }
  function toggleExercise(id: string) {
    setManualSelection(undefined);
    if (templateId || manualSelection) setNotice(copy.manualDefaults);
    setTemplateId(undefined);
    setSelected(current => toggleSelection(current, id));
  }
  async function localSelection() {
    if (!(saved?.adultConfirmed ?? answers.adultConfirmed)) {
      setNotice(copy.adultRequired);
      return;
    }
    if (!saved && !initialFilters(answers.placeEquipmentText).places.length && !filters.places?.length) {
      setNotice(copy.placeRequired);
      return;
    }
    const profile =
      saved ??
      localProfile({
        ...answers,
        placeEquipmentText: [answers.placeEquipmentText, ...(filters.places ?? [])].join(' '),
      });
    if (!data) return;
    if (isFeatureEnabled('trainingEngine')) {
      setCandidateTemplates([]);
      try {
        const candidate = await workflow.propose(profile, locale, { trainingEngine: true });
        if (!isFeatureEnabled('trainingEngine')) return;
        setCandidateTemplates(
          candidate.proposal.templates.map(template => ({
            adultConfirmed: profile.adultConfirmed,
            template,
            expectedRevision: candidate.expectedRevision,
            restoreGeneration: candidate.restoreGeneration,
          })),
        );
        setNotice(copy.chooseCandidate);
      } catch {
        setNotice(`${engineCopy('engine.copy.unavailable', locale)} ${copy.noPlan}`);
      }
      return;
    }
    const proposal = basicProposal(profile, locale);
    setCandidateTemplates(
      (proposal?.templates ?? []).map(template => ({
        adultConfirmed: profile.adultConfirmed,
        template,
        expectedRevision: data.metadata.dataRevision,
        restoreGeneration: data.metadata.restoreGeneration ?? 0,
      })),
    );
    setNotice(proposal?.templates.length ? copy.local : copy.helpEmpty);
  }
  function openHelp() {
    if (!(saved?.adultConfirmed ?? answers.adultConfirmed)) {
      setNotice(copy.adultRequired);
      return;
    }
    if (!data) return;
    const profile = saved ?? localProfile(answers);
    setCoachRequest(buildCoachRequest({ task: 'ONBOARD_PLAN', data, profile }));
    setCoachRevision(data.metadata.dataRevision);
    setCoachOpen(true);
  }
  async function importCandidate(candidate: CoachApplication) {
    const metadata = await repository.readMetadata();
    if (
      metadata.dataRevision !== candidate.expectedRevision ||
      (metadata.restoreGeneration ?? 0) !== candidate.request.restoreGeneration
    )
      throw new Error('STALE_CANDIDATE');
    const response = adaptCoachResponse(candidate.request, candidate.response);
    if (candidate.request.task !== 'ONBOARD_PLAN' || response.type !== 'plan_proposal')
      throw new Error('INVALID_CANDIDATE');
    setCandidateTemplates(
      response.proposal.templates.map(template => ({
        adultConfirmed: candidate.request.adultConfirmed,
        template: candidate.request.trainingEngine
          ? template
          : { ...template, estimatedMinutes: estimatePlannedMinutes(template.items) },
        expectedRevision: metadata.dataRevision,
        restoreGeneration: metadata.restoreGeneration ?? 0,
      })),
    );
    setCoachOpen(false);
    setNotice(copy.chooseCandidate);
  }
  const template = templates.find(item => item.id === templateId);
  const minutes = selected.length
    ? estimatePlannedMinutes(template?.items ?? manualSelection?.template.items ?? manualTrainingItems(selected))
    : 0;
  return (
    <main className="manual-page">
      <nav className="v9-plan-nav" aria-label={copy.title}>
        <BackButton locale={locale} onFallback={() => navigate('/')} />
        <HomeExit locale={locale} dirty={selected.length > 0} onLeave={() => navigate('/')} />
      </nav>
      <header>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
      </header>
      <CheckinCard />
      {(historyPainState(data?.workouts ?? [], saved?.painState, data?.state?.painFollowupRestrictions) ?? []).some(
        row => row.remainingSessions > 0,
      ) && <p role="status">{engineCopy('pain.copy.drop_pattern', locale)}</p>}

      <div className="manual-shortcuts">
        <Button
          onClick={() => {
            if (data?.version?.templates.length) setShowPlans(value => !value);
            else setNotice(copy.noPlan);
          }}
        >
          {copy.plan}
        </Button>
        <Button onClick={openHelp}>{copy.help}</Button>
        <Button
          onClick={() => {
            const recent = recentExerciseIds(data?.workouts ?? []);
            if (recent.length) choose(recent);
            else setNotice(copy.noRecent);
          }}
        >
          {copy.recent}
        </Button>
      </div>
      {showPlans && (
        <section className="manual-plans" aria-label={copy.choosePlan}>
          <h2>{copy.choosePlan}</h2>
          {templates.map(template => (
            <Button
              key={template.id}
              onClick={() => {
                choose(
                  template.items.map(item => item.exerciseId),
                  copy.planTargets,
                );
                setTemplateId(template.id);
                setShowPlans(false);
              }}
            >
              {templateLabel(template, locale, templates)}
            </Button>
          ))}
          <Button onClick={() => setShowPlans(false)}>{copy.close}</Button>
        </section>
      )}
      {!!candidateTemplates.length && (
        <section aria-label={copy.chooseCandidate}>
          <h2>{copy.chooseCandidate}</h2>
          <p>{copy.candidateHint}</p>
          {candidateTemplates.map(selection => (
            <section key={selection.template.id}>
              <h3>{templateLabel(selection.template, locale)}</h3>
              <ul>
                {selection.template.items.map((item, index) => (
                  <li key={index}>
                    {exercises.find(e => e.id === item.exerciseId)?.name[locale]} · {item.sets} {copy.sets} ·{' '}
                    {targetText(item.target, locale)}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => {
                  choose(
                    selection.template.items.map(item => item.exerciseId),
                    copy.candidateReady,
                  );
                  setManualSelection(selection);
                }}
              >
                {copy.useCandidate}
              </Button>
            </section>
          ))}
        </section>
      )}
      <p role="status" className="manual-notice">
        {notice}
      </p>
      {selected.length > 0 && (
        <section aria-label={format(copy.selected, { count: selected.length })} className="manual-chips">
          {selected.map(id => (
            <ChoiceChip key={id} size="sm" selected onClick={() => toggleExercise(id)}>
              {exercises.find(exercise => exercise.id === id)!.name[locale]} ×
            </ChoiceChip>
          ))}
        </section>
      )}
      {selected.length > 0 && <Button onClick={() => choose([])}>{copy.removeAll}</Button>}
      <ExerciseBrowser
        locale={locale}
        query={query}
        setQuery={setQuery}
        filters={filters}
        setFilters={next => {
          filtersEdited.current = true;
          setFilters(next);
        }}
        selected={selected}
        onSelect={toggleExercise}
        onDetail={(id, trigger) => {
          guideTrigger.current = trigger;
          setGuideId(id);
        }}
        cautionAreas={cautionAreas}
        prefilled={initial.places.length > 0 || initial.equipment.length > 0}
      />
      <footer className="manual-start">
        <div aria-live="polite">
          <strong>{format(copy.selected, { count: selected.length })}</strong>
          <span>{format(copy.minutes, { minutes })}</span>
        </div>
        <Button
          variant="primary"
          disabled={!selected.length || busy}
          onClick={() => void (template ? start(template.id) : startManual(selected, manualSelection))}
        >
          {copy.start}
        </Button>
      </footer>
      <ExerciseGuidePanel
        id={guideId}
        locale={locale}
        open={!!guideId}
        onClose={() => setGuideId(undefined)}
        triggerRef={guideTrigger}
      />
      <CoachPanel
        open={coachOpen}
        onClose={() => setCoachOpen(false)}
        request={coachRequest}
        expectedRevision={coachRevision}
        onApply={importCandidate}
        rememberOnApply={false}
        locale={locale}
        disableNutrition
        localFallbackOnError
        templateMinutes={template =>
          coachRequest?.trainingEngine ? template.estimatedMinutes : estimatePlannedMinutes(template.items)
        }
        applyLabel={copy.importCandidate}
        successLabel={copy.candidateReady}
        onLocalPlan={() => {
          setCoachOpen(false);
          void localSelection();
        }}
      />
    </main>
  );
}
