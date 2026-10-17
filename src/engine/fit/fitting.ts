import { cardioWorkCap, capCardioItems } from "./cardio-cap";
import { fillSafeBudget } from "./refill";
import { finalizeFit } from "./finalize";
import { type SessionDraft, type PipelineContext } from "../contracts";
import { insertBeforeCooldown } from "./item-order";
import { estimateSeconds } from "./estimate";
import { retainsRequirements } from "./requirements";
import { checkHard } from "../hard-checks";
import { newWeek, prescribe } from "../dose";
import { marginal } from "../score";
import { candidatesFor } from "../candidates";

export function fitDuration(
  session: SessionDraft,
  target: number,
  ctx: PipelineContext,
): SessionDraft {
  let out = structuredClone(session);
  const r = ctx.rules,
    p = ctx.profile,
    bounds = r.get("duration.fit.bounds"),
    band = r.get("duration.fit.tolerance").band,
    T = target * 60,
    locked = new Set(
      (ctx.lockedItemIndexes ?? []).map((n) => out.items[n]?.exerciseId),
    ),
    distance = (s: SessionDraft) => Math.abs(estimateSeconds(s, r) - T),
    accept = (next: SessionDraft) => {
      if (!retainsRequirements(out, next, ctx)) return false;
      if (distance(next) < distance(out)) {
        const base = ctx.plan ?? {
            weeklyTarget: p.daysPerWeek,
            sessionMinutes: target,
            templates: [],
            meta: {
              engineVersion: "2",
              rulesVersion: r.data.rulesVersion,
              seed: ctx.profileHash,
            },
            trace: [],
            notices: [],
            gates: ctx.gate.reasons,
          },
          plan = {
            ...base,
            templates: [
              ...base.templates.filter((t) => t.id !== next.id),
              next,
            ],
          },
          violations = checkHard(plan, p, ctx.gate, r, true).filter(
            (e) =>
              e.severity === "error" &&
              !["duration_tolerance", "balance_days"].includes(e.code),
          );
        if (violations.length) return false;
        out = next;
        return true;
      }
      return false;
    };
  out = capCardioItems(out, p, r, ctx.gate, locked);
  const week = newWeek(p, r),
    cap = Math.min(
      bounds.sets_per_exercise_max[p.level],
      week
        ? Array.isArray(week.sets_per_exercise)
          ? week.sets_per_exercise[1]
          : week.sets_per_exercise
        : Infinity,
    );
  const planFor = (session: SessionDraft) =>
    Object.freeze({
      ...ctx.plan!,
      weeklyTarget: p.daysPerWeek,
      sessionMinutes: target,
      templates: [
        ...(ctx.plan?.templates.filter((t) => t.id !== session.id) ?? []),
        session,
      ],
      meta: ctx.plan?.meta ?? {
        engineVersion: "2",
        rulesVersion: r.data.rulesVersion,
        seed: ctx.profileHash,
      },
      trace: ctx.trace,
      notices: [],
      gates: ctx.gate.reasons,
    });
  // Remove one optional action at a time, choosing the smallest true quality loss.
  while (estimateSeconds(out, r) > T * band[1]) {
    const plan = planFor(out),
      choices = out.items
        .flatMap((item, index) => {
          const slot =
            out.slots.find((s) => s.id === item.prescription?.sourcePosition) ??
            out.slots[index];
          if (
            locked.has(item.exerciseId) ||
            !slot?.optional ||
            out.items.length <= 1
          )
            return [];
          const next = structuredClone(out);
          next.items.splice(index, 1);
          return retainsRequirements(out, next, ctx)
            ? [
                {
                  next,
                  gain: marginal(
                    plan,
                    { kind: "remove", templateId: out.id, itemIndex: index },
                    p,
                    r,
                  ),
                },
              ]
            : [];
        })
        .sort((a, b) => b.gain - a.gain);
    if (!choices.some((choice) => accept(choice.next))) break;
  }
  if (estimateSeconds(out, r) < T * band[0])
    for (const slot of out.slots.filter(
      (s) =>
        s.optional &&
        !out.items.some((i) => i.prescription?.sourcePosition === s.id),
    )) {
      const pool = candidatesFor(slot, p, ctx.gate, {
        ...ctx,
        usedIds: new Set(out.items.map((i) => i.exerciseId)),
        usedLadders: new Set(
          out.items
            .map((i) => r.byExercise.get(i.exerciseId)?.ladder.id)
            .filter((id): id is string => !!id),
        ),
      });
      const e = pool[0];
      if (!e) continue;
      const next = structuredClone(out),
        item = prescribe(e, p, r, ctx.gate.restrictions, slot.role, 1);
      if (item.prescription) item.prescription.sourcePosition = slot.id;
      insertBeforeCooldown(next, item);
      accept(next);
    }
  for (let pass = 0; pass < out.items.length * cap; pass++) {
    const seconds = estimateSeconds(out, r);
    const over = seconds > T,
      choices: { next: SessionDraft; gain: number }[] = [],
      plan = over ? planFor(out) : undefined;
    let increased = false;
    for (let n = 0; n < out.items.length; n++) {
      const i = out.items[n],
        e = r.byExercise.get(i.exerciseId);
      if (
        locked.has(i.exerciseId) ||
        !["main", "accessory"].includes(i.prescription?.block ?? "") ||
        !e ||
        !["strength", "isometric", "power"].includes(e.modality)
      )
        continue;
      const min =
          i.prescription?.block === "main" &&
          e.nsca_class === "compound" &&
          target > 10 &&
          !week
            ? bounds.sets_per_exercise_min.main_compound
            : bounds.sets_per_exercise_min.other,
        next = structuredClone(out);
      next.items[n].sets += over ? -1 : 1;
      if (next.items[n].sets < min || next.items[n].sets > cap) continue;
      if (over)
        choices.push({
          next,
          gain: marginal(
            plan!,
            {
              kind: "replace",
              templateId: out.id,
              itemIndex: n,
              item: next.items[n],
            },
            p,
            r,
          ),
        });
      else if (accept(next)) {
        increased = true;
        break;
      }
    }
    if (over) {
      choices.sort((a, b) => b.gain - a.gain);
      if (!choices.some((choice) => accept(choice.next))) break;
    } else if (!increased) break;
  }
  // Compress only source-allowed noncompeting pairs, after slot and set changes.
  if (estimateSeconds(out, r) > T * band[1]) {
    const when = r.get("session.superset.when"),
      pairing = r.get("session.superset.pairing"),
      forbid = pairing.forbidden_if,
      group = (id: string, key: string) => {
        const e = r.byExercise.get(id)!;
        return key === "any_strength"
          ? ["strength", "isometric"].includes(e.modality)
          : (pairing.groups[key] ?? []).includes(e.primary_pattern);
      };
    for (let a = 0; a < out.items.length; a++)
      for (let b = a + 1; b < out.items.length; b++) {
        const x = out.items[a],
          y = out.items[b],
          ex = r.byExercise.get(x.exerciseId),
          ey = r.byExercise.get(y.exerciseId);
        if (
          !ex ||
          !ey ||
          locked.has(x.exerciseId) ||
          locked.has(y.exerciseId) ||
          x.prescription?.groupId ||
          y.prescription?.groupId ||
          !x.prescription ||
          !y.prescription ||
          (p.goal === "strength" &&
            when.strength_goal_main_lifts === "straight" &&
            (x.prescription.block === "main" ||
              y.prescription.block === "main"))
        )
          continue;
        if (
          ex.primary_pattern === ey.primary_pattern ||
          (ex.ladder.id && ex.ladder.id === ey.ladder.id) ||
          forbid.both_flag.some(
            (f: string) => ex.flags.includes(f) && ey.flags.includes(f),
          ) ||
          Object.entries(forbid.both_joint_load_min).some(
            ([j, n]) =>
              ex.joint_load[j] >= Number(n) && ey.joint_load[j] >= Number(n),
          ) ||
          (ex.time.setup_s >= forbid.both_setup_s_min &&
            ey.time.setup_s >= forbid.both_setup_s_min) ||
          (forbid.different_space_large &&
            ex.space !== ey.space &&
            [ex.space, ey.space].includes("large")) ||
          (p.goal === "strength" &&
            [...ex.flags, ...ey.flags].some((f) =>
              forbid.either_flag_when_goal_strength.includes(f),
            ))
        )
          continue;
        const back =
          forbid.core_member_joint_load_min_with_back_loaded_partner?.back;
        if (
          back !== undefined &&
          (((pairing.groups.core ?? []).includes(ex.primary_pattern) &&
            ex.joint_load.back >= back &&
            ey.joint_load.back >= back) ||
            ((pairing.groups.core ?? []).includes(ey.primary_pattern) &&
              ey.joint_load.back >= back &&
              ex.joint_load.back >= back))
        )
          continue;
        if (
          !pairing.allowed_pairs.some(
            ([u, v]: string[]) =>
              (group(x.exerciseId, u) && group(y.exerciseId, v)) ||
              (group(x.exerciseId, v) && group(y.exerciseId, u)),
          )
        )
          continue;
        const next = structuredClone(out);
        for (const n of [a, b])
          Object.assign(next.items[n].prescription!, {
            structure: "superset",
            groupId: "fit-" + a + "-" + b,
          });
        accept(next);
      }
  }
  fillSafeBudget(() => out, T, ctx, locked, accept);
  // Source timed ranges constrain holds; continuous aerobic work may fill the remaining budget.
  for (let n = 0; n < out.items.length; n++) {
    const i = out.items[n],
      e = r.byExercise.get(i.exerciseId);
    if (locked.has(i.exerciseId) || !e || !("durationSeconds" in i.target))
      continue;
    const next = structuredClone(out),
      item = next.items[n];
    if (!("durationSeconds" in item.target)) continue;
    const side =
        i.prescription?.perSide || e.time.per_side
          ? r.get("session.time.model").per_side_multiplier
          : 1,
      delta = (T - estimateSeconds(out, r)) / (i.sets * side),
      range =
        e.modality === "isometric"
          ? r.get("dose.isometric")[p.level].hold_s
          : e.modality === "mobility"
            ? p.population.kind === "older_adult"
              ? r.get("dose.stretch").hold_s.older_adult
              : r.get("dose.stretch").hold_s.range
            : e.modality === "cardio" &&
                i.prescription?.block === "conditioning"
              ? [1, cardioWorkCap(e, p, r, ctx.gate) / (i.sets * side)]
              : e.default_dose[p.level]?.seconds;
    if (!range) continue;
    item.target.durationSeconds = Math.max(
      Math.ceil(range[0]),
      Math.min(
        Math.floor(range[1]),
        Math.round(item.target.durationSeconds + delta),
      ),
    );
    accept(next);
  }
  // Only repair a remaining hard-duration overflow after all ordinary fitting stages.
  const hardHigh =
    target === r.get("session.durations.allowed").minutes[0]
      ? (bounds.min10_duration_seconds?.[1] ??
        target * 60 * bounds.duration_band[1])
      : target * 60 * bounds.duration_band[1];
  while (estimateSeconds(out, r) > hardHigh) {
    const plan = planFor(out),
      choices = out.items
        .flatMap((item, index) => {
          const e = r.byExercise.get(item.exerciseId),
            range = e?.default_dose[p.level]?.sets;
          if (
            locked.has(item.exerciseId) ||
            item.prescription?.block !== "balance" ||
            e?.primary_pattern !== "balance" ||
            !range ||
            range.length !== 2 ||
            item.sets - 1 < range[0] ||
            item.sets - 1 > range[1]
          )
            return [];
          const next = structuredClone(out);
          next.items[index].sets--;
          return [
            {
              next,
              gain: marginal(
                plan,
                {
                  kind: "replace",
                  templateId: out.id,
                  itemIndex: index,
                  item: next.items[index],
                },
                p,
                r,
              ),
            },
          ];
        })
        .sort((a, b) => b.gain - a.gain);
    if (!choices.some((choice) => accept(choice.next))) break;
  }
  return finalizeFit(out, target, session, ctx, r, T);
}
