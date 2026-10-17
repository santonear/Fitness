import {
  type EnginePlan,
  type EngineProfile,
  type ProgressionResult,
} from "../contracts";

import { Rules } from "../data";

// Legacy persisted start-moving targets still require compatibility reconstruction until M3 policy is settled.
import { readLegacySourceTarget } from "./legacy-target";
import { estimateSeconds } from "../fit";
import { refreshWarmupRamps } from "../source-warmup";

export function finishProgression(
  value: EnginePlan,
  output: ProgressionResult,
  p: EngineProfile,
  r: Rules,
) {
  for (const template of value.templates) {
    if (output.diff.some((change) => change.templateId === template.id))
      Object.assign(template, refreshWarmupRamps(template, p, r));
    if (p.goal === "start_moving" && template.targetMinutes !== undefined) {
      if (/^1\./.test(value.meta.engineVersion))
        template.targetMinutes = readLegacySourceTarget(template, p, r);
      else if (!/^2\./.test(value.meta.engineVersion))
        r.trace(
          output.trace,
          "duration.fit.algorithm",
          "unknown_engine_version_preserves_declared_target",
          {
            engineVersion: value.meta.engineVersion,
            targetMinutes: template.targetMinutes,
          },
        );
    }
    template.estimatedSeconds = estimateSeconds(template, r);
    template.estimatedMinutes = Math.ceil(template.estimatedSeconds / 60);
  }
  output.noop = output.diff.length === 0;
  output.summary = output.noop
    ? { zh: "", en: "" }
    : r.text("meta.copy.operation_volume", { count: output.diff.length });
  return output;
}

export function removeDroppedPatterns(
  value: EnginePlan,
  droppedPatterns: Set<string>,
  r: Rules,
  output: ProgressionResult,
) {
  for (const t of value.templates) {
    if (droppedPatterns.size) {
      for (let index = t.items.length - 1; index >= 0; index--) {
        const item = t.items[index],
          e = r.byExercise.get(item.exerciseId);
        if (e && droppedPatterns.has(e.primary_pattern)) {
          output.diff.push({
            kind: "remove",
            templateId: t.id,
            itemIndex: index,
            before: structuredClone(item),
          });
          t.items.splice(index, 1);
        }
      }
    }
  }
}
