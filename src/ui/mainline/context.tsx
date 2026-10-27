import { equipmentLabel, EXERCISE_PLACES } from '../../catalog/taxonomy';
import { useFeature } from '../useFeature';
import { isFeatureEnabled } from '../../application/feature-flags';
import { countRetention, countUsage, reportSafeError } from '../../application/monitoring-client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../themes/ThemeProvider';
import { getThemeSlots } from '../../themes/registry';
import { createV8Workflow, type LocalCandidate, type ManualSelection } from '../../application/v8-workflow';
import { optionalCoachBody, optionalCoachHistory } from '../../application/v8-coach-optional';
import { backfillOnboarding } from '../../application/v8-onboarding-backfill';
import { buildCoachRequest } from '../../coach/request-builder';
import type { CoachRequest, PickedSchedule } from '../../coach/contracts';
import { pickedSchedule } from '../../application/picked-schedule';
import { planTipCandidate } from '../../application/plan-tip-candidate';
import { normalizeTrainingDates } from '../../application/training-dates';
import { DEFAULT_TIME_ZONE, addDays, todayIn, weekStart } from '../../domain/local-date';
import { monthOf, shiftMonth } from '../../application/plan-calendar';
import type { CoachProfile } from '../../domain/v8/contracts';
import i18n, { languageKey } from '../../i18n';
import { profileService } from '../../application/profile';
import { repository } from '../../persistence/repository';
import { createV8DataService } from '../../persistence/v8-access';
import { computeMonthFacts, computeWeekFacts } from '../../application/review/compute';
import { exercises } from '../../catalog/exercises';
import type { OnboardingAnswers } from '../pages/onboarding/OnboardingPage';
import type { MonthFacts, WeekFacts } from '../../application/review/contracts';
import zh from '../../i18n/features/training/zh.json';
import en from '../../i18n/features/training/en.json';
/** The language saved on this device; Chinese when none is saved or storage is unavailable. */
function savedLocale(): 'zh' | 'en' {
  try {
    return localStorage.getItem(languageKey) === 'en' ? 'en' : 'zh';
  } catch {
    return 'zh';
  }
}
export const workflow = createV8Workflow(repository);
const blank: OnboardingAnswers = {
  goalText: '',
  scheduleOriginalText: '',
  placeEquipmentText: '',
  adultConfirmed: false,
  cautions: [],
};
export interface VersionUndo {
  planId: string;
  appliedVersionId: string;
  priorVersionId: string;
  expectedRevision: number;
  versionNumber: number;
  expiresAt: number;
}
function week(today: string) {
  const from = weekStart(today);
  return { from, to: addDays(from, 6) };
}
function useController() {
  const planLifecycle = useFeature('planLifecycle');
  const navigate = useNavigate(),
    location = useLocation(),
    appearance = useTheme();
  const [data, setData] = useState<Awaited<ReturnType<typeof workflow.snapshot>>>();
  const [monthFacts, setMonthFacts] = useState<MonthFacts>(),
    [previousFacts, setPreviousFacts] = useState<WeekFacts>(),
    [facts, setFacts] = useState<WeekFacts>(),
    [answers, setAnswers] = useState(blank),
    [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [completedWeeks, setCompletedWeeks] = useState<[WeekFacts, WeekFacts]>();
  const [optionalCoach, setOptionalCoach] = useState<{ body?: CoachRequest['body']; history?: string }>({});
  const [reviewKind, setReviewKind] = useState<'week' | 'month'>('week');
  const [draftDiscarded, setDraftDiscarded] = useState(false);
  const [deletedNotice, setDeletedNotice] = useState<{ planId: string; expiresAt: number }>();
  /** The 10-second “撤销” toast after a new plan version (芽芽 chat or a local tip). */
  const [versionUndo, setVersionUndo] = useState<VersionUndo>();
  const [candidate, setCandidate] = useState<LocalCandidate>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  // AI 助手芽芽 activation sheet, opened in place from the chat, the orb, the draft or onboarding.
  const [activationOpen, setActivationOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false),
    [coachRequest, setCoachRequest] = useState<CoachRequest>(),
    [coachRevision, setCoachRevision] = useState(0);
  const [coachInitialSend, setCoachInitialSend] = useState<{
    nonce: string;
    message: string;
    request: CoachRequest;
    expectedRevision: number;
  }>();
  function sendHomeCoach(request: CoachRequest, message: string) {
    if (!data) return;
    coachTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCoachRequest(request);
    setCoachRevision(data.metadata.dataRevision);
    setCoachInitialSend({ nonce: crypto.randomUUID(), message, request, expectedRevision: data.metadata.dataRevision });
    setCoachOpen(true);
  }
  const coachTrigger = useRef<HTMLElement | null>(null);
  const [coachDraft, setCoachDraft] = useState<{ nonce: string; text: string }>();
  /** Opens the assistant like openCoach and places a quick-action prompt in the composer without sending it. */
  function openCoachWithDraft(
    text: string,
    task?: CoachRequest['task'],
    profile?: CoachProfile,
    templateId?: string,
    schedule?: PickedSchedule,
  ) {
    openCoach(task, templateId, profile, schedule);
    setCoachDraft({ nonce: crypto.randomUUID(), text });
  }
  /** Session shown on 今天, so the 芽芽 orb adjusts the same workout the user is looking at. */
  const [homeTemplateId, setHomeTemplateId] = useState<string>();
  function openCoach(
    task: CoachRequest['task'] = 'MODIFY_PLAN',
    templateId?: string,
    profile?: CoachProfile,
    schedule?: PickedSchedule,
  ) {
    if (!data) return;
    // A new plan discussed in chat keeps the calendar days already picked (draft first, then the onboarding answers).
    const picked =
      task === 'ONBOARD_PLAN'
        ? (schedule ??
          (candidate
            ? pickedSchedule(candidate)
            : pickedSchedule({
                ...answers,
                trainingDates: normalizeTrainingDates(
                  answers.trainingDates ?? [],
                  todayIn(data.profile?.timeZone ?? DEFAULT_TIME_ZONE),
                ).dates,
              })))
        : undefined;
    coachTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const selectedFacts = reviewKind === 'month' ? monthFacts : facts;
    const nextRequest = buildCoachRequest({
      ...optionalCoach,
      task,
      data,
      templateId,
      profile,
      schedule: picked,
      facts: selectedFacts ? { ...selectedFacts, improvements: [...selectedFacts.improvements] } : undefined,
      kind: reviewKind,
    });
    const key = (request: CoachRequest | undefined) => {
      if (!request) return '';
      const { requestId: _requestId, conversationId: _conversationId, ...content } = request;
      return JSON.stringify(content);
    };
    if (key(nextRequest) !== key(coachRequest) || coachRevision !== data.metadata.dataRevision) {
      setCoachRequest(nextRequest);
      setCoachRevision(data.metadata.dataRevision);
    }
    setCoachOpen(true);
  }
  function refreshCoachContext(next: Awaited<ReturnType<typeof workflow.snapshot>>) {
    if (!coachRequest) return;
    const task = coachRequest.task === 'ONBOARD_PLAN' ? 'MODIFY_PLAN' : coachRequest.task;
    const currentFacts = reviewKind === 'month' ? monthFacts : facts;
    const updated = buildCoachRequest({
      ...optionalCoach,
      conversationId: coachRequest.conversationId,
      task,
      data: next,
      templateId: coachRequest.task === 'ADJUST_TODAY' ? coachRequest.template.id : undefined,
      facts: currentFacts ? { ...currentFacts, improvements: [...currentFacts.improvements] } : undefined,
      kind: reviewKind,
    });
    // Applying a future-plan version does not rewrite an active workout. Keep
    // the conversation attached to the new plan when its old workout snapshot
    // can no longer be adjusted safely.
    setCoachRequest(
      updated ??
        (task === 'ADJUST_TODAY'
          ? buildCoachRequest({
              ...optionalCoach,
              conversationId: coachRequest.conversationId,
              task: 'MODIFY_PLAN',
              data: next,
            })
          : undefined),
    );
    setCoachRevision(next.metadata.dataRevision);
  }
  const [workoutValues, setWorkoutValues] = useState<Record<string, number>>({}),
    [focusIndex, setFocusIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const draftKey = useRef(''),
    lock = useRef(false);
  // Before local data loads, boot and error copy follow the saved language.
  const locale: 'zh' | 'en' = (data ? data.profile?.locale : savedLocale()) === 'en' ? 'en' : 'zh',
    t = locale === 'zh' ? zh : en;
  const observedCounts = useRef<{ plans: number; started: number; completed: number } | undefined>(undefined);
  async function reload() {
    if (isFeatureEnabled('planLifecycle')) await workflow.purgeExpiredPlans();
    const next = await workflow.snapshot();
    const counters = {
      plans: next.versions.length,
      started: next.workouts.length,
      completed: next.workouts.filter(w => ['complete', 'partial', 'not_started'].includes(w.status)).length,
    };
    if (observedCounts.current) {
      for (const [key, event] of [
        ['plans', 'plan_confirmed'],
        ['started', 'workout_started'],
        ['completed', 'workout_completed'],
      ] as const) {
        const delta = counters[key] - observedCounts.current[key];
        if (delta > 0) countUsage(event, delta);
      }
    }
    observedCounts.current = counters;
    const review = await createV8DataService(repository).getReviewWorkouts();
    const zone = next.profile?.timeZone ?? DEFAULT_TIME_ZONE,
      today = todayIn(zone);
    const firstPlan = next.versions.map(v => v.createdAt).sort()[0];
    countRetention(
      firstPlan && todayIn(zone, firstPlan),
      next.workouts.filter(w => w.status === 'complete' || w.status === 'partial').map(w => w.localDate),
      today,
    );
    setOptionalCoach({
      body: optionalCoachBody(next.profile),
      history: optionalCoachHistory(
        [...review.legacyWorkouts, ...review.workouts],
        today,
        zone,
        next.profile?.locale === 'en' ? 'en' : 'zh',
      ),
    });
    const input = {
      ...week(today),
      timeZone: zone,
      weeklyTarget:
        next.version?.weeklyTarget ?? next.state?.reviewWeeklyTarget ?? next.state?.coachProfile?.weeklyTarget ?? 2,
      ...review,
      activities: next.activities,
      bodyWeights: await repository.db.bodyWeights.toArray(),
    };
    setFacts(computeWeekFacts(input));
    const previous = computeWeekFacts({ ...input, from: addDays(input.from, -7), to: addDays(input.from, -1) });
    setPreviousFacts(previous);
    setCompletedWeeks([
      computeWeekFacts({ ...input, from: addDays(input.from, -14), to: addDays(input.from, -8) }),
      previous,
    ]);
    const month = monthOf(today);
    setMonthFacts(computeMonthFacts({ ...input, from: `${month}-01`, to: addDays(`${shiftMonth(month, 1)}-01`, -1) }));
    // Publish the snapshot only when its assistant/review context is ready.
    setData(next);
    return next;
  }
  /**
   * 芽芽's plan tip the user tapped (今天 / 上周 / 今天练这里): the same apply path as a 芽芽 plan edit (new version,
   * old one kept), then the same 10-second undo. Resolves to the new version when one was saved.
   */
  async function applyPlanCandidate(tip: Parameters<typeof planTipCandidate>[1]) {
    let saved: NonNullable<typeof data>['version'];
    await run(async () => {
      const previous = data?.version;
      const candidate = data && previous && planTipCandidate(data, tip);
      if (!candidate) return;
      await workflow.applyCoachCandidate(candidate);
      const updated = await reload();
      if (updated.version && updated.version.id !== previous.id && updated.plan) {
        saved = updated.version;
        setVersionUndo({
          planId: updated.plan.id,
          appliedVersionId: updated.version.id,
          priorVersionId: previous.id,
          expectedRevision: updated.metadata.dataRevision,
          versionNumber: updated.version.versionNumber,
          expiresAt: Date.now() + 10000,
        });
      }
    });
    return saved;
  }
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
      await reload();
    } catch {
      reportSafeError('storage');
      setError(t.saveError);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    let alive = true;
    void (async () => {
      await profileService.initialize(savedLocale());
      const next = await reload();
      if (!alive) return;
      if (next.profile) await i18n.changeLanguage(next.profile.locale);
      if (!alive) return;
      draftKey.current = `fitness-v8-draft:${next.metadata.localProfileId}:${next.metadata.restoreGeneration ?? 0}`;
      const legacy = await repository.db.guidedStates.get('guided');
      if (legacy?.onboarding?.answers)
        setAnswers(backfillOnboarding(legacy.onboarding.answers, next.profile?.locale === 'en' ? 'en' : 'zh'));
      if (next.state?.coachProfile) {
        const p = next.state.coachProfile;
        setAnswers({
          goalText: p.goalText,
          scheduleOriginalText: p.scheduleOriginalText,
          placeEquipmentText: [
            EXERCISE_PLACES[p.place]?.[locale === 'zh' ? 0 : 1] ?? p.place,
            ...p.equipment.map(key => equipmentLabel(key, locale)),
          ].join(' · '),
          adultConfirmed: p.adultConfirmed,
          cautions: p.cautions,
        });
      }
      try {
        const saved = JSON.parse(localStorage.getItem(draftKey.current) ?? 'null');
        if (
          saved?.answers &&
          ['goalText', 'scheduleOriginalText', 'placeEquipmentText'].every(k => typeof saved.answers[k] === 'string') &&
          typeof saved.answers.adultConfirmed === 'boolean' &&
          Array.isArray(saved.answers.cautions)
        ) {
          if (next.profile?.bodyDetails && (!saved.updatedAt || saved.updatedAt < next.profile.bodyDetails.updatedAt)) {
            saved.answers.body = next.profile.bodyDetails.values;
            saved.answers.bodyText = '';
          }
          setAnswers(saved.answers);
          if ([0, 1, 2, 3, 4].includes(saved.step)) setStep(saved.step);
        }
      } catch {
        /* Preserve unknown raw draft. */
      }
      setAnswers(previous => ({ ...previous, body: previous.body ?? next.profile?.bodyDetails?.values }));
      setReady(true);
      if (
        location.pathname === '/' &&
        !next.state?.planDismissedAt &&
        !next.plans.length &&
        !next.deletedPlans.length &&
        !next.version &&
        !next.active &&
        !legacy?.onboarding?.completed &&
        (await repository.db.sessions.count()) === 0
      )
        navigate('/onboarding', { replace: true });
    })().catch(() => {
      if (alive) setError(t.loadError);
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (ready && planLifecycle) void reload().catch(() => setError(t.loadError));
  }, [ready, planLifecycle]);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(draftKey.current, JSON.stringify({ answers, step, updatedAt: new Date().toISOString() }));
      } catch {
        setError(t.draftError);
      }
  }, [answers, step, ready]);
  async function deletePlan(planId: string) {
    if (!isFeatureEnabled('planLifecycle')) return false;
    let success = false;
    await run(async () => {
      if (!data) return;
      const removed = await workflow.deletePlan(planId, data.metadata.dataRevision);
      setDeletedNotice({ planId, expiresAt: removed.undoUntil });
      success = true;
    });
    return success;
  }
  async function undoPlan() {
    if (!deletedNotice || Date.now() >= deletedNotice.expiresAt) {
      setDeletedNotice(undefined);
      return;
    }
    await run(async () => {
      if (!data) return;
      await workflow.restorePlan(deletedNotice.planId, data.metadata.dataRevision, true);
      setDeletedNotice(undefined);
    });
  }
  const slots = getThemeSlots(appearance.theme);
  const name = (id: string) => exercises.find(e => e.id === id)?.name[locale] ?? id;
  const start = (templateId?: string, manualId?: string, minutes?: number) =>
    run(async () => {
      const record = await workflow.start(templateId, manualId, undefined, undefined, minutes);
      setWorkoutValues({});
      setFocusIndex(0);
      navigate(`/workout/${record.id}`);
    });
  const startManual = (ids: string[], selection?: ManualSelection) =>
    run(async () => {
      const record = await workflow.start(undefined, undefined, ids, selection);
      setWorkoutValues({});
      setFocusIndex(0);
      navigate(`/workout/${record.id}`);
    });
  /** Clears onboarding answers, the unconfirmed draft and its local copy. Saved plans and workouts stay. */
  const resetOnboarding = () => {
    const fresh = {
      ...blank,
      ...(data?.profile?.bodyDetails?.values ? { body: data.profile.bodyDetails.values } : {}),
    };
    setAnswers(fresh);
    setStep(0);
    setCandidate(undefined);
    try {
      localStorage.setItem(
        draftKey.current,
        JSON.stringify({ answers: fresh, step: 0, updatedAt: new Date().toISOString() }),
      );
    } catch {
      /* The state above is already cleared. */
    }
  };
  const onboardingDirty = () =>
    !!candidate ||
    step > 0 ||
    !!answers.goalText.trim() ||
    !!answers.scheduleOriginalText.trim() ||
    !!answers.placeEquipmentText.trim() ||
    !!answers.trainingDates?.length;
  /** 重新制定计划 starts from the first question (Bo 2026-10-19); with earlier answers it asks first. */
  const [replanAsk, setReplanAsk] = useState(false);
  const startFresh = () => {
    setReplanAsk(false);
    resetOnboarding();
    setDraftDiscarded(false);
    navigate('/onboarding');
  };
  const restartPlanning = () => {
    if (onboardingDirty()) setReplanAsk(true);
    else startFresh();
  };
  const setLanguage = (next: 'zh' | 'en') => {
    if (next !== locale)
      void run(async () => {
        await profileService.setLocale(next);
        await i18n.changeLanguage(next);
      });
  };
  return {
    setLanguage,
    resetOnboarding,
    onboardingDirty,
    replanAsk,
    setReplanAsk,
    startFresh,
    homeTemplateId,
    setHomeTemplateId,
    coachDraft,
    openCoachWithDraft,
    refreshCoachContext,
    restartPlanning,
    draftDiscarded,
    setDraftDiscarded,
    deletedNotice,
    setDeletedNotice,
    versionUndo,
    setVersionUndo,
    applyPlanCandidate,
    deletePlan,
    undoPlan,
    coachInitialSend,
    sendHomeCoach,
    reviewKind,
    setReviewKind,
    activationOpen,
    setActivationOpen,
    coachOpen,
    setCoachOpen,
    coachRequest,
    coachRevision,
    coachTrigger,
    openCoach,
    completedWeeks,
    monthFacts,
    previousFacts,
    workoutValues,
    setWorkoutValues,
    focusIndex,
    setFocusIndex,
    data,
    facts,
    answers,
    setAnswers,
    step,
    setStep,
    candidate,
    setCandidate,
    busy,
    error,
    locale,
    t,
    slots,
    name,
    navigate,
    run,
    reload,
    start,
    startManual,
    appearance,
  };
}
const Context = createContext<ReturnType<typeof useController> | null>(null);
export const useMainline = () => {
  const value = useContext(Context);
  if (!value) throw new Error('Missing mainline provider');
  return value;
};
export function MainlineProvider({ children }: { children: ReactNode }) {
  const value = useController();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function format(text: string, values: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
}
