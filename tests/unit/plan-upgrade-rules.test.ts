import { describe, expect, it } from 'vitest';
import { MUSCLE_GROUPS, type BodyChangeInput, type Camp, type MuscleLoad } from '../../src/domain/plan-upgrade';
import { DATA } from '../../src/engine/data';
import {
  MUSCLE_LOAD_THRESHOLDS,
  bodyAge,
  bodyChangeEvents,
  buildNowSession,
  campProgress,
  estimateE1rm,
  exerciseMuscleGroups,
  isoWeekday,
  itemEquivalentAge,
  muscleLoadLevel,
  personalRecords,
  personalRecordsAsOf,
  sessionMuscleFocus,
  skipPattern,
  weeklyMuscleLoad,
} from '../../src/application/rules/plan-upgrade';
import { FITNESS_NORMS_2023 } from '../../src/application/rules/fitness-norms-2023';

const bySlug = (slug: string) => DATA.exercises.find(exercise => exercise.slug === slug)!;
const pushUp = bySlug('push-up');
const engine = new Map(DATA.exercises.map(exercise => [exercise.id, exercise]));

describe('weekly muscle load', () => {
  it('counts primary as 1 and secondary as 0.5, once per exercise', () => {
    // push-up: primary chest + triceps, secondary anterior deltoid.
    const loads = weeklyMuscleLoad([{ exerciseId: pushUp.id, completedSets: 4 }]);
    const get = (group: string) => loads.find(load => load.group === group)!;
    expect(loads.map(load => load.group)).toEqual([...MUSCLE_GROUPS]);
    expect(get('chest').sets).toBe(4);
    expect(get('triceps').sets).toBe(4);
    expect(get('delts').sets).toBe(2);
    expect(get('quads')).toEqual({ group: 'quads', sets: 0, level: 'none' });
  });
  it('counts a group at its strongest role only', () => {
    // Banded clamshell: gluteus medius primary, gluteus maximus secondary; both are "glutes".
    const glutes = weeklyMuscleLoad([{ exerciseId: bySlug('banded-clamshell').id, completedSets: 2 }]).find(
      load => load.group === 'glutes',
    )!;
    expect(glutes.sets).toBe(2);
    expect(exerciseMuscleGroups(bySlug('banded-clamshell').id)).toEqual({ primary: ['glutes'], secondary: [] });
  });
  it('ignores unknown exercises and non-positive sets', () => {
    expect(
      weeklyMuscleLoad([
        { exerciseId: 'nope', completedSets: 3 },
        { exerciseId: pushUp.id, completedSets: 0 },
        { exerciseId: pushUp.id, completedSets: -2 },
      ]).every(load => load.sets === 0),
    ).toBe(true);
  });
  it('levels at the documented thresholds', () => {
    expect(MUSCLE_LOAD_THRESHOLDS).toEqual({ okMin: 10, okMax: 20 });
    expect([0, 0.5, 9.5, 10, 20, 20.5].map(muscleLoadLevel)).toEqual(['none', 'low', 'low', 'ok', 'ok', 'high']);
  });
});

describe('session muscle focus', () => {
  it('splits primary and secondary across exercises', () => {
    const squat =
      bySlug('bodyweight-squat') ?? DATA.exercises.find(e => (e.primaryMuscles ?? []).includes('quadriceps'))!;
    const focus = sessionMuscleFocus([pushUp.id, squat.id]);
    expect(focus.primary).toEqual(expect.arrayContaining(['chest', 'triceps', 'quads']));
    expect(focus.secondary).not.toContain('chest');
    expect(focus.byExercise[pushUp.id]).toEqual(['chest', 'triceps', 'delts']);
    for (const group of focus.secondary) expect(focus.primary).not.toContain(group);
  });
  it('drops a secondary group that another exercise trains as primary', () => {
    const press = DATA.exercises.find(e => (e.primaryMuscles ?? []).includes('anterior-deltoid'))!;
    const focus = sessionMuscleFocus([pushUp.id, press.id]);
    expect(focus.primary).toContain('delts');
    expect(focus.secondary).not.toContain('delts');
  });
  it('is empty for no exercises', () => {
    expect(sessionMuscleFocus([])).toEqual({ primary: [], secondary: [], byExercise: {} });
  });
});

describe('e1RM and personal records', () => {
  it('uses Epley for 1–12 reps only', () => {
    expect(estimateE1rm(100, 1)).toBe(100);
    expect(estimateE1rm(100, 10)).toBe(133.3);
    expect(estimateE1rm(60, 12)).toBe(84);
    expect(estimateE1rm(60, 13)).toBeUndefined();
    expect(estimateE1rm(60, 0)).toBeUndefined();
    expect(estimateE1rm(60, 2.5)).toBeUndefined();
    expect(estimateE1rm(0, 5)).toBeUndefined();
    expect(estimateE1rm(Number.NaN, 5)).toBeUndefined();
  });
  it('keeps the best e1RM per exercise with the first date reached', () => {
    const records = personalRecords([
      { exerciseId: 'b', localDate: '2026-09-01', weightKg: 50, reps: 5 },
      { exerciseId: 'a', localDate: '2026-09-02', weightKg: 100, reps: 1 },
      { exerciseId: 'a', localDate: '2026-09-09', weightKg: 100, reps: 1 },
      { exerciseId: 'a', localDate: '2026-09-05', weightKg: 90, reps: 3 },
      { exerciseId: 'a', localDate: '2026-09-20', weightKg: 200, reps: 20 },
    ]);
    expect(records).toEqual([
      { exerciseId: 'a', e1rmKg: 100, localDate: '2026-09-02' },
      { exerciseId: 'b', e1rmKg: 58.3, localDate: '2026-09-01' },
    ]);
    expect(
      personalRecordsAsOf([{ exerciseId: 'a', localDate: '2026-10-01', weightKg: 80, reps: 1 }], '2026-09-30'),
    ).toEqual([]);
  });
});

describe('now session', () => {
  const lowLegs: MuscleLoad[] = MUSCLE_GROUPS.map(group => ({
    group,
    sets: ['quads', 'glutes'].includes(group) ? 0 : 12,
    level: 'ok',
  }));
  const base = { weekLoads: lowLegs, usedMinutesThisWeek: 0 };

  it.each([5, 15, 30, 45] as const)('fits %i minutes and is deterministic', minutes => {
    const session = buildNowSession({ minutes }, base)!;
    expect(session.exerciseIds.length).toBeGreaterThan(0);
    expect(session.minutes).toBeLessThanOrEqual(minutes);
    expect(buildNowSession({ minutes }, base)).toEqual(session);
    expect(new Set(session.exerciseIds).size).toBe(session.exerciseIds.length);
    expect(session.focus).toEqual(sessionMuscleFocus(session.exerciseIds));
  });
  it('starts with the group that has the biggest weekly gap', () => {
    const session = buildNowSession({ minutes: 15 }, base)!;
    expect(
      exerciseMuscleGroups(session.exerciseIds[0]!).primary.some(group => group === 'quads' || group === 'glutes'),
    ).toBe(true);
  });
  it('offers more work for more time', () => {
    expect(buildNowSession({ minutes: 45 }, base)!.exerciseIds.length).toBeGreaterThanOrEqual(
      buildNowSession({ minutes: 5 }, base)!.exerciseIds.length,
    );
  });
  it('keeps every pick safe: no impact, no risky flags, bodyweight without plan candidates', () => {
    for (const variant of ['standard', 'tired', 'no-equipment'] as const)
      for (const minutes of [5, 15, 30, 45] as const) {
        for (const id of buildNowSession({ minutes, variant }, base)?.exerciseIds ?? []) {
          const exercise = engine.get(id)!;
          expect(exercise.impact).toBe(0);
          expect(exercise.flags).not.toContain('jumping');
          expect(exercise.flags).not.toContain('high_fall_risk');
          expect(exercise.equipment_required.every(item => item === 'none')).toBe(true);
        }
      }
  });
  it('keeps the tired variant light', () => {
    const session = buildNowSession({ minutes: 30, variant: 'tired' }, base)!;
    for (const id of session.exerciseIds) expect(engine.get(id)!.difficulty).toBeLessThanOrEqual(2);
  });
  it('keeps scenes quiet, short and upright for commute and office', () => {
    for (const scene of ['commute', 'office', 'bedtime'] as const) {
      const session = buildNowSession({ minutes: 45, scene }, base)!;
      expect(session.minutes).toBeGreaterThanOrEqual(1);
      expect(session.minutes).toBeLessThanOrEqual(5);
      for (const id of session.exerciseIds) {
        const exercise = engine.get(id)!;
        expect(exercise.noise).toBe(0);
        expect(exercise.difficulty).toBeLessThanOrEqual(2);
        if (scene === 'commute') expect(exercise.modality).not.toBe('mobility');
        if (scene !== 'bedtime')
          expect(exercise.position.every(position => position === 'standing' || position === 'seated')).toBe(true);
      }
    }
  });
  it('stays inside the plan candidates when given', () => {
    expect(buildNowSession({ minutes: 15 }, { ...base, candidateIds: [pushUp.id] })!.exerciseIds).toEqual([pushUp.id]);
    expect(buildNowSession({ minutes: 15 }, { ...base, candidateIds: [] })).toBeUndefined();
  });
  it('skips exercises that load a cautioned joint', () => {
    expect(
      buildNowSession({ minutes: 15 }, { ...base, candidateIds: [pushUp.id], avoidJoints: ['wrist'] }),
    ).toBeUndefined();
  });
});

describe('body age (国民体质测定标准 2023)', () => {
  it('stores bands for every home item with low ≤ high', () => {
    for (const sex of ['male', 'female'] as const)
      for (const [item, bands] of Object.entries(FITNESS_NORMS_2023[sex])) {
        expect(bands!.length, `${sex} ${item}`).toBeGreaterThanOrEqual(4);
        for (const band of bands!) expect(band.mid[0]).toBeLessThanOrEqual(band.mid[1]);
      }
    expect(FITNESS_NORMS_2023.male.pushup![0]).toEqual({ fromAge: 20, mid: [15, 22] });
    expect(FITNESS_NORMS_2023.female.chairStand30s![3]).toEqual({ fromAge: 75, mid: [7, 9] });
  });
  it('maps a result to the group whose 60–70 band holds it', () => {
    expect(itemEquivalentAge('male', 40, 'pushup', 50)).toBe(22);
    expect(itemEquivalentAge('male', 40, 'pushup', 0)).toBe(57);
    expect(itemEquivalentAge('male', 40, 'situp60s', 26.5)).toBe(22);
    expect(itemEquivalentAge('male', 78, 'chairStand30s', 3)).toBe(77);
    // 70–74 and 75–79 share one band: the tie goes to the user's own group.
    expect(itemEquivalentAge('male', 70, 'chairStand30s', 3)).toBe(72);
  });
  it('takes the median of at least two items and clamps to 20–79', () => {
    expect(bodyAge('male', 40, { pushup: 50 })).toBeUndefined();
    expect(bodyAge('male', 40, {})).toBeUndefined();
    const result = bodyAge('male', 40, { pushup: 50, situp60s: 26.5, singleLegStandEyesClosedS: 2 })!;
    expect(result).toEqual({ years: 22, items: 3, estimated: true });
    const old = bodyAge('female', 78, { chairStand30s: 1, singleLegStandEyesClosedS: 0 })!;
    expect(old.years).toBe(77);
    expect(old.years).toBeLessThanOrEqual(79);
    expect(bodyAge('female', 30, { pushup: 100, situp60s: 100 })!.years).toBeGreaterThanOrEqual(20);
  });
  it('ignores impossible results', () => {
    expect(bodyAge('male', 40, { pushup: -1, situp60s: Number.NaN })).toBeUndefined();
  });
});

describe('body change events (wording v5 §19)', () => {
  const today = '2026-10-21';
  const series = (start: number, weeklyDrop: number) =>
    Array.from({ length: 21 }, (_, i) => ({
      localDate: new Date(Date.parse(`${today}T00:00:00Z`) - (20 - i) * 86_400_000).toISOString().slice(0, 10),
      weightKg: start - Math.floor(i / 7) * weeklyDrop,
    }));
  const input = (patch: Partial<BodyChangeInput>): BodyChangeInput => ({
    route: 'shape',
    heightCm: 170,
    weights: [],
    records: [],
    tests: [],
    lastSpokenByKind: {},
    today,
    ...patch,
  });

  it('says lighter on the shape route after two weeks of slow, healthy loss', () => {
    const events = bodyChangeEvents(input({ weights: series(70, 0.5) }));
    expect(events).toEqual([{ kind: 'lighter', metric: 'weightKg', delta: -1, sinceLocalDate: '2026-10-01' }]);
  });
  it('never says lighter on health or postpartum routes', () => {
    expect(bodyChangeEvents(input({ route: 'postpartum', weights: series(70, 0.5) }))).toEqual([]);
    expect(bodyChangeEvents(input({ route: 'health', weights: series(70, 0.5) }))).toEqual([]);
    expect(bodyChangeEvents(input({ route: undefined, weights: series(70, 0.5) }))).toEqual([]);
  });
  it('needs two consecutive weeks down', () => {
    const flatThenDown = series(70, 0).map((w, i) => (i >= 14 ? { ...w, weightKg: 69.5 } : w));
    expect(bodyChangeEvents(input({ weights: flatThenDown }))).toEqual([]);
  });
  it("allows up to 1 % of last week's weight and turns to care above it", () => {
    expect(bodyChangeEvents(input({ weights: series(100, 0.99) }))[0]!.kind).toBe('lighter');
    expect(bodyChangeEvents(input({ weights: series(100, 1) }))[0]!.kind).toBe('care-fast-loss');
    const fast = bodyChangeEvents(input({ weights: series(100, 1.5) }));
    expect(fast).toEqual([{ kind: 'care-fast-loss', metric: 'weightKg', delta: -1.5, sinceLocalDate: '2026-10-08' }]);
    expect(bodyChangeEvents(input({ route: 'postpartum', weights: series(100, 1.5) }))[0]!.kind).toBe('care-fast-loss');
  });
  it('turns to care below BMI 18.5 and never says lighter there', () => {
    // 170 cm: BMI 18.5 ≈ 53.5 kg.
    const events = bodyChangeEvents(input({ weights: series(53.5, 0.3) }));
    expect(events.map(e => e.kind)).toEqual(['care-low-bmi']);
    expect(bodyChangeEvents(input({ heightCm: undefined, weights: series(70, 0.5) }))).toEqual([]);
  });
  it('says nothing when weight goes up', () => {
    expect(bodyChangeEvents(input({ weights: series(60, -0.5) }))).toEqual([]);
  });
  it('says stronger when e1RM beats the record from 4 weeks ago', () => {
    const records = [
      { exerciseId: 'squat', e1rmKg: 80, localDate: '2026-09-10' },
      { exerciseId: 'squat', e1rmKg: 87.5, localDate: '2026-10-15' },
    ];
    expect(bodyChangeEvents(input({ records }))).toEqual([
      { kind: 'stronger', metric: 'squat', delta: 7.5, sinceLocalDate: '2026-09-10' },
    ]);
    expect(bodyChangeEvents(input({ records: [records[1]!] }))).toEqual([]);
    expect(bodyChangeEvents(input({ records: [{ ...records[0]!, localDate: '2026-09-24' }, records[1]!] }))).toEqual(
      [],
    );
  });
  it('says stronger when a test improves against one from 4 weeks ago', () => {
    const tests = [
      { id: '1', localDate: '2026-09-20', results: { pushup: 8 }, createdAt: '' },
      { id: '2', localDate: '2026-10-20', results: { pushup: 15 }, createdAt: '' },
    ];
    expect(bodyChangeEvents(input({ tests }))).toEqual([
      { kind: 'stronger', metric: 'pushup', delta: 7, sinceLocalDate: '2026-09-20' },
    ]);
    expect(bodyChangeEvents(input({ tests: [tests[0]!, { ...tests[1]!, results: { pushup: 8 } }] }))).toEqual([]);
  });
  it('speaks each kind at most once in 7 days', () => {
    const weights = series(70, 0.5);
    expect(bodyChangeEvents(input({ weights, lastSpokenByKind: { lighter: '2026-10-15' } }))).toEqual([]);
    expect(bodyChangeEvents(input({ weights, lastSpokenByKind: { lighter: '2026-10-14' } }))).toHaveLength(1);
    expect(bodyChangeEvents(input({ weights, lastSpokenByKind: { stronger: '2026-10-20' } }))).toHaveLength(1);
  });
});

describe('camp progress and skip pattern', () => {
  const camp = (patch: Partial<Camp>): Camp => ({
    id: 'c',
    title: 't',
    metric: 'pushup',
    start: 8,
    target: 16,
    ...patch,
  });
  it('measures progress in both directions and clamps', () => {
    expect(campProgress(camp({}), 12)).toBe(0.5);
    expect(campProgress(camp({}), 30)).toBe(1);
    expect(campProgress(camp({}), 2)).toBe(0);
    expect(campProgress(camp({ metric: 'weightKg', start: 70, target: 66 }), 68)).toBe(0.5);
    expect(campProgress(camp({ metric: 'weightKg', start: 70, target: 66 }), 72)).toBe(0);
    expect(campProgress(camp({ metric: 'waistCm', start: 80, target: 80 }), 79)).toBe(1);
    expect(campProgress(camp({ metric: 'waistCm', start: 80, target: 80 }), 81)).toBe(0);
    expect(campProgress(camp({}), Number.NaN)).toBe(0);
  });
  it('finds a weekday skipped in 3 of its last 4 planned occurrences', () => {
    // Wednesdays 2026-09-23 … 2026-10-14.
    const wednesdays = ['2026-09-23', '2026-09-30', '2026-10-07', '2026-10-14'];
    expect(isoWeekday('2026-10-14')).toBe(3);
    expect(skipPattern(['2026-09-30'], wednesdays)).toEqual({ weekday: 3 });
    expect(skipPattern(['2026-09-30', '2026-10-07'], wednesdays)).toBeUndefined();
    // An old trained Wednesday outside the last four does not help.
    expect(skipPattern(['2026-09-16'], ['2026-09-16', ...wednesdays])).toEqual({ weekday: 3 });
    expect(skipPattern([], wednesdays.slice(0, 2))).toBeUndefined();
  });
});
