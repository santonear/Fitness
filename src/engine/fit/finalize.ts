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
  return out;
}
