import { engineCopy } from '../../../coach/engine-copy';
import { PlanStops, PlanTip } from './WeekPlan';
import { weekDoneDays } from '../../../application/plan-calendar';
import { localDateIn, planStartDate, startDateLabel, weekdayIndex } from '../../../application/plan-presentation';
import { startDateCopy } from '../../../i18n/features/plan/start-date';
import { exerciseToolsCopy } from '../../../i18n/features/plan/exercise-tools';
import { StartDatePicker } from '../../components/StartDatePicker';
import { HomeExit } from '../../components/HomeExit';
import { PageSwitches } from '../../components/PageSwitches';
import { useExerciseTools } from '../../components/ExerciseTools';
import { fill } from '../../../i18n/features/onboarding/entry';
import { Card, PrimaryButton } from '../../components/kit';
import { useFeature } from '../../useFeature';
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PlanPage } from './PlanPage';
import { VersionsPage } from './VersionsPage';
import { useMainline, workflow } from '../../mainline/context';
import { Button, MorphPanel, Sheet } from '../../components/common';
import { ExerciseGuidePanel } from '../../components/ExerciseGuide';
import { planLifecycleCopy } from '../../../i18n/features/plan/lifecycle';
import guideZh from '../../../i18n/features/training/guide.zh.json';
import guideEn from '../../../i18n/features/training/guide.en.json';
import { DEFAULT_TIME_ZONE } from '../../../domain/local-date';
export function PlanRoute({ versions = false }: { versions?: boolean }) {
  const enabled = useFeature('planLifecycle'),
    engineEnabled = useFeature('trainingEngine'),
    remindersEnabled = useFeature('trainingReminders');
  const c = useMainline(),
    [query, setQuery] = useSearchParams(),
    [exercise, setExercise] = useState<string>();
  const triggerRef = useRef<HTMLElement | null>(null),
    [open, setOpen] = useState(false);
  const deleteTrigger = useRef<HTMLElement | null>(null),
    [deleting, setDeleting] = useState<string>();
  const activateTrigger = useRef<HTMLElement | null>(null),
    [activating, setActivating] = useState<{ id: string; revision: number }>();
  const activate = async (id: string, revision: number) => {
    await c.run(async () => {
      await workflow.activatePlan(id, revision);
      setActivating(undefined);
      setQuery({});
    });
  };
  const askActivate = (id: string, trigger: HTMLElement) => {
    if (!enabled || !c.data) return;
    activateTrigger.current = trigger;
    if (c.data.plan) setActivating({ id, revision: c.data.metadata.dataRevision });
    else void activate(id, c.data.metadata.dataRevision);
  };
  const timeZone = c.data?.profile?.timeZone ?? DEFAULT_TIME_ZONE,
    todayDate = localDateIn(timeZone),
    sd = startDateCopy[c.locale];
  const tools = useExerciseTools('plan', {
    swapBlocked: c.data?.active ? exerciseToolsCopy[c.locale].blocked : undefined,
  });
  const startTrigger = useRef<HTMLElement | null>(null),
    [startDraft, setStartDraft] = useState<string>();
  const copy = c.locale === 'zh' ? guideZh : guideEn,
    life = planLifecycleCopy[c.locale];
  const plans = c.data?.plans ?? [],
    previous = plans.filter(p => p.id !== c.data?.plan?.id);
  const creationDate = (planId: string) => {
    const value = c.data?.versions
      .filter(version => version.planId === planId && Number.isFinite(Date.parse(version.createdAt)))
      .map(version => version.createdAt)
      .sort((a, b) => Date.parse(a) - Date.parse(b))[0];
    if (!value || !Number.isFinite(Date.parse(value)) || !c.data?.profile?.timeZone) return undefined;
    return {
      value,
      label: new Intl.DateTimeFormat(c.locale, {
        timeZone: c.data.profile.timeZone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value)),
    };
  };
  const prenatalPrompt =
    c.data?.version &&
    c.data.state?.coachProfile?.population?.kind === 'pregnant' &&
    c.data.state.coachProfile.population.prenatalCareConfirmed === undefined ? (
      <div role="status" className="engine-notice">
        <Button onClick={() => c.navigate('/settings/engine')}>
          {engineCopy('pregnancy.gate.copy.prenatal_checkups_question', c.locale)}
        </Button>
      </div>
    ) : null;
  const selectedVersion = query.has('version') ? c.data?.versions.find(v => v.id === query.get('version')) : undefined;
  const selectedPlan = query.has('version')
    ? plans.find(p => p.id === selectedVersion?.planId)
    : query.has('plan')
      ? plans.find(p => p.id === query.get('plan'))
      : c.data?.plan;
  const selected = selectedVersion ?? c.data?.versions.find(v => v.id === selectedPlan?.currentVersionId);
  const selectedQuery = selectedPlan ? `?plan=${encodeURIComponent(selectedPlan.id)}` : '';
  const target = plans.find(p => p.id === deleting);
  const activePlanId = c.data?.versions.find(v => v.id === c.data?.active?.planVersionId)?.planId;
  const askDelete = (id: string) => {
    deleteTrigger.current = document.activeElement as HTMLElement;
    setDeleting(id);
  };
  if (versions)
    return (
      <main>
        <nav className="v9-plan-nav" aria-label={c.t.plan}>
          <HomeExit locale={c.locale} onLeave={() => c.navigate('/')} />
        </nav>
        {prenatalPrompt}
        <VersionsPage
          versions={(c.data?.versions ?? []).filter(v => v.planId === selectedPlan?.id)}
          currentVersionId={c.data?.version?.id ?? ''}
          language={c.locale}
          onBack={() => c.navigate(`/plans${selectedQuery}`)}
          onView={v => c.navigate(`/plans?version=${encodeURIComponent(v.id)}`)}
        />
      </main>
    );
  return (
    <main>
      <PageSwitches />
      {prenatalPrompt}
      {engineEnabled && selected?.enginePlan && <PlanStops plan={selected.enginePlan} locale={c.locale} />}
      {selected ? (
        <PlanPage
          version={selected}
          currentVersionId={c.data?.version?.id ?? ''}
          language={c.locale}
          exerciseName={c.name}
          onVersions={() => c.navigate(`/plans/versions${selectedQuery}`)}
          onExercises={() => c.navigate('/exercises')}
          onReplan={c.restartPlanning}
          today={weekdayIndex(new Date(), timeZone)}
          startDate={planStartDate(selected, timeZone)}
          todayDate={todayDate}
          timeZone={timeZone}
          workouts={c.data?.workouts}
          done={selected.id === c.data?.version?.id ? weekDoneDays(c.data?.workouts ?? [], todayDate) : undefined}
          exerciseActions={tools.buttons}
          changeStartBlocked={c.data?.active ? sd.busyWorkout : undefined}
          onChangeStart={trigger => {
            startTrigger.current = trigger;
            const current = planStartDate(selected, timeZone) ?? todayDate;
            setStartDraft(current < todayDate ? todayDate : current);
          }}
          onExercise={(v, id, index, trigger) => {
            triggerRef.current = trigger ?? null;
            setExercise(v.templates.find(t => t.id === id)?.items[index]?.exerciseId);
            setOpen(true);
          }}
        />
      ) : null}
      {selected && engineEnabled && selected.enginePlan && (
        <PlanTip
          plan={selected.enginePlan}
          locale={c.locale}
          onEditEnvironment={() => c.navigate('/settings/engine#environment')}
        />
      )}
      {selected ? null : (
        <>
          <h1 className="v9-display">{c.t.plan}</h1>
          <p>{life.empty}</p>
          <PrimaryButton onClick={c.restartPlanning}>{life.create}</PrimaryButton>
        </>
      )}
      <ExerciseGuidePanel
        id={exercise}
        locale={c.locale}
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
      />
      {remindersEnabled && (
        <Card variant="inset" padding="md" as="section" className="v9-plan-more">
          <PrimaryButton tone="quiet" size="sm" onClick={() => c.navigate('/settings#reminders')}>
            {copy.reminder}
          </PrimaryButton>
          <p>{copy.reminderHint}</p>
        </Card>
      )}
      {query.has('version') || query.has('plan') ? (
        <Button onClick={() => setQuery({})}>{life.back}</Button>
      ) : (
        <section aria-labelledby="previous-plans-title" className="v9-plan-more">
          <h2 id="previous-plans-title">{life.previous}</h2>
          {!previous.length && <p>{life.noPrevious}</p>}
          {previous.map(plan => {
            const created = creationDate(plan.id);
            return (
              <Card key={plan.id} variant="raised" padding="md">
                <h3>{plan.name}</h3>
                <p>
                  {created ? (
                    <>
                      {life.created} <time dateTime={created.value}>{created.label}</time>
                    </>
                  ) : (
                    life.createdUnknown
                  )}
                </p>
                <Button onClick={() => setQuery({ plan: plan.id })}>{life.view}</Button>
                <Button
                  hidden={!enabled}
                  disabled={c.busy || !!c.data?.active}
                  onClick={event => askActivate(plan.id, event.currentTarget)}
                >
                  {life.activate}
                </Button>
                <Button
                  hidden={!enabled}
                  disabled={c.busy || activePlanId === plan.id}
                  onClick={() => askDelete(plan.id)}
                >
                  {life.delete}
                </Button>
                {activePlanId === plan.id && <p>{life.active}</p>}
              </Card>
            );
          })}
        </section>
      )}
      {enabled && previous.length > 0 && c.data?.active && <p>{life.activateActive}</p>}
      {enabled && selectedPlan && selectedPlan.id !== c.data?.plan?.id && !query.has('version') && (
        <Button
          disabled={c.busy || !!c.data?.active}
          onClick={event => askActivate(selectedPlan.id, event.currentTarget)}
        >
          {life.activate}
        </Button>
      )}
      {enabled && selectedPlan && !query.has('version') && (
        <>
          <Button disabled={c.busy || activePlanId === selectedPlan.id} onClick={() => askDelete(selectedPlan.id)}>
            {selectedPlan.id === c.data?.plan?.id ? life.stop : life.delete}
          </Button>
          {activePlanId === selectedPlan.id && <p>{life.active}</p>}
        </>
      )}
      {tools.sheets}
      <MorphPanel
        open={!!startDraft}
        title={sd.sheetTitle}
        closeLabel={life.cancel}
        onClose={() => {
          if (!c.busy) setStartDraft(undefined);
        }}
        triggerRef={startTrigger}
      >
        <p>{sd.sheetHint}</p>
        {startDraft && (
          <StartDatePicker
            value={startDraft}
            today={todayDate}
            locale={c.locale}
            disabled={c.busy}
            onChange={setStartDraft}
          />
        )}
        <PrimaryButton
          disabled={c.busy || !startDraft || !!c.data?.active}
          onClick={() => {
            if (!startDraft || !c.data) return;
            const date = startDraft;
            void c.run(async () => {
              await workflow.changeStartDate({
                startDate: date,
                expectedRevision: c.data!.metadata.dataRevision,
                summary: fill(sd.summary, { date: startDateLabel(date, undefined, c.locale) }),
              });
              setStartDraft(undefined);
            });
          }}
        >
          {sd.save}
        </PrimaryButton>
      </MorphPanel>
      <MorphPanel
        open={enabled && !!target}
        title={life.confirmTitle}
        closeLabel={life.cancel}
        onClose={() => {
          if (!c.busy) setDeleting(undefined);
        }}
        triggerRef={deleteTrigger}
      >
        <p>{target?.name}</p>
        <p>{life.confirmHint}</p>
        <Button
          disabled={c.busy}
          onClick={() => {
            if (target)
              void c.deletePlan(target.id).then(success => {
                if (success) {
                  setDeleting(undefined);
                  if (location.pathname === '/plans') setQuery({});
                }
              });
          }}
        >
          {life.confirm}
        </Button>
      </MorphPanel>
      <MorphPanel
        open={enabled && !!activating}
        title={life.activateTitle}
        closeLabel={life.cancel}
        onClose={() => {
          if (!c.busy) setActivating(undefined);
        }}
        triggerRef={activateTrigger}
      >
        <p>{plans.find(p => p.id === activating?.id)?.name}</p>
        <p>{life.activateHint}</p>
        <Button
          disabled={c.busy || !!c.data?.active}
          onClick={() => {
            if (enabled && activating) void activate(activating.id, activating.revision);
          }}
        >
          {life.activateConfirm}
        </Button>
      </MorphPanel>
    </main>
  );
}
