import { refillProposals, type RefillPhase } from "./refill-proposals";
import { checkHard } from "../hard-checks";
import { type PipelineContext, type SessionDraft } from "../contracts";
import { type Rules } from "../data";
import { estimateSeconds } from "./estimate";

export function finalizeFit(
  out: SessionDraft,
  target: number,
  session: SessionDraft,
  ctx: PipelineContext,
  r: Rules,
  T: number,
): SessionDraft {
  out.targetMinutes = target;
  out.estimatedSeconds = estimateSeconds(out, r);
  out.estimatedMinutes = Math.ceil(out.estimatedSeconds / 60);
  out.name =
    out.name.replace(/\s*\d+\s*(分钟|min(?:utes)?)/gi, "").trim() ||
    session.name;
  ctx.trace.push({
    ruleId: "duration.fit.algorithm",
    step: "fit",
    reason: "source time fitting",
    note: "optional actions then sets then timed work",
    details: { targetSeconds: T, estimatedSeconds: out.estimatedSeconds },
  });
  if (out.estimatedSeconds < T * r.get("duration.fit.tolerance").band[0]) {
    const base = ctx.plan ?? {
      weeklyTarget: ctx.profile.daysPerWeek,
      sessionMinutes: target,
      templates: [],
      meta: {
        engineVersion: "2",
        rulesVersion: r.data.rulesVersion,
        seed: ctx.profileHash,
      },
      trace: [],
      notices: [],
      gates: ctx.gate.reasons,
    };
    const issues = checkHard(
      {
        ...base,
        templates: [...base.templates.filter((t) => t.id !== out.id), out],
      },
      ctx.profile,
      ctx.gate,
      r,
    );
    if (
      issues.some(
        (issue) =>
          issue.code === "intentional_short" && issue.templateId === out.id,
      ) &&
      !issues.some(
        (issue) => issue.severity === "error" && issue.templateId === out.id,
      )
    ) {
      const limitingRuleIds = new Set<string>();
      for (const phase of r.get("duration.cardio.cap").refill
        .order as RefillPhase[])
        for (const proposal of refillProposals(
          out,
          ctx.profile,
          ctx.gate,
          r,
          phase,
        )) {
          const trial = {
            ...base,
            templates: [
              ...base.templates.filter((t) => t.id !== out.id),
              proposal,
            ],
          };
          for (const issue of checkHard(trial, ctx.profile, ctx.gate, r, true))
            if (issue.severity === "error") limitingRuleIds.add(issue.ruleId);
        }
      if (!limitingRuleIds.size) limitingRuleIds.add("select.pipeline");
      limitingRuleIds.add("duration.cardio.cap");
      ctx.trace.push({
        ruleId: "duration.cardio.cap",
        step: "fit",
        reason: "intentional_short",
        details: {
          templateId: out.id,
          targetSeconds: T,
          estimatedSeconds: out.estimatedSeconds,
          missingSeconds: T - out.estimatedSeconds,
          limitingRuleIds: [...limitingRuleIds].sort(),
        },
      });
    }
  }
  return out;
}
