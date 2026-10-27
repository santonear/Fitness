import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { exercises } from '../../catalog/exercises';
import { replacementScore } from '../../catalog/catalog-service';
import { engineAction } from '../../application/engine-plan';
import { estimatePlannedMinutes } from '../../domain/duration-estimate';
import { isFeatureEnabled } from '../../application/feature-flags';
import { buildCoachRequest } from '../../coach/request-builder';
import { coachResponseSchema, type CoachRequest, type CoachResponse } from '../../coach/contracts';
import type { EnginePlan } from '../../engine/contracts';
import type { PlannedItem, SessionTemplate } from '../../domain/v8/contracts';
import type { SetMetrics } from '../../domain/models';
import { exerciseToolsCopy } from '../../i18n/features/plan/exercise-tools';
import { fill } from '../../i18n/features/onboarding/entry';
import { useMainline, workflow } from '../mainline/context';
import { initialFilters } from '../pages/training/manual/selection';
import { MorphPanel } from './common';
import { ExerciseGuidePanel } from './ExerciseGuideLazy';
import { BigChoice, PrimaryButton } from './kit';
import './exercise-tools.css';

type ExerciseToolScope = 'today' | 'plan';
interface SwapTarget {
  templateId: string;
  itemIndex: number;
  exerciseId: string;
}

/** A new planned target for the replacement: keep the old target when the metric matches, otherwise a gentle default. */
function replacementTarget(previous: SetMetrics, metricType: SetMetrics['metricType']): SetMetrics {
  if (previous.metricType === metricType) return previous;
  if (metricType === 'reps_load') return { metricType, reps: 'reps' in previous ? previous.reps : 10, loadGrams: 0 };
  if (metricType === 'reps') return { metricType, reps: 'reps' in previous ? previous.reps : 10 };
  if (metricType === 'duration')
    return { metricType, durationSeconds: 'durationSeconds' in previous ? previous.durationSeconds : 30 };
  return { metricType, durationSeconds: 'durationSeconds' in previous ? previous.durationSeconds : 300 };
}
function replacedItem(item: PlannedItem, exerciseId: string): PlannedItem {
  const exercise = exercises.find(row => row.id === exerciseId)!;
  return {
    exerciseId,
    equipment: exercise.equipment,
    sets: item.sets,
    target: replacementTarget(item.target, exercise.metricType),
  };
}
const withItem = (template: SessionTemplate, itemIndex: number, item: PlannedItem): SessionTemplate => {
  const items = template.items.map((row, index) => (index === itemIndex ? item : row));
  return {
    ...template,
    items,
    estimatedMinutes:
      template.durationScope === 'untargeted'
        ? template.estimatedMinutes
        : Math.min(120, estimatePlannedMinutes(items as Parameters<typeof estimatePlannedMinutes>[0])),
  };
};

/**
 * 换动作 outside the chat (今天 / 计划). The user picks the replacement and confirms; the change goes through the
 * same validated apply path as assistant candidates (today: a one-time adjustment; plan: a new plan version).
 */
function ExerciseSwapSheet({
  scope,
  target,
  onClose,
  triggerRef,
}: {
  scope: ExerciseToolScope;
  target?: SwapTarget;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}) {
  const { data, locale, run, busy, name } = useMainline();
  const t = exerciseToolsCopy[locale];
  const [allowed, setAllowed] = useState<string[]>();
  const [choice, setChoice] = useState<string>();
  const [all, setAll] = useState(false);
  const [notice, setNotice] = useState('');
  const [guide, setGuide] = useState<string>();
  const guideTrigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    setChoice(undefined);
    setNotice('');
    setAll(false);
  }, [target?.templateId, target?.itemIndex, target?.exerciseId]);
  useEffect(() => {
    let alive = true;
    if (target)
      void workflow
        .replacementCandidates()
        .then(ids => {
          if (alive) setAllowed(ids);
        })
        .catch(() => {
          if (alive) setAllowed([]);
        });
    return () => {
      alive = false;
    };
  }, [target?.exerciseId, data?.metadata.dataRevision]);
  const profile = data?.state?.coachProfile;
  const ranked = useMemo(() => {
    if (!target || !allowed) return [];
    const equipment = initialFilters([profile?.place, ...(profile?.equipment ?? [])].join(' ')).equipment;
    // An exercise already in this session is not offered again.
    const inSession = new Set(
      data?.version?.templates.find(row => row.id === target.templateId)?.items.map(item => item.exerciseId) ?? [],
    );
    return allowed
      .filter(id => id !== target.exerciseId && !inSession.has(id) && exercises.some(row => row.id === id))
      .map(id => ({ id, score: replacementScore(id, target.exerciseId, equipment, profile?.cautions) }))
      .sort((a, b) => b.score - a.score)
      .map(row => row.id);
  }, [allowed, target?.exerciseId, target?.templateId, data?.version, profile]);
  const shown = all ? ranked.slice(0, 40) : ranked.slice(0, 6);

  function candidate(
    request: CoachRequest,
    replacementId: string,
  ): { response?: CoachResponse; enginePlan?: EnginePlan } {
    if (!target) return {};
    if (request.trainingEngine && request.engineProfile && isFeatureEnabled('trainingEngine')) {
      const result = engineAction(request, request.engineProfile, {
        kind: 'modify',
        changes: [{ op: 'replace', templateId: target.templateId, itemIndex: target.itemIndex, replacementId }],
      });
      return result.noop ? {} : { response: result.response, enginePlan: result.enginePlan };
    }
    const summary = fill(t.summary, { before: name(target.exerciseId), after: name(replacementId) });
    const identity = {
      requestId: request.requestId,
      restoreGeneration: request.restoreGeneration,
      mutationAllowed: false as const,
    };
    if (request.task === 'ADJUST_TODAY') {
      const item = request.template.items[target.itemIndex];
      if (!item || item.exerciseId !== target.exerciseId) return {};
      return {
        response: coachResponseSchema.parse({
          ...identity,
          type: 'today_adjustment',
          target: request.target,
          template: withItem(request.template, target.itemIndex, replacedItem(item, replacementId)),
          summary,
        }),
      };
    }
    if (request.task === 'MODIFY_PLAN') {
      const templates = request.plan.templates.map(template => {
        const item = template.id === target.templateId ? template.items[target.itemIndex] : undefined;
        return item && item.exerciseId === target.exerciseId
          ? withItem(template, target.itemIndex, replacedItem(item, replacementId))
          : template;
      });
      if (JSON.stringify(templates) === JSON.stringify(request.plan.templates)) return {};
      return {
        response: coachResponseSchema.parse({
          ...identity,
          type: 'change_proposal',
          target: request.target,
          proposal: { ...request.plan, templates, reasons: [summary, summary, summary] },
          changes: [summary],
        }),
      };
    }
    return {};
  }
  function confirm() {
    if (!target || !choice || !data) return;
    void run(async () => {
      const request = buildCoachRequest({
        task: scope === 'today' ? 'ADJUST_TODAY' : 'MODIFY_PLAN',
        data,
        templateId: target.templateId,
      });
      if (!request) {
        setNotice(t.unavailable);
        return;
      }
      const { response, enginePlan } = candidate(request, choice);
      if (!response) {
        setNotice(t.noop);
        return;
      }
      await workflow.applyCoachCandidate({
        request,
        response,
        expectedRevision: data.metadata.dataRevision,
        ...(enginePlan ? { enginePlan } : {}),
        byUser: true,
      });
      onClose();
    });
  }
  return (
    <>
      <MorphPanel open={!!target} onClose={onClose} triggerRef={triggerRef} title={t.swapTitle} closeLabel={t.close}>
        {target && (
          <div className="v9-swap">
            <p className="v9-swap-from">{fill(t.from, { name: name(target.exerciseId) })}</p>
            <p className="v9-swap-hint">{scope === 'today' ? t.todayHint : t.planHint}</p>
            {!allowed && <p role="status">{t.loading}</p>}
            {allowed && !ranked.length && <p role="status">{t.none}</p>}
            <div className="v9-swap-list" role="radiogroup" aria-label={t.choose}>
              {shown.map(id => (
                <div key={id} className="v9-swap-row">
                  <BigChoice label={name(id)} selected={choice === id} disabled={busy} onClick={() => setChoice(id)} />
                  <PrimaryButton
                    tone="text"
                    size="sm"
                    onClick={event => {
                      guideTrigger.current = event.currentTarget;
                      setGuide(id);
                    }}
                  >
                    {t.howTo}
                  </PrimaryButton>
                </div>
              ))}
            </div>
            {!all && ranked.length > shown.length && (
              <PrimaryButton tone="quiet" size="sm" onClick={() => setAll(true)}>
                {t.more}
              </PrimaryButton>
            )}
            {notice && <p role="alert">{notice}</p>}
            <div className="v9-swap-actions" data-orb-avoid="">
              <PrimaryButton disabled={!choice || busy} onClick={confirm}>
                {choice ? fill(t.confirm, { name: name(choice) }) : t.choose}
              </PrimaryButton>
              <PrimaryButton tone="text" size="md" onClick={onClose}>
                {t.cancel}
              </PrimaryButton>
            </div>
          </div>
        )}
      </MorphPanel>
      <ExerciseGuidePanel
        id={guide}
        locale={locale}
        open={!!guide}
        onClose={() => setGuide(undefined)}
        triggerRef={guideTrigger}
      />
    </>
  );
}

/** 动作怎么做 + 换动作 next to each exercise; each opens its own sheet. */
export function useExerciseTools(scope: ExerciseToolScope, options: { canSwap?: boolean; swapBlocked?: string } = {}) {
  const { locale } = useMainline();
  const t = exerciseToolsCopy[locale];
  const [guide, setGuide] = useState<string>();
  const [swap, setSwap] = useState<SwapTarget>();
  const guideTrigger = useRef<HTMLElement | null>(null),
    swapTrigger = useRef<HTMLElement | null>(null);
  const buttons = (templateId: string, itemIndex: number, exerciseId: string, canSwap = true): ReactNode => (
    <>
      <PrimaryButton
        tone="quiet"
        size="sm"
        className="v9-tool"
        onClick={event => {
          guideTrigger.current = event.currentTarget;
          setGuide(exerciseId);
        }}
      >
        {t.howTo}
      </PrimaryButton>
      {options.canSwap !== false && canSwap && (
        <PrimaryButton
          tone="quiet"
          size="sm"
          className="v9-tool"
          disabled={!!options.swapBlocked}
          title={options.swapBlocked}
          onClick={event => {
            swapTrigger.current = event.currentTarget;
            setSwap({ templateId, itemIndex, exerciseId });
          }}
        >
          {t.swap}
        </PrimaryButton>
      )}
    </>
  );
  const sheets = (
    <>
      <ExerciseGuidePanel
        id={guide}
        locale={locale}
        open={!!guide}
        onClose={() => setGuide(undefined)}
        triggerRef={guideTrigger}
      />
      <ExerciseSwapSheet scope={scope} target={swap} onClose={() => setSwap(undefined)} triggerRef={swapTrigger} />
    </>
  );
  return {
    buttons,
    sheets,
    openGuide: (id: string, trigger: HTMLElement) => {
      guideTrigger.current = trigger;
      setGuide(id);
    },
    /** Opens 换动作 for one item (the 上周 card's “看替代动作”); same sheet and save path as the item buttons. */
    openSwap: (target: SwapTarget, trigger: HTMLElement | null) => {
      swapTrigger.current = trigger;
      setSwap(target);
    },
  };
}
