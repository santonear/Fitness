import { durationText } from '../../../components/ExerciseTargets';
import { painPromptAreas } from '../../../../application/pain-followup';
import { Rules, calendarDay } from '../../../../engine/data';
import { PregnancySafetyControls } from '../PregnancySafetyControls';
import { OlderFallPanel } from '../OlderFallPanel';
import { PostpartumSafetyPanel } from '../PostpartumSafetyPanel';
import { painExcludedItemIndexes } from '../../../../application/pain-restrictions';
import { needsPostpartumReferralCheck } from '../../../../application/postpartum-referral';
import { effectivePainItem, latestSetFeedback } from '../../../../application/training-pain';
import { SetFeedback } from '../SetFeedback';
import { engineCopy } from '../../../../coach/engine-copy';
import { Button } from '../../../components/common';
import { PrimaryButton } from '../../../components/kit';
import { workflow, format } from '../../../mainline/context';
import { exercises } from '../../../../catalog/exercises';
import { CoachVisual } from '../../../components/CoachVisual';
import { getExerciseGuide } from '../../../../catalog/exercise-guide';
import { manualTrainingItems } from '../../../../application/rules/manual-items';
import {
  holdIdle,
  holdPause,
  holdStatus,
  holdSecondsToRecord,
  restVisible,
  pauseOtherHolds,
  type HoldTimer,
} from '../timer-logic';
import { VoiceToggle } from '../../plan-upgrade/VoiceToggle';
import { Icon } from './workout-parts';
import { playSetCue } from '../useRestVibration';
import type { useWorkoutState } from './useWorkoutState';

const painPromptRules = new Rules();
type WorkoutState = ReturnType<typeof useWorkoutState>;
/** The state once a workout and its current item exist (WorkoutPage returned early otherwise). */
export type WorkoutReady = WorkoutState & {
  active: NonNullable<WorkoutState['active']>;
  item: NonNullable<WorkoutState['item']>;
  data: NonNullable<WorkoutState['data']>;
};
export type WorkoutModel = ReturnType<typeof workoutModel>;

/** Values derived for one render of the player; plain function, so the rendered tree is unchanged. */
export function workoutModel(w: WorkoutReady) {
  const {
    engineEnabled,
    data,
    t,
    locale,
    name,
    navigate,
    run,
    busy,
    openCoach,
    index,
    setIndex,
    values,
    active,
    panelTrigger,
    safetyInline,
    showPanel,
    copy,
    p,
    engineCopyText,
    holds,
    setHolds,
    restClosed,
    setRestClosed,
    latestSet,
    restKey,
    now,
    cardiacPanel,
    items,
    item,
    template,
    restPlan,
  } = w;
  const exerciseIdOf = (itemIndex: number, fallback: string) =>
    (engineEnabled || active.painActions?.length ? effectivePainItem(active, itemIndex)?.exerciseId : undefined) ??
    active.substitutions?.filter(s => s.itemIndex === itemIndex).at(-1)?.toExerciseId ??
    fallback;
  const effective = engineEnabled || active.painActions?.length ? effectivePainItem(active, item.itemIndex) : undefined;
  const effectiveId =
    effective?.exerciseId ??
    active.substitutions?.filter(s => s.itemIndex === item.itemIndex).at(-1)?.toExerciseId ??
    item.exerciseId;
  const exercise = exercises.find(e => e.id === effectiveId)!;
  const planned = effective ?? template?.items[item.itemIndex];
  const prescription = planned?.exerciseId === effectiveId ? planned.prescription : undefined;
  const promptedPainAreas = latestSet
    ? painPromptAreas(latestSet.exerciseId, data.state?.coachProfile?.cautions ?? [], painPromptRules)
    : [];
  const population = data.state?.coachProfile?.population;
  const matching = planned?.exerciseId === effectiveId ? planned.target : manualTrainingItems([effectiveId])[0]?.target;
  const previous = active.sets.filter(s => s.itemIndex === item.itemIndex && s.exerciseId === effectiveId).at(-1);
  const relativePower = !!prescription?.safetyCue && planned?.target.metricType === 'reps';
  const needsLoad = exercise.metricType === 'reps_load' && !relativePower;
  const timed = exercise.metricType.startsWith('duration') && !relativePower;
  const key = `${active.id}:${index}:${effectiveId}`;
  const value =
    values[key] ??
    (timed
      ? (previous?.durationSeconds ?? (matching && 'durationSeconds' in matching ? matching.durationSeconds : 30))
      : (previous?.reps ?? (matching && 'reps' in matching ? matching.reps : 8)));
  const suggestedLoad = previous?.loadGrams ?? (matching && 'loadGrams' in matching ? matching.loadGrams : undefined);
  const load =
    values[`${key}:kg`] ?? (typeof suggestedLoad === 'number' && suggestedLoad > 0 ? suggestedLoad / 1000 : undefined);
  const hasLoad = load !== undefined && Number.isFinite(load) && load > 0;
  const guide = getExerciseGuide(effectiveId, locale);
  const distance =
    values[`${key}:meters`] ??
    previous?.distanceMeters ??
    (matching && 'distanceMeters' in matching ? matching.distanceMeters : undefined);
  const excluded = new Set(
    painExcludedItemIndexes(
      active,
      data.workouts,
      data.state?.coachProfile?.painState,
      data.state?.painFollowupRestrictions,
    ),
  );
  const pendingPain = latestSetFeedback(active).some(
    event =>
      event.effort === 'discomfort' &&
      (event.painScore ?? 0) >= 4 &&
      !active.painActions?.some(action => action.eventId === event.id),
  );
  const painBlocked =
    !!data.state?.pregnancySafety?.providerPause ||
    !!data.state?.olderSafety?.reviewRequiredAt ||
    !!data.state?.cardiacPause ||
    !!data.state?.postpartumSafety?.urgentAt ||
    !!data.state?.trainingPause ||
    !!active.painReviewRequired ||
    pendingPain;
  const setsOf = (itemIndex: number) => active.sets.filter(s => s.itemIndex === itemIndex).length;
  const isDone = (row: { itemIndex: number; plannedSetCount: number }) =>
    excluded.has(row.itemIndex) || setsOf(row.itemIndex) >= row.plannedSetCount;
  const done = setsOf(item.itemIndex),
    allDone = items.every(isDone),
    thisDone = isDone(item);
  const nextOpen = (from: number) => {
    const after = items.findIndex((row, i) => i > from && !isDone(row));
    return after >= 0 ? after : items.findIndex(row => !isDone(row));
  };
  // Hold countdown for timed exercises: idle until the user taps 开始计时.
  const holdKey = `${active.id}:${index}:${done}`,
    hold = holds[holdKey];
  const timer = timed ? (hold && hold.total === value ? hold : holdIdle(value)) : undefined;
  const timerStatus = timer ? holdStatus(timer, now) : 'idle';
  const setHold = (next: HoldTimer) =>
    setHolds(prior => ({
      ...(next.startedAt !== undefined ? pauseOtherHolds(prior, Date.now(), holdKey) : prior),
      [holdKey]: next,
    }));
  const recordValue = timer ? holdSecondsToRecord(timer, now) : value;
  const loadText =
    relativePower && prescription?.loadDescription
      ? prescription.loadDescription[locale]
      : needsLoad
        ? hasLoad
          ? `${load} ${t.kg}`
          : engineEnabled && prescription?.loadDescription
            ? prescription.loadDescription[locale]
            : copy.chooseLoad
        : t.bodyweight;
  const targetText = `${timed ? durationText(value, locale) : `${value} ${t.reps}`}${exercise.metricType === 'duration_distance' && distance !== undefined && Number.isFinite(distance) ? ` · ${distance} ${t.meters}` : ''}`;
  const complete = (event: React.MouseEvent<HTMLButtonElement>) => {
    panelTrigger.current = event.currentTarget;
    if (!allDone && !thisDone && needsLoad && !hasLoad) {
      showPanel('edit');
      return;
    }
    void run(async () => {
      if (painBlocked) return;
      if (allDone) {
        navigate(`/workout/${active.id}/finish`);
        return;
      }
      if (thisDone) {
        setIndex(items.findIndex(p => !isDone(p)));
        return;
      }
      let nextSet = 0;
      while (active.sets.some(s => s.itemIndex === item.itemIndex && s.setIndex === nextSet)) nextSet++;
      await workflow.recordSet(
        active.id,
        item.itemIndex,
        nextSet,
        timed
          ? {
              durationSeconds: recordValue,
              ...(exercise.metricType === 'duration_distance' && distance !== undefined && Number.isFinite(distance)
                ? { distanceMeters: distance }
                : {}),
            }
          : { reps: value, ...(needsLoad ? { loadGrams: Math.round(load! * 1000) } : {}) },
      );
      playSetCue();
      setHolds(prior => {
        const next = { ...prior };
        delete next[holdKey];
        return next;
      });
    });
  };
  // Safety: every existing panel stays reachable. Signals that need action stay on the page; the rest open from 身体不适？.
  const state = data.state,
    timeZone = data.profile?.timeZone ?? 'Asia/Shanghai';
  const referralDue =
    population?.kind === 'postpartum' &&
    needsPostpartumReferralCheck(state?.postpartumReferralChecks, 'weekly_checkin', {
      asOfDate: calendarDay(new Date().toISOString(), timeZone)!,
      timeZone,
    });
  const safetyAttention =
    !!state?.cardiacPause ||
    (!!state?.olderSafety && !state.olderSafety.professionalSeenAt) ||
    !!state?.pregnancySafety?.providerPause ||
    !!state?.postpartumSafety?.urgentAt ||
    !!state?.postpartumSafety?.regression ||
    referralDue;
  const safetyPanels = (
    <>
      {cardiacPanel}
      <OlderFallPanel />
      <PostpartumSafetyPanel />
      <PregnancySafetyControls exerciseId={effectiveId} itemIndex={item.itemIndex} />
      {engineEnabled && (population?.kind === 'pregnant' || population?.kind === 'postpartum') && (
        <details>
          <summary>{engineCopyText.stop}</summary>
          {population.kind === 'pregnant' ? (
            <p>{engineCopy('pregnancy.stop.copy.stop', locale)}</p>
          ) : (
            <>
              <p>{engineCopy('postpartum.copy.warning.warning', locale)}</p>
              <p>{engineCopy('postpartum.copy.urgent.urgent', locale)}</p>
            </>
          )}
          <Button onClick={() => navigate(`/workout/${active.id}/finish`)}>{engineCopyText.end}</Button>
        </details>
      )}
    </>
  );
  // A panel over the player holds the countdown; the user resumes it with 继续计时.
  const openPaused = (next: 'safety' | 'pause', trigger: HTMLElement) => {
    if (timer && timerStatus === 'running') setHold(holdPause(timer, Date.now()));
    showPanel(next, trigger);
  };
  const openSafety = (trigger: HTMLElement) => openPaused('safety', trigger);
  // Rest between sets: counts down from the saved set; the next set never starts by itself.
  const restItem = latestSet ? items.find(row => row.itemIndex === latestSet.itemIndex) : undefined;
  const restShown =
    !!restPlan &&
    !!restItem &&
    !allDone &&
    !painBlocked &&
    !safetyAttention &&
    restVisible(restPlan, now, restClosed.includes(restKey));
  const restNextIndex = restItem
    ? isDone(restItem)
      ? nextOpen(items.indexOf(restItem))
      : items.indexOf(restItem)
    : -1;
  const restNext = restNextIndex >= 0 ? items[restNextIndex] : undefined;
  const leaveRest = () => {
    setRestClosed(prior => [...prior, restKey]);
    if (restNextIndex >= 0) setIndex(restNextIndex);
  };
  const progressLabel = format(p.progress, { current: index + 1, total: items.length });
  const colon = locale === 'zh' ? '：' : ': ';
  const nextText = (): string => {
    if (allDone) return p.allDoneNext;
    if (!thisDone && done + 1 < item.plannedSetCount)
      return `${p.upNext}${colon}${name(effectiveId)} · ${format(t.setCount, { current: done + 2, total: item.plannedSetCount })}`;
    const upcoming = nextOpen(index);
    const row = upcoming >= 0 && upcoming !== index ? items[upcoming] : undefined;
    return row ? `${p.upNext}${colon}${name(exerciseIdOf(row.itemIndex, row.exerciseId))}` : p.lastOne;
  };
  const top = (
    <header className="wk-top">
      <button
        type="button"
        className="wk-round v8-press"
        aria-label={t.pause}
        onClick={event => openPaused('pause', event.currentTarget)}
      >
        <Icon d="M6 6l12 12M18 6L6 18" />
      </button>
      <div
        className="wk-progress"
        role="progressbar"
        aria-label={progressLabel}
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={items.filter(isDone).length}
      >
        {items.map((row, i) => (
          <span
            key={row.itemIndex}
            data-state={isDone(row) ? 'done' : i === index && !restShown ? 'current' : 'todo'}
          />
        ))}
      </div>
      <VoiceToggle locale={locale} cue={restShown ? undefined : name(effectiveId)} />
      <PrimaryButton
        tone="warn"
        size="sm"
        onClick={event => {
          if (safetyAttention) safetyInline.current?.scrollIntoView({ block: 'start' });
          openSafety(event.currentTarget);
        }}
      >
        {p.unwell}
      </PrimaryButton>
      <button
        type="button"
        className="wk-round wk-coach v8-press"
        aria-label={t.askCoach}
        onClick={() => openCoach('ADJUST_TODAY', active.templateId)}
      >
        <CoachVisual />
      </button>
    </header>
  );
  const feedback = (engineEnabled || promptedPainAreas.length > 0) && latestSet && (
    <section className="wk-feedback">
      <p className="wk-muted">{name(latestSet.exerciseId)}</p>
      <SetFeedback
        key={`${active.id}:${latestSet.itemIndex}:${latestSet.setIndex}`}
        fact={latestSet}
        events={active.setFeedbackEvents ?? []}
        locale={locale}
        busy={busy}
        painAllowed={!!data.state?.coachProfile?.healthStorageConsent}
        promptPainAreas={promptedPainAreas}
        onHealthSettings={() => navigate('/settings/engine')}
        onAppend={event =>
          void run(async () => {
            await workflow.appendSetFeedback(active.id, event, data.metadata.dataRevision);
          })
        }
      />
    </section>
  );
  return {
    ...w,
    exerciseIdOf,
    effective,
    effectiveId,
    exercise,
    planned,
    prescription,
    promptedPainAreas,
    population,
    matching,
    previous,
    relativePower,
    needsLoad,
    timed,
    key,
    value,
    suggestedLoad,
    load,
    hasLoad,
    guide,
    distance,
    excluded,
    pendingPain,
    painBlocked,
    setsOf,
    isDone,
    done,
    allDone,
    thisDone,
    nextOpen,
    holdKey,
    hold,
    timer,
    timerStatus,
    setHold,
    recordValue,
    loadText,
    targetText,
    complete,
    state,
    timeZone,
    referralDue,
    safetyAttention,
    safetyPanels,
    openSafety,
    restItem,
    restShown,
    restNextIndex,
    restNext,
    leaveRest,
    progressLabel,
    colon,
    nextText,
    top,
    feedback,
  };
}
