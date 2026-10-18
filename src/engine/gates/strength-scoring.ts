import { applyStrengthScoringPopulation } from "./strength-scoring-population";
import type {
  EngineProfile,
  GateResult,
  EngineNotice,
  RuleTrace,
  GateState,
} from "../contracts";
import { cautionSchema } from "../contracts";
import {
  Rules,
  age,
  calendarDay,
  addCalendarMonths,
  type RuleValue,
} from "../data";

export type SafetyState = GateState;
/** All dates are caller supplied. Missing answers never become negative medical answers. */
export function safety(profile: EngineProfile, rules: Rules): SafetyState {
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
  const screenDate = screening?.completedAt ?? screening?.lastScreenedAt;
  const timeZone =
    (profile as EngineProfile & { timeZone?: string }).timeZone ?? "UTC";
  const screenedDay = screenDate
    ? calendarDay(screenDate, timeZone)
    : undefined;
  const review = (
    screening as typeof screening & {
      redFlagReview?: {
        requiredAt: string;
        questionKeys: string[];
        areas: string[];
        answeredAt?: string;
        answers?: Record<string, boolean>;
        professionalSeenAt?: string;
      };
    }
  )?.redFlagReview;
  let professionalSeen = false;
  let redFlagCautions: string[] = [];
  let resumedCautionLevel = 0;
  const repeatReferral = profile.painState?.some(
    (pain) =>
      (pain.repeatEvents ?? 0) >= rules.get("pain.repeat_referral").when.gte,
  );
  if (review) {
    const joint = rules.get("redflag.joint_any"),
      back = rules.get("redflag.back"),
      shoulder = rules.get("redflag.shoulder");
    const knownAreas: readonly string[] = cautionSchema.options;
    const areas = Array.isArray(review.areas) ? review.areas : [];
    const expected: string[] = [
      ...joint.items,
      ...(areas.includes("back")
        ? [...back.emergency_items, ...back.urgent_items]
        : []),
      ...(areas.includes("shoulder")
        ? [...shoulder.cardiac_route_items, ...shoulder.prompt_medical_items]
        : []),
    ];
    const requiredDay = calendarDay(review.requiredAt, timeZone),
      answeredDay = review.answeredAt
        ? calendarDay(review.answeredAt, timeZone)
        : undefined;
    const questionKeys = Array.isArray(review.questionKeys)
      ? review.questionKeys
      : [];
    const answers = review.answers;
    const complete =
      !!answers &&
      Array.isArray(review.areas) &&
      areas.length > 0 &&
      areas.every((area) => knownAreas.includes(area)) &&
      questionKeys.length === expected.length &&
      new Set(questionKeys).size === questionKeys.length &&
      expected.every(
        (key) =>
          questionKeys.includes(key) && typeof answers[key] === "boolean",
      ) &&
      Object.keys(answers).length === expected.length;
    const latestAnswers =
      typeof review.requiredAt === "string" &&
      review.requiredAt.includes("T") &&
      !!review.answeredAt?.includes("T") &&
      Date.parse(review.answeredAt) >= Date.parse(review.requiredAt);
    const current =
      latestAnswers &&
      !!requiredDay &&
      !!answeredDay &&
      !!profile.asOfDate &&
      requiredDay <= answeredDay &&
      answeredDay <= profile.asOfDate &&
      profile.asOfDate <
        addCalendarMonths(
          answeredDay,
          rules.get("redflag.screen").rescreen_interval_months,
        );
    if (!complete || !current)
      gate(
        "redflag.screen",
        "blocked",
        "redflag_review_incomplete_or_invalid",
        "redflag.copy.paused_banner",
      );
    else {
      const seenDay = review.professionalSeenAt
        ? calendarDay(review.professionalSeenAt, timeZone)
        : undefined;
      professionalSeen =
        !!seenDay &&
        !!review.professionalSeenAt?.includes("T") &&
        Date.parse(review.professionalSeenAt) >=
          Date.parse(review.requiredAt) &&
        Date.parse(review.professionalSeenAt) >=
          Date.parse(review.answeredAt!) &&
        seenDay >= requiredDay! &&
        seenDay >= answeredDay! &&
        seenDay <= profile.asOfDate!;
      const positive = expected.filter((key) => answers![key]);
      if (positive.length && !professionalSeen) {
        const emergency = positive.some((key) =>
          back.emergency_items.includes(key),
        );
        const cardiac = positive.some((key) =>
          shoulder.cardiac_route_items.includes(key),
        );
        const backPositive = positive.some(
          (key) =>
            back.emergency_items.includes(key) ||
            back.urgent_items.includes(key),
        );
        const shoulderPositive = positive.some(
          (key) =>
            shoulder.cardiac_route_items.includes(key) ||
            shoulder.prompt_medical_items.includes(key),
        );
        gate(
          emergency
            ? "redflag.back"
            : cardiac
              ? "redflag.shoulder"
              : backPositive
                ? "redflag.back"
                : shoulderPositive
                  ? "redflag.shoulder"
                  : "redflag.joint_any",
          "blocked",
          "positive_redflag_requires_professional_confirmation",
          emergency
            ? "redflag.copy.emergency_back"
            : cardiac
              ? "redflag.copy.cardiac"
              : "redflag.copy.prompt_medical",
        );
      } else if (positive.length) {
        redFlagCautions = areas;
        resumedCautionLevel = rules.get(
          "redflag.after_clearance",
        ).resume_caution_level;
        state.maxRpe = Math.min(
          state.maxRpe,
          rules.get("safety.clearance.restricted_mode").max_rpe_0_10,
        );
        rules.trace(
          state.trace,
          "redflag.after_clearance",
          "professional_confirmation_for_current_review",
        );
      } else gate("redflag.screen", "pass", "explicit_current_redflag_answers");
    }
  } else if (repeatReferral)
    gate(
      "redflag.screen",
      "blocked",
      "repeated_pain_requires_explicit_redflag_review",
      "redflag.copy.paused_banner",
    );
  if (repeatReferral)
    rules.notice(state.notices, "pain.copy.referral", "warning");
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
  if (!completed) gate("safety.screen.parq", "blocked", "screening_incomplete");
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
  const activity = screening?.activityStatus ?? "inactive";
  const parq = screening?.parqAnswers;
  const anyYes = parq?.some(Boolean) ?? !screening?.parqAllNo;
  const bp = screening?.restingBp ?? "unknown";
  let clearance = "none_needed";
  const matrix = rules.get("safety.clearance.matrix");
  const knownCmr =
    screening?.knownCmrDisease ?? screening?.knownCondition ?? false;
  const hard = !!screening?.symptoms || !!parq?.[1] || !!parq?.[2];
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
  if (hard && (!clearanceConfirmed || screening?.symptoms)) {
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
  if (clearanceConfirmed && !screening?.symptoms) {
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
  if (activity === "inactive")
    state.maxRpe = Math.min(
      state.maxRpe,
      rules.get("aerobic.intensity.rpe_scale").moderate[1],
    );
  if (screening?.acuteIllness)
    gate(
      "safety.screen.temporary_illness",
      "blocked",
      "acute_illness",
      "safety.copy.illness_pause",
    );
  state.rirMin = Math.max(0, 10 - state.maxRpe);
  applyStrengthScoringPopulation(profile, rules, state, gate, pop, population);
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
  rules.trace(
    state.trace,
    "meta.conflict.precedence",
    "safety_population_caution_dose_duration",
  );
  return state;
}
