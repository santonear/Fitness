import { type Template } from "../dose";
import { type EngineProfile, type Slot } from "../contracts";
import { type Rules } from "../data";
import { isRealizedBodyweightWarmup, mainRampSlot } from "./warmup-realize";

/** Generated drafts only: fold the authenticated bodyweight steps into their existing main item. */
export function foldGeneratedBodyweightWarmup<T extends Template>(
  template: T,
  p: EngineProfile,
  r: Rules,
): T {
  const copy = structuredClone(template),
    found = mainRampSlot(template, p, r);
  if (!found) return copy;
  const { ramp, slot } = found;
  const positions = new Set([slot.slot, template.id + "-" + slot.slot]),
    placeholders = copy.items.flatMap((item, index) =>
      item.prescription?.block === "warmup" &&
      positions.has(item.prescription.sourcePosition)
        ? [index]
        : [],
    );
  if (placeholders.length !== 1) return copy;
  const index = placeholders[0],
    main = copy.items[ramp.itemIndex];
  if (
    index >= ramp.itemIndex ||
    !main.prescription ||
    isRealizedBodyweightWarmup(template, index, p, r)
  )
    return copy;
  if (
    main.prescription.warmupSeconds !== undefined &&
    main.prescription.warmupSeconds !== 0 &&
    main.prescription.warmupSeconds !== ramp.seconds
  )
    return copy;
  main.prescription.warmupSeconds = ramp.seconds;
  copy.items.splice(index, 1);
  const draft = copy as T & { slots?: Slot[] };
  if (draft.slots)
    draft.slots = draft.slots.filter((slot) => !positions.has(slot.id));
  return copy;
}
