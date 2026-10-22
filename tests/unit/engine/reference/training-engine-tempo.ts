/** Legacy independent unit-test reference only; never used by V2 generation or acceptance. */
import type { EnginePlan, EngineProfile, ValidationIssue } from '../../../../src/engine/contracts';
import { Rules } from '../../../../src/engine/data';
const rules = new Rules();
/** Independent source replay: no producer cadence, dose or duration helpers. */
export function independentMobilityTempoIssues(plan: EnginePlan, profile: EngineProfile): ValidationIssue[] {
  if (profile.goal !== 'mobility') return [];
  const goal = rules.get('goal.params.mobility'),
    issues: ValidationIssue[] = [];
  for (const template of plan.templates)
    for (const [itemIndex, item] of template.items.entries()) {
      const exercise = rules.byExercise.get(item.exerciseId),
        p = item.prescription;
      if (
        exercise?.modality !== 'strength' ||
        !['main', 'accessory'].includes(p?.block ?? 'main') ||
        !('reps' in item.target)
      )
        continue;
      const expected = Math.max(
        goal.rep_duration_min_s,
        exercise.time.s_per_rep ?? rules.get('duration.rep.seconds').default_if_unknown,
      );
      if (
        p?.secondsPerRep !== expected ||
        p?.tempo?.eccentricSeconds !== goal.eccentric_s ||
        p?.tempo?.concentricSeconds !== goal.concentric_s ||
        p?.tempo?.pauseSeconds !== goal.pause_s
      )
        issues.push({
          code: 'external_mobility_tempo',
          ruleId: 'goal.params.mobility',
          severity: 'error',
          reason: `fixed_source_seconds_per_rep:${expected};actual:${p?.secondsPerRep}`,
          templateId: template.id,
          itemIndex,
        });
    }
  return issues;
}
