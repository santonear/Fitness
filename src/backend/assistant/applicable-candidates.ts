import { selectAssistantCandidates } from '../../catalog/ai-catalog';
import { coachV8Exercises } from '../../coach/response-adapter';
import type { AssistantRequest } from '../../assistant/contracts';
import { catalogMetadata } from '../../catalog/registry';
import { sameExerciseFamily } from '../../catalog/exercise-family';
import { exercises } from '../../catalog/exercises';

/** Narrow the server's safety-filtered candidates to the client's existing vocabulary. */
export function applicableAssistantCandidates(request: AssistantRequest) {
  const candidates = selectAssistantCandidates(request);
  if (!request.context) return candidates;
  const accepted = new Set(coachV8Exercises(request.context).map(exercise => exercise.id));
  return candidates.filter(candidate => accepted.has(candidate.exercise.id));
}

/** Stable priority within the already safety-filtered client/server intersection. */
export function lowerBodyAddition(request: AssistantRequest) {
  if (request.context?.task !== 'MODIFY_PLAN') return;
  const plan = request.context.plan;
  const existing = new Set(plan.templates.flatMap(template => template.items.map(item => item.exerciseId)));
  const equipment = new Set([
    'none',
    ...plan.templates.flatMap(template => template.items.map(item => item.equipment)),
  ]);
  const candidates = applicableAssistantCandidates(request).filter(row => {
    const name = `${row.exercise.name.zh} ${row.exercise.name.en} ${catalogMetadata.get(row.exercise.id)?.slug ?? ''}`;
    return (
      !existing.has(row.exercise.id) &&
      !exercises.some(exercise => existing.has(exercise.id) && sameExerciseFamily(exercise, row.exercise)) &&
      equipment.has(row.exercise.equipment) &&
      row.mode !== 'carry' &&
      !/squat|lunge|leg.press|deep.knee|深蹲|弓步|腿举|jump|hop|burpee|跳|跃|walk|行走/i.test(name)
    );
  });
  return (
    candidates.find(row => row.mode === 'hinge') ??
    candidates.find(
      row =>
        /提踵|calf.?raise/i.test(`${row.exercise.name.zh} ${row.exercise.name.en}`) ||
        catalogMetadata.get(row.exercise.id)?.bodyPart === 'lower-legs',
    ) ??
    candidates.find(row => ['upper-legs', 'lower-legs'].includes(catalogMetadata.get(row.exercise.id)?.bodyPart ?? ''))
  );
}
