import { type Item } from "./types";
import {
  type EngineProfile,
  type GateOutcome,
  type PipelineContext,
} from "../contracts";
import { Rules, condition } from "../data";
import { isHardEligible } from "../candidates";
import { prescribe } from "./prescribe";

/** Keep phase order: floor grouping never moves a cooldown or warmup across work. */
export function floorSafeOrder(
  items: Item[],
  profile: EngineProfile,
  gate: GateOutcome,
  rules: Rules,
  ctx?: PipelineContext,
): Item[] {
  if (gate.restrictions.population !== "older_adult") return items;
  const source = rules.get("older.floor.transitions"),
    isFloor = (item: Item) => {
      const e = rules.byExercise.get(item.exerciseId);
      return (
        !!e &&
        (e.requires_floor_transition ?? condition(source.floor_based_if, e, {}))
      );
    },
    ordered: Item[] = [];
  for (let start = 0; start < items.length; ) {
    let end = start + 1;
    while (
      end < items.length &&
      items[end].prescription?.block === items[start].prescription?.block
    )
      end++;
    const phase = items.slice(start, end),
      first = phase.findIndex(isFloor);
    ordered.push(
      ...(first < 0
        ? phase
        : [
            ...phase.slice(0, first),
            ...phase.filter(isFloor),
            ...phase.slice(first).filter((item) => !isFloor(item)),
          ]),
    );
    start = end;
  }
  const groups: number[][] = [];
  let previous = false;
  for (const [index, item] of ordered.entries()) {
    const floor = isFloor(item);
    if (floor && !previous) groups.push([]);
    if (floor) groups.at(-1)!.push(index);
    previous = floor;
  }
  if (groups.length <= source.other_older_users.max_floor_descents_per_session)
    return ordered;
  const keep =
      groups.find((group) =>
        group.some((index) =>
          ["main", "accessory"].includes(
            ordered[index].prescription?.block ?? "",
          ),
        ),
      ) ?? groups[0],
    retained = new Set(keep),
    match = rules.get("select.use_tag.slot_match");
  const used = new Set(ordered.map((item) => item.exerciseId));
  for (const group of groups)
    for (const index of group) {
      if (retained.has(index)) continue;
      const original = ordered[index],
        exercise = rules.byExercise.get(original.exerciseId)!,
        block = original.prescription?.block ?? "main";
      const uses =
        block === "main"
          ? match.main_slot_requires.use
          : block === "warmup"
            ? match.warmup_slot_requires.use
            : block === "cooldown" || block === "mobility"
              ? match.cooldown_slot_requires.use
              : block === "conditioning"
                ? match.conditioning_slot_requires.use
                : match.accessory_slot_requires.use;
      const pool = rules.data.exercises.filter(
        (e) =>
          !used.has(e.id) &&
          (!e.ladder.id ||
            !ordered.some(
              (item) =>
                item.exerciseId !== original.exerciseId &&
                rules.byExercise.get(item.exerciseId)?.ladder.id ===
                  e.ladder.id,
            )) &&
          isHardEligible(e, profile, gate, { rules }) &&
          !(
            e.requires_floor_transition ??
            condition(source.floor_based_if, e, {})
          ) &&
          e.position.some((pos) =>
            source.cautious_profile.substitute_with.includes(pos),
          ) &&
          e.use.some((use) => uses.includes(use)) &&
          (block !== "balance" || e.primary_pattern === "balance"),
      );
      pool.sort(
        (a, b) =>
          Number(b.primary_pattern === exercise.primary_pattern) -
            Number(a.primary_pattern === exercise.primary_pattern) ||
          a.id.localeCompare(b.id, "en"),
      );
      const replacement = pool[0];
      if (!replacement) {
        ctx?.trace.push({
          ruleId: "older.floor.transitions",
          reason:
            "no hard eligible same-phase nonfloor substitute; unresolved floor descents retained",
          step: "dose",
          note: original.exerciseId,
        });
        continue;
      }
      const next = prescribe(
        replacement,
        profile,
        rules,
        gate.restrictions,
        block,
      );
      if (next.prescription && original.prescription) {
        next.prescription.sourcePosition = original.prescription.sourcePosition;
        next.prescription.goalRole = original.prescription.goalRole;
      }
      ordered[index] = next;
      used.delete(original.exerciseId);
      used.add(next.exerciseId);
      ctx?.trace.push({
        ruleId: "older.floor.transitions",
        reason:
          "same-phase standing or seated substitution avoids extra floor descent",
        step: "dose",
        note: `${original.exerciseId}->${next.exerciseId}`,
      });
    }
  return ordered;
}
