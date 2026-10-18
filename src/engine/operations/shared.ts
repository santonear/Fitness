import type {
  EnginePlan,
  EngineProfile,
  Pattern,
  PipelineContext,
  SessionDraft,
  Slot,
} from "../contracts";
import type { SessionTemplate } from "../../domain/v8/contracts";

import { checkHard } from "../hard-checks";

export { FOCUS } from "../candidates/focus";
export const slotFor = (
  item: SessionDraft["items"][number],
  patterns: Pattern[],
): Slot => ({
  id: item.prescription?.sourcePosition ?? item.exerciseId,
  role: item.prescription?.block ?? "accessory",
  patterns,
  priority: 0,
  optional: false,
  sourceRuleId: "select.rank",
});
export function legal(
  t: SessionTemplate,
  p: EngineProfile,
  ctx: PipelineContext,
  ignoreDuration = false,
) {
  const plan: EnginePlan = {
    weeklyTarget: p.daysPerWeek,
    sessionMinutes: p.sessionMinutes,
    templates: ctx.plan?.templates.some((row) => row.id === t.id)
      ? ctx.plan.templates.map((row) =>
          row.id === t.id ? (t as EnginePlan["templates"][number]) : row,
        )
      : [t as EnginePlan["templates"][number]],
    meta: {
      engineVersion: "2",
      rulesVersion: ctx.rules.data.rulesVersion,
      seed: ctx.profileHash,
    },
    trace: [],
    notices: [],
    gates: ctx.gate.reasons,
  };
  return !checkHard(plan, p, ctx.gate, ctx.rules).filter(
    (e) =>
      e.severity === "error" &&
      (!ignoreDuration || e.code !== "duration_tolerance"),
  ).length;
}
export function insertWork(
  items: SessionDraft["items"],
  item: SessionDraft["items"][number],
) {
  const tail = items.findIndex((i) =>
    ["conditioning", "cooldown", "mobility"].includes(
      i.prescription?.block ?? "",
    ),
  );
  items.splice(tail < 0 ? items.length : tail, 0, item);
}
export function retainSource(
  next: SessionDraft["items"][number],
  before: SessionDraft["items"][number],
) {
  if (next.prescription) {
    if (before.prescription?.block !== undefined)
      next.prescription.block = before.prescription.block;
    if (before.prescription?.sourcePosition !== undefined)
      next.prescription.sourcePosition = before.prescription.sourcePosition;
    if (before.prescription?.goalRole !== undefined)
      next.prescription.goalRole = before.prescription.goalRole;
  }
  return next;
}
