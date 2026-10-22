import { type EngineProfile } from "../contracts";
import { type Rules } from "../data";
import { type Item, type Template } from "../dose";
import {
  sourceWarmupRamps as sourceRamps,
  writeWarmupRamps,
  type SourceWarmupRamp,
} from "../dose/warmup-source";

/** The legacy source target matches main positions on the raw stored value only. */
const storedPosition = (item: Item) => item.prescription?.sourcePosition;

export function sourceWarmupRamps(
  template: Template,
  p: EngineProfile,
  r: Rules,
): SourceWarmupRamp[] {
  return sourceRamps(template, p, r, storedPosition);
}

export function refreshWarmupRamps(
  template: Template,
  p: EngineProfile,
  r: Rules,
): void {
  writeWarmupRamps(template, p, r, storedPosition);
}
