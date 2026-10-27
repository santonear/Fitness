import { capCardioItems } from './fit/cardio-cap';
import { pregnancyTargetMinutes } from './pregnancy-limits';
import type { EnginePlan, EngineProfile, PipelineContext, Scorer } from './contracts';
import { hash, Rules } from './data';
import { runGates } from './gates';
import { buildWeek } from './structure';
import { buildSlots } from './skeleton';
import { fillSlots } from './fill';
import { assignDose, allocateVolumeBudget, continuousCardioItems } from './dose';
import { fitDuration, estimateSeconds } from './fit';
import { improve } from './improve';
import { scorePlan, createGenerationScorer } from './score';
import { checkHard } from './hard-checks';
import { buildNotices } from './notices';
import { candidatesFor } from './candidates';
import { missingEnvironmentTypes } from './environment';
import { foldGeneratedBodyweightWarmup } from './source-warmup';
import { buildYogaSession } from './yoga';
export function retainEnvironmentDraft(plan: EnginePlan, ctx: PipelineContext): EnginePlan {
  const claims = missingEnvironmentTypes(plan, ctx.profile, ctx.gate, ctx.rules, plan.quality?.issues ?? []);
  if (!plan.quality || !claims.length) return plan;
  plan.quality.status = 'environmentLimited';
  plan.quality.basis = 'environment_constraint';
  plan.quality.environmentConstraints = claims;
  const notices: EnginePlan['notices'] = [];
  for (const claim of claims) {
    const source = ctx.rules.get(claim.ruleId).environment_exception;
    ctx.rules.notice(notices, source.notice_key, 'warning');
    ctx.rules.trace(
      ctx.trace,
      claim.ruleId,
      'required coverage pool empty only because of the proven environment; safe draft retained',
      { environmentConstraint: true },
    );
  }
  plan.notices = [...notices, ...plan.notices].slice(0, 3);
  return plan;
}
export function createContext(profile: EngineProfile, variant = 0, rules = new Rules()): PipelineContext {
  // Medical checks always receive the original evidence, including exact times.
  const gate = runGates(profile, rules);
  const screening = profile.screening;
  const present = (value: string | undefined) => (value === undefined ? undefined : true);
  const seedPopulation = { ...profile.population };
  // Elapsed ramp weeks already carry the clinical meaning; an adoption timestamp must not shuffle actions.
  if (seedPopulation.kind === 'pregnant') delete seedPopulation.inactiveRampStartedAt;
  const seedProfile = {
    ...profile,
    population: seedPopulation,
    screening: {
      ...screening,
      completedAt: present(screening.completedAt),
      lastScreenedAt: present(screening.lastScreenedAt),
      ...(screening.redFlagReview
        ? {
            redFlagReview: {
              ...screening.redFlagReview,
              requiredAt: present(screening.redFlagReview.requiredAt),
              answeredAt: present(screening.redFlagReview.answeredAt),
              professionalSeenAt: present(screening.redFlagReview.professionalSeenAt),
            },
          }
        : {}),
      ...(screening.age45AdvisoryAck
        ? {
            age45AdvisoryAck: {
              acknowledgedAt: present(screening.age45AdvisoryAck.acknowledgedAt),
              screenedAt: present(screening.age45AdvisoryAck.screenedAt),
            },
          }
        : {}),
    },
  };
  // Audit clock differences cannot shuffle equivalent plans. Real time-sensitive
  // gate outcomes still distinguish expired or incorrectly ordered evidence.
  const profileHash = hash([seedProfile, variant, gate.status, gate.reasons]);
  let index = 0;
  return {
    profile,
    gate,
    rules,
    variant,
    profileHash,
    rng: () => parseInt(hash([profileHash, index++]), 16) / 0x100000000,
    trace: [...gate.trace],
    usedIds: new Set(),
    usedLadders: new Set(),
  };
}
/** Complete-plan mutations may never replace a known hard-safe checkpoint with an unsafe plan. */
export function retainLastHardSafe(
  candidate: EnginePlan,
  previous: EnginePlan | undefined,
  ctx: PipelineContext,
  stage: string,
): EnginePlan {
  const violations = checkHard(candidate, ctx.profile, ctx.gate, ctx.rules).filter(issue => issue.severity === 'error');
  if (!violations.length) return candidate;
  if (!previous || checkHard(previous, ctx.profile, ctx.gate, ctx.rules).some(issue => issue.severity === 'error')) {
    throw new Error(`No hard-safe generation checkpoint at ${stage}: ${violations.map(issue => issue.code).join(',')}`);
  }
  ctx.trace.push({
    ruleId: 'select.pipeline',
    step: stage,
    reason: 'hard violation rejected; restored last hard-safe checkpoint',
    details: {
      violations: violations.map(({ code, ruleId }) => ({ code, ruleId })),
    },
  });
  return { ...structuredClone(previous), trace: ctx.trace };
}
export function generatePlan(profile: EngineProfile, opts: { variant?: number; rules?: Rules } = {}): EnginePlan {
  const requestedMinutes = profile.sessionMinutes;
  const ramp = pregnancyTargetMinutes(profile, opts.rules);
  if (ramp !== undefined) profile = { ...profile, sessionMinutes: ramp };
  const ctx = createContext(profile, opts.variant ?? 0, opts.rules),
    week = buildWeek(profile, ctx.gate, ctx.rules, ctx.profileHash),
    scorer: Scorer = createGenerationScorer();
  ctx.trace.push(...week.trace);
  ctx.volumeBudget = allocateVolumeBudget(profile, ctx.gate, ctx.rules, week.days);
  const plan: EnginePlan = {
    weeklyTarget: profile.daysPerWeek,
    sessionMinutes: requestedMinutes,
    ...(profile.preferredDays ? { preferredDays: [...profile.preferredDays] } : {}),
    templates: [],
    gates: ctx.gate.reasons,
    notices: [],
    trace: ctx.trace,
    meta: {
      engineVersion: '2.0.0-p0',
      rulesVersion: ctx.rules.data.rulesVersion,
      seed: ctx.profileHash,
    },
  };
  ctx.plan = plan;
  const untargeted =
    profile.population.kind === 'postpartum' &&
    ctx.gate.restrictions.population === 'postpartum' &&
    ctx.gate.restrictions.phase === 1 &&
    ctx.rules.get('postpartum.phase1').minutes_target === 'none';
  for (const day of week.days) {
    ctx.currentWeekday = day.weekday;
    ctx.usedIds = new Set();
    ctx.usedLadders = new Set();
    if (day.kind === 'yoga') {
      const { slots: _, ...template } = buildYogaSession(day, ctx);
      plan.templates.push({ ...template, weekday: day.weekday, id: day.id });
      continue;
    }
    const slots = buildSlots(day, profile, day.minutes, ctx.rules),
      draft = fillSlots(slots, ctx, scorer);
    draft.id = day.id;
    draft.weekday = day.weekday;
    const dosed = capCardioItems(
      foldGeneratedBodyweightWarmup(assignDose(draft, profile, ctx.gate, ctx.rules, ctx), profile, ctx.rules),
      profile,
      ctx.rules,
      ctx.gate,
      new Set(),
    );
    const seconds = untargeted ? estimateSeconds(dosed, ctx.rules) : undefined,
      fitted = untargeted
        ? {
            ...dosed,
            durationScope: 'untargeted' as const,
            estimatedSeconds: seconds!,
            estimatedMinutes: Math.ceil(seconds! / 60),
          }
        : fitDuration(dosed, day.minutes, ctx);
    if (untargeted) {
      delete fitted.targetMinutes;
      ctx.trace.push({
        ruleId: 'postpartum.phase1',
        reason: 'source minutes_target none; retain default dose and actual duration',
        step: 'dose',
        note: 'duration fitting skipped',
      });
    }
    ctx.trace.push({
      ruleId: slots[0]?.sourceRuleId ?? 'session.conditioning.slot',
      reason: 'P0 slot and dose adapters',
      step: 'skeleton/dose',
      note: 'P0 slot and dose adapters',
    });
    const { slots: _, ...template } = fitted;
    plan.templates.push({ ...template, id: day.id });
  }

  const emptyPool = ctx.gate.status !== 'blocked' && plan.templates.some(t => !t.items.length);
  if (emptyPool) {
    const remaining = candidatesFor(
      {
        id: 'environment-check',
        role: 'conditioning',
        patterns: [],
        priority: 0,
        optional: false,
        sourceRuleId: 'select.pipeline',
      },
      profile,
      ctx.gate,
      { ...ctx, usedIds: new Set(), usedLadders: new Set() },
    );
    if (remaining.length) throw Error('P0 incomplete session despite available candidates');
    ctx.trace.push({
      ruleId: 'select.pipeline',
      reason: 'complete hard candidate pool empty',
      step: 'availability',
      note: 'complete hard candidate pool empty',
    });
    plan.templates = [];
    plan.quality = {
      status: 'unavailable',
      basis: 'no_safe_candidates',
      score: 0,
      perRule: [],
      issues: [],
    };
    ctx.rules.notice(plan.notices, 'engine.copy.environment_limited', 'warning');
    return retainLastHardSafe(plan, undefined, ctx, 'availability-return');
  }
  const assembled = retainLastHardSafe(plan, undefined, ctx, 'assemble');
  let checkpoint = structuredClone(assembled);
  let result = retainLastHardSafe(improve(assembled, ctx, scorer), checkpoint, ctx, 'improve');
  for (let index = 0; index < result.templates.length; index++) {
    checkpoint = structuredClone(result);
    const candidate = structuredClone(result);
    candidate.templates[index].items = continuousCardioItems(candidate.templates[index].items, profile, ctx.rules);
    result = retainLastHardSafe(candidate, checkpoint, ctx, 'continuous-cardio');
  }
  result = retainLastHardSafe(result, checkpoint, ctx, 'final-return');
  result.trace = ctx.trace;
  ctx.plan = result;
  const violations = checkHard(result, profile, ctx.gate, ctx.rules),
    score = scorePlan(result, profile, ctx.rules);
  ctx.trace.push({
    ruleId: 'select.rank',
    reason: 'score and hard validation',
    step: 'score/validate',
    note: 'score and hard validation',
  });
  result.notices = buildNotices(score, ctx.gate, ctx);
  if (ramp !== undefined && ramp < requestedMinutes) {
    ctx.trace.push({
      ruleId: 'pregnancy.inactive.ramp',
      step: 'fit',
      reason: 'pregnancy_inactive_ramp',
      details: {
        requestedMinutes,
        capMinutes: ramp,
        trainingAgeWeeks: profile.trainingAgeWeeks,
        actualSeconds: result.templates.map(t => t.estimatedSeconds),
      },
    });
    const notice: EnginePlan['notices'] = [];
    ctx.rules.notice(notice, 'session.copy.intentional_short');
    result.notices = [...result.notices.slice(0, 2), ...notice].slice(0, 3);
  }
  result.quality = planQuality(ctx.gate, violations, score);
  return retainEnvironmentDraft(result, ctx);
}
/** Plan quality from the health gate, hard-check issues and score. */
export function planQuality(
  gate: PipelineContext['gate'],
  issues: ReturnType<typeof checkHard>,
  score: ReturnType<typeof scorePlan>,
): NonNullable<EnginePlan['quality']> {
  return {
    status:
      gate.status === 'blocked' || issues.some(issue => issue.severity === 'error')
        ? 'unavailable'
        : gate.status === 'restricted'
          ? 'limited'
          : 'ready',
    ...(gate.status === 'blocked' ? { basis: 'health_gate' as const } : {}),
    score: score.quality,
    perRule: score.perRule,
    issues,
  };
}
