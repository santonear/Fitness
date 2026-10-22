import { reviewRedFlags } from "./redflag-review";
import { applyPopulationLimits } from "./population-limits";
import type { EngineProfile, GateResult, GateState } from "../contracts";

import { Rules, age, calendarDay, addCalendarMonths } from "../data";

type SafetyState = GateState;
export interface GateStateOptions {
  /**
   * Legacy source-scoring view read only by progression/legacy-* (via gates/strength-scoring).
   * It reproduces the safety state those source targets were built against: no fall/urgent
   * pause, caution activation, CMR symptom, vigorous unlock, age-45 advisory or HIIT unlock
   * gates, no postpartum regression or phase-1 walking cap, and no PAR-Q notice copy.
   * tests/unit/engine/gate-state-legacy-scoring.test.ts pins the exact gap.
   */
  legacyScoring?: boolean;
}
/** All dates are caller supplied. Missing answers never become negative medical answers. */
export function gateState(
  profile: EngineProfile,
  rules: Rules,
  { legacyScoring = false }: GateStateOptions = {},
): SafetyState {
  const a = age(profile);
  const pop = profile.population;
  const screening = profile.screening;
  const population =
    pop.kind === "general" &&
    a !== undefined &&
    a >= rules.get("older.activation").trigger.any[0].gte
      ? "older_adult"
      : pop.kind;
  const state: SafetyState = {
    blocked: false,
    gates: [],
    notices: [],
    trace: [],
    user: {},
    maxRpe: 10,
    rirMin: 0,
    phase: 0,
    population,
    eligibility: new Map(),
  };
  const gate = (
    id: string,
    status: GateResult["status"],
    reason: string,
    copy?: string,
  ) => {
    state.gates.push({
      ruleId: id,
      status,
      reason,
      ...(copy ? { noticeCode: copy } : {}),
    });
    if (status === "blocked") state.blocked = true;
    rules.trace(state.trace, id, reason);
    if (copy)
      rules.notice(
        state.notices,
        copy,
        status === "blocked" ? "stop" : "warning",
      );
  };
  if (!legacyScoring && profile.olderSafety?.fallPaused)
    gate("older.stop.trigger", "blocked", "fall_professional_review_pending");
  if (!legacyScoring && profile.postpartumSafety?.urgentPaused)
    gate(
      "postpartum.urgent",
      "blocked",
      "urgent_professional_review_pending",
      "postpartum.copy.urgent.urgent",
    );
  const {
    screenDate,
    timeZone,
    screenedDay,
    professionalSeen,
    redFlagCautions,
    resumedCautionLevel,
  } = reviewRedFlags(profile, rules, state, gate, legacyScoring);
  const completed =
    !!screenDate &&
    !!screening &&
    Array.isArray(screening.parqAnswers) &&
    screening.parqAnswers.length ===
      rules.get("safety.screen.parq").parq_questions.length &&
    screening.parqAnswers.every((answer) => typeof answer === "boolean");
  if (a === undefined || !Number.isFinite(a))
    gate("safety.scope.age_min", "blocked", "age_missing");
  else if (a < rules.get("safety.scope.age_min").age_min_years)
    gate(
      "safety.scope.age_min",
      "blocked",
      "under_minimum_age",
      "safety.copy.under_18",
    );
  else gate("safety.scope.age_min", "pass", "adult_age_supplied");
  if (!completed)
    gate(
      "safety.screen.parq",
      "blocked",
      "screening_incomplete",
      legacyScoring ? undefined : "safety.copy.screening_required",
    );
  else gate("safety.screen.parq", "pass", "screening_explicitly_completed");
  if (!profile.asOfDate)
    gate("safety.rescreen.interval", "blocked", "reference_date_missing");
  else if (screenDate) {
    const months = rules.get("safety.rescreen.interval").interval_months;
    const day = screenedDay;
    if (
      !day ||
      profile.asOfDate >= addCalendarMonths(day, months) ||
      screening.rescreenRequired ||
      day > profile.asOfDate
    )
      gate("safety.rescreen.interval", "blocked", "rescreen_required");
  }
  let currentSymptoms = !!screening?.symptoms;
  if (!legacyScoring) {
    const cmrKeys = rules.get("safety.screen.cmr_symptoms")
      .symptoms as string[];
    const cmrComplete = cmrKeys.every(
      (key) => typeof screening.cmrSymptoms?.[key] === "boolean",
    );
    currentSymptoms =
      !!screening.symptoms ||
      cmrKeys.some((key) => screening.cmrSymptoms?.[key] === true);
    gate(
      "safety.screen.cmr_symptoms",
      cmrComplete ? "pass" : "blocked",
      cmrComplete ? "cmr_answers_complete" : "screening_incomplete",
      cmrComplete ? undefined : "safety.copy.screening_required",
    );
  }
  const activity = screening?.activityStatus ?? "inactive";
  const parq = screening?.parqAnswers;
  const anyYes = parq?.some(Boolean) ?? !screening?.parqAllNo;
  const bp = screening?.restingBp ?? "unknown";
  let clearance = "none_needed";
  const matrix = rules.get("safety.clearance.matrix");
  const knownCmr =
    screening?.knownCmrDisease ?? screening?.knownCondition ?? false;
  const hard = currentSymptoms || !!parq?.[1] || !!parq?.[2];
  let clearanceConfirmed = false;
  if (screening?.clearance && profile.asOfDate) {
    const day = calendarDay(screening.clearance.date, timeZone);
    clearanceConfirmed =
      !!day &&
      !!screenedDay &&
      day >= screenedDay &&
      profile.asOfDate <
        addCalendarMonths(
          day,
          rules.get("safety.clearance.confirm").valid_months_max,
        ) &&
      day <= profile.asOfDate;
  }
  if (hard && (!clearanceConfirmed || currentSymptoms)) {
    clearance = "hard_stop";
    gate(
      "safety.clearance.hard_stop",
      "blocked",
      "symptoms_or_chest_pain_or_syncope",
      "safety.copy.clearance_needed",
    );
  } else if (knownCmr && activity === "inactive" && !clearanceConfirmed) {
    clearance = "required";
    gate(
      "safety.clearance.matrix",
      "blocked",
      "inactive_known_cmr",
      "safety.copy.clearance_needed",
    );
  } else if (knownCmr && activity === "active" && !clearanceConfirmed) {
    clearance = "required";
    state.maxRpe = matrix.steps[2].set.max_rpe_0_10;
    gate(
      "safety.clearance.matrix",
      "restricted",
      "active_known_cmr",
      "safety.copy.clearance_needed",
    );
  } else if (
    (anyYes || bp !== "known_below_threshold") &&
    !clearanceConfirmed
  ) {
    clearance = "required";
    state.maxRpe = rules.get("safety.clearance.restricted_mode").max_rpe_0_10;
    gate(
      "safety.clearance.restricted_mode",
      "restricted",
      "parq_or_bp_restriction",
      "safety.copy.clearance_needed",
    );
  }
  if (clearanceConfirmed && !currentSymptoms) {
    clearance = "confirmed";
    const intensity = screening.clearance!.intensity;
    state.maxRpe = Math.min(
      state.maxRpe,
      intensity === "vigorous"
        ? rules.get("aerobic.intensity.rpe_scale").vigorous[1]
        : intensity === "moderate"
          ? rules.get("aerobic.intensity.rpe_scale").moderate[1]
          : rules.get("safety.clearance.restricted_mode").max_rpe_0_10,
    );
    gate("safety.clearance.confirm", "pass", "current_user_attestation");
  }
  let inactiveVigorousReady = false;
  if (!legacyScoring) {
    const vigorousUnlock = rules.get("safety.unlock.vigorous"),
      regularWeeks = screening.activityEvidence;
    const inactiveWeeks =
      vigorousUnlock.unlock_vigorous_after_regular_weeks.inactive;
    inactiveVigorousReady =
      (regularWeeks?.consecutiveRegularWeeks ?? -1) >= inactiveWeeks &&
      (!vigorousUnlock.requires_no_symptoms ||
        (!currentSymptoms &&
          (regularWeeks?.noSymptomReportsWeeks ?? -1) >= inactiveWeeks));
  }
  if (activity === "inactive" && !inactiveVigorousReady)
    state.maxRpe = Math.min(
      state.maxRpe,
      rules.get("aerobic.intensity.rpe_scale").moderate[1],
    );
  if (!legacyScoring && activity === "inactive")
    gate(
      "safety.unlock.vigorous",
      inactiveVigorousReady ? "pass" : "restricted",
      inactiveVigorousReady
        ? "regular_week_evidence_complete"
        : "regular_week_evidence_missing",
    );
  let advisoryRequired = false,
    advisoryAcked = false;
  if (!legacyScoring) {
    const advisory = rules.get("safety.age45.vigorous_advisory");
    advisoryRequired =
      a !== undefined &&
      a >= advisory.age_min_years &&
      ((advisory.when_any.includes("activity_status_inactive") &&
        activity === "inactive") ||
        (advisory.when_any.includes("self_report_rarely_vigorous") &&
          screening.rarelyVigorous !== false));
    const ack = screening.age45AdvisoryAck;
    advisoryAcked =
      !!ack &&
      !!screenDate &&
      ack.screenedAt === screenDate &&
      Date.parse(ack.acknowledgedAt) >= Date.parse(screenDate) &&
      !!profile.asOfDate &&
      calendarDay(ack.acknowledgedAt, timeZone) !== undefined &&
      calendarDay(ack.acknowledgedAt, timeZone)! <= profile.asOfDate &&
      !screening.rescreenRequired;
    if (advisoryRequired && !advisoryAcked) {
      state.maxRpe = Math.min(
        state.maxRpe,
        rules.get("aerobic.intensity.rpe_scale").moderate[1],
      );
      gate(
        "safety.age45.vigorous_advisory",
        "restricted",
        "advisory_ack_required",
        advisory.show_copy,
      );
    }
  }
  if (screening?.acuteIllness)
    gate(
      "safety.screen.temporary_illness",
      "blocked",
      "acute_illness",
      "safety.copy.illness_pause",
    );
  applyPopulationLimits(profile, rules, state, gate, legacyScoring);
  state.user = {
    population,
    age: a,
    activity_status: activity,
    clearance_state: clearance,
    hypertension: bp === "known_below_threshold" ? "controlled" : "unknown",
    caution_selfreport: profile.cautions,
    equipment: profile.equipment.map((e) =>
      e === "dumbbell"
        ? "dumbbells"
        : e === "pushup-handles"
          ? "pushup_handles"
          : e,
    ),
    gestation_week: pop.kind === "pregnant" ? pop.week : undefined,
    provider_confirmed: pop.kind === "pregnant" && pop.providerCleared,
    postpartum_phase: state.phase,
    postpartum_week:
      pop.kind === "postpartum" ? pop.weeksSinceBirth : undefined,
    postnatal_cleared: pop.kind === "postpartum" && pop.cleared,
    delivery:
      pop.kind === "postpartum"
        ? pop.delivery === "cesarean"
          ? "caesarean"
          : pop.delivery === "assisted_or_tear"
            ? "assisted"
            : "vaginal"
        : undefined,
    balance_cautious:
      pop.kind === "older_adult" &&
      (pop.balanceCautious ||
        pop.walkingAid ||
        pop.fallsAnswers?.some(Boolean)),
    walking_aid: pop.kind === "older_adult" && pop.walkingAid,
    advanced_opt_in: false,
    prepregnancy_running: false,
    running_comfortable_and_provider_agrees: false,
    professional_seen: professionalSeen,
    redflag_cautions: redFlagCautions,
    redflag_caution_level: resumedCautionLevel,
  };
  if (!legacyScoring) {
    const hiit = rules.get("hiit.gate.unlock"),
      evidence = screening.activityEvidence;
    const requirement = (key: string) =>
      hiit.all_of.find((entry: Record<string, unknown>) => key in entry)?.[key];
    const normalizedClearance =
      clearance === "confirmed" && screening.clearance?.intensity === "vigorous"
        ? "confirmed_vigorous"
        : clearance;
    const hiitUnlocked =
      !state.blocked &&
      requirement("clearance_state_in").includes(normalizedClearance) &&
      state.maxRpe >=
        rules.get("aerobic.intensity.rpe_scale")[
          requirement("max_intensity")
        ][1] &&
      (evidence?.consecutiveRegularWeeks ?? -1) >=
        requirement("consecutive_regular_weeks_min") &&
      (evidence?.noSymptomReportsWeeks ?? -1) >=
        requirement("no_symptom_reports_weeks") &&
      (!advisoryRequired || advisoryAcked) &&
      !currentSymptoms &&
      population !== "pregnant" &&
      population !== "postpartum";
    const balanceRule = rules.get("older.balance.progression");
    state.user.balance_stage = Math.min(
      profile.olderSafety?.balanceStage ?? balanceRule.stages[0].stage,
      state.user.balance_cautious
        ? balanceRule.max_stage_if_balance_cautious
        : balanceRule.stages.at(-1).stage,
    );
    Object.assign(state.user, {
      age45_advisory_required: advisoryRequired,
      age45_advisory_acked: !advisoryRequired || advisoryAcked,
      hiit_unlocked: hiitUnlocked,
    });
    gate(
      "hiit.gate.unlock",
      hiitUnlocked ? "pass" : "restricted",
      hiitUnlocked
        ? "source_unlock_evidence_complete"
        : "source_unlock_evidence_missing",
    );
  }
  rules.trace(
    state.trace,
    "meta.conflict.precedence",
    "safety_population_caution_dose_duration",
  );
  return state;
}
