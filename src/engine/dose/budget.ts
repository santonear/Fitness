import {
  type EngineProfile,
  type GateOutcome,
  type DayPlan,
  type VolumeBudget,
} from "../contracts";
import { Rules } from "../data";
import { allocatedVolumeCapacity } from "./capacity";
import { volumeLimits } from "./limits";

/** A jointly feasible subset of the fixed capacity witness, directed toward the resolved interval midpoint. */
export function allocateVolumeBudget(
  p: EngineProfile,
  g: GateOutcome,
  r = new Rules(),
  days?: DayPlan[],
): VolumeBudget {
  const capacity = allocatedVolumeCapacity(p, g, r, days),
    range = volumeLimits(p, r),
    center = (range.min + range.max) / 2,
    weeklyTargets: Record<string, number> = {},
    bySlot: Record<string, number> = {},
    totals: Record<string, number> = {},
    daySets = new Map<string, number>();
  for (const [group, available] of Object.entries(capacity.byMuscle))
    if (available !== null) weeklyTargets[group] = Math.min(center, available);
  if (!Object.keys(weeklyTargets).length) return { weeklyTargets, bySlot };
  const slots = capacity.days.flatMap((day) =>
    day.items
      .filter((value) => value.item.sets > 0)
      .map((value) => ({
        dayId: day.dayId,
        key: value.item.prescription!.sourcePosition!,
        max: value.item.sets,
        min: value.minimumSets,
        credit: value.unitCredit,
      })),
  );
  const add = (slot: (typeof slots)[number], sets: number) => {
    bySlot[slot.key] = (bySlot[slot.key] ?? 0) + sets;
    daySets.set(slot.dayId, (daySets.get(slot.dayId) ?? 0) + sets);
    for (const [group, n] of Object.entries(slot.credit))
      totals[group] = (totals[group] ?? 0) + n * sets;
  };
  for (const slot of slots) add(slot, slot.min);
  // Unit increments can never exceed the witnessed dose/time/caps. Stop when no increment
  // reduces the joint absolute distance; never duplicate the available capacity per muscle.
  while (true) {
    const choices = slots
      .filter((slot) => bySlot[slot.key] < slot.max)
      .map((slot) => ({
        slot,
        gain: Object.entries(weeklyTargets).reduce(
          (n, [group, target]) =>
            n +
            Math.abs(target - (totals[group] ?? 0)) -
            Math.abs(target - (totals[group] ?? 0) - (slot.credit[group] ?? 0)),
          0,
        ),
      }))
      .filter((choice) => choice.gain > 0)
      .sort(
        (a, b) =>
          b.gain - a.gain ||
          (daySets.get(a.slot.dayId) ?? 0) - (daySets.get(b.slot.dayId) ?? 0) ||
          a.slot.key.localeCompare(b.slot.key, "en"),
      );
    if (!choices.length) break;
    add(choices[0].slot, 1);
  }
  return { weeklyTargets, bySlot };
}
