import { checkHistoryChanges } from "./history-checks";
import type { EngineApi, EnginePlan, EngineProfile } from "./contracts";
import { Rules } from "./data";
import {
  generatePlan as pipeline,
  createContext,
  planQuality,
  retainEnvironmentDraft,
} from "./pipeline";
import { adjust, modify, substituteItem } from "./operations";
import { progress } from "./progression";
import { checkHard } from "./hard-checks";
import { scorePlan } from "./score";
import { isHardEligible } from "./candidates";
const rules = new Rules();
/** P0 facade; the staged M1–M3 gates, not this facade, certify full behavior. */
function assess(plan: EnginePlan, profile: EngineProfile): EnginePlan {
  const ctx = createContext(profile, 0, rules),
    issues = checkHard(plan, profile, ctx.gate, rules),
    score = scorePlan(plan, profile, rules);
  plan.quality = planQuality(ctx.gate, issues, score);
  return retainEnvironmentDraft(plan, ctx);
}
export const generatePlan: EngineApi["generatePlan"] = (profile, opts) =>
  pipeline(profile, { ...opts, rules });
export const adjustToday: EngineApi["adjustToday"] = (
  template,
  profile,
  request,
) => adjust(template, profile, request, rules);
export const modifyPlan: EngineApi["modifyPlan"] = (plan, profile, changes) => {
  const out = modify(plan, profile, changes, rules);
  assess(out.value, profile);
  return out;
};
export const substitute: EngineApi["substitute"] = (item, profile, reason) =>
  substituteItem(item, profile, reason, rules);
export const nextTargets: EngineApi["nextTargets"] = (
  history,
  plan,
  profile,
  options,
) => {
  const out = progress(history, plan, profile, rules, options);
  assess(out.value, profile);
  return out;
};
export const validatePlan: EngineApi["validatePlan"] = (
  plan,
  profile,
  context,
) => {
  const ctx = createContext(profile, 0, rules);
  return [
    ...checkHard(plan, profile, ctx.gate, rules),
    ...checkHistoryChanges(plan, profile, context, rules),
  ];
};
export function getEligibleExercises(profile: EngineProfile): {
  exerciseId: string;
  primaryPattern: string;
  equipmentRequired: string[];
}[] {
  const ctx = createContext(profile, 0, rules);
  if (ctx.gate.status === "blocked") return [];
  return rules.data.exercises
    .filter((e) => isHardEligible(e, profile, ctx.gate, ctx))
    .map((e) => ({
      exerciseId: e.id,
      primaryPattern: e.primary_pattern,
      equipmentRequired: [...e.equipment_required],
    }))
    .sort((a, b) => a.exerciseId.localeCompare(b.exerciseId, "en"));
}
export type * from "./contracts";
