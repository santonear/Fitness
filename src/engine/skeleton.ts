import type { DayPlan, EngineProfile, Pattern, Slot } from "./contracts";
import { Rules, type RuleValue } from "./data";
import { buildWeek } from "./structure";
import { runGates } from "./gates";
import { isHardEligible } from "./candidates";
import { prescribe, newWeek } from "./dose";
import { estimateSeconds } from "./fit";
/** One-day core targets are independent of the broader multi-day coverage target. */
export function sourceCorePatternGroups(
  rtDays: number,
  rules: Rules,
): Pattern[][] {
  const source = rules.get("balance.week.core_three"),
    target = rtDays >= 3 ? source.rt_days_min_3 : source.rt_days_1_2;
  return [
    ...(target.required_each ?? target.required ?? []).map(
      (pattern: Pattern) => [pattern],
    ),
    ...(target.required_one_of ? [target.required_one_of] : []),
  ];
}
/** Expand grouped source positions into independently fillable movement slots. */
export function buildSlots(
  day: DayPlan,
  profile: EngineProfile,
  minutes: number,
  rules = new Rules(),
): Slot[] {
  const allowed: number[] = rules.get("session.durations.allowed").minutes;
  let duration = allowed.reduce((nearest, value) =>
    Math.abs(value - minutes) < Math.abs(nearest - minutes) ? value : nearest,
  );
  const durations = rules.get("session.durations.allowed");
  if (
    duration === allowed[allowed.length - 1] &&
    !durations.min90_requires_level.includes(profile.level)
  )
    duration = durations.min90_beginner_fallback;
  const templateId = "session.template.min" + duration,
    template = rules.get(templateId);
  const sourceId =
    day.sourceDayRuleId ??
    "week.day." +
      {
        full: day.index % 2 ? "fb_b" : "fb_a",
        upper: "u1",
        lower: "l1",
        aerobic: "aerobic",
        mobility: "mobility",
        early_postpartum: "aerobic",
      }[day.kind];
  const positions: RuleValue[] =
    sourceId === "postpartum.phase1" ? [] : rules.get(sourceId).slots;
  const priority = (role: Slot["role"]) =>
    [
      "cooldown",
      "conditioning",
      "warmup",
      "mobility",
      "balance",
      "accessory",
      "main",
    ].indexOf(role);
  const make = (
    id: string,
    role: Slot["role"],
    patterns: Pattern[],
    sourceRuleId: string,
    optional: boolean,
  ): Slot => ({
    id: day.id + "-" + id,
    role,
    patterns,
    priority: priority(role),
    optional,
    sourceRuleId,
  });
  let slots: Slot[] = [];
  if (day.kind === "early_postpartum")
    slots = [
      make(
        "early",
        "conditioning",
        rules.get("session.conditioning.slot").pattern_priority.slice(0, 1),
        "postpartum.phase1",
        false,
      ),
    ];
  else if (day.kind === "aerobic" || day.kind === "mobility")
    slots = positions
      .filter(
        (p) =>
          !p.applies_population || profile.population.kind === "older_adult",
      )
      .map((p) => ({
        ...make(
          p.pos,
          p.pattern.includes("balance")
            ? "balance"
            : day.kind === "mobility"
              ? "mobility"
              : p.use.includes("conditioning")
                ? "conditioning"
                : p.use[0],
          p.pattern,
          sourceId,
          p.pos !== "main_aerobic" && day.kind !== "mobility",
        ),
        ...(day.kind === "mobility" && p.target
          ? { region: p.target as Slot["region"] }
          : {}),
      }));
  else {
    const variant = template.variants?.[profile.goal];
    const sourceSlots: RuleValue[] = template.slots
      .map((slot: RuleValue) => {
        const replacement = variant?.replace?.[slot.slot];
        return replacement === null
          ? null
          : replacement
            ? { ...slot, ...replacement }
            : slot;
      })
      .filter(Boolean);
    const firstMain = positions.find((p) => p.pos === "main_1")!;
    for (const slot of sourceSlots) {
      if (variant?.trim?.[slot.slot] === null) continue;
      const role: Slot["role"] =
        slot.block === "core" ? "accessory" : slot.block;
      if (slot.from_pos) {
        for (const pos of slot.from_pos) {
          const source = positions.find((p) => p.pos === pos);
          if (source)
            slots.push(
              make(
                slot.slot + "-" + pos,
                role,
                source.pattern,
                sourceId,
                role !== "main",
              ),
            );
        }
      } else
        slots.push(
          make(
            slot.slot,
            role,
            Array.isArray(slot.pattern) ? slot.pattern : firstMain.pattern,
            templateId,
            role !== "main",
          ),
        );
    }
  }
  if (
    minutes <=
    rules.get("session.cooldown.stretch").exempt_when_session_minutes_max
  )
    slots = slots.filter((s) => s.role !== "cooldown");
  if (
    day.balanceRequired &&
    !slots.some((s) => s.patterns.includes("balance"))
  ) {
    const index = slots.findIndex((slot) =>
      ["conditioning", "cooldown", "mobility"].includes(slot.role),
    );
    slots.splice(
      index < 0 ? slots.length : index,
      0,
      make(
        "balance",
        "balance",
        rules.get("session.warmup.balance_older").add_slot.pattern,
        "older.week.multicomponent",
        false,
      ),
    );
  }
  if (profile.population.kind === "older_adult" || day.balanceRequired)
    slots = slots.map((slot) =>
      slot.patterns.includes("balance") ? { ...slot, optional: false } : slot,
    );
  if (["full", "upper", "lower"].includes(day.kind)) {
    const source = rules.get("balance.week.core_three"),
      all: Pattern[] = [
        ...source.rt_days_min_3.required_each,
        ...source.rt_days_1_2.required,
        ...source.rt_days_1_2.required_one_of,
      ];
    if (
      !slots.some(
        (slot) =>
          ["main", "accessory"].includes(slot.role) &&
          slot.patterns.some((pattern) => all.includes(pattern)),
      )
    ) {
      const gate = runGates(profile, rules),
        days = buildWeek(profile, gate, rules).days.filter((day) =>
          ["full", "upper", "lower"].includes(day.kind),
        ),
        groups = sourceCorePatternGroups(days.length, rules),
        uses = rules.get("select.use_tag.slot_match").accessory_slot_requires
          .use;
      const legal = rules.data.exercises.filter(
          (e) =>
            e.use.some((use) => uses.includes(use)) &&
            all.includes(e.primary_pattern) &&
            isHardEligible(e, profile, gate, { rules }),
        ),
        preferred =
          groups[
            days.findIndex((value) => value.id === day.id) % groups.length
          ] ?? all,
        pool = legal.filter((e) => preferred.includes(e.primary_pattern)),
        patterns = [
          ...new Set(
            (pool.length ? pool : legal).map((e) => e.primary_pattern),
          ),
        ];
      if (patterns.length) {
        const next = [...slots],
          limit =
            newWeek(profile, rules)?.exercises_per_session?.[1] ?? Infinity,
          working = next.filter((slot) =>
            ["main", "accessory"].includes(slot.role),
          );
        if (working.length >= limit) {
          const overflow =
              String(template.overflow_rule ?? "").match(/[a-z]+_\d+/g) ?? [],
            index = next.findIndex(
              (slot) =>
                ["main", "accessory"].includes(slot.role) &&
                (slot.optional ||
                  overflow.some((pos) => slot.id.endsWith("-" + pos))),
            );
          if (index >= 0) next.splice(index, 1);
        }
        const itemCost = (slot: Slot) => {
            const choices = rules.data.exercises.filter(
              (e) =>
                slot.patterns.includes(e.primary_pattern) &&
                e.use.some((use) =>
                  (
                    rules.get("select.use_tag.slot_match")[
                      slot.role + "_slot_requires"
                    ]?.use ?? uses
                  ).includes(use),
                ) &&
                isHardEligible(e, profile, gate, { rules }),
            );
            return choices.length
              ? Math.min(
                  ...choices.map((e) =>
                    estimateSeconds(
                      {
                        items: [
                          prescribe(
                            e,
                            profile,
                            rules,
                            gate.restrictions,
                            slot.role,
                            1,
                          ),
                        ],
                      },
                      rules,
                    ),
                  ),
                )
              : 0;
          },
          preparation = next
            .filter((slot) => ["warmup", "cooldown"].includes(slot.role))
            .reduce((seconds, slot) => {
              const authored = template.slots.find((value: RuleValue) =>
                slot.id.endsWith("-" + value.slot),
              );
              return (
                seconds +
                Math.max(
                  authored?.seconds?.[0] ?? (authored?.minutes ?? 0) * 60,
                  itemCost(slot),
                )
              );
            }, 0),
          extra = make(
            "source-core",
            "accessory",
            patterns,
            "balance.week.core_three",
            true,
          ),
          minimum =
            next
              .filter(
                (slot) =>
                  !slot.optional &&
                  ["main", "accessory", "balance"].includes(slot.role),
              )
              .reduce(
                (seconds, slot) => seconds + itemCost(slot),
                preparation,
              ) + itemCost(extra),
          bounds = rules.get("duration.fit.bounds"),
          high =
            minutes === rules.get("session.durations.allowed").minutes[0]
              ? bounds.min10_duration_seconds[1]
              : minutes * 60 * bounds.duration_band[1];
        if (
          next.filter((slot) => ["main", "accessory"].includes(slot.role))
            .length < limit &&
          minimum <= high
        ) {
          slots = next;
          const index = slots.findIndex((slot) =>
            ["conditioning", "cooldown", "mobility", "balance"].includes(
              slot.role,
            ),
          );
          slots.splice(index < 0 ? slots.length : index, 0, extra);
        }
      }
    }
  }
  if (!slots.some((s) => !s.optional) && slots.length)
    slots[0] = { ...slots[0], optional: false };
  return slots;
}
