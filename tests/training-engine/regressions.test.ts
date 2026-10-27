import { describe, expect, it } from 'vitest';
import {
  adjustToday,
  generatePlan,
  getEligibleExercises,
  modifyPlan,
  nextTargets,
  substitute,
  validatePlan,
} from '../../src/engine';
import type { PlannedItem, WorkoutRecord } from '../../src/domain/v8/contracts';
import type { EngineProfile, Pattern } from '../../src/engine/contracts';
import index from '../../src/engine/generated/exercise-index.json';
import { baseProfile, equipmentScenarios, sampledProfiles } from '../../tools/eval/training-engine-profiles';

const facts = new Map(index.exercises.map(row => [row.id, row]));
const profile = () =>
  baseProfile({
    equipment: [...equipmentScenarios[4]],
    place: 'gym',
    level: 'intermediate',
    trainingAgeWeeks: 52,
    sessionMinutes: 45,
  });
describe('training engine required regressions', () => {
  it('allows a standing wall plank but excludes actual seated-floor drills for no-floor users', () => {
    const p = baseProfile({
        equipment: ['none', 'wall'],
        preferences: { excludedExerciseIds: [], cannotDo: ['floor_work'] },
      }),
      eligible = new Set(getEligibleExercises(p).map(row => row.exerciseId));
    const wall = index.exercises.find(row => row.slug === 'custom-wall-plank')!;
    expect(eligible.has(wall.id)).toBe(true);
    for (const slug of ['custom-seated-self-overhead-press', 'custom-seated-self-resisted-leg-curl', 'bear-crawl'])
      expect(eligible.has(index.exercises.find(row => row.slug === slug)!.id), slug).toBe(false);
  });
  it('removes lower-body strength for upper-only 30 minutes and reaches 27–33 minutes', () => {
    const p = profile(),
      original = generatePlan(p).templates[0];
    expect(original).toBeDefined();
    const result = adjustToday(original, p, { minutes: 30, focus: 'upper' });
    expect(result.noop).toBe(false);
    expect(result.value.estimatedMinutes).toBeGreaterThanOrEqual(27);
    expect(result.value.estimatedMinutes).toBeLessThanOrEqual(33);
    for (const item of result.value.items)
      expect(['squat', 'lunge', 'hinge', 'isolation_lower']).not.toContain(facts.get(item.exerciseId)?.primary_pattern);
    expect(result.summary.zh).not.toMatch(/[A-Za-z]/);
    expect(result.diff.length).toBeGreaterThan(0);
  });
  it('preserves locked completed items exactly', () => {
    const p = profile(),
      original = generatePlan(p).templates[0],
      locked = original.items.findIndex(item => facts.get(item.exerciseId)?.primary_pattern === 'push_horizontal');
    expect(locked).toBeGreaterThanOrEqual(0);
    const before = structuredClone(original.items[locked]);
    const result = adjustToday(original, p, { minutes: 30, focus: 'upper', lockedItemIndexes: [locked] });
    expect(result.value.items.find(item => item.exerciseId === before.exerciseId)).toEqual(before);
    expect(original.items[locked]).toEqual(before);
  });
  it('replaces a walking carry without squats or another walking movement', () => {
    const e =
      index.exercises.find(row => row.slug === 'farmer-walk') ??
      index.exercises.find(row => row.primary_pattern === 'carry');
    expect(e).toBeDefined();
    const item: PlannedItem = {
      exerciseId: e!.id,
      equipment: e!.equipment_required[0],
      sets: 2,
      target: { metricType: 'duration', durationSeconds: 30 },
    };
    const p = baseProfile({
      equipment: [...equipmentScenarios[4]],
      preferences: { excludedExerciseIds: [], cannotDo: ['walking_carry'] },
    });
    const result = substitute(item, p, 'dislike');
    expect(result.noop).toBe(false);
    const replacement = facts.get(result.value.exerciseId)!;
    expect(replacement.id).not.toBe(item.exerciseId);
    expect(['squat', 'lunge', 'carry']).not.toContain(replacement.primary_pattern);
    expect(replacement.flags).not.toContain('running');
    expect(replacement.space).not.toBe('large');
  });
  it('does not bounce to the just-replaced exercise on adjacent substitution', () => {
    const p = profile(),
      plan = generatePlan(p),
      item = plan.templates
        .flatMap(template => template.items)
        .find(item => facts.get(item.exerciseId)?.primary_pattern === 'push_horizontal')!;
    expect(item).toBeDefined();
    const first = substitute(item, p, 'dislike');
    expect(first.noop).toBe(false);
    const next = substitute(first.value, p, 'dislike');
    expect(next.value.exerciseId).not.toBe(item.exerciseId);
  });
  it('keeps a reported painful pattern out of the next generated plan', () => {
    const excluded: Pattern = 'push_horizontal';
    const p = profile();
    p.painState = [{ pattern: excluded, remainingSessions: 2, score: 6, repeatEvents: 1 }];
    const plan = generatePlan(p);
    expect(plan.templates.length).toBeGreaterThan(0);
    for (const item of plan.templates.flatMap(template => template.items))
      expect(facts.get(item.exerciseId)?.primary_pattern).not.toBe(excluded);
  });
  it('advances reps after two explicit too-light sessions without changing recorded history', () => {
    const p = profile(),
      plan = generatePlan(p),
      template = plan.templates[0],
      itemIndex = template.items.findIndex(item => 'reps' in item.target),
      item = template.items[itemIndex];
    expect(item).toBeDefined();
    const record = (day: string): WorkoutRecord => ({
      id: `record-${day}`,
      templateId: template.id,
      startedAt: `${day}T08:00:00.000Z`,
      endedAt: `${day}T08:30:00.000Z`,
      localDate: day,
      timeZone: 'Asia/Shanghai',
      status: 'complete',
      plannedSetCount: item.sets,
      sets: Array.from({ length: item.sets }, (_, setIndex) => ({
        exerciseId: item.exerciseId,
        itemIndex,
        setIndex,
        reps: 'reps' in item.target ? item.target.reps : 10,
        completedAt: `${day}T08:20:00.000Z`,
        ...('loadGrams' in item.target ? { loadGrams: item.target.loadGrams } : {}),
      })),
      setFeedbackEvents: [
        {
          id: `feedback-${day}`,
          exerciseId: item.exerciseId,
          itemIndex,
          setIndex: item.sets - 1,
          effort: 'too_light',
          rir: 5,
          createdAt: `${day}T08:20:00.000Z`,
        },
      ],
    });
    const history = [record('2026-10-12'), record('2026-10-14')],
      before = JSON.stringify(history),
      result = nextTargets(history, plan, p);
    expect(result.noop).toBe(false);
    expect(result.suggestions.some(suggestion => suggestion.before.exerciseId === item.exerciseId)).toBe(true);
    expect(JSON.stringify(history)).toBe(before);
    expect(nextTargets(history, plan, p)).toEqual(result);
  });
  it('rejects unsafe manual volume rather than silently treating it as a quality pass', () => {
    const p = profile(),
      plan = generatePlan(p),
      broken = structuredClone(plan);
    broken.templates[0].items[0].sets = 100;
    expect(validatePlan(broken, p).some(issue => issue.severity === 'error')).toBe(true);
  });

  it('shortens a long session for little time today instead of giving the whole session back', () => {
    for (const goal of ['health', 'muscle'] as const) {
      const p = baseProfile({ goal, daysPerWeek: 3, sessionMinutes: 45 }),
        plan = generatePlan(p),
        template = plan.templates[0],
        result = adjustToday(template, p, { minutes: 15 });
      expect(result.noop, goal).toBe(false);
      expect(result.value.estimatedMinutes).toBeLessThan(template.estimatedMinutes - 10);
    }
  });

  it('judges a plan moved to more days per week by the new number of days', () => {
    // An older adult who trains once a week, from the pinned sample (frailty ramps depend on the days per week).
    const p = { ...sampledProfiles(40)[13], asOfDate: '2026-10-15' },
      result = modifyPlan(generatePlan(p), p, [{ op: 'frequency', daysPerWeek: 5 }]);
    expect(result.value.quality?.status).not.toBe('unavailable');
  });
});
