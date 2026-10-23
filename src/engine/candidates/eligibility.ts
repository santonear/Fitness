import { pregnancyBalanceSupport } from '../pregnancy-limits';
import { ownedEquipment } from '../equipment';
import type { Caution, EngineProfile, GateOutcome, GateState, PipelineContext } from '../contracts';
import { condition, stretchHoldRange, balanceStageEligible, type Rules, type Exercise } from '../data';
interface SelectionContext {
  profile: EngineProfile;
  rules: PipelineContext['rules'];
  safety: GateOutcome['restrictions'];
  excluded?: Set<string>;
}
const SPACE = ['mat', 'small', 'medium', 'large'];
export function equipmentAvailable(e: Exercise, p: EngineProfile): boolean {
  const owned = ownedEquipment(p);
  return e.equipment_required.every(
    required => owned.has(required) || (e.equipment_alternatives?.[required] ?? []).some(alt => owned.has(alt)),
  );
}
export function floorBased(e: Exercise, rules: Rules): boolean {
  return condition(rules.get('older.floor.transitions').floor_based_if, e, {});
}
/** Complete hard pool entry point; slot preferences and session reuse are caller concerns. */
export function isHardEligible(
  e: Exercise,
  profile: EngineProfile,
  gate: GateOutcome,
  context: Pick<PipelineContext, 'rules'>,
): boolean {
  return (
    gate.status !== 'blocked' &&
    computeEligibility(e, {
      profile,
      rules: context.rules,
      safety: gate.restrictions,
    })
  );
}
// As with candidate pools, Rules identity denotes one compiled source snapshot; no user facts are cached here.
const sourceFallbackRules = new WeakMap<Rules, Rules['data']['rules']>();
/** Source-scoped substitutes never become general candidates or displace a hard-eligible primary. */
export function sourceFallbackRestriction(
  e: Exercise,
  p: EngineProfile,
  s: GateOutcome['restrictions'],
  r: Rules,
): string | undefined {
  let registered = sourceFallbackRules.get(r);
  if (!registered) {
    registered = r.data.rules.filter(rule => rule.value?.candidate_fallback);
    sourceFallbackRules.set(r, registered);
  }
  for (const rule of registered) {
    const value = rule.value,
      fallback = value?.candidate_fallback;
    if (fallback?.exercise_id !== e.id) continue;
    if (!value?.when || !condition(value.when, e, s.user)) return rule.id;
    if (
      r.data.exercises.some(
        primary =>
          primary.id !== e.id &&
          condition(fallback.primary_if, primary, s.user) &&
          computeEligibility(primary, { profile: p, rules: r, safety: s }),
      )
    )
      return rule.id;
  }
  return undefined;
}
function computeEligibility(e: Exercise, ctx: SelectionContext): boolean {
  const { profile: p, rules: r, safety: s } = ctx;
  if (sourceFallbackRestriction(e, p, s, r)) return false;
  if (
    (s.population === 'older_adult' || p.olderSafety?.balanceStage !== undefined) &&
    !balanceStageEligible(e, s.user.balance_stage ?? r.get('older.balance.progression').stages[0].stage, r)
  )
    return false;
  if (
    s.population === 'pregnant' &&
    r.get('pregnancy.environment').content_blacklist.some((slug: string) => e.slug.replaceAll('-', '_') === slug)
  )
    return false;
  const regression = r.get('postpartum.symptom_regression');
  if (
    p.postpartumSafety?.regressedPhase !== undefined &&
    regression.action.some(
      (action: unknown) =>
        typeof action === 'object' &&
        action !== null &&
        condition((action as { exclude_if: unknown }).exclude_if, e, s.user),
    )
  )
    return false;
  if (
    ((e.modality as string) === 'hiit' || e.flags.includes('hiit')) &&
    (!s.user.hiit_unlocked ||
      (s.population === 'older_adult' && e.impact > r.get('hiit.gate.unlock').older_adult.max_impact))
  )
    return false;
  const power = r.get('dose.power'),
    isPower = e.modality === 'power' || power.patterns.includes(e.primary_pattern);
  // Both source intervals must be satisfiable before a power prescription can be scored.
  if (isPower && (e.difficulty >= power.exclude_difficulty_min || e.flags.some(f => power.exclude_flags.includes(f))))
    return false;
  if (isPower && ((p.level === 'beginner' && power.beginner === 'excluded') || s.rirMin > power.rir[1])) return false;
  if (s.excludeFlags.some(f => e.flags.includes(f)) || s.excludePositions.some(v => e.position.includes(v)))
    return false;
  if (r.get('ladder.gate.barbell').gated_flags.some((f: string) => e.flags.includes(f))) return false;
  return sharedEligibility(e, ctx);
}
/** Checks shared with the legacy source-target pool (progression/legacy-candidates). */
export function sharedEligibility(e: Exercise, ctx: Omit<SelectionContext, 'safety'> & { safety: GateState }): boolean {
  const { profile: p, rules: r, safety: s } = ctx;
  const pop = p.population;
  if (e.stretch_hold_s && !stretchHoldRange(e, r, s.population)) return false;
  if (p.preferences.excludedExerciseIds.includes(e.id) || ctx.excluded?.has(e.id)) return false;
  if (
    (e as Exercise & { excluded_cautions?: string[] }).excluded_cautions?.some(c => p.cautions.includes(c as Caution))
  )
    return false;
  if (!equipmentAvailable(e, p) || SPACE.indexOf(e.space) > SPACE.indexOf(p.constraints.space)) return false;
  if (p.constraints.quiet && e.noise > 0) return false;
  if (
    (p.constraints.noJump || p.preferences.cannotDo.includes('jumping')) &&
    (e.flags.includes('jumping') ||
      e.flags.includes('running') ||
      e.modality === 'plyometric' ||
      e.primary_pattern === 'jump_land')
  )
    return false;
  const cannot = p.preferences.cannotDo;
  if (cannot.includes('walking_carry') && e.primary_pattern === 'carry') return false;
  const floorTransition =
    e.requires_floor_transition ??
    (floorBased(e, r) ||
      e.position.includes('quadruped') ||
      (e.position.includes('plank') && !e.position.some(p => p === 'standing' || p === 'seated')));
  if (cannot.includes('floor_work') && floorTransition) return false;
  if (cannot.includes('overhead') && e.flags.includes('overhead_load')) return false;
  if (cannot.includes('kneeling') && e.position.some(v => v === 'kneeling' || v === 'quadruped')) return false;
  if (p.painState?.some(x => x.pattern === e.primary_pattern && x.remainingSessions > 0)) return false;
  if (e.difficulty >= 5 || e.use.includes('skill')) return false;
  const week = Math.max(1, Math.floor(p.trainingAgeWeeks) + 1);
  if (p.level === 'beginner' && week <= 4) {
    const cap = r.get('progression.new.week_caps');
    const v = week === 1 ? cap.week_1 : week === 2 ? cap.week_2 : cap.week_3_4;
    if (e.difficulty > v.difficulty_max) return false;
    const excluded = r.get('progression.new.exclusions');
    if (
      excluded.exclude_modality.includes(e.modality) ||
      excluded.exclude_flags.some((f: string) => e.flags.includes(f)) ||
      excluded.exclude_use.some((u: string) => e.use.includes(u))
    )
      return false;
  }
  if (s.user.clearance_state === 'required') {
    const restricted = r.get('safety.clearance.restricted_mode');
    if (
      restricted.exclude_modality.includes(e.modality) ||
      restricted.exclude_flags.some((f: string) => e.flags.includes(f))
    )
      return false;
  }
  if (
    s.user.hypertension !== 'controlled' &&
    r.get('safety.hypertension.limits').exclude_flags.some((f: string) => e.flags.includes(f))
  )
    return false;
  for (const joint of new Set([...p.cautions, ...(s.user.redflag_cautions ?? [])])) {
    if (joint === 'other') continue;
    const level = Math.max(
      p.cautionLevels?.[joint as 'knee' | 'back' | 'shoulder' | 'wrist'] ?? 1,
      s.user.redflag_caution_level ?? 1,
      p.painState?.some(x => (x.score ?? 0) > 5 || (x.cautionLevelDelta ?? 0) > 0) ? 2 : 1,
    );
    const v = r.get(`caution.${joint}.filter`)[`level_${level}`];
    if (condition(v.exclude_if, e, s.user)) return false;
  }
  const boundUser = {
    ...s.user,
    pregnancy_balance_supported: pregnancyBalanceSupport(e, p, r).available.length > 0,
    exercise: {
      supported_variant_available: e.supported_variant_available === true,
    },
  };
  const applyExclude = (id: string) => {
    const value = r.get(id);
    return (!value.when || condition(value.when, e, boundUser)) && condition(value.exclude_if, e, boundUser);
  };
  if (s.population === 'older_adult') {
    if (applyExclude('older.exclude.base')) return false;
    if (condition(r.get('older.exclude.base').default_low_impact.exclude_if, e, s.user)) return false;
    if (s.user.balance_cautious && applyExclude('older.exclude.balance_cautious')) return false;
    if ((s.user.balance_cautious || s.user.walking_aid) && (e.requires_floor_transition || floorBased(e, r)))
      return false;
    if (
      pop.kind === 'older_adult' &&
      pop.boneFlag &&
      condition(r.get('older.bone').until_clearance_exclude_if, e, s.user)
    )
      return false;
  }
  if (s.population === 'pregnant')
    for (const id of [
      'pregnancy.exclude.supine',
      'pregnancy.exclude.prone',
      'pregnancy.exclude.impact',
      'pregnancy.exclude.fall_risk',
      'pregnancy.exclude.valsalva',
      'pregnancy.exclude.abdominal_flexion',
    ])
      if (applyExclude(id)) return false;
  if (s.population === 'postpartum' && pop.kind === 'postpartum') {
    if (s.phase === 1) {
      if (pop.delivery === 'cesarean' && !pop.cleared) {
        if (!condition(r.get('postpartum.gate.caesarean').allow_only_if, e, s.user)) return false;
      } else if (!condition(r.get('postpartum.phase1').allow_only_if, e, s.user)) return false;
    }
    if (s.phase < 3 && applyExclude('postpartum.exclude.pre_phase3')) return false;
    if (
      s.phase === 2 &&
      e.modality !== 'mobility' &&
      e.difficulty > r.get('postpartum.phase2').strength_limits.difficulty_max
    )
      return false;
    if (
      !pop.readinessChecklistPassed &&
      (e.flags.some(f => f === 'running' || f === 'jumping') || e.impact >= 2 || e.modality === 'plyometric')
    )
      return false;
  }
  return true;
}
