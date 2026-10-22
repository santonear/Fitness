import { independentRefillWitness } from './refill-capacity';
import type { EnginePlan, EngineProfile, ValidationIssue } from '../contracts';
import type { Exercise, Rules } from '../data';
type Item = EnginePlan['templates'][number]['items'][number];
/** Independent source arithmetic: no fitter, production cap, validator or producer marker is used. */
export function independentCardioDurationIssues(
  plan: EnginePlan,
  p: EngineProfile,
  r: Rules,
  possibleIds: readonly string[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [],
    source = r.get('duration.cardio.cap'),
    side = (i: Item, e: Exercise) =>
      i.prescription?.perSide || e.time.per_side ? r.get('session.time.model').per_side_multiplier : 1;
  const cap = (e: Exercise) => {
    let value =
      (source.explicit_low_intensity_slugs ?? []).includes(e.slug) ||
      (e.flags.includes(source.low_intensity.required_flag) && e.impact === source.low_intensity.impact)
        ? source.low_intensity.max_work_seconds
        : source.other_max_work_seconds;
    for (const row of source.specialized_caps ?? [])
      if (!row.when || independentMatch(row.when, e, { population: p.population.kind }))
        value = Math.min(value, row.max_work_seconds);
    return value;
  };
  const work = (i: Item, e: Exercise) =>
    'durationSeconds' in i.target ? i.sets * i.target.durationSeconds * side(i, e) : NaN;
  for (const t of plan.templates) {
    const totals = new Map<string, number>();
    for (const [index, i] of t.items.entries()) {
      const e = r.byExercise.get(i.exerciseId);
      if (e?.modality !== 'cardio') continue;
      const total = (totals.get(e.id) ?? 0) + work(i, e);
      totals.set(e.id, total);
      if (!Number.isFinite(total) || total > cap(e))
        issues.push({
          code: 'independent_cardio_work_cap',
          ruleId: 'duration.cardio.cap',
          severity: 'error',
          templateId: t.id,
          itemIndex: index,
          reason: 'independent whole-identity work exceeds source cap',
        });
    }
    const target = t.targetMinutes ?? p.sessionMinutes,
      limits = r.get('duration.fit.bounds'),
      low =
        target === r.get('session.durations.allowed').minutes[0]
          ? limits.min10_duration_seconds[0]
          : target * 60 * limits.duration_band[0],
      seconds = independentElapsedSeconds(t.items, r);
    const pop = p.population,
      boundary = r.get('postpartum.phase.boundaries'),
      buffer =
        pop.kind === 'postpartum' && (pop.delivery !== 'vaginal' || pop.perinealTrauma)
          ? boundary.buffer_weeks_if.default
          : 0;
    if (
      pop.kind === 'postpartum' &&
      (!pop.cleared ||
        pop.weeksSinceBirth < boundary.base_weeks.phase2[0] + buffer ||
        p.postpartumSafety?.regressedPhase === 1)
    )
      continue;
    if (!Number.isFinite(seconds) || seconds >= low) continue;
    if (independentRefillWitness(plan, t, p, r, possibleIds))
      issues.push({
        code: 'independent_short_capacity',
        ruleId: 'duration.fit.bounds',
        severity: 'error',
        templateId: t.id,
        reason: 'independent catalogue or actual items retain bounded aerobic capacity',
      });
  }
  return issues;
}
function independentMatch(input: unknown, e: Exercise, user: Record<string, unknown>): boolean {
  if (!input || typeof input !== 'object') return false;
  const c = input as Record<string, any>;
  if (c.all) return c.all.every((v: unknown) => independentMatch(v, e, user));
  if (c.any) return c.any.some((v: unknown) => independentMatch(v, e, user));
  if (c.not) return !independentMatch(c.not, e, user);
  const value = c.field ? (e as unknown as Record<string, unknown>)[c.field] : c.user ? user[c.user] : undefined;
  if (c.flag) return (Array.isArray(c.flag) ? c.flag : [c.flag]).some((flag: string) => e.flags.includes(flag));
  if ('eq' in c || 'is' in c) return value === (c.eq ?? c.is);
  if (c.in) return c.in.includes(value);
  if ('gte' in c) return typeof value === 'number' && value >= c.gte;
  return false;
}
export function independentElapsedSeconds(items: Item[], r: Rules): number {
  const seen = new Set<string>(),
    overhead = r.get('duration.set.overhead'),
    transition = r.get('duration.transition.setup');
  let total = 0;
  const one = (i: Item) => {
    const e = r.byExercise.get(i.exerciseId);
    if (!e) return 0;
    const side = i.prescription?.perSide || e.time.per_side ? r.get('session.time.model').per_side_multiplier : 1;
    return (
      ('durationSeconds' in i.target
        ? i.target.durationSeconds
        : i.target.reps *
          (i.prescription?.secondsPerRep ?? e.time.s_per_rep ?? r.get('duration.rep.seconds').default_if_unknown)) *
        side +
      (e.modality === 'mobility' ? overhead.mobility_overhead_s_per_set : overhead.overhead_s_per_set)
    );
  };
  for (const i of items) {
    const e = r.byExercise.get(i.exerciseId);
    if (!e) continue;
    const pres = i.prescription;
    if (['warmup', 'cooldown', 'mobility'].includes(pres?.block ?? '')) {
      total += i.sets * one(i);
      continue;
    }
    const group = pres?.structure && pres.structure !== 'straight' ? pres.groupId : undefined,
      key = group ? pres!.structure + ':' + group : undefined;
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    const members = group
      ? items.filter(
          m =>
            m.prescription?.groupId === group &&
            m.prescription?.structure === pres?.structure &&
            !['warmup', 'cooldown'].includes(m.prescription?.block ?? ''),
        )
      : [i];
    if (members.length === 1 && e.modality === 'cardio' && 'durationSeconds' in i.target) {
      total +=
        i.sets *
        i.target.durationSeconds *
        (pres?.perSide || e.time.per_side ? r.get('session.time.model').per_side_multiplier : 1);
      continue;
    }
    total +=
      members.reduce(
        (sum, m) =>
          sum +
          (r.byExercise.get(m.exerciseId)?.time.setup_s ?? 0) +
          m.sets * one(m) +
          (m.prescription?.warmupSeconds ?? 0),
        0,
      ) + transition.buffer_s;
    if (members.length > 1) {
      const rule = r.get('duration.rest.block')[pres!.structure!],
        rounds = Math.max(...members.map(m => m.sets)),
        rest =
          pres?.structure === 'superset'
            ? Math.max(
                rule.after_round_range_s[0],
                ...members.map(m => m.prescription?.roundRestSeconds ?? rule.after_round_s),
              )
            : rule.after_round_s;
      total +=
        (rounds - 1) * rest +
        Array.from({ length: rounds }, (_, n) => Math.max(0, members.filter(m => m.sets > n).length - 1)).reduce(
          (a, b) => a + b,
          0,
        ) *
          (rule.between_exercises_s ?? rule.between_stations_s);
    } else
      total +=
        (i.sets - 1) *
        (pres?.restSeconds ??
          r.get('duration.rest.straight').rest_s[e.nsca_class === 'isolation' ? 'isolation' : 'compound']);
  }
  return total;
}
