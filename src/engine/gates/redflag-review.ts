import { cautionSchema } from '../contracts';
import type { EngineProfile, GateState, GateResult } from '../contracts';
import { Rules, calendarDay, addCalendarMonths } from '../data';
type Gate = (id: string, status: GateResult['status'], reason: string, copy?: string) => void;
export function reviewRedFlags(profile: EngineProfile, rules: Rules, state: GateState, gate: Gate) {
  const screening = profile.screening;
  const screenDate = screening?.completedAt ?? screening?.lastScreenedAt;
  const timeZone = (profile as EngineProfile & { timeZone?: string }).timeZone ?? 'UTC';
  const screenedDay = screenDate ? calendarDay(screenDate, timeZone) : undefined;
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
  const unreviewed = profile.cautions.filter(
    joint => joint !== 'other' && !(profile.cautionLevels?.[joint] ?? 0) && !review?.areas.includes(joint),
  );
  if (unreviewed.length)
    gate('caution.activation', 'blocked', 'explicit_joint_redflag_answers_required', 'redflag.copy.paused_banner');
  const repeatReferral = profile.painState?.some(
    pain => (pain.repeatEvents ?? 0) >= rules.get('pain.repeat_referral').when.gte,
  );
  if (review) {
    const joint = rules.get('redflag.joint_any'),
      back = rules.get('redflag.back'),
      shoulder = rules.get('redflag.shoulder');
    const knownAreas: readonly string[] = cautionSchema.options;
    const areas = Array.isArray(review.areas) ? review.areas : [];
    const expected: string[] = [
      ...joint.items,
      ...(areas.includes('back') ? [...back.emergency_items, ...back.urgent_items] : []),
      ...(areas.includes('shoulder') ? [...shoulder.cardiac_route_items, ...shoulder.prompt_medical_items] : []),
    ];
    const requiredDay = calendarDay(review.requiredAt, timeZone),
      answeredDay = review.answeredAt ? calendarDay(review.answeredAt, timeZone) : undefined;
    const questionKeys = Array.isArray(review.questionKeys) ? review.questionKeys : [];
    const answers = review.answers;
    const complete =
      !!answers &&
      Array.isArray(review.areas) &&
      areas.length > 0 &&
      areas.every(area => knownAreas.includes(area)) &&
      questionKeys.length === expected.length &&
      new Set(questionKeys).size === questionKeys.length &&
      expected.every(key => questionKeys.includes(key) && typeof answers[key] === 'boolean') &&
      Object.keys(answers).length === expected.length;
    const latestAnswers =
      typeof review.requiredAt === 'string' &&
      review.requiredAt.includes('T') &&
      !!review.answeredAt?.includes('T') &&
      Date.parse(review.answeredAt) >= Date.parse(review.requiredAt);
    const current =
      latestAnswers &&
      !!requiredDay &&
      !!answeredDay &&
      !!profile.asOfDate &&
      requiredDay <= answeredDay &&
      answeredDay <= profile.asOfDate &&
      profile.asOfDate < addCalendarMonths(answeredDay, rules.get('redflag.screen').rescreen_interval_months);
    if (!complete || !current)
      gate('redflag.screen', 'blocked', 'redflag_review_incomplete_or_invalid', 'redflag.copy.paused_banner');
    else {
      const seenDay = review.professionalSeenAt ? calendarDay(review.professionalSeenAt, timeZone) : undefined;
      professionalSeen =
        !!seenDay &&
        !!review.professionalSeenAt?.includes('T') &&
        Date.parse(review.professionalSeenAt) >= Date.parse(review.requiredAt) &&
        Date.parse(review.professionalSeenAt) >= Date.parse(review.answeredAt!) &&
        seenDay >= requiredDay! &&
        seenDay >= answeredDay! &&
        seenDay <= profile.asOfDate!;
      const positive = expected.filter(key => answers![key]);
      if (positive.length && !professionalSeen) {
        const emergency = positive.some(key => back.emergency_items.includes(key));
        const cardiac = positive.some(key => shoulder.cardiac_route_items.includes(key));
        const backPositive = positive.some(
          key => back.emergency_items.includes(key) || back.urgent_items.includes(key),
        );
        const shoulderPositive = positive.some(
          key => shoulder.cardiac_route_items.includes(key) || shoulder.prompt_medical_items.includes(key),
        );
        gate(
          emergency
            ? 'redflag.back'
            : cardiac
              ? 'redflag.shoulder'
              : backPositive
                ? 'redflag.back'
                : shoulderPositive
                  ? 'redflag.shoulder'
                  : 'redflag.joint_any',
          'blocked',
          'positive_redflag_requires_professional_confirmation',
          emergency ? 'redflag.copy.emergency_back' : cardiac ? 'redflag.copy.cardiac' : 'redflag.copy.prompt_medical',
        );
      } else if (positive.length) {
        redFlagCautions = areas;
        resumedCautionLevel = rules.get('redflag.after_clearance').resume_caution_level;
        state.maxRpe = Math.min(state.maxRpe, rules.get('safety.clearance.restricted_mode').max_rpe_0_10);
        rules.trace(state.trace, 'redflag.after_clearance', 'professional_confirmation_for_current_review');
      } else gate('redflag.screen', 'pass', 'explicit_current_redflag_answers');
    }
  } else if (repeatReferral)
    gate('redflag.screen', 'blocked', 'repeated_pain_requires_explicit_redflag_review', 'redflag.copy.paused_banner');
  if (repeatReferral) rules.notice(state.notices, 'pain.copy.referral', 'warning');
  return {
    screenDate,
    timeZone,
    screenedDay,
    professionalSeen,
    redFlagCautions,
    resumedCautionLevel,
  };
}
