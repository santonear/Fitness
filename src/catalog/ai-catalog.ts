import { exercises } from './exercises';
import { catalogMetadata } from './registry';
import { equipmentLabel } from './taxonomy';
import type { GuidedDialogueRequest } from '../domain/guided-ai-contracts';

// Bounded prompt vocabulary, not a suitability recommendation. Every registered
// movement is eligible by name/alias; the provider still evaluates restrictions.
export function selectAiExercises(goal: string, conditions: unknown = {}, refinement = '') {
  const text = `${goal} ${JSON.stringify(conditions)} ${refinement}`.toLowerCase();
  const terms = text.match(/[a-z0-9]+|[\u4e00-\u9fff]+/g) ?? [];
  const ranked = exercises.map((exercise, index) => {
    const metadata = catalogMetadata.get(exercise.id);
    const aliases = [exercise.name.zh, exercise.name.en, ...(metadata?.aliases ?? [])].map(value => value.toLowerCase());
    const words = aliases.join(' ');
    const exact = aliases.some(alias => alias.length > 2 && text.includes(alias));
    const equipment = text.includes(exercise.equipment) || text.includes(equipmentLabel(exercise.equipment, 'zh'));
    return { exercise, index, score: (exact ? 100 : 0) + (equipment ? 10 : 0) + terms.filter(term => term.length > 2 && words.includes(term)).length };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
  // Original four remain available for existing plans and deterministic adapters.
  const selected = new Map(exercises.slice(0, 4).map(row => [row.id, row]));
  for (const { exercise, score } of ranked) {
    if (score < 100 || selected.size >= 64) break;
    selected.set(exercise.id, exercise);
  }
  // Break equal-score ties across body areas, not alphabetically across the
  // entire catalog (which would otherwise overfill a general plan with abs).
  const groups = new Map<string, typeof exercises>();
  for (const { exercise } of ranked) {
    if (selected.has(exercise.id)) continue;
    const key = catalogMetadata.get(exercise.id)?.bodyPart ?? exercise.category;
    const group = groups.get(key) ?? []; group.push(exercise); groups.set(key, group);
  }
  while (selected.size < 64 && [...groups.values()].some(group => group.length)) {
    for (const group of groups.values()) {
      const exercise = group.shift();
      if (exercise) selected.set(exercise.id, exercise);
      if (selected.size >= 64) break;
    }
  }
  return [...selected.values()];
}
export function guidedAiExercises(request: GuidedDialogueRequest) {
  return selectAiExercises(`${request.scope.goal} ${request.confirmedSummary}`, request.scope.conditions, request.refinement);
}
