import { EngineProfile } from "../contracts";

import { Rules, stretchHoldRange } from "../data";

import { credit, prescribe, strengthRoles, Item, Template } from "../dose";

import { safety, SafetyState } from "../gates/strength-scoring";

import { hardEligible } from "./legacy-candidates";

import {
  setSeconds,
  blockSeconds,
  estimatedSeconds,
} from "../fit/elapsed-time";

import {
  durationTier,
  timingRow,
  templateTargetMinutes,
} from "./legacy-target";

import { safetyBlockMinimums } from "./legacy-blocks";
import { ensureCooldown } from "./legacy-cooldown-ensure";
export { ensureCooldown } from "./legacy-cooldown-ensure";
export { plannedCooldown } from "./legacy-cooldown-plan";

export function requiredStretchGroups(template: Template, r: Rules): string[] {
  // Existing default targets are retained; these volume credits are never primary-priority evidence.
  const groups = r.get("dose.muscle_groups"),
    required = new Set<string>();
  for (const item of template.items
    .filter((i) => ["main", "accessory"].includes(i.prescription?.block ?? ""))
    .sort(
      (a, b) =>
        Number(b.prescription?.block === "main") -
        Number(a.prescription?.block === "main"),
    ))
    for (const [group, sets] of Object.entries(credit(item, r)))
      if (sets > 0 && groups.target_groups.includes(group)) required.add(group);
  return [...required];
}

export function priorityStretchGroups(
  template: Template,
  r: Rules,
  p?: EngineProfile,
): string[] {
  const rule = r.get("session.cooldown.stretch"),
    count = Math.max(
      ...[...rule.priority_when_time_short.matchAll(/M(\d+)/g)].map((match) =>
        Number(match[1]),
      ),
    ),
    map = r.get("dose.muscle_groups").catalog_map,
    major = r.get("dose.muscle_groups").target_groups,
    groups = new Set<string>();
  const work = template.items.filter((i) =>
      ["main", "accessory"].includes(i.prescription?.block ?? ""),
    ),
    authored = work.filter((i) => {
      const match = i.prescription?.sourcePosition?.match(/^main_(\d+)$/);
      return match && Number(match[1]) >= 1 && Number(match[1]) <= count;
    }),
    legacy = work
      .filter(
        (i) =>
          i.prescription?.block === "main" &&
          !/^(main|acc|core)_\d+$/.test(i.prescription?.sourcePosition ?? ""),
      )
      .slice(0, count),
    priority = [...new Set([...authored, ...legacy])];
  const roles =
    p?.goal === "strength" ? strengthRoles(template.items, p, r) : undefined;
  for (const item of priority
    .filter((item) => !roles || roles.get(item) === "main")
    .sort(
      (a, b) =>
        Number(
          a.prescription?.sourcePosition?.match(/^main_(\d+)$/)?.[1] ??
            Infinity,
        ) -
        Number(
          b.prescription?.sourcePosition?.match(/^main_(\d+)$/)?.[1] ??
            Infinity,
        ),
    )) {
    const e = r.byExercise.get(item.exerciseId),
      mapped = (e?.primaryMuscles ?? [])
        .map((m) => map[m])
        .filter((group) => major.includes(group));
    for (const group of mapped) groups.add(group);
  }
  return [...groups];
}

export function shortStretchSession(
  template: Template,
  p: EngineProfile,
  r: Rules,
  s: SafetyState,
): boolean {
  if (s.population === "postpartum" && s.phase === 1) return false;
  const full = structuredClone(template);
  ensureCooldown(
    full,
    p,
    r,
    {
      ...s,
      cooldownHoldSeconds: r.get("session.cooldown.stretch").dose.default
        .hold_s,
    },
    true,
    true,
  );
  return (
    estimatedSeconds(full, r) >
    templateTargetMinutes(template, p, r) *
      60 *
      r.get("duration.fit.tolerance").band[1]
  );
}

export function cooldownCapSeconds(
  template: Template,
  p: EngineProfile,
  r: Rules,
): number {
  const minutes = templateTargetMinutes(template, p, r),
    variant =
      p.goal === "mobility" &&
      template.items.some((i) =>
        ["main", "accessory"].includes(i.prescription?.block ?? ""),
      )
        ? r.get(`session.template.min${durationTier(minutes, p, r)}`).variants
            ?.mobility
        : undefined,
    extended = [
      ...Object.entries(variant?.extend ?? {})
        .filter(([slot]) => slot.startsWith("CD"))
        .map(([, entry]) => entry),
      ...(
        Object.values(variant?.replace ?? {}) as {
          block?: string;
          minutes?: number | number[];
        }[]
      ).filter((entry) => entry?.block === "cooldown"),
    ] as { minutes?: number | number[] }[],
    extension = Math.max(
      0,
      ...extended.flatMap((entry) =>
        Array.isArray(entry.minutes) ? entry.minutes : (entry.minutes ?? 0),
      ),
    );
  return (
    Math.max(
      timingRow(durationTier(minutes, p, r), r).cooldown,
      safetyBlockMinimums(template, p, r).cooldownSeconds / 60,
      Array.isArray(extension) ? extension[1] : (extension ?? 0),
    ) * 60
  );
}
