import type {
  AdjustTodayRequest,
  EngineProfile,
  EngineResult,
  PipelineContext,
  SessionDraft,
  Slot,
} from "../contracts";
import type { SessionTemplate } from "../../domain/v8/contracts";
import { Rules, stableString } from "../data";
import { prescribe, assignDose } from "../dose";
import { createContext } from "../pipeline";
import { candidatesFor, isHardEligible } from "../candidates";

import { fillSlots } from "../fill";
import { fitDuration, estimateSeconds } from "../fit";

import { scorePlan, marginal } from "../score";
import { changes, result } from "./result";
import { FOCUS, slotFor, legal, insertWork } from "./shared";
export function adjust(
  template: SessionTemplate,
  p: EngineProfile,
  req: AdjustTodayRequest,
  r: Rules,
  context?: PipelineContext,
): EngineResult<SessionTemplate> {
  const profile = {
      ...p,
      sessionMinutes: req.minutes ?? p.sessionMinutes,
      cautions: req.painArea
        ? [...new Set([...p.cautions, req.painArea])]
        : p.cautions,
    },
    ctx = {
      ...createContext(profile, 0, r),
      plan: context?.plan,
      currentWeekday: template.weekday,
    };
  if (ctx.gate.status === "blocked")
    return result(structuredClone(template), [], r, profile);
  const locked = new Set(req.lockedItemIndexes ?? []),
    focus = req.focus && req.focus !== "full" ? FOCUS[req.focus] : undefined,
    avoid = new Set(req.avoidPatterns ?? []),
    items: SessionDraft["items"] = [];
  const original = template.items as SessionDraft["items"];
  for (const [n, item] of original.entries()) {
    const e = r.byExercise.get(item.exerciseId);
    if (
      locked.has(n) ||
      (e &&
        isHardEligible(e, profile, ctx.gate, ctx) &&
        !avoid.has(e.primary_pattern) &&
        (!focus || focus.includes(e.primary_pattern)))
    )
      items.push(structuredClone(item));
  }
  ctx.usedIds = new Set(items.map((i) => i.exerciseId));
  ctx.focus = req.focus;
  const patterns = (
      focus ?? r.data.exercises.map((e) => e.primary_pattern)
    ).filter((x) => !avoid.has(x)),
    slot: Slot = {
      id: "operation-fill",
      role: "accessory",
      patterns,
      priority: 0,
      optional: false,
      sourceRuleId: "select.rank",
    };
  const pool = candidatesFor(slot, profile, ctx.gate, ctx).filter((e) =>
    patterns.includes(e.primary_pattern),
  );
  if (req.focus === "upper") {
    const retained = new Set(items.map((item) => item.exerciseId));
    const missing = original
      .filter((item) => !retained.has(item.exerciseId))
      .flatMap((item) => {
        const exercise = r.byExercise.get(item.exerciseId);
        return exercise && FOCUS.upper.includes(exercise.primary_pattern)
          ? [exercise.primary_pattern]
          : [];
      });
    pool.sort(
      (a, b) =>
        Number(missing.includes(b.primary_pattern)) -
        Number(missing.includes(a.primary_pattern)),
    );
  }
  if (!items.length && pool.length) {
    const draft = fillSlots([slot], ctx, { score: scorePlan, marginal });
    items.push(
      ...draft.items.filter((i) =>
        patterns.includes(r.byExercise.get(i.exerciseId)!.primary_pattern),
      ),
    );
  }
  for (const e of pool) {
    if (
      items.some(
        (i) =>
          i.exerciseId === e.id ||
          (e.ladder.id &&
            r.byExercise.get(i.exerciseId)?.ladder.id === e.ladder.id),
      )
    )
      continue;
    const item = prescribe(
      e,
      profile,
      r,
      ctx.gate.restrictions,
      "accessory",
      1,
    );
    const proposed = [...items];
    insertWork(proposed, item);
    if (!legal({ ...template, items: proposed }, profile, ctx, true)) continue;
    insertWork(items, item);
    if (estimateSeconds({ items }, r) >= profile.sessionMinutes * 60) break;
  }
  ctx.lockedItemIndexes = items
    .map((i, n) =>
      original.some(
        (o, k) => locked.has(k) && stableString(o) === stableString(i),
      )
        ? n
        : -1,
    )
    .filter((n) => n >= 0);
  let draft: SessionDraft = {
    ...structuredClone(template),
    items,
    slots: items.map((i) =>
      slotFor(i, [r.byExercise.get(i.exerciseId)!.primary_pattern]),
    ),
  };
  draft = assignDose(draft, profile, ctx.gate, r, ctx);
  for (const n of ctx.lockedItemIndexes ?? []) {
    const source = original.find(
      (item, k) =>
        locked.has(k) && item.exerciseId === draft.items[n]?.exerciseId,
    );
    if (source) draft.items[n] = structuredClone(source);
  }
  draft = fitDuration(draft, profile.sessionMinutes, ctx);
  const { slots: _, ...value } = draft;
  if (
    [...locked].some(
      (n) =>
        original[n] &&
        stableString(value.items[n]) !== stableString(original[n]),
    ) ||
    !items.length ||
    !legal(value, profile, ctx)
  )
    return result(structuredClone(template), [], r, profile);
  const out = result<SessionTemplate>(
    value,
    changes(template, value),
    r,
    profile,
    value.estimatedMinutes,
  );
  out.trace.push(...ctx.trace);
  return out;
}
