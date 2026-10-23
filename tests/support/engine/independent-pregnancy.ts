import type { EnginePlan, EngineProfile, ValidationIssue } from '../../../src/engine/contracts';
import { Rules, condition } from '../../../src/engine/data';
import { independentElapsedSeconds } from '../../../src/engine/validation/cardio-duration';

/** Recalculate from source data and items; never trust a producer marker or its clock. */
export function independentPregnancyIssues(plan: EnginePlan, p: EngineProfile, r = new Rules()): ValidationIssue[] {
  if (p.population.kind !== 'pregnant' || !plan.templates.length) return [];
  const issues: ValidationIssue[] = [];
  const add = (code: string, ruleId: string, templateId?: string) =>
    issues.push({ code, ruleId, templateId, severity: 'error', reason: code });
  if (p.population.prenatalCareConfirmed !== true) add('independent_prenatal_care', 'pregnancy.gate.provider');
  const ramp = r.get('pregnancy.week.target').previously_inactive;
  const limit =
    p.screening.activityStatus === ramp.when.activity_status
      ? Math.min(
          ramp.first_week_minutes + Math.floor(p.trainingAgeWeeks) * ramp.weekly_increment_minutes,
          ramp.max_minutes,
        )
      : undefined;
  for (const t of plan.templates) {
    if (
      limit !== undefined &&
      (independentElapsedSeconds(t.items, r) > limit * 60 + 1e-9 ||
        (t.targetMinutes ?? plan.sessionMinutes) > Math.min(p.sessionMinutes, limit))
    )
      add('independent_pregnancy_ramp', 'pregnancy.inactive.ramp', t.id);
    const standing = r.get('pregnancy.intensity').static_standing;
    for (const item of t.items) {
      const e = r.byExercise.get(item.exerciseId);
      const modifier = r
        .get('pregnancy.exclude.fall_risk')
        .modify.find((row: { cue: string }) => row.cue === 'hold_wall_or_chair');
      if (e && condition(modifier.when, e, { gestation_week: p.population.week })) {
        const household = r.get('environment.household_support');
        const owned = new Set([
          ...p.equipment,
          ...((p.householdSupport ?? household.default_places.includes(p.place)) ? household.equipment : []),
        ]);
        const hasVariant = e.supported_variant_available === true || modifier.supported_exercise_ids.includes(e.id);
        const copy = r.text('pregnancy.exclude.fall_risk.support_copy');
        if (
          !hasVariant ||
          !modifier.support_equipment.includes(item.equipment) ||
          !owned.has(item.equipment) ||
          item.prescription?.safetyCue?.zh !== copy.zh ||
          item.prescription?.safetyCue?.en !== copy.en
        )
          add('independent_pregnancy_support', 'pregnancy.exclude.fall_risk', t.id);
      }
      if (
        e?.flags.includes(standing.match.flag) &&
        'durationSeconds' in item.target &&
        item.target.durationSeconds *
          (e.time.per_side || item.prescription?.perSide ? r.get('session.time.model').per_side_multiplier : 1) >
          standing.per_set_seconds_max
      )
        add('independent_pregnancy_standing', 'pregnancy.intensity', t.id);
    }
  }
  return issues;
}
