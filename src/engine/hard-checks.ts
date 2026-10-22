import { checkCardioCaps, exhaustedSafeCapacity } from './checkHard/cardio-duration';
import { checkItemStructure } from './checkHard/item-structure';
import { checkItemDose } from './checkHard/item-dose';
import { pregnancyRampMinutes } from './pregnancy-limits';

import { proveEnvironmentCoverage, pregnancyEnvironmentIssues } from './environment';

import { isRealizedBodyweightWarmup, sourceWarmupRamps } from './source-warmup';
import type { EngineProfile, GateOutcome, HardViolation, Plan } from './contracts';
import { engineTemplateSchema } from './contracts';
import { Rules, condition, adjacentTrainingDays, requiresAlternatingDay } from './data';
import { estimatedSeconds } from './fit/elapsed-time';
import { volume, newWeek } from './dose';

/** Only hard invariants and explicitly authorized structural filters become errors. */
export function checkHard(
  plan: Plan,
  p: EngineProfile,
  g: GateOutcome,
  r = new Rules(),
  skipDuration = false,
): HardViolation[] {
  const errors: HardViolation[] = [],
    add = (code: string, ruleId: string, reason: string, templateId?: string, itemIndex?: number) =>
      errors.push({
        code,
        ruleId,
        reason,
        severity: 'error',
        ...(templateId ? { templateId } : {}),
        ...(itemIndex !== undefined ? { itemIndex } : {}),
      });
  if (g.status === 'blocked') {
    if (plan.templates.length)
      add(
        'blocked_has_templates',
        g.reasons.find(x => x.status === 'blocked')?.ruleId ?? 'safety.screen.parq',
        'blocked profile has templates',
      );
    return errors;
  }
  if (!plan.templates.length) {
    add('empty_plan', 'select.pipeline', 'nonblocked profile has no plan');
    return errors;
  }
  const intro = newWeek(p, r),
    rt = plan.templates.filter(t => t.items.some(i => ['main', 'accessory'].includes(i.prescription?.block ?? '')));
  if (
    intro &&
    rt.length >
      (intro.three_sessions_path?.deferred ? intro.rt_sessions[0] : (intro.rt_sessions_max ?? intro.rt_sessions?.[1]))
  )
    add('intro_frequency', 'progression.new.week_caps', 'resistance sessions exceed introductory cap');
  for (const [day, t] of plan.templates.entries())
    for (const prior of plan.templates.slice(0, day)) {
      if (!t.weekday || !prior.weekday || !adjacentTrainingDays(t.weekday, prior.weekday)) continue;
      const previous = new Set(
        prior.items
          .filter((item, index) => requiresAlternatingDay(item, r) && !isRealizedBodyweightWarmup(prior, index, p, r))
          .map(item => item.exerciseId),
      );
      for (const [index, item] of t.items.entries())
        if (
          previous.has(item.exerciseId) &&
          requiresAlternatingDay(item, r) &&
          !isRealizedBodyweightWarmup(t, index, p, r)
        )
          add(
            'adjacent_exercise',
            'variety.no_repeat',
            'strength exercise repeated on adjacent known weekdays',
            t.id,
            index,
          );
    }
  for (const t of plan.templates) {
    const ramp = pregnancyRampMinutes(p, r);
    if (
      !skipDuration &&
      ramp !== undefined &&
      (estimatedSeconds(t, r) > ramp * 60 + 1e-9 ||
        (t.targetMinutes ?? plan.sessionMinutes) > Math.min(p.sessionMinutes, ramp))
    )
      add(
        'pregnancy_inactive_ramp',
        'pregnancy.inactive.ramp',
        'session exceeds approved inactive-pregnancy weekly duration cap',
        t.id,
      );
    checkCardioCaps(t, p, g, r, add);
    if (!engineTemplateSchema.shape.targetMinutes.safeParse(t.targetMinutes).success)
      add(
        'declared_target_invalid',
        'duration.fit.bounds',
        'declared target must match the stored integer duration contract',
        t.id,
      );
    const ramps = new Map(
        t.items.some(item => (item.prescription?.warmupSeconds ?? 0) > 0)
          ? sourceWarmupRamps(t, p, r).map(row => [row.itemIndex, row.seconds])
          : [],
      ),
      seen = new Set<string>(),
      ladders = new Set<string>();
    if (!t.items.length) add('empty_session', 'select.pipeline', 'session has no items', t.id);
    for (const [index, item] of t.items.entries()) {
      const e = r.byExercise.get(item.exerciseId),
        pres = item.prescription,
        work = ['main', 'accessory'].includes(pres?.block ?? ''),
        sourceRamp =
          pres?.block === 'warmup' &&
          r.get('variety.no_repeat').ramp_sets_exempt === true &&
          isRealizedBodyweightWarmup(t, index, p, r);
      if (!e) {
        add('unknown_exercise', 'select.pipeline', 'unknown exercise', t.id, index);
        continue;
      }
      const context = {
        e,
        p,
        g,
        r,
        t,
        item,
        index,
        pres,
        work,
        sourceRamp,
        ramps,
        seen,
        ladders,
        intro,
        add,
      };
      checkItemStructure(context);
      checkItemDose(context);
    }
    const staticSets: Record<string, number> = {};
    for (const item of t.items) {
      const e = r.byExercise.get(item.exerciseId);
      if (e?.mobility_type === 'static')
        for (const group of new Set(e.stretch_targets ?? [])) staticSets[group] = (staticSets[group] ?? 0) + item.sets;
    }
    const stretchCap = r.get('dose.stretch').reps_per_muscle[1];
    for (const [group, sets] of Object.entries(staticSets))
      if (sets > stretchCap) add('stretch_group_set_cap', 'dose.stretch', `${group}:${sets}>${stretchCap}`, t.id);
    if (
      intro?.exercises_per_session &&
      t.items.filter(i => ['main', 'accessory'].includes(i.prescription?.block ?? '')).length >
        intro.exercises_per_session[1]
    )
      add('intro_exercise_count', 'progression.new.week_caps', 'working exercises exceed introductory count cap', t.id);
    if (g.restrictions.population === 'older_adult') {
      let descents = 0,
        previous = false;
      for (const item of t.items) {
        const e = r.byExercise.get(item.exerciseId),
          floor =
            !!e && (e.requires_floor_transition ?? condition(r.get('older.floor.transitions').floor_based_if, e, {}));
        if (floor && !previous) descents++;
        previous = floor;
      }
      if (descents > r.get('older.floor.transitions').other_older_users.max_floor_descents_per_session)
        add('floor_descents', 'older.floor.transitions', 'floor blocks require too many descents', t.id);
    }
    if (r.get('fatloss.spot_reduction.ban').banned_claims.some((claim: string) => t.name.includes(claim)))
      add('banned_claim', 'fatloss.spot_reduction.ban', 'session name contains banned spot-reduction claim', t.id);
    const totals = volume(
        t.items.filter(i => ['main', 'accessory'].includes(i.prescription?.block ?? '')),
        r,
      ),
      cap = r.get('dose.sets_session.cap').per_muscle_fractional_sets_max[p.level];
    for (const [muscle, total] of Object.entries(totals))
      if (total > cap) add('session_volume_cap', 'dose.sets_session.cap', `${muscle} exceeds session cap`, t.id);
    const target = t.targetMinutes ?? p.sessionMinutes,
      bounds = r.get('duration.fit.bounds'),
      exception = target === r.get('session.durations.allowed').minutes[0] ? bounds.min10_duration_seconds : undefined,
      low = exception?.[0] ?? target * 60 * bounds.duration_band[0],
      high = exception?.[1] ?? target * 60 * bounds.duration_band[1],
      seconds = estimatedSeconds(t, r);
    if (!skipDuration && !(g.restrictions.population === 'postpartum' && g.restrictions.phase === 1)) {
      const short = Number.isFinite(seconds) && seconds < low;
      const belowReportingBand =
        Number.isFinite(seconds) && seconds < target * 60 * r.get('duration.fit.tolerance').band[0];
      const exhausted =
        belowReportingBand &&
        !checkHard(plan, p, g, r, true).some(issue => issue.severity === 'error') &&
        exhaustedSafeCapacity(t, p, g, r, proposal => {
          const candidate = structuredClone(plan),
            template = candidate.templates.find(row => row.id === t.id)!;
          template.items = proposal.items;
          const proposedSeconds = estimatedSeconds(template, r);
          if (proposedSeconds > high || Math.abs(proposedSeconds - target * 60) >= Math.abs(seconds - target * 60))
            return false;
          return !checkHard(candidate, p, g, r, true).some(issue => issue.severity === 'error');
        });
      if (!Number.isFinite(seconds) || seconds > high || (short && !exhausted))
        add('duration_tolerance', 'duration.fit.bounds', 'duration outside source hard bounds', t.id);
      else if (belowReportingBand && exhausted)
        errors.push({
          code: 'intentional_short',
          ruleId: 'duration.cardio.cap',
          severity: 'warning',
          templateId: t.id,
          reason: 'actual bounded safe workload cannot fill declared duration',
        });
    }
  }
  if (intro) {
    const v = r.get('progression.new.weekly_sets'),
      goal = r.get('dose.sets_week.goal_matrix')[p.goal][p.level],
      cap = Math.min(
        v.through_week_4_max,
        Math.min(goal.start, Number(String(v.week_1_max).match(/\d+/)?.[0])) +
          Math.floor(p.trainingAgeWeeks) * v.weekly_increase_max,
      ),
      weekly = volume(
        rt.flatMap(t => t.items.filter(i => ['main', 'accessory'].includes(i.prescription?.block ?? ''))),
        r,
      );
    for (const [muscle, total] of Object.entries(weekly))
      if (total > cap)
        add('intro_week_volume', 'progression.new.week_caps', `${muscle} exceeds introductory weekly cap`);
  }
  const old = r.get('older.template.balance_required');
  if (
    g.restrictions.population === 'older_adult' &&
    p.daysPerWeek >= old.hard_when_days_available_min &&
    plan.templates.filter(t =>
      t.items.some(
        i =>
          r.byExercise.get(i.exerciseId)?.primary_pattern === 'balance' &&
          i.prescription?.block !== 'cooldown' &&
          (i.prescription?.block !== 'warmup' || r.get('session.warmup.balance_older').counts_toward_balance_days),
      ),
    ).length < old.hard_balance_days_min
  ) {
    const proof = proveEnvironmentCoverage(p, g, r, 'older.template.balance_required');
    if (proof)
      errors.push({
        code: proof.warningCode,
        ruleId: proof.ruleId,
        severity: 'warning',
        reason:
          'required coverage absent: complete hard pool empty; only configured environment access restores candidates',
      });
    else add('balance_days', 'older.template.balance_required', 'required weekly balance days absent');
  }
  errors.push(...pregnancyEnvironmentIssues(p, g, r));
  return errors;
}

export { hardCheckCoverage, hardRuleAssessments } from './checkHard/coverage';
