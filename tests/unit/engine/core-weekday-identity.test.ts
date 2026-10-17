import { expect, it } from "vitest";
import { baseProfile } from "../../../tools/eval/training-engine-profiles";
import { buildWeek } from "../../../src/engine/structure";
import {
  buildSlots,
  sourceCorePatternGroups,
} from "../../../src/engine/skeleton";
import { createContext } from "../../../src/engine/pipeline";

it("rotates source core groups by actual weekday when generation identity differs", () => {
  const p = baseProfile({ trainingAgeWeeks: 52, level: "intermediate" }),
    ctx = createContext(p);
  const oldDays = buildWeek(p, ctx.gate, ctx.rules).days,
    newDays = buildWeek(p, ctx.gate, ctx.rules, ctx.profileHash).days;
  expect(newDays.some((day, index) => day.id !== oldDays[index].id)).toBe(true);
  const rt = oldDays.filter((day) =>
      ["full", "upper", "lower"].includes(day.kind),
    ),
    groups = sourceCorePatternGroups(rt.length, ctx.rules);
  const observed: string[][] = [];
  for (const day of newDays) {
    const old = oldDays.find((value) => value.weekday === day.weekday)!;
    const before = buildSlots(old, p, old.minutes, ctx.rules),
      after = buildSlots(day, p, day.minutes, ctx.rules);
    expect(
      after.map((slot) => [slot.role, slot.patterns, slot.optional]),
    ).toEqual(before.map((slot) => [slot.role, slot.patterns, slot.optional]));
    const core = after.filter((slot) =>
      slot.patterns.some((pattern) => groups.flat().includes(pattern)),
    );
    observed.push(core.flatMap((slot) => slot.patterns));
  }
  expect(observed.some((patterns) => patterns.length > 0)).toBe(true);
});
