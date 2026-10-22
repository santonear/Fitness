/** Legacy independent unit-test reference only; never used by V2 generation or acceptance. */
import { Rules } from '../../../../src/engine/data';
import type { EnginePlan, EngineProfile, ValidationIssue } from '../../../../src/engine/contracts';
import type { SessionTemplate } from '../../../../src/domain/v8/contracts';
import { independentStartTarget, independentStartAllocation } from './training-engine-start-target';
const rules = new Rules();

/** Revalidates the approved independent-mobility exception, without core target/region helpers. */
export function independentTemplateTarget(
  template: SessionTemplate,
  p: EngineProfile,
): { minutes: number; issues: ValidationIssue[] } {
  const requested = template.targetMinutes,
    issues: ValidationIssue[] = [],
    fail = (reason: string) =>
      issues.push({
        code: 'external_template_target',
        ruleId: 'week.day.mobility',
        severity: 'error',
        templateId: template.id,
        reason,
      });
  if (requested === undefined) return { minutes: p.sessionMinutes, issues };
  if (p.goal === 'start_moving') {
    const expected = independentStartTarget(template, p);
    if (
      !Number.isInteger(requested) ||
      requested < rules.get('session.durations.allowed').minutes[0] ||
      requested > p.sessionMinutes ||
      expected === undefined ||
      requested !== expected
    )
      issues.push({
        code: 'external_template_target',
        ruleId: 'goal.params.start_moving',
        severity: 'error',
        templateId: template.id,
        reason: `source_rebuilt_target:${expected};requested:${requested}`,
      });
    return { minutes: issues.length ? p.sessionMinutes : requested, issues };
  }
  const day = rules.get('week.day.mobility'),
    [minimum, maximum] = day.minutes;
  if (!Number.isInteger(requested) || requested < minimum || requested > maximum || requested > p.sessionMinutes)
    fail('target_outside_source_mobility_range_or_profile');
  if (p.goal !== 'mobility') fail('independent_mobility_target_requires_mobility_goal');
  if (
    template.items.some(i => {
      const e = rules.byExercise.get(i.exerciseId);
      return !!e && ['strength', 'isometric'].includes(e.modality) && e.primary_pattern !== 'balance';
    })
  )
    fail('actual_resistance_work_cannot_use_mobility_target');
  const credits = new Map<string, number>(),
    map = rules.get('dose.muscle_groups').catalog_map,
    multiplier = rules.get('session.time.model').per_side_multiplier;
  for (const i of template.items.filter(i => i.prescription?.block === 'mobility')) {
    const e = rules.byExercise.get(i.exerciseId);
    if (!e || e.modality !== 'mobility' || !e.mobility_type || !('durationSeconds' in i.target)) {
      fail('unknown_or_non_mobility_formal_region_work');
      continue;
    }
    const work = i.sets * i.target.durationSeconds * (i.prescription?.perSide || e.time.per_side ? multiplier : 1),
      regions = new Set<string>();
    if (e.mobility_type === 'static')
      for (const g of e.stretch_targets ?? []) {
        if (['quads', 'glutes', 'hamstrings'].includes(g)) regions.add('lower_body');
        if (['chest', 'back', 'shoulders'].includes(g)) regions.add('upper_body');
      }
    if (e.mobility_type === 'dynamic' && (e.primaryMuscles ?? []).some(m => ['core', 'lower_back'].includes(map[m])))
      regions.add('trunk');
    for (const region of regions) credits.set(region, (credits.get(region) ?? 0) + work);
  }
  for (const slot of day.slots.filter((slot: { pattern: string[] }) => slot.pattern.includes('mobility')))
    if ((credits.get(slot.target) ?? 0) < day.seconds_per_region_min) fail(`missing_source_region_work:${slot.target}`);
  return { minutes: issues.length ? p.sessionMinutes : requested, issues };
}
export function independentTemplateTargetIssues(plan: EnginePlan, p: EngineProfile): ValidationIssue[] {
  const issues = plan.templates.flatMap(t => independentTemplateTarget(t, p).issues);
  if (p.goal === 'start_moving' && plan.templates.some(t => t.targetMinutes !== undefined)) {
    const allocation = independentStartAllocation(p),
      isRt = (t: SessionTemplate) =>
        t.items.some(
          i =>
            ['main', 'accessory'].includes(i.prescription?.block ?? '') ||
            (['strength', 'isometric'].includes(rules.byExercise.get(i.exerciseId)?.modality ?? '') &&
              rules.byExercise.get(i.exerciseId)?.primary_pattern !== 'balance'),
        ),
      rtCount = plan.templates.filter(isRt).length;
    if (
      plan.templates.length !== p.daysPerWeek ||
      rtCount !== allocation.rtDays ||
      plan.templates.some(t => {
        const actual = t.items
          .filter(
            i => i.prescription?.block === 'conditioning' && rules.byExercise.get(i.exerciseId)?.modality === 'cardio',
          )
          .reduce(
            (sum, i) =>
              sum +
              ('durationSeconds' in i.target
                ? i.sets *
                  i.target.durationSeconds *
                  (i.prescription?.perSide || rules.byExercise.get(i.exerciseId)?.time.per_side
                    ? rules.get('session.time.model').per_side_multiplier
                    : 1)
                : 0),
            0,
          );
        return actual !== (allocation.otherDays && isRt(t) ? 0 : allocation.seconds);
      })
    )
      issues.push({
        code: 'external_start_allocation',
        ruleId: 'goal.params.start_moving',
        severity: 'error',
        reason: 'actual_days_or_conditioning_differ_from_source_default_capped_allocation',
      });
    const sourceSets = rules.get('goal.params.start_moving').sets_per_exercise;
    for (const t of plan.templates)
      for (const [itemIndex, i] of t.items.entries())
        if (
          ['main', 'accessory'].includes(i.prescription?.block ?? '') &&
          (!Number.isInteger(i.sets) || i.sets < sourceSets.min || i.sets > sourceSets.max)
        )
          issues.push({
            code: 'external_start_working_sets',
            ruleId: 'goal.params.start_moving',
            severity: 'error',
            templateId: t.id,
            itemIndex,
            reason: 'actual_working_sets_outside_source_goal_range',
          });
    for (const t of plan.templates)
      for (const [itemIndex, i] of t.items.entries())
        if (['main', 'accessory'].includes(i.prescription?.block ?? '')) {
          const e = rules.byExercise.get(i.exerciseId);
          if ('reps' in i.target) {
            let range = [
              rules.get('goal.params.start_moving').reps.min,
              rules.get('goal.params.start_moving').reps.max,
            ];
            if (p.population.kind === 'older_adult') {
              const dose = rules.get('older.strength.dose'),
                v =
                  p.trainingAgeWeeks < rules.get('older.strength.progression').intro_phase_weeks.default
                    ? dose.reps_phase_intro
                    : dose.reps_phase_strength;
              range = [v.min, v.max];
            }
            if (p.screening.restingBp !== 'known_below_threshold')
              range = range.map(n => Math.max(n, rules.get('safety.hypertension.limits').min_reps_per_set));
            const bound = rules.get('dose.reps.bounds');
            range = [
              Math.max(bound.min[p.level], range[0]),
              Math.min(bound.absolute_max, Math.max(bound.min[p.level], range[1])),
            ];
            if (i.target.reps < range[0] || i.target.reps > range[1])
              issues.push({
                code: 'external_start_working_dose',
                ruleId: 'goal.params.start_moving',
                severity: 'error',
                templateId: t.id,
                itemIndex,
                reason: 'actual_work_reps_outside_source_range',
              });
          } else if (e?.modality === 'isometric' && 'durationSeconds' in i.target) {
            const range = rules.get('dose.isometric')[p.level].hold_s;
            if (i.target.durationSeconds < range[0] || i.target.durationSeconds > range[1])
              issues.push({
                code: 'external_start_working_dose',
                ruleId: 'dose.isometric',
                severity: 'error',
                templateId: t.id,
                itemIndex,
                reason: 'actual_isometric_hold_outside_source_range',
              });
          }
        }
    const goal = rules.get('goal.params.start_moving'),
      moderate = rules.get('aerobic.intensity.rpe_scale').moderate,
      actual = plan.templates
        .flatMap(t => t.items)
        .reduce((sum, i) => {
          const e = rules.byExercise.get(i.exerciseId),
            rpe = i.prescription?.targetRpe;
          if (e?.modality !== 'cardio' || !rpe || !('durationSeconds' in i.target)) return sum;
          if (rpe[1] > moderate[1])
            issues.push({
              code: 'external_start_intensity',
              ruleId: 'goal.params.start_moving',
              severity: 'error',
              reason: 'start_moving_source_max_intensity_is_moderate',
            });
          return (
            sum +
            (rpe[0] >= moderate[0] && rpe[1] <= moderate[1]
              ? i.sets *
                i.target.durationSeconds *
                (i.prescription?.perSide || e.time.per_side ? rules.get('session.time.model').per_side_multiplier : 1)
              : 0)
          );
        }, 0),
      required =
        Math.max(goal.aerobic_moderate_equiv_min_week.week1[0], rules.get('aerobic.progression.ramp').week1_floor_min) *
        60;
    if (actual < required)
      issues.push({
        code: 'external_start_aerobic_floor',
        ruleId: 'goal.params.start_moving',
        severity: 'error',
        reason: `explicit_weekly_moderate_seconds:${actual}<source_floor:${required}`,
      });
  }
  return issues;
}
