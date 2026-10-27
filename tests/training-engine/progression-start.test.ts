import { describe, expect, it } from 'vitest';
import { generatePlan, nextTargets, validatePlan } from '../../src/engine';
import { forStart } from '../../src/application/workflow/workout-session';
import type { EnginePlan, EngineProfile } from '../../src/engine/contracts';
import type { WorkoutRecord } from '../../src/domain/v8/contracts';
import { addDays } from '../../src/domain/local-date';
import { baseProfile } from '../../tools/eval/training-engine-profiles';

type Kind = 'too_hard' | 'pain' | 'partial' | 'done';

/** One session as the app records it: every planned set, half of them, or each set marked too hard or uncomfortable. */
function record(t: EnginePlan['templates'][number], date: string, kind: Kind, n: number): WorkoutRecord {
  const sets: WorkoutRecord['sets'] = [],
    events: NonNullable<WorkoutRecord['setFeedbackEvents']> = [];
  t.items.forEach((item, itemIndex) => {
    for (let setIndex = 0; setIndex < (kind === 'partial' ? Math.floor(item.sets / 2) : item.sets); setIndex++) {
      const target = { ...item.target } as Record<string, unknown>;
      if (kind === 'too_hard' && typeof target.reps === 'number') target.reps = Math.max(1, target.reps - 3);
      delete target.metricType;
      sets.push({ exerciseId: item.exerciseId, itemIndex, setIndex, ...target, completedAt: `${date}T08:20:00Z` });
      if (kind === 'too_hard' || kind === 'pain')
        events.push({
          id: `e${n}-${itemIndex}-${setIndex}`,
          itemIndex,
          setIndex,
          exerciseId: item.exerciseId,
          createdAt: `${date}T08:20:00Z`,
          ...(kind === 'pain'
            ? { effort: 'discomfort', painScore: 4, painArea: 'knee' }
            : { effort: 'too_hard', rir: 0 }),
        });
    }
  });
  return {
    id: `h${n}`,
    planVersionId: 'v1',
    templateId: t.id,
    localDate: date,
    timeZone: 'UTC',
    status: kind === 'partial' ? 'partial' : 'complete',
    startedAt: `${date}T08:00:00Z`,
    endedAt: `${date}T08:40:00Z`,
    plannedSetCount: t.items.reduce((sum, item) => sum + item.sets, 0),
    sets,
    templateSnapshot: t,
    setFeedbackEvents: events,
  };
}

/** What 今天's start checks: today's next targets inside the plan as applied (workout-session nextTargetPreview). */
function startErrors(history: WorkoutRecord[], plan: EnginePlan, p: EngineProfile, templateId: string) {
  const next = nextTargets(history, plan, p, { templateId }).value,
    today = next.templates.find(t => t.id === templateId)!,
    preview = { ...next, templates: plan.templates.map(t => (t.id === templateId ? today : t)) };
  return validatePlan(preview, p, { progression: { baseline: plan, history, templateId } })
    .map(issue => forStart(issue, preview, plan))
    .filter(issue => issue.severity === 'error')
    .map(issue => issue.code);
}

describe('feedback never blocks the next start', () => {
  it('keeps 开始 available after a session marked too hard, uncomfortable or half done', { timeout: 120_000 }, () => {
    const blocked: string[] = [];
    for (const goal of ['health', 'muscle', 'strength', 'fat_loss', 'mobility', 'start_moving', 'yoga'] as const)
      for (const [days, minutes] of [
        [2, 60],
        [3, 20],
        [3, 45],
        [5, 30],
      ]) {
        const p = baseProfile({ goal, daysPerWeek: days, sessionMinutes: minutes, asOfDate: '2026-10-17' }),
          plan = generatePlan(p),
          [a, b = a] = plan.templates;
        for (const kind of ['too_hard', 'pain', 'partial'] as const) {
          const errors = startErrors([record(a, '2026-10-15', kind, 1)], plan, p, b.id);
          if (errors.length) blocked.push(`${goal} ${days}d ${minutes}m ${kind}: ${errors.join(',')}`);
        }
      }
    expect(blocked).toEqual([]);
  });

  it('eight weeks of mixed sessions never block a start', { timeout: 120_000 }, () => {
    const blocked: string[] = [];
    let seed = 7;
    const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (const goal of ['health', 'muscle', 'strength', 'yoga'] as const) {
      const p = baseProfile({ goal, daysPerWeek: 3, sessionMinutes: 30 }),
        plan = generatePlan(p),
        history: WorkoutRecord[] = [];
      for (let n = 0; n < 24; n++) {
        const date = addDays('2026-10-15', Math.floor((n * 7) / 3)),
          t = plan.templates[n % plan.templates.length],
          errors = startErrors(history, plan, { ...p, asOfDate: date }, t.id);
        if (errors.length) blocked.push(`${goal} #${n + 1}: ${errors.join(',')}`);
        const roll = random();
        if (roll >= 0.15)
          history.push(
            record(t, date, roll < 0.35 ? 'partial' : roll > 0.9 ? 'pain' : roll > 0.75 ? 'too_hard' : 'done', n),
          );
      }
    }
    expect(blocked).toEqual([]);
  });
});
