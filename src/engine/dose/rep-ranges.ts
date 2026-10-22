import { type Exercise, Rules } from '../data';
import { type EngineProfile, type EnginePrescription } from '../contracts';
import { type SafetyState } from '../gates/strength-scoring';
import { type PlannedItem } from '../../domain/v8/contracts';

export function powerExercise(e: Exercise, r: Rules): boolean {
  return e.modality === 'power' || r.get('dose.power').patterns.includes(e.primary_pattern);
}

export function minimumReps(p: EngineProfile, r: Rules): number {
  const v = r.get('dose.reps.bounds');
  return (
    v.min[p.level] + (p.level === 'beginner' && p.trainingAgeWeeks < v.beginner_min_reps_le_6_unlock_weeks ? 1 : 0)
  );
}

export function straightRestFloor(e: Exercise, p: EngineProfile, r: Rules, block: string): number {
  const v = r.get('duration.fit.bounds').rest_floor_s;
  return Math.max(
    e.flags.includes('heavy_axial_load')
      ? v.heavy_compound
      : v[e.nsca_class === 'isolation' ? 'isolation' : 'compound'],
    p.goal === 'strength' && p.level === 'intermediate' && block === 'main'
      ? r.get('dose.rest.table').intermediate_strength_main.min
      : 0,
  );
}

export function prescribedRepRange(
  e: Exercise,
  p: EngineProfile,
  r: Rules,
  s: SafetyState,
  block: EnginePrescription['block'],
): [number, number] {
  const goal = r.get(`goal.params.${p.goal}`),
    defaultDose = e.default_dose[p.level];
  let range: number[] = goal.reps
    ? [goal.reps.min, goal.reps.max]
    : (goal.accessory?.reps ?? defaultDose?.reps ?? r.get('dose.reps.bounds').default_range);
  if (p.goal === 'strength' && block === 'main') {
    range = goal.main_lift.reps;
    if (
      p.level === 'beginner' &&
      p.trainingAgeWeeks < r.get('goal.strength.beginner_rep_gate').weeks_trained_before_low_reps
    ) {
      const v = r.get('goal.strength.beginner_rep_gate').main_lift_reps_before_gate;
      range = [v.min, v.max];
    }
  }
  if (s.population === 'older_adult') {
    const dose = r.get('older.strength.dose');
    const v =
      p.trainingAgeWeeks < r.get('older.strength.progression').intro_phase_weeks.default
        ? dose.reps_phase_intro
        : dose.reps_phase_strength;
    range = [v.min, v.max];
  }
  if (s.user.hypertension !== 'controlled')
    range = [
      Math.max(range[0], r.get('safety.hypertension.limits').min_reps_per_set),
      Math.max(range[1], r.get('safety.hypertension.limits').min_reps_per_set),
    ];
  if (powerExercise(e, r)) range = r.get('dose.power').reps;
  const limits = r.get('dose.reps.bounds');
  return [Math.max(minimumReps(p, r), range[0]), Math.min(limits.absolute_max, Math.max(minimumReps(p, r), range[1]))];
}

/** Fixed goal cadence; never inferred from a timing deficit or applied to timed modalities. */
export function mobilityTempo(
  e: Exercise,
  p: EngineProfile,
  r: Rules,
  block: EnginePrescription['block'],
  target: PlannedItem['target'],
): Pick<EnginePrescription, 'tempo' | 'secondsPerRep'> | undefined {
  if (
    p.goal !== 'mobility' ||
    !['main', 'accessory'].includes(block) ||
    e.modality !== 'strength' ||
    !('reps' in target)
  )
    return;
  const goal = r.get('goal.params.mobility');
  return {
    tempo: {
      eccentricSeconds: goal.eccentric_s,
      concentricSeconds: goal.concentric_s,
      pauseSeconds: goal.pause_s,
    },
    secondsPerRep: Math.max(
      goal.rep_duration_min_s,
      e.time.s_per_rep ?? r.get('duration.rep.seconds').default_if_unknown,
    ),
  };
}
