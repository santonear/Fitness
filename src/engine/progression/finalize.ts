import { type EnginePlan, type EngineProfile, type ProgressionResult } from '../contracts';

import { Rules } from '../data';

// Legacy persisted start-moving targets still require compatibility reconstruction until M3 policy is settled.
import { readLegacySourceTarget } from './legacy-target';
import { estimateSeconds } from '../fit';
import { refreshWarmupRamps } from '../source-warmup';
import { isYogaSession } from '../yoga-session';
import { settleYogaSession } from '../yoga';
import { createContext } from '../pipeline';
import { checkHard } from '../hard-checks';
import { runGates } from '../gates';

export function finishProgression(
  value: EnginePlan,
  output: ProgressionResult,
  p: EngineProfile,
  r: Rules,
  before?: EnginePlan,
) {
  let ctx: ReturnType<typeof createContext> | undefined;
  for (const template of value.templates) {
    if (isYogaSession(template)) settleYogaSession(template, p, (ctx ??= createContext(p, 0, r)));
    if (output.diff.some(change => change.templateId === template.id))
      Object.assign(template, refreshWarmupRamps(template, p, r));
    if (p.goal === 'start_moving' && template.targetMinutes !== undefined) {
      if (/^1\./.test(value.meta.engineVersion)) template.targetMinutes = readLegacySourceTarget(template, p, r);
      else if (!/^2\./.test(value.meta.engineVersion))
        r.trace(output.trace, 'duration.fit.algorithm', 'unknown_engine_version_preserves_declared_target', {
          engineVersion: value.meta.engineVersion,
          targetMinutes: template.targetMinutes,
        });
    }
    template.estimatedSeconds = estimateSeconds(template, r);
    template.estimatedMinutes = Math.ceil(template.estimatedSeconds / 60);
  }
  if (before) keepWithinHardRules(value, before, output, p, r);
  output.noop = output.diff.length === 0;
  output.summary = output.noop
    ? { zh: '', en: '' }
    : r.text('meta.copy.operation_volume', { count: output.diff.length });
  return output;
}

/**
 * Next targets never add a hard-rule error (a longer session than allowed, a hold past its range): the grown sets
 * and targets of a session that would break one go back to where they were. Swaps and removals stay.
 */
function keepWithinHardRules(
  value: EnginePlan,
  before: EnginePlan,
  output: ProgressionResult,
  p: EngineProfile,
  r: Rules,
) {
  const gate = runGates(p, r),
    errors = (plan: EnginePlan) =>
      checkHard(plan, p, gate, r).filter(issue => issue.severity === 'error' && issue.templateId),
    known = new Set(errors(before).map(issue => `${issue.templateId} ${issue.code}`));
  const broken = new Set(
    errors(value)
      .filter(issue => !known.has(`${issue.templateId} ${issue.code}`))
      .map(issue => issue.templateId!),
  );
  for (const template of value.templates.filter(t => broken.has(t.id))) {
    const original = before.templates.find(t => t.id === template.id);
    if (!original) continue;
    const restored = new Set<number>();
    template.items.forEach((item, index) => {
      const old = original.items[index];
      // Only growth goes back; a reduction (deload, fatigue) is never undone.
      if (old?.exerciseId !== item.exerciseId || !grew(item, old)) return;
      item.sets = old.sets;
      item.target = structuredClone(old.target);
      restored.add(index);
    });
    output.diff = output.diff.filter(
      change =>
        change.templateId !== template.id ||
        !['volume', 'duration'].includes(change.kind) ||
        !restored.has(change.itemIndex ?? -1),
    );
    template.estimatedSeconds = estimateSeconds(template, r);
    template.estimatedMinutes = Math.ceil(template.estimatedSeconds / 60);
  }
}

const grew = (item: EnginePlan['templates'][number]['items'][number], old: typeof item) =>
  item.sets > old.sets ||
  (['reps', 'durationSeconds', 'loadGrams', 'distanceMeters'] as const).some(
    key =>
      ((item.target as Record<string, unknown>)[key] as number) >
      ((old.target as Record<string, unknown>)[key] as number),
  );

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
            kind: 'remove',
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
