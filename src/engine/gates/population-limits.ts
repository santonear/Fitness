import type { EngineProfile, GateState, GateResult } from '../contracts';
import { Rules } from '../data';
type Gate = (id: string, status: GateResult['status'], reason: string, copy?: string) => void;
export function applyPopulationLimits(
  profile: EngineProfile,
  rules: Rules,
  state: GateState,
  gate: Gate,
  legacyScoring = false,
) {
  const population = state.population,
    pop = profile.population;
  state.rirMin = Math.max(0, 10 - state.maxRpe);
  if (population === 'pregnant' && pop.kind === 'pregnant') {
    if (rules.get('pregnancy.gate.provider').regular_prenatal_checkups_required && pop.prenatalCareConfirmed !== true)
      gate(
        'pregnancy.gate.provider',
        'blocked',
        'prenatal_care_confirmation_missing',
        'pregnancy.gate.copy.ask_provider',
      );
    if (!pop.providerCleared)
      gate('pregnancy.gate.provider', 'blocked', 'provider_confirmation_missing', 'pregnancy.gate.copy.ask_provider');
    if (!pop.contraindicationsConfirmedNone || pop.absoluteContraindications?.length)
      gate(
        'pregnancy.gate.absolute',
        'blocked',
        'contraindications_not_confirmed_absent',
        'pregnancy.gate.copy.absolute_yes',
      );
    if (pop.relativeContraindications?.length)
      gate(
        'pregnancy.gate.relative',
        'blocked',
        'relative_condition_needs_specific_confirmation',
        'pregnancy.gate.copy.relative_yes',
      );
    const reconfirm = rules.get('pregnancy.reconfirm');
    if (
      reconfirm.full_reconfirm_at_weeks.some((w: number) => pop.week >= w && (pop.lastScreenedWeek ?? -1) < w) ||
      (pop.week >= reconfirm.ask_placenta_praevia_item_at_week &&
        (pop.lastScreenedWeek ?? -1) < reconfirm.ask_placenta_praevia_item_at_week)
    )
      gate(
        'pregnancy.reconfirm',
        'blocked',
        'pregnancy_stage_reconfirmation_required',
        'pregnancy.gate.copy.ask_provider',
      );
    state.maxRpe = Math.min(state.maxRpe, rules.get('pregnancy.intensity').rpe_0_10.max);
    state.rirMin = Math.max(state.rirMin, rules.get('pregnancy.intensity').strength_rir_min);
    rules.notice(state.notices, 'pregnancy.stop.copy.stop');
    rules.notice(state.notices, 'pregnancy.pelvic_floor.copy');
  }
  if (population === 'postpartum' && pop.kind === 'postpartum') {
    const boundaries = rules.get('postpartum.phase.boundaries');
    const buffer =
      pop.delivery === 'cesarean' || pop.delivery === 'assisted_or_tear' || pop.perinealTrauma
        ? boundaries.buffer_weeks_if.default
        : 0;
    const phase =
      pop.weeksSinceBirth >= boundaries.base_weeks.phase3_from + buffer
        ? 3
        : pop.weeksSinceBirth >= boundaries.base_weeks.phase2[0] + buffer
          ? 2
          : 1;
    state.phase = legacyScoring
      ? pop.cleared
        ? phase
        : 1
      : Math.min(pop.cleared ? phase : 1, profile.postpartumSafety?.regressedPhase ?? phase);

    if (!legacyScoring && state.phase === 1) {
      const ref = rules.get('postpartum.phase1').walking_intensity_ref;
      state.maxRpe = Math.min(state.maxRpe, rules.get(ref.rule_id)[ref.field]);
      state.rirMin = Math.max(state.rirMin, 10 - state.maxRpe);
    }
    if (!pop.cleared)
      gate(
        'postpartum.gate.pre_check',
        'restricted',
        'postnatal_confirmation_missing',
        'postpartum.gate.pre_check.copy',
      );
    if (state.phase < 3) state.rirMin = Math.max(state.rirMin, rules.get('postpartum.phase2').strength_limits.rir_min);
    rules.notice(state.notices, 'postpartum.copy.urgent.urgent');
    rules.notice(state.notices, 'postpartum.pelvic_floor.copy');
    if (pop.weeksSinceBirth >= rules.get('postpartum.physio_offer').show_from_week)
      rules.notice(state.notices, 'postpartum.physio_offer.offer');
  }
  if (population === 'older_adult') {
    const falls = pop.kind === 'older_adult' ? pop.fallsAnswers : undefined;
    if (!falls || falls.length !== rules.get('older.screen.falls').questions.length)
      gate('older.screen.falls', 'blocked', 'older_falls_screening_incomplete', 'older.screen.copy.intro');
    state.rirMin = Math.max(state.rirMin, rules.get('older.strength.dose').rir_min);
  }
}
