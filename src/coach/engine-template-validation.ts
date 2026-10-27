import type { CoachRequest } from './contracts';
import type { PlannedItem } from '../domain/v8/contracts';
import { Rules } from '../engine/data';
import { runGates } from '../engine/gates';
import { exclusions } from '../engine/checkHard/eligibility';
import { powerLoadIssue } from '../engine/power';
import { engineExercises } from '../engine/yoga-session';

const rules = new Rules();

/** Validate local engine output against current hard eligibility, not the model's short vocabulary. */
export function engineTemplateIds(request: CoachRequest): Set<string> {
  const profile = request.engineProfile;
  if (!profile) return new Set();
  const gates = runGates(profile, rules);
  if (gates.status === 'blocked') return new Set();
  return new Set(
    engineExercises(rules, profile.goal)
      .filter(exercise => exclusions(exercise, profile, gates, rules).length === 0)
      .map(exercise => exercise.id),
  );
}

/** Recheck the authored metric branches; a description alone is never permission to drop a known load. */
export function engineMetricMatches(request: CoachRequest, item: PlannedItem): boolean {
  const exercise = rules.byExercise.get(item.exerciseId),
    profile = request.engineProfile;
  if (!exercise || !profile || item.prescription?.pattern !== exercise.primary_pattern) return false;
  const power = rules.get('dose.power');
  if (exercise.modality === 'power' || power.patterns.includes(exercise.primary_pattern))
    return powerLoadIssue(exercise, item, profile, rules) === undefined;
  if (exercise.modality === 'cardio' || exercise.modality === 'isometric')
    return item.target.metricType === (exercise.metricType === 'duration_distance' ? 'duration_distance' : 'duration');
  if (item.target.metricType === exercise.metricType)
    return item.target.metricType !== 'reps_load' || item.target.loadGrams > 0;
  if (exercise.metricType !== 'reps_load' || item.target.metricType !== 'reps') return false;
  const known =
    profile.equipmentLoadsKg?.[exercise.id] ??
    exercise.equipment_required
      .flatMap(key => [key, ...(exercise.equipment_alternatives[key] ?? [])])
      .map(key => profile.equipmentLoadsKg?.[key])
      .find(value => value !== undefined) ??
    0;
  if (known > 0) return false;
  const band = item.prescription.loadBand;
  if (band !== 'light' && band !== 'medium') return false;
  const copy = rules.data.copy[`meta.copy.load_${band}`];
  return (
    !!copy && item.prescription.loadDescription?.zh === copy.zh && item.prescription.loadDescription?.en === copy.en
  );
}
