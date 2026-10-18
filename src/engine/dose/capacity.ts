import {
  type EngineProfile,
  type GateOutcome,
  type DayPlan,
} from "../contracts";
import { Rules } from "../data";
import { buildWeek } from "../structure";
import {
  type AllocatedVolumeCapacity,
  type AllocatedCapacityDay,
} from "./capacity-types";
import { newWeek, volumeLimits } from "./limits";
import { isHardEligible } from "../candidates";
import { buildSlots } from "../skeleton";
import { prescribe } from "./prescribe";
import { strengthRoles } from "./roles";
import { credit } from "./volume";
import { powerExercise } from "./rep-ranges";

/**
 * Capacity of ONE explicit joint allocation, not an optimum over the exercise catalog.
 * Fix source slots and the cheapest legal straight prescription per slot (ID breaks ties).
 * Visit slots in source order, first their legal minimum dose, then one set per round.
 * Session/intro hard caps remove unavailable increments from this fixed path. Stop a
 * day's prefix at the first unaffordable increment; never search alternative programs.
 * Each increment costs actual work+overhead+rest; the first increment adds catalog
 * setup+transition-rest once, reproducing the shared (sets-1)*rest clock exactly.
 * Capacity-table counts are reference metadata, not hard caps. The affordable prefix is bounded
 * and reproducible. All muscles share these same sets and their real fractional credit.
 * A missing RT row/slot or uncostable minimum makes the whole week's per-muscle
 * capacity unmeasured. Partial items/counts remain diagnostic, never scoring evidence.
 */
export function allocatedVolumeCapacity(
  p: EngineProfile,
  g: GateOutcome,
  r = new Rules(),
  days: DayPlan[] = buildWeek(p, g, r).days,
): AllocatedVolumeCapacity {
  const groups: string[] = r.get("dose.muscle_groups").target_groups,
    result: AllocatedVolumeCapacity = {
      model: "source_straight_fixed_quota_prefix",
      byMuscle: Object.fromEntries(groups.map((group) => [group, null])),
      totalWorkingSets: 0,
      days: [],
    };
  if (g.status === "blocked") return result;
  const source = r.get("duration.capacity.table"),
    overhead = r.get("duration.set.overhead"),
    transition = r.get("duration.transition.setup").buffer_s,
    bounds = r.get("duration.fit.bounds"),
    intro = newWeek(p, r),
    sessionCap = r.get("dose.sets_session.cap").per_muscle_fractional_sets_max[
      p.level
    ],
    weekly: Record<string, number> = {},
    weeklyCap = intro ? volumeLimits(p, r).max : Infinity;
  const legal = r.data.exercises.filter(
    (e) =>
      ["strength", "isometric", "power"].includes(e.modality) &&
      isHardEligible(e, p, g, { rules: r }),
  );
  let measured = true;
  const lower = (value: unknown) =>
    typeof value === "number"
      ? value
      : Array.isArray(value) && typeof value[0] === "number"
        ? value[0]
        : 0;
  for (const day of days.filter((day) =>
    ["full", "upper", "lower"].includes(day.kind),
  )) {
    const row = source.sessions
      .filter(
        (row: { minutes: number; level_min?: string }) =>
          row.minutes <= day.minutes &&
          (!row.level_min || row.level_min === p.level),
      )
      .at(-1);
    if (!row) {
      measured = false;
      continue;
    }
    const recipe = r.get(`session.template.min${row.minutes}`),
      variant = recipe.variants?.[p.goal],
      recipeSlots = recipe.slots.flatMap((slot: Record<string, any>) =>
        variant?.trim?.[slot.slot] === null ||
        variant?.replace?.[slot.slot] === null
          ? []
          : [
              {
                ...slot,
                ...variant?.replace?.[slot.slot],
                ...variant?.extend?.[slot.slot],
              },
            ],
      );
    const seconds = (slot: Record<string, any>) =>
      slot.minutes !== undefined
        ? lower(slot.minutes) * 60
        : lower(slot.seconds);
    const warm = Math.max(
        row.warmup * 60,
        recipeSlots
          .filter(
            (slot: Record<string, any>) =>
              slot.block === "warmup" && !slot.ramp,
          )
          .reduce(
            (n: number, slot: Record<string, any>) => n + seconds(slot),
            0,
          ),
      ),
      cold = Math.max(
        row.cooldown * 60,
        recipeSlots
          .filter((slot: Record<string, any>) => slot.block === "cooldown")
          .reduce(
            (n: number, slot: Record<string, any>) => n + seconds(slot),
            0,
          ),
      );
    const nonWork = recipeSlots
        .filter((slot: Record<string, any>) =>
          ["conditioning", "mobility", "balance"].includes(slot.block),
        )
        .reduce((n: number, slot: Record<string, any>) => n + seconds(slot), 0),
      balance = day.balanceRequired
        ? r.get("session.warmup.balance_older").add_slot.seconds[0]
        : 0;
    const fixedSeconds = warm + cold + row.ramp_s + nonWork + balance,
      entry: AllocatedCapacityDay = {
        dayId: day.id,
        targetSeconds: day.minutes * 60,
        fixedSeconds,
        usedSeconds: fixedSeconds,
        sourceMinutes: row.minutes,
        referenceSetLimit: row.straight_only_sets ?? row.sets_range[1],
        items: [],
        stoppedBy: "source_or_hard_cap",
      };
    result.days.push(entry);
    const slots = buildSlots(day, p, row.minutes, r).filter((slot) =>
        ["main", "accessory"].includes(slot.role),
      ),
      used = new Set<string>(),
      ladders = new Set<string>();
    let missing = false;
    const countLimit = intro?.exercises_per_session?.[1] ?? Infinity;
    for (const slot of slots.slice(0, countLimit)) {
      const uses = r.get("select.use_tag.slot_match")[
        slot.role === "main" ? "main_slot_requires" : "accessory_slot_requires"
      ].use;
      const pool = legal.filter(
        (e) =>
          slot.patterns.includes(e.primary_pattern) &&
          e.use.some((use) => uses.includes(use)) &&
          !used.has(e.id) &&
          (!e.ladder.id || !ladders.has(e.ladder.id)),
      );
      const options = pool
        .map((e) => {
          const item = prescribe(e, p, r, g.restrictions, slot.role);
          item.prescription!.sourcePosition = slot.id;
          const side =
              item.prescription?.perSide || e.time.per_side
                ? r.get("session.time.model").per_side_multiplier
                : 1,
            work =
              ("durationSeconds" in item.target
                ? item.target.durationSeconds
                : item.target.reps *
                  (item.prescription?.secondsPerRep ??
                    e.time.s_per_rep ??
                    r.get("duration.rep.seconds").default_if_unknown)) *
                side +
              overhead.overhead_s_per_set,
            cost = work + item.prescription!.restSeconds;
          return { e, item, cost };
        })
        .sort((a, b) => a.cost - b.cost || a.e.id.localeCompare(b.e.id, "en"));
      const selected = options[0];
      if (!selected) {
        missing = true;
        continue;
      }
      used.add(selected.e.id);
      if (selected.e.ladder.id) ladders.add(selected.e.ladder.id);
      entry.items.push({
        item: selected.item,
        unitCredit: {},
        setCostSeconds: selected.cost,
        setupSeconds: selected.e.time.setup_s + transition,
        maxSets: 0,
        minimumSets: 0,
      });
    }
    if (missing || !entry.items.length) measured = false;
    const roles = strengthRoles(
      entry.items.map((value) => value.item),
      p,
      r,
    );
    for (const value of entry.items) {
      const old = value.item,
        e = r.byExercise.get(old.exerciseId)!,
        role =
          p.goal === "strength"
            ? (roles.get(old) ?? "accessory")
            : old.prescription!.block;
      const cap = prescribe(
        e,
        p,
        r,
        g.restrictions,
        role,
        bounds.sets_per_exercise_max[p.level],
      );
      cap.prescription!.sourcePosition = old.prescription!.sourcePosition;
      cap.prescription!.block = old.prescription!.block;
      if (p.goal === "strength")
        cap.prescription!.goalRole = role as "main" | "accessory";
      value.maxSets = Math.min(
        cap.sets,
        p.goal === "strength" && role === "main"
          ? r.get("dose.sets_session.cap").strength_main_lift_direct_sets_max
          : Infinity,
      );
      cap.sets = 1;
      value.item = cap;
      value.unitCredit = credit(cap, r);
      const side =
          cap.prescription!.perSide || e.time.per_side
            ? r.get("session.time.model").per_side_multiplier
            : 1,
        work =
          ("durationSeconds" in cap.target
            ? cap.target.durationSeconds
            : cap.target.reps *
              (cap.prescription!.secondsPerRep ??
                e.time.s_per_rep ??
                r.get("duration.rep.seconds").default_if_unknown)) *
            side +
          overhead.overhead_s_per_set;
      value.setCostSeconds = work + cap.prescription!.restSeconds;
      value.setupSeconds =
        e.time.setup_s + transition - cap.prescription!.restSeconds;
      // Specific introductory/older low-start prescriptions take precedence over the generic minimum.
      value.minimumSets = Math.min(
        value.maxSets,
        powerExercise(e, r)
          ? r.get("dose.power").sets[0]
          : role === "main" &&
              e.nsca_class === "compound" &&
              day.minutes > 10 &&
              !intro
            ? bounds.sets_per_exercise_min.main_compound
            : bounds.sets_per_exercise_min.other,
      );
      value.item.sets = 0;
    }
    const session: Record<string, number> = {},
      startWeekly = { ...weekly };
    let allocated = 0,
      minimumFailed = false;
    const add = (
      value: AllocatedCapacityDay["items"][number],
      sets: number,
    ) => {
      const amount = Object.entries(value.unitCredit),
        time =
          sets * value.setCostSeconds +
          (value.item.sets === 0 ? value.setupSeconds : 0);
      if (
        value.item.sets + sets > value.maxSets ||
        amount.some(
          ([group, n]) =>
            (session[group] ?? 0) + n * sets > sessionCap ||
            (weekly[group] ?? 0) + n * sets > weeklyCap,
        )
      )
        return "cap";
      if (entry.usedSeconds + time > entry.targetSeconds) return "time";
      entry.usedSeconds += time;
      value.item.sets += sets;
      allocated += sets;
      for (const [group, n] of amount) {
        session[group] = (session[group] ?? 0) + n * sets;
        weekly[group] = (weekly[group] ?? 0) + n * sets;
      }
      return "added";
    };
    for (const value of entry.items)
      if (add(value, value.minimumSets) !== "added") {
        minimumFailed = true;
        break;
      }
    if (minimumFailed) {
      measured = false;
      for (const value of entry.items) value.item.sets = 0;
      entry.usedSeconds = fixedSeconds;
      entry.stoppedBy = "minimum_dose";
      for (const group of Object.keys(weekly)) delete weekly[group];
      Object.assign(weekly, startWeekly);
      continue;
    }
    let stopped = false;
    while (!stopped) {
      let progressed = false;
      for (const value of entry.items) {
        const outcome = add(value, 1);
        if (outcome === "time") {
          entry.stoppedBy = "time";
          stopped = true;
          break;
        }
        if (outcome === "added") progressed = true;
      }
      if (!progressed) break;
    }
    if (missing && entry.stoppedBy !== "time")
      entry.stoppedBy = "missing_candidates";
    result.totalWorkingSets += allocated;
  }
  if (measured)
    for (const group of groups)
      if ((weekly[group] ?? 0) > 0) result.byMuscle[group] = weekly[group];
  return result;
}
