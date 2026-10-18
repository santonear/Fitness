import { type EngineProfile } from "../contracts";
import { type Rules } from "../data";
import { type Item, type Template } from "../dose";

export function durationTier(
  minutes: number,
  p: EngineProfile,
  r: Rules,
): number {
  const v = r.get("session.durations.allowed"),
    tier = v.minutes.filter((n: number) => n <= minutes).at(-1) ?? v.minutes[0];
  return p.level === "beginner" && tier === 90
    ? v.min90_beginner_fallback
    : tier;
}

export function sourcePosition(
  item: Item,
  template: Template,
): string | undefined {
  const value = item.prescription?.sourcePosition;
  if (!value) return undefined;
  if (/^(main|acc|core)_[1-9]\d*$/.test(value)) return value;
  if (!value.startsWith(template.id + "-")) return undefined;
  return value.match(/-(main_[1-9]\d*|acc_[1-9]\d*|core_[1-9]\d*)$/)?.[1];
}
