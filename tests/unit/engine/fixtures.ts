import type { EngineProfile, Plan, SessionDraft } from '../../../src/engine/contracts';
import { Rules } from '../../../src/engine/data';
import { baseProfile } from '../../../tools/eval/training-engine-profiles';
const rules = new Rules();
export const fixtureProfile = baseProfile({
  constraints: { noJump: false, quiet: false, space: 'large' },
});
export const typicalProfiles: EngineProfile[] = [
  baseProfile(),
  baseProfile({ sessionMinutes: 10, daysPerWeek: 1 }),
  baseProfile({ sessionMinutes: 20, daysPerWeek: 2 }),
  baseProfile({
    goal: 'muscle',
    equipment: ['none', 'dumbbell', 'flat-bench'],
    daysPerWeek: 4,
    sessionMinutes: 45,
  }),
  baseProfile({
    constraints: { noJump: true, quiet: true, space: 'mat' },
    cautions: ['knee'],
  }),
  baseProfile({ goal: 'mobility' }),
  baseProfile({
    population: {
      kind: 'pregnant',
      week: 20,
      providerCleared: true,
      prenatalCareConfirmed: true,
      contraindicationsConfirmedNone: true,
      lastScreenedWeek: 20,
    },
  }),
  baseProfile({
    population: {
      kind: 'postpartum',
      weeksSinceBirth: 6,
      delivery: 'cesarean',
      cleared: false,
    },
    constraints: { noJump: false, quiet: false, space: 'large' },
  }),
  baseProfile({
    birthYearMonth: '1956-06',
    population: {
      kind: 'older_adult',
      fallsAnswers: [false, false, false, false],
    },
    daysPerWeek: 3,
  }),
  baseProfile({ screening: { ...baseProfile().screening, symptoms: true } }),
];
/** Hand-built fixtures deliberately do not call the planner. */
export function sessionFixture(): SessionDraft {
  const exercise = rules.data.exercises.find(e => e.slug === 'walking')!;
  return {
    id: 'fixture-session',
    name: 'Training',
    estimatedMinutes: 30,
    estimatedSeconds: 1800,
    slots: [
      {
        id: 'fixture-slot',
        role: 'conditioning',
        patterns: ['cardio_cyclic'],
        priority: 0,
        optional: false,
        sourceRuleId: 'session.conditioning.slot',
      },
    ],
    items: [
      {
        exerciseId: exercise.id,
        equipment: 'none',
        sets: 1,
        target: { metricType: 'duration', durationSeconds: 1800 },
        prescription: {
          pattern: exercise.primary_pattern,
          block: 'conditioning',
          rir: [4, 4],
          restSeconds: 0,
          targetRpe: [3, 3],
          structure: 'straight',
        },
      },
    ],
  };
}
export function planFixture(): Plan {
  const { slots: _, ...session } = sessionFixture();
  return {
    weeklyTarget: 1,
    sessionMinutes: 30,
    templates: [session],
    gates: [],
    notices: [],
    trace: [],
    meta: {
      engineVersion: '2.0.0-p0',
      rulesVersion: rules.data.rulesVersion,
      seed: 'hand-built',
    },
  };
}
