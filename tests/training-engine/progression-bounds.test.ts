import { describe, expect, it } from 'vitest';
import { generatePlan, nextTargets, validatePlan } from '../../src/engine';
import type { EnginePlan, EngineProfile } from '../../src/engine/contracts';
import { Rules } from '../../src/engine/data';
import { baseProfile } from '../../tools/eval/training-engine-profiles';

const r = new Rules();

/** Every set done as prescribed, every other day: next targets keep growing as long as the rules allow. */
function trainFully(p: EngineProfile, sessions: number) {
  let plan: EnginePlan = generatePlan(p);
  const history: unknown[] = [];
  for (let n = 0; n < sessions; n++) {
    const t = plan.templates[n % plan.templates.length],
      day = `2026-10-${String(1 + n * 2).padStart(2, '0')}`;
    history.push({
      id: `h${n}`,
      templateId: t.id,
      localDate: day,
      timeZone: 'UTC',
      status: 'complete',
      startedAt: `${day}T08:00:00Z`,
      endedAt: `${day}T08:40:00Z`,
      plannedSetCount: t.items.reduce((sum, i) => sum + i.sets, 0),
      sets: t.items.flatMap((i, itemIndex) =>
        Array.from({ length: i.sets }, (_, setIndex) => ({
          exerciseId: i.exerciseId,
          itemIndex,
          setIndex,
          ...i.target,
          rpe: 7,
          completedAt: `${day}T08:20:00Z`,
        })),
      ),
    });
    const profile = { ...p, asOfDate: day },
      next = nextTargets(history as never, plan, profile).value;
    expect(
      validatePlan(next, profile, { progression: { baseline: plan, history: history as never } }).filter(
        issue => issue.severity === 'error',
      ),
      `${p.goal} after ${n + 1}`,
    ).toEqual([]);
    plan = next;
  }
  return plan;
}

describe('next targets stay inside the hard rules', () => {
  it('stops a static hold at its level range and never blocks the next session', () => {
    for (const goal of ['health', 'muscle', 'fat_loss', 'yoga'] as const) {
      const p = baseProfile({ goal, daysPerWeek: 3, sessionMinutes: 30 }),
        hold = r.get('dose.isometric')[p.level].hold_s[1];
      for (const item of trainFully(p, 9).templates.flatMap(t => t.items))
        if (r.byExercise.get(item.exerciseId)?.modality === 'isometric' && 'durationSeconds' in item.target)
          expect(item.target.durationSeconds).toBeLessThanOrEqual(hold);
    }
  });
});
