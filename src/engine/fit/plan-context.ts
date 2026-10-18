import type { SessionDraft, PipelineContext } from "../contracts";

/** One source-consistent plan snapshot for fitting checks and marginal scores. */
export function fittingPlan(
  session: SessionDraft,
  ctx: PipelineContext,
  target: number,
) {
  return Object.freeze({
    ...ctx.plan!,
    weeklyTarget: ctx.profile.daysPerWeek,
    sessionMinutes: target,
    templates: [
      ...(ctx.plan?.templates.filter((t) => t.id !== session.id) ?? []),
      session,
    ],
    meta: ctx.plan?.meta ?? {
      engineVersion: "2",
      rulesVersion: ctx.rules.data.rulesVersion,
      seed: ctx.profileHash,
    },
    trace: ctx.trace,
    notices: [],
    gates: ctx.gate.reasons,
  });
}
