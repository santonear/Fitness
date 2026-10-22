import { Rules } from './data';
import { pregnancyTargetMinutes } from './pregnancy-limits';
import { type Scorer, type Plan, type EngineProfile, type ScoreResult, type PlanChange } from './contracts';
import { type GenerationTimingBatch } from './score/types';
import { evaluate } from './score/evaluate';
import { facts } from './score/facts';
import { marginalInBatch } from './score/marginal';

const defaultRules = new Rules();

const generationScorers = new WeakMap<Scorer, { timing?: GenerationTimingBatch }>();

/** Only the default synchronous improve loop owns these scopes; public scorers never retain timing. */
export function createGenerationScorer(): Scorer {
  const state: { timing?: GenerationTimingBatch } = {};
  const scorer: Scorer = {
    score: (plan, p, r = defaultRules) => evaluate(plan, p, r, facts(plan, r), state.timing),
    marginal: (plan, change, p, r = defaultRules) => marginalInBatch(plan, change, p, r, state.timing),
  };
  generationScorers.set(scorer, state);
  return scorer;
}

/** Copy-on-write improve candidates cannot mutate these baseline sessions until finally closes the round. */
export function beginDefaultScorerBatch(
  scorer: Scorer,
  baseline: Plan,
  profile: EngineProfile,
  rules: Rules,
): () => void {
  const state = generationScorers.get(scorer);
  if (!state) return () => {};
  const previous = state.timing;
  state.timing = {
    profile,
    rules,
    baselineSessions: new Set(baseline.templates),
    baselineItems: new Set(baseline.templates.flatMap(t => t.items)),
    goalItems: new WeakMap(),
    values: new WeakMap(),
    roles: new WeakMap(),
    cooldownStretch: new WeakMap(),
  };
  return () => {
    state.timing = previous;
  };
}

export function scorePlan(plan: Plan, profile: EngineProfile, rules = defaultRules): ScoreResult {
  const cap = pregnancyTargetMinutes(profile, rules);
  if (cap !== undefined) profile = { ...profile, sessionMinutes: cap };
  return evaluate(plan, profile, rules, facts(plan, rules));
}

/** Recompute only the affected session facts; registry evaluations use aggregated statistics. */
export function marginal(plan: Plan, change: PlanChange, profile: EngineProfile, rules = defaultRules): number {
  return marginalInBatch(plan, change, profile, rules);
}
export { countSatisfaction } from './score/math';
export { intervalSatisfaction } from './score/math';
export { targetSatisfactions } from './score/registry';
export { targetRuleIds } from './score/registry';
export { targetRuleAssessments } from './score/registry';
