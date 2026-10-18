import { loadedPreference } from "./candidates/loaded-preference";
import type {
  Candidate,
  Pattern,
  PipelineContext,
  Plan,
  Scorer,
  SessionDraft,
  Slot,
} from "./contracts";
import { candidatesFor } from "./candidates";
import { condition } from "./data";
import { prescribe } from "./dose";
/** Source coverage may promote only an existing, unlocked accessory slot. */
function coverageCandidates(
  slot: Slot,
  draft: SessionDraft,
  slots: Slot[],
  ctx: PipelineContext,
): Candidate[] {
  const rule = ctx.rules.get("week.coverage.patterns"),
    work = (items: SessionDraft["items"]) =>
      items.filter((item) =>
        ["main", "accessory"].includes(item.prescription?.block ?? ""),
      );
  const prior =
    ctx.plan?.templates.filter((template) => work(template.items).length) ?? [];
  if (
    slot.role !== "accessory" ||
    (ctx.focus && ctx.focus !== "full") ||
    ctx.lockedItemIndexes?.includes(slots.indexOf(slot)) ||
    rule.on_fail !== "promote_missing_pattern_to_next_free_acc_slot" ||
    prior.length + 1 < rule.applies_when.rt_days_min
  )
    return candidatesFor(slot, ctx.profile, ctx.gate, ctx);
  const current = new Set(
      work(draft.items).map(
        (item) => ctx.rules.byExercise.get(item.exerciseId)?.primary_pattern,
      ),
    ),
    seen = new Set([
      ...prior.flatMap((template) =>
        work(template.items).map(
          (item) => ctx.rules.byExercise.get(item.exerciseId)?.primary_pattern,
        ),
      ),
      ...current,
    ]);
  let missing = (rule.weekly_min_exposures.each_once as Pattern[]).filter(
    (pattern) => !seen.has(pattern),
  );
  if (!missing.length)
    missing = Object.values(rule.weekly_min_exposures).flatMap((entry) => {
      if (Array.isArray(entry)) return [];
      const group = entry as { patterns: Pattern[]; min: number },
        exposures = prior.filter((template) =>
          work(template.items).some((item) => {
            const e = ctx.rules.byExercise.get(item.exerciseId);
            return !!e && group.patterns.includes(e.primary_pattern);
          }),
        ).length;
      return exposures < group.min &&
        !group.patterns.some((pattern) => current.has(pattern))
        ? group.patterns
        : [];
    });
  if (missing.length) {
    const originalMissing = missing.filter((pattern) =>
      slot.patterns.includes(pattern),
    );
    if (originalMissing.length) {
      const sourceCandidates = candidatesFor(
        { ...slot, patterns: originalMissing },
        ctx.profile,
        ctx.gate,
        ctx,
      ).filter((candidate) =>
        originalMissing.includes(candidate.primary_pattern),
      );
      if (sourceCandidates.length) return sourceCandidates;
    }
    const promoted = candidatesFor(
      { ...slot, patterns: missing },
      ctx.profile,
      ctx.gate,
      ctx,
    ).filter((candidate) => missing.includes(candidate.primary_pattern));
    if (promoted.length) {
      ctx.trace.push({
        ruleId: "week.coverage.patterns",
        reason: "promote missing pattern into existing free accessory slot",
        step: "fill",
        note: `${slot.id}:${missing.join(",")}`,
      });
      return promoted;
    }
  }
  return candidatesFor(slot, ctx.profile, ctx.gate, ctx);
}
export function fillSlots(
  slots: Slot[],
  ctx: PipelineContext,
  scorer: Scorer,
): SessionDraft {
  const draft: SessionDraft = {
    id: slots[0]?.id ?? "empty",
    name: ctx.profile.locale === "en" ? "Training" : "训练",
    estimatedMinutes: ctx.profile.sessionMinutes,
    items: [],
    slots,
  };
  const sourceOrder = new Map(slots.map((slot, index) => [slot.id, index]));
  const orderedItems = (items: SessionDraft["items"]) =>
    [...items].sort(
      (a, b) =>
        (sourceOrder.get(a.prescription?.sourcePosition ?? "") ?? Infinity) -
        (sourceOrder.get(b.prescription?.sourcePosition ?? "") ?? Infinity),
    );
  const floorChanges = (items: SessionDraft["items"]) => {
    let descents = 0;
    let ascents = 0;
    let previousFloor = false;
    const source = ctx.rules.get("older.floor.transitions");
    for (const item of orderedItems(items)) {
      const exercise = ctx.rules.byExercise.get(item.exerciseId);
      const floor =
        !!exercise &&
        (exercise.requires_floor_transition ??
          condition(source.floor_based_if, exercise, {}));
      if (floor && !previousFloor) descents++;
      if (!floor && previousFloor) ascents++;
      previousFloor = floor;
    }
    return { descents, ascents };
  };
  for (const slot of [...slots].sort((a, b) => b.priority - a.priority)) {
    const candidates = coverageCandidates(slot, draft, slots, ctx);
    const plan: Plan = ctx.plan
      ? { ...ctx.plan, templates: [...ctx.plan.templates, draft] }
      : {
          weeklyTarget: ctx.profile.daysPerWeek,
          sessionMinutes: ctx.profile.sessionMinutes,
          templates: [draft],
          gates: [],
          notices: [],
          trace: ctx.trace,
          meta: {
            engineVersion: "2",
            rulesVersion: ctx.rules.data.rulesVersion,
            seed: ctx.profileHash,
          },
        };
    // A fresh baseline is shared only within this candidate batch; draft mutation follows scoring.
    Object.freeze(plan);
    let best: SessionDraft["items"][number] | undefined,
      bestScore = -Infinity,
      bestTie = -Infinity;
    const patternChoices = new Map<
      Pattern,
      {
        item: SessionDraft["items"][number];
        score: number;
        rank: number;
        tie: number;
      }
    >();
    for (const candidate of candidates) {
      const source = /-(main|acc)_(\d+)$/.exec(slot.id),
        role =
          ctx.profile.goal === "strength" &&
          ["main", "accessory"].includes(slot.role) &&
          source
            ? source[1] === "acc" ||
              Number(source[2]) >
                ctx.rules.get("goal.params.strength").main_lifts_per_session.max
              ? "accessory"
              : "main"
            : slot.role;
      const item = prescribe(
        candidate,
        ctx.profile,
        ctx.rules,
        ctx.gate.restrictions,
        role,
        ctx.volumeBudget?.bySlot[slot.id],
      );
      if (item.prescription) {
        item.prescription.block = slot.role;
        item.prescription.sourcePosition = slot.id;
        if (
          ctx.profile.goal === "strength" &&
          ["main", "accessory"].includes(role)
        )
          item.prescription.goalRole = role as "main" | "accessory";
      }
      if (ctx.gate.restrictions.population === "older_adult") {
        const changes = floorChanges([...draft.items, item]);
        const limit = ctx.rules.get("older.floor.transitions").other_older_users
          .max_floor_descents_per_session;
        if (changes.descents > limit) continue;
      }
      const score = scorer.marginal(
          plan,
          { kind: "add", templateId: draft.id, item },
          ctx.profile,
          ctx.rules,
        ),
        tie = ctx.rng(),
        rank = score + loadedPreference(candidate, ctx.profile, ctx.rules);
      const previous = patternChoices.get(candidate.primary_pattern);
      if (
        !previous ||
        rank > previous.rank ||
        (rank === previous.rank && tie > previous.tie)
      )
        patternChoices.set(candidate.primary_pattern, {
          item,
          score,
          rank,
          tie,
        });
    }
    // The equipment bonus ranks alternatives within one pattern, never substitutes coverage.
    for (const choice of patternChoices.values()) {
      if (
        choice.score > bestScore ||
        (choice.score === bestScore && choice.tie > bestTie)
      ) {
        best = choice.item;
        bestScore = choice.score;
        bestTie = choice.tie;
      }
    }
    if (best) {
      draft.items.push(best);
      ctx.usedIds.add(best.exerciseId);
      const ladder = ctx.rules.byExercise.get(best.exerciseId)?.ladder.id;
      if (ladder) ctx.usedLadders.add(ladder);
    }
    ctx.trace.push({
      ruleId: best ? "select.rank" : "select.fallback.chain",
      reason: best
        ? "maximum marginal contribution"
        : "slot omitted; time available to remaining items",
      step: "fill",
      note: slot.id,
    });
  }
  draft.items = orderedItems(draft.items);
  if (ctx.gate.restrictions.population === "older_adult") {
    ctx.trace.push({
      ruleId: "older.floor.transitions",
      step: "fill",
      reason: "source-ordered floor transitions constrained during selection",
      details: floorChanges(draft.items),
    });
  }
  return draft;
}
