import { expect, it } from 'vitest';
import { Rules } from '../../src/engine/data';
import type { EngineProfile } from '../../src/engine/contracts';
import { baseProfile } from '../../tools/eval/training-engine-profiles';
import { runGates } from '../../src/engine/gates';
import { generatePlan, getEligibleExercises, validatePlan } from '../../src/engine';
import { verifyObservedGoalShares } from './v2-quality-observation';

const r = new Rules();
function actualPool(p: EngineProfile) {
  const gate = runGates(p, r);
  return gate.status === 'blocked' || p.screening.clearance
    ? undefined
    : getEligibleExercises(p).map(row => r.byExercise.get(row.exerciseId)!);
}
// Explicit screening fixtures are independent of evaluation sampling order.
const activeGeneral = baseProfile({
  goal: 'start_moving',
  level: 'intermediate',
  trainingAgeWeeks: 99,
  daysPerWeek: 1,
  sessionMinutes: 30,
  constraints: { noJump: false, quiet: true, space: 'medium' },
  cautions: ['knee', 'back'],
  screening: {
    ...baseProfile().screening,
    knownCondition: true,
    knownCmrDisease: true,
  },
});
const { redFlagReview: previousAreas, ...pregnantScreen } = activeGeneral.screening;
void previousAreas;
const activePregnant = baseProfile({
  ...structuredClone(activeGeneral),
  screening: pregnantScreen,
  trainingAgeWeeks: 5,
  sessionMinutes: 45,
  equipment: ['none', 'dumbbell'],
  constraints: { noJump: false, quiet: true, space: 'small' },
  cautions: ['wrist'],
  population: {
    kind: 'pregnant',
    week: 28,
    providerCleared: true,
    prenatalCareConfirmed: true,
    contraindicationsConfirmedNone: true,
    lastScreenedWeek: 28,
  },
  preferences: { excludedExerciseIds: [], cannotDo: ['jumping'] },
});
const cases = [
  { label: 'general active CMR', profile: activeGeneral },
  { label: 'pregnant active CMR', profile: activePregnant },
];
it.each(cases)(
  'keeps actual active/asymptomatic CMR eligible within source caps while observing its V2 target: $label',
  ({ profile }) => {
    const p = structuredClone(profile),
      before = JSON.stringify(p),
      matrix = r
        .get('safety.clearance.matrix')
        .steps.find(
          (step: any) =>
            step.when?.known_cmr_disease === true &&
            step.when.activity_status === 'active' &&
            step.when.symptomatic === false,
        );
    expect(p.screening).toMatchObject({
      activityStatus: 'active',
      knownCmrDisease: true,
      symptoms: false,
      parqAnswers: Array(7).fill(false),
    });
    expect(matrix.set).toMatchObject({
      plan_lock: false,
      max_rpe_0_10: 6,
      hiit: 'locked',
    });
    const pool = actualPool(p);
    expect(pool).toBeDefined();
    expect(pool!.length).toBeGreaterThan(0);
    const excluded = r.get('safety.clearance.restricted_mode');
    expect(
      pool!.some(
        e =>
          excluded.exclude_modality.includes(e.modality) || e.flags.some(flag => excluded.exclude_flags.includes(flag)),
      ),
    ).toBe(false);
    const plan = generatePlan(p);
    expect(validatePlan(plan, p)).toEqual([]);
    verifyObservedGoalShares(plan, p, r);
    expect(plan.templates.length).toBeGreaterThan(0);
    expect(runGates(p, r).restrictions.maxIntensity).toBeLessThanOrEqual(matrix.set.max_rpe_0_10);
    expect(runGates(p, r).restrictions.user.hiit_unlocked).toBe(false);
    expect(JSON.stringify(p)).toBe(before);
  },
);
it.each([
  'inactive',
  'symptoms',
  'expired',
  'future',
  'rescreen',
  'incomplete',
  'unknown',
  'positive',
  'illness',
  'clearance',
  'cmr_missing',
  'cmr_positive',
] as const)('refuses unsupported or invalid CMR screening: %s', mode => {
  const p = structuredClone(activeGeneral);
  if (mode === 'cmr_missing') delete p.screening.cmrSymptoms;
  if (mode === 'cmr_positive') p.screening.cmrSymptoms![r.get('safety.screen.cmr_symptoms').symptoms[0]] = true;
  if (mode === 'inactive') p.screening.activityStatus = 'inactive';
  if (mode === 'symptoms') p.screening.symptoms = true;
  if (mode === 'expired') p.screening.completedAt = '2025-10-15T00:00:00Z';
  if (mode === 'future') p.screening.completedAt = '2026-10-16T00:00:00Z';
  if (mode === 'rescreen') p.screening.rescreenRequired = true;
  if (mode === 'incomplete') p.screening.parqAnswers!.pop();
  if (mode === 'unknown') p.screening.parqAnswers![0] = undefined as unknown as boolean;
  if (mode === 'positive') p.screening.parqAnswers![1] = true;
  if (mode === 'illness') p.screening.acuteIllness = true;
  if (mode === 'clearance') p.screening.clearance = { date: '2026-10-01', intensity: 'moderate' };
  expect(actualPool(p)).toBeUndefined();
});
it.each(['provider', 'absolute', 'relative', 'unknown_absence', 'reconfirm'] as const)(
  'keeps pregnancy gates independent of the active CMR branch: %s',
  mode => {
    const p = structuredClone(activePregnant);
    if (p.population.kind !== 'pregnant') throw Error('fixture must be pregnant');
    if (mode === 'provider') p.population.providerCleared = false;
    if (mode === 'absolute') p.population.absoluteContraindications = ['placenta_praevia_after_26_weeks'];
    if (mode === 'relative') p.population.relativeContraindications = ['gestational_hypertension'];
    if (mode === 'unknown_absence') p.population.contraindicationsConfirmedNone = false;
    if (mode === 'reconfirm') p.population.lastScreenedWeek = 25;
    expect(actualPool(p)).toBeUndefined();
  },
);
it('respects the explicit knownCmrDisease alias before the legacy knownCondition field', () => {
  const p = structuredClone(activeGeneral);
  p.screening.knownCmrDisease = false;
  p.screening.knownCondition = true;
  p.screening.activityStatus = 'inactive';
  expect(actualPool(p)).toBeDefined();
  const legacy = structuredClone(activeGeneral);
  delete legacy.screening.knownCmrDisease;
  legacy.screening.knownCondition = true;
  expect(actualPool(legacy)).toBeDefined();
  legacy.screening.activityStatus = 'inactive';
  expect(actualPool(legacy)).toBeUndefined();
});
it('evaluates screening expiry on the caller local day including the exact anniversary boundary', () => {
  const p: EngineProfile = structuredClone(activeGeneral);
  p.timeZone = 'Asia/Shanghai';
  p.screening.completedAt = '2025-10-14T16:00:00Z';
  expect(actualPool(p)).toBeUndefined();
  p.screening.completedAt = '2025-10-15T16:00:00Z';
  expect(actualPool(p)).toBeDefined();
});
