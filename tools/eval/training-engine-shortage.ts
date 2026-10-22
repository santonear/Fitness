import { checkHard } from '../../src/engine/hard-checks';
import { runGates } from '../../src/engine/gates';
import type { EnginePlan, EngineProfile } from '../../src/engine/contracts';
import { Rules } from '../../src/engine/data';
import { independentElapsedSeconds } from '../../src/engine/validation/cardio-duration';
import { independentRefillWitness } from '../../src/engine/validation/refill-capacity';
import { independentlyPossibleIds } from './training-engine-quality';

/** Clinically capped ramp courses are reported separately, never as exhausted-capacity exemptions. */
export function pregnancyRampFacts(plan: EnginePlan, p: EngineProfile, r: Rules) {
  const source = r.get('pregnancy.week.target').previously_inactive;
  if (
    p.population.kind !== 'pregnant' ||
    p.screening.activityStatus !== source.when.activity_status ||
    !plan.templates.length
  )
    return;
  const cap = Math.min(
    p.sessionMinutes,
    source.first_week_minutes + Math.floor(p.trainingAgeWeeks) * source.weekly_increment_minutes,
    source.max_minutes,
  );
  if (cap >= p.sessionMinutes) return;
  const courses = plan.templates.map(t => ({
    templateId: t.id,
    actualSeconds: independentElapsedSeconds(t.items, r),
    targetMinutes: t.targetMinutes,
  }));
  return {
    requestedMinutes: p.sessionMinutes,
    capMinutes: cap,
    trainingAgeWeeks: p.trainingAgeWeeks,
    courses,
    withinCap: courses.every(
      t => t.actualSeconds <= cap * 60 + 1e-9 && t.targetMinutes !== undefined && t.targetMinutes <= cap,
    ),
    disclosed:
      plan.notices.some(n => n.code === 'session.copy.intentional_short') &&
      plan.trace.some(t => t.reason === 'pregnancy_inactive_ramp'),
  };
}
/** A producer warning alone never earns a denominator exemption. */
export function intentionalShortFacts(plan: EnginePlan, p: EngineProfile, r: Rules) {
  const course = plan.templates
    .filter(t => t.durationScope !== 'untargeted')
    .map(t => ({
      templateId: t.id,
      seconds: independentElapsedSeconds(t.items, r),
      target: (t.targetMinutes ?? p.sessionMinutes) * 60,
    }));
  const short = course.filter(t => t.seconds / t.target < 0.9 - 1e-9),
    possible = short.length ? independentlyPossibleIds(p, r) : [];
  const reasons = new Set<string>(),
    proofs: { templateId: string; missingSeconds: number; ratio: number }[] = [];
  let qualified =
    short.length > 0 &&
    course.every(t => t.seconds / t.target <= 1.1 + 1e-9) &&
    !checkHard(plan, p, runGates(p, r), r, true).some(issue => issue.severity === 'error');
  for (const row of short) {
    const t = plan.templates.find(t => t.id === row.templateId)!;
    const trace = plan.trace.find(
      x =>
        x.reason === 'intentional_short' &&
        x.details?.templateId === t.id &&
        Number(x.details?.missingSeconds) > 0 &&
        x.details?.targetSeconds === row.target &&
        Math.abs(Number(x.details?.estimatedSeconds) - row.seconds) < 1e-6 &&
        Math.abs(Number(x.details?.missingSeconds) - (row.target - row.seconds)) < 1e-6 &&
        Array.isArray(x.details?.limitingRuleIds) &&
        x.details.limitingRuleIds.length > 0,
    );
    if (
      !trace ||
      row.seconds >= row.target ||
      !plan.notices.some(n => n.code === 'session.copy.intentional_short') ||
      independentRefillWitness(plan, t, p, r, possible)
    )
      qualified = false;
    const ids = (trace?.details?.limitingRuleIds ?? []) as string[];
    for (const id of ids) reasons.add(id);
    proofs.push({
      templateId: t.id,
      missingSeconds: row.target - row.seconds,
      ratio: row.seconds / row.target,
    });
  }
  return {
    qualified,
    minimumRatio: course.length ? Math.min(...course.map(t => t.seconds / t.target)) : null,
    below50: course.some(t => t.seconds / t.target < 0.5 - 1e-9),
    population: p.population.kind,
    level: p.level === 'beginner' && p.trainingAgeWeeks < 4 ? 'new_first4' : 'other',
    equipment: [...p.equipment].sort().join('+'),
    space: p.constraints.space,
    targetMinutes: p.sessionMinutes,
    reasons: [...reasons].sort(),
    proofs,
  };
}
