import type { EngineProfile } from '../contracts';
import type { Exercise, Rules } from '../data';
import { ownedEquipment } from '../equipment';

/** Candidate preference only: target weights and safety eligibility are unchanged. */
export function loadedPreference(exercise: Exercise, profile: EngineProfile, rules: Rules): number {
  const policy = rules.get('select.rank').loaded_preference;
  if (!policy.goals.includes(profile.goal) || !policy.modalities.includes(exercise.modality)) return 0;
  const owned = ownedEquipment(profile);
  return exercise.equipment_required.some(item =>
    [item, ...(exercise.equipment_alternatives[item] ?? [])].some(
      actual => policy.equipment.includes(actual) && owned.has(actual),
    ),
  )
    ? policy.marginal_bonus
    : 0;
}
