import { CardiacStopPanel } from '../CardiacStopPanel';
import { latestSetFeedback, type PainFeedbackPreview } from '../../../../application/training-pain';
import { useFeature } from '../../../useFeature';
import { engineTrainingCopy } from '../../../../i18n/features/training/engine';
import { type ExerciseSearchFilters } from '../../../../catalog/catalog-service';
import { useState, useEffect, useRef } from 'react';
import { useMainline, workflow } from '../../../mainline/context';
import { useTrainingWakeLock } from '../useTrainingWakeLock';
import { recommendedRestSeconds, restVisible, type HoldTimer, type RestPlan } from '../timer-logic';
import guideZh from '../../../../i18n/features/training/guide.zh.json';
import guideEn from '../../../../i18n/features/training/guide.en.json';
import playerZh from '../../../../i18n/features/training/player.zh.json';
import playerEn from '../../../../i18n/features/training/player.en.json';
import { type Panel, useNow, closedRestKey, readClosedRests } from './workout-parts';

/** Screen state for the workout player: everything WorkoutPage reads before its early returns. */
export function useWorkoutState() {
  const engineEnabled = useFeature('trainingEngine');
  const {
    data,
    t,
    locale,
    name,
    navigate,
    run,
    busy,
    slots,
    openCoach,
    focusIndex: index,
    setFocusIndex: setIndex,
    workoutValues: values,
    setWorkoutValues: setValues,
  } = useMainline();
  const active = data?.active;
  const painSequence = useRef(0);
  const [painPreviewLoading, setPainPreviewLoading] = useState(false);
  const [painPreview, setPainPreview] = useState<{ eventId: string; value: PainFeedbackPreview }>();
  useEffect(() => {
    let alive = true;
    const serial = ++painSequence.current;
    setPainPreview(undefined);
    setPainPreviewLoading(false);
    if (!active) return;
    const event = latestSetFeedback(active)
      .filter(row => row.effort === 'discomfort' && (row.painScore ?? 0) >= 4)
      .at(-1);
    if (event)
      void workflow
        .painFeedbackPreview(active.id, event.id)
        .then(value => {
          if (alive && serial === painSequence.current) setPainPreview({ eventId: event.id, value });
        })
        .catch(() => {});
    return () => {
      alive = false;
      painSequence.current++;
    };
  }, [engineEnabled, active?.id, data?.metadata.dataRevision]);
  const [allowedSwapIds, setAllowedSwapIds] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    setAllowedSwapIds([]);
    void workflow
      .replacementCandidates()
      .then(ids => {
        if (alive) setAllowedSwapIds(ids);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [data?.metadata.dataRevision]);
  const [swapQuery, setSwapQuery] = useState(''),
    [swapFilters, setSwapFilters] = useState<ExerciseSearchFilters>({}),
    [guideId, setGuideId] = useState<string>();
  const [panel, setPanel] = useState<Panel>(),
    [replacement, setReplacement] = useState(''),
    [reason, setReason] = useState<'other' | 'discomfort'>('other');
  const panelTrigger = useRef<HTMLElement | null>(null),
    guideTrigger = useRef<HTMLElement | null>(null),
    safetyInline = useRef<HTMLElement | null>(null),
    [guideOpen, setGuideOpen] = useState(false),
    editStart = useRef(values);
  const showPanel = (next: Panel, trigger?: HTMLElement) => {
    if (trigger) panelTrigger.current = trigger;
    // Closing the edit panel with an invalid value goes back to what was there when it opened.
    if (next === 'edit') editStart.current = values;
    setPanel(next);
  };
  const copy = locale === 'zh' ? guideZh : guideEn,
    p = locale === 'zh' ? playerZh : playerEn,
    engineCopyText = engineTrainingCopy[locale];
  // Timer state is per device and per screen visit; saved facts never depend on it.
  const [holds, setHolds] = useState<Record<string, HoldTimer>>({}),
    [restExtra, setRestExtra] = useState<Record<string, RestPlan>>({}),
    [restClosed, setRestClosedState] = useState<string[]>(readClosedRests);
  const setRestClosed = (update: (prior: string[]) => string[]) =>
    setRestClosedState(prior => {
      const next = update(prior).slice(-20);
      try {
        sessionStorage.setItem(closedRestKey, JSON.stringify(next));
      } catch {
        /* Per-tab convenience only. */
      }
      return next;
    });
  const latestSet = active?.sets.at(-1);
  const restKey =
    active && latestSet ? `${active.id}:${latestSet.itemIndex}:${latestSet.setIndex}:${latestSet.completedAt}` : '';
  const cardiacPanel = data ? (
    <CardiacStopPanel
      locale={locale}
      busy={busy}
      paused={!!data.state?.cardiacPause}
      onStop={symptoms =>
        void run(async () => {
          await workflow.reportCardiacSymptoms(active?.id, symptoms, data.metadata.dataRevision);
          navigate('/workout/recovery');
        })
      }
    />
  ) : null;
  const items = active?.plannedExercises ?? [],
    item = items[index] ?? items[0];
  // Computed before any early return so hook order stays fixed.
  const template = active
    ? (active.templateSnapshot ??
      data?.versions.find(v => v.id === active.planVersionId)?.templates.find(s => s.id === active.templateId))
    : undefined;
  const restPlan: RestPlan | undefined =
    active && latestSet
      ? (restExtra[restKey] ?? {
          completedAt: Date.parse(latestSet.completedAt),
          baseSeconds: recommendedRestSeconds(template?.items[latestSet.itemIndex]?.prescription?.restSeconds),
          extraSeconds: 0,
        })
      : undefined;
  const anyHoldRunning = Object.values(holds).some(hold => hold.startedAt !== undefined);
  // Ticks only while a countdown runs or the rest screen can still show; the last tick re-checks and stops.
  const now = useNow(!!active && (anyHoldRunning || restVisible(restPlan, Date.now(), restClosed.includes(restKey))));
  useTrainingWakeLock(!!active && !panel);
  return {
    engineEnabled,
    data,
    t,
    locale,
    name,
    navigate,
    run,
    busy,
    slots,
    openCoach,
    index,
    setIndex,
    values,
    setValues,
    active,
    painSequence,
    painPreviewLoading,
    setPainPreviewLoading,
    painPreview,
    setPainPreview,
    allowedSwapIds,
    setAllowedSwapIds,
    swapQuery,
    setSwapQuery,
    swapFilters,
    setSwapFilters,
    guideId,
    setGuideId,
    panel,
    setPanel,
    replacement,
    setReplacement,
    reason,
    setReason,
    panelTrigger,
    guideTrigger,
    safetyInline,
    guideOpen,
    setGuideOpen,
    showPanel,
    editStart,
    copy,
    p,
    engineCopyText,
    holds,
    setHolds,
    restExtra,
    setRestExtra,
    restClosed,
    setRestClosedState,
    setRestClosed,
    latestSet,
    restKey,
    anyHoldRunning,
    now,
    cardiacPanel,
    items,
    item,
    template,
    restPlan,
  };
}
