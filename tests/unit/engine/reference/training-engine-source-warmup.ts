/** Legacy independent unit-test reference only; never used by V2 generation or acceptance. */
import type { EngineProfile } from '../../../../src/engine/contracts';
import type { SessionTemplate, PlannedItem } from '../../../../src/domain/v8/contracts';
import { Rules } from '../../../../src/engine/data';
import { independentActualStrengthRole } from './training-engine-strength-role';
import { independentlyPossibleIds, matches, postpartumPhase } from '../../../../tools/eval/training-engine-quality';
const rules = new Rules();
/** No target parser or production dose/timing helper is reachable from this module. */
export function independentSourceRampSeconds(items: PlannedItem[], profile: EngineProfile, minutes: number): number[] {
  const protocol = rules.get('session.warmup.ramp_sets'),
    timing = rules.get('duration.ramp.sets'),
    firstTier = rules.get('duration.capacity.table').sessions.find((row: { ramp_s: number }) => row.ramp_s > 0).minutes,
    setup = rules.get('duration.transition.setup').setup_s_defaults;
  const template: SessionTemplate = { id: 'source-replay', name: '', estimatedMinutes: minutes, items };
  let firstLoaded = false;
  return items.map(item => {
    const e = rules.byExercise.get(item.exerciseId),
      p = item.prescription;
    if (
      !e ||
      !p ||
      !['main', 'accessory'].includes(p.block) ||
      e.modality !== 'strength' ||
      e.nsca_class !== 'compound'
    )
      return 0;
    const loaded = item.target.metricType === 'reps_load' && e.time.setup_s >= setup.dumbbell_kettlebell_band;
    if (loaded && minutes >= firstTier) {
      if (!firstLoaded) {
        firstLoaded = true;
        return timing.first_loaded_compound.ramp_s;
      }
      if (e.time.setup_s === setup.barbell) return timing.later_barbell_compound.ramp_s;
    }
    if (
      !authoredBodyweightMain(item, template, profile, minutes) ||
      !e.equipment_required.every(value => value === 'none') ||
      !('reps' in item.target)
    )
      return 0;
    const reps = Math.ceil(item.target.reps * protocol.bodyweight_main.target_rep_fraction),
      side = p.perSide || e.time.per_side ? rules.get('session.time.model').per_side_multiplier : 1,
      cadence =
        profile.goal === 'mobility' && e.modality === 'strength'
          ? Math.max(
              rules.get('goal.params.mobility').rep_duration_min_s,
              e.time.s_per_rep ?? rules.get('duration.rep.seconds').default_if_unknown,
            )
          : (e.time.s_per_rep ?? rules.get('duration.rep.seconds').default_if_unknown);
    return (
      protocol.bodyweight_main.sets * (reps * cadence * side + rules.get('duration.set.overhead').overhead_s_per_set)
    );
  });
}

/** Certify only the raw matrix's active/asymptomatic CMR branch, without clearance inference. */
function activeCmrSource(profile: EngineProfile, age: number | undefined): boolean {
  const s = profile.screening,
    known = s.knownCmrDisease ?? s.knownCondition ?? false,
    pop = profile.population;
  if (
    !known ||
    s.clearance ||
    s.activityStatus !== 'active' ||
    s.symptoms !== false ||
    s.acuteIllness ||
    s.redFlagReview ||
    s.rescreenRequired ||
    s.restingBp !== 'known_below_threshold' ||
    age === undefined ||
    !Number.isFinite(age) ||
    age < rules.get('safety.scope.age_min').age_min_years ||
    !['general', 'pregnant'].includes(pop.kind)
  )
    return false;
  if (
    !Array.isArray(s.parqAnswers) ||
    s.parqAnswers.length !== rules.get('safety.screen.parq').parq_questions.length ||
    !s.parqAnswers.every(answer => answer === false)
  )
    return false;
  const raw = s.completedAt ?? s.lastScreenedAt,
    asOf = profile.asOfDate;
  if (!raw || !asOf || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return false;
  try {
    const instant = new Date(raw);
    if (!Number.isFinite(instant.getTime())) return false;
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: profile.timeZone ?? 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(instant),
      part = (type: string) => parts.find(p => p.type === type)!.value,
      day = `${part('year')}-${part('month')}-${part('day')}`;
    const [y, m, d] = day.split('-').map(Number),
      expiry = new Date(Date.UTC(y, m - 1 + rules.get('safety.rescreen.interval').interval_months, 1));
    expiry.setUTCDate(
      Math.min(d, new Date(Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth() + 1, 0)).getUTCDate()),
    );
    if (day > asOf || asOf >= expiry.toISOString().slice(0, 10)) return false;
  } catch {
    return false;
  }
  if (pop.kind === 'pregnant') {
    if (
      !Number.isFinite(pop.week) ||
      !pop.providerCleared ||
      !pop.contraindicationsConfirmedNone ||
      pop.absoluteContraindications?.length ||
      pop.relativeContraindications?.length
    )
      return false;
    const reconfirm = rules.get('pregnancy.reconfirm');
    if (
      [...reconfirm.full_reconfirm_at_weeks, reconfirm.ask_placenta_praevia_item_at_week].some(
        (w: number) => pop.week >= w && (pop.lastScreenedWeek ?? -1) < w,
      )
    )
      return false;
  }
  const step = rules
    .get('safety.clearance.matrix')
    .steps.find(
      (step: { when?: { known_cmr_disease?: boolean; activity_status?: string; symptomatic?: boolean } }) =>
        step.when?.known_cmr_disease === true &&
        step.when.activity_status === 'active' &&
        step.when.symptomatic === false,
    );
  const cap =
    pop.kind === 'pregnant'
      ? Math.min(step?.set.max_rpe_0_10 ?? 0, rules.get('pregnancy.intensity').rpe_0_10.max)
      : step?.set.max_rpe_0_10;
  // Target reconstruction uses the source's moderate quota, never vigorous/HIIT.
  return (
    step?.set.plan_lock === false &&
    step.set.hiit === 'locked' &&
    cap >= rules.get('aerobic.intensity.rpe_scale').moderate[1]
  );
}
/** Exact reconstruction is deliberately refused when a separate medical state machine is needed. */
export function independentWarmupPool(profile: EngineProfile) {
  const birth = profile.birthYearMonth?.split('-').map(Number),
    day = profile.asOfDate?.split('-').map(Number),
    age = birth && day ? day[0] - birth[0] - (day[1] < birth[1] ? 1 : 0) : profile.ageYears;
  const known = profile.screening.knownCmrDisease ?? profile.screening.knownCondition ?? false,
    cmr = known && activeCmrSource(profile, age);
  if (
    profile.screening.parqAnswers?.some(Boolean) ||
    profile.screening.redFlagReview ||
    (known && !cmr) ||
    profile.screening.symptoms ||
    profile.screening.acuteIllness ||
    (profile.population.kind === 'general' &&
      age !== undefined &&
      age >= rules.get('older.activation').trigger.any[0].gte)
  )
    return undefined;
  const possible = new Set(independentlyPossibleIds(profile)),
    pop = profile.population,
    phase = postpartumPhase(profile),
    cautious = pop.kind === 'older_adult' && (pop.balanceCautious || pop.walkingAid || pop.fallsAnswers?.some(Boolean)),
    user = {
      postpartum_phase: phase,
      balance_cautious: cautious,
      walking_aid: pop.kind === 'older_adult' && pop.walkingAid,
    };
  return rules.data.exercises.filter(e => {
    if (!possible.has(e.id)) return false;
    if (cmr) {
      const restricted = rules.get('safety.clearance.restricted_mode');
      if (
        restricted.exclude_modality.includes(e.modality) ||
        restricted.exclude_flags.some((flag: string) => e.flags.includes(flag))
      )
        return false;
    }
    if (
      profile.screening.restingBp !== 'known_below_threshold' &&
      rules.get('safety.hypertension.limits').exclude_flags.some((flag: string) => e.flags.includes(flag))
    )
      return false;
    if (pop.kind === 'older_adult') {
      const base = rules.get('older.exclude.base'),
        balance = rules.get('older.exclude.balance_cautious');
      if (
        ((!base.when || matches(base.when, e, user)) && matches(base.exclude_if, e, user)) ||
        matches(base.default_low_impact.exclude_if, e, user)
      )
        return false;
      if (
        cautious &&
        (((!balance.when || matches(balance.when, e, user)) && matches(balance.exclude_if, e, user)) ||
          e.requires_floor_transition ||
          matches(rules.get('older.floor.transitions').floor_based_if, e, user))
      )
        return false;
      if (pop.boneFlag && matches(rules.get('older.bone').until_clearance_exclude_if, e, user)) return false;
    }
    if (pop.kind === 'postpartum' && phase < 3) {
      const limit = rules.get('postpartum.exclude.pre_phase3');
      if ((!limit.when || matches(limit.when, e, user)) && matches(limit.exclude_if, e, user)) return false;
      if (
        phase === 2 &&
        e.modality !== 'mobility' &&
        e.difficulty > rules.get('postpartum.phase2').strength_limits.difficulty_max
      )
        return false;
    }
    if (
      pop.kind === 'postpartum' &&
      !pop.readinessChecklistPassed &&
      (e.flags.some(flag => flag === 'running' || flag === 'jumping') || e.impact >= 2 || e.modality === 'plyometric')
    )
      return false;
    return true;
  });
}
function sourceMainPosition(item: PlannedItem, template: SessionTemplate): string | undefined {
  const raw = item.prescription?.sourcePosition;
  if (!raw) return;
  if (/^main_[1-9]\d*$/.test(raw)) return raw;
  if (!/^day-[a-f0-9]{8}$/.test(template.id) || !raw.startsWith(template.id + '-')) return;
  return /-main_[1-9]\d*$/.test(raw) ? raw.split('-').at(-1) : undefined;
}
export function authoredBodyweightMain(
  item: PlannedItem,
  template: SessionTemplate,
  profile: EngineProfile,
  minutes: number,
): boolean {
  const p = item.prescription,
    pos = sourceMainPosition(item, template);
  if (
    !p ||
    !pos ||
    !/^main_[1-9]\d*$/.test(pos) ||
    (profile.goal === 'strength' && independentActualStrengthRole(item) !== 'main')
  )
    return false;
  const duration = rules.get('session.durations.allowed'),
    allowed = duration.minutes.filter((n: number) => n <= minutes).at(-1) ?? duration.minutes[0],
    tier = profile.level === 'beginner' && allowed === 90 ? duration.min90_beginner_fallback : allowed,
    recipe = rules.get(`session.template.min${tier}`),
    container = recipe.slots.find((s: { from_pos?: string[] }) => s.from_pos?.includes(pos));
  if (!container || (container.block === 'core' ? 'accessory' : container.block) !== p.block) return false;
  if (p.sourcePosition !== pos && p.sourcePosition !== template.id + '-' + container.slot + '-' + pos) return false;
  const tagged = template.items.filter(i => sourceMainPosition(i, template) !== undefined);
  if (
    tagged.some((i, n) =>
      tagged.slice(0, n).some(other => sourceMainPosition(other, template) === sourceMainPosition(i, template)),
    )
  )
    return false;
  const goal = rules.get(`goal.params.${profile.goal}`),
    days = new Set<string>();
  for (const rule of rules.data.rules) {
    const match = rule.id.match(/^week\.template\.rt(\d+)$/);
    if (!match || Number(match[1]) > Math.min(profile.daysPerWeek, goal.rt_sessions_week.max)) continue;
    const value = rule.value!,
      variants = (value.variants ?? []).filter(
        (v: { when?: { session_minutes_min?: number; session_minutes_max?: number } }) =>
          !v.when ||
          (v.when.session_minutes_min !== undefined && minutes >= v.when.session_minutes_min) ||
          (v.when.session_minutes_max !== undefined && minutes <= v.when.session_minutes_max),
      );
    for (const day of [value.rotation, ...variants.map((v: { rotation?: unknown }) => v.rotation)].flat(Infinity))
      if (typeof day === 'string') days.add(day);
  }
  return [...days].some(day => {
    const source = rules.get(`week.day.${day}`);
    return tagged.every(i =>
      source.slots.some(
        (slot: { pos?: string; pattern?: string[] }) =>
          slot.pos === sourceMainPosition(i, template) &&
          slot.pattern?.includes(rules.byExercise.get(i.exerciseId)?.primary_pattern ?? ''),
      ),
    );
  });
}
