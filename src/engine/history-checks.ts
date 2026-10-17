import {
  derivePostpartumRisk,
  postpartumLoadStepCap,
  postpartumVolumeStepCap,
  postpartumMuscleSets,
} from "./postpartum-risk";
import type {
  EnginePlan,
  EngineProfile,
  EngineValidationContext,
  ValidationIssue,
} from "./contracts";
import { Rules, elapsedDays, detrainingGapDays } from "./data";
function lowJointSession(
  record: import("../domain/v8/contracts").WorkoutRecord,
  joint: string,
  r: Rules,
): boolean {
  if (
    record.status !== "complete" ||
    record.plannedSetCount <= 0 ||
    record.sets.length < record.plannedSetCount ||
    record.sets.some((f) => !r.byExercise.has(f.exerciseId))
  )
    return false;
  const key = (f: {
      exerciseId: string;
      itemIndex: number;
      setIndex: number;
    }) => `${f.exerciseId}:${f.itemIndex}:${f.setIndex}`,
    sets = record.sets.filter(
      (f) => (r.byExercise.get(f.exerciseId)!.joint_load[joint] ?? 0) > 0,
    ),
    keys = new Set(sets.map(key)),
    reports = (record.setFeedbackEvents ?? []).filter(
      (e) => e.painArea === joint && keys.has(key(e)),
    );
  return (
    sets.length > 0 &&
    keys.size === sets.length &&
    sets.every((f) =>
      reports.some((e) => key(e) === key(f) && e.painScore !== undefined),
    ) &&
    reports.every(
      (e) =>
        e.painScore !== undefined &&
        Number.isFinite(e.painScore) &&
        e.painScore >= r.get("pain.prompt").scale.min &&
        e.painScore <= r.get("pain.rule").bands[0].when.all[0].lte,
    )
  );
}
/** Recheck actual changes against recorded working sets; never trust a producer trace. */
export function checkHistoryChanges(
  plan: EnginePlan,
  p: EngineProfile,
  context: EngineValidationContext | undefined,
  r: Rules,
): ValidationIssue[] {
  const c = context?.progression;
  if (!c || !p.asOfDate) return [];
  const issues: ValidationIssue[] = [];
  const postpartumRisk = derivePostpartumRisk(p, r).applies;
  if (postpartumRisk) {
    const before = postpartumMuscleSets(c.baseline, r),
      after = postpartumMuscleSets(plan, r),
      cap = postpartumVolumeStepCap(r);
    for (const [group, sets] of after)
      if (sets - (before.get(group) ?? 0) > cap)
        issues.push({
          code: "postpartum_risk_progression",
          ruleId: "postpartum.risk_modifiers",
          severity: "error",
          reason:
            "weekly muscle set increase exceeds source lower bound: " + group,
        });
  }
  const records = [...new Map(c.history.map((h) => [h.id, h])).values()]
    .filter(
      (h) =>
        (h.status === "complete" || h.status === "partial") &&
        h.endedAt &&
        h.localDate <= p.asOfDate!,
    )
    .sort(
      (a, b) =>
        a.localDate.localeCompare(b.localDate) ||
        a.startedAt.localeCompare(b.startedAt) ||
        a.id.localeCompare(b.id),
    );
  const latest = records.at(-1),
    returning =
      !!latest &&
      elapsedDays(latest.localDate, p.asOfDate) > detrainingGapDays(p, r);
  for (const t of plan.templates) {
    if (c.templateId && c.templateId !== t.id) continue;
    const baseline = c.baseline.templates.find((b) => b.id === t.id);
    if (!baseline) continue;
    for (const [index, item] of t.items.entries()) {
      const matches = baseline.items.filter(
          (row) =>
            row.exerciseId === item.exerciseId &&
            row.prescription?.block === item.prescription?.block,
        ),
        position = item.prescription?.sourcePosition;
      const before =
          (position
            ? baseline.items.find(
                (row) => row.prescription?.sourcePosition === position,
              )
            : undefined) ??
          (matches.length === 1 ? matches[0] : baseline.items[index]),
        e = r.byExercise.get(item.exerciseId);
      const old = before ? r.byExercise.get(before.exerciseId) : undefined;
      if (
        old &&
        e &&
        old.ladder.id &&
        old.ladder.id === e.ladder.id &&
        e.ladder.step > old.ladder.step
      ) {
        for (const joint of p.cautions.filter(
          (j) => j !== "other" && (old.joint_load[j] ?? 0) > 0,
        )) {
          const count = r.get("caution.progression_gate")
              .ladder_step_up_requires.gte,
            jointRecords = records
              .filter((record) =>
                record.sets.some(
                  (f) =>
                    !r.byExercise.has(f.exerciseId) ||
                    (r.byExercise.get(f.exerciseId)!.joint_load[joint] ?? 0) >
                      0,
                ),
              )
              .slice(-count);
          if (
            jointRecords.length < count ||
            !jointRecords.every((record) => lowJointSession(record, joint, r))
          )
            issues.push({
              code: "history_progression",
              ruleId: "caution.progression_gate",
              severity: "error",
              templateId: t.id,
              itemIndex: index,
              reason:
                "ladder progression requires complete low-pain joint sessions",
            });
        }
      }
      if (
        !before ||
        before.exerciseId !== item.exerciseId ||
        !e ||
        item.target.metricType !== "reps_load" ||
        before.target.metricType !== "reps_load"
      )
        continue;
      const baselineIndex = baseline.items.indexOf(before);
      const relevant = records
        .map((record) => ({
          record,
          sets: record.sets.filter(
            (f) =>
              f.exerciseId === e.id &&
              (record.templateId === t.id
                ? f.itemIndex === baselineIndex
                : new Set(
                    record.sets
                      .filter((s) => s.exerciseId === e.id)
                      .map((s) => s.itemIndex),
                  ).size === 1),
          ),
        }))
        .filter((v) => v.sets.length);
      const last = relevant.at(-1);
      if (!last) continue;
      const add = (ruleId: string, reason: string) =>
        issues.push({
          code: "history_progression",
          ruleId,
          severity: "error",
          templateId: t.id,
          itemIndex: index,
          reason,
        });
      if (returning) {
        const previous = last.sets.flatMap((f) =>
          (f.loadGrams ?? 0) > 0 ? [f.loadGrams!] : [],
        );
        if (previous.length) {
          const gapWeeks = elapsedDays(latest!.localDate, p.asOfDate) / 7,
            classification = r.get("progression.return.classify"),
            older =
              p.population.kind === "older_adult"
                ? r.get("older.return_after_break")
                : undefined;
          const short =
              older?.returning_short_weeks_max ??
              classification.classes.returning_short.gap_weeks_max,
            mid =
              older?.returning_mid_weeks.max ??
              classification.classes.returning_mid.gap_weeks_max;
          const kind =
              gapWeeks <= short ? "short" : gapWeeks <= mid ? "mid" : "long",
            rule = r.get(`progression.return.${kind}`),
            pct =
              kind === "short"
                ? rule.week_1.load_pct
                : kind === "mid"
                  ? rule.load_pct_by_week[0]
                  : rule.start.load_pct;
          if (
            item.target.loadGrams >= Math.max(...previous) ||
            item.target.loadGrams >
              Math.floor((Math.max(...previous) * pct) / 100)
          )
            add(
              "progression.return.first_session_cap",
              "return load must respect source ramp from recorded prebreak working load",
            );
        }
        const bestSets = Math.max(...relevant.map((v) => v.sets.length));
        if (item.sets >= bestSets)
          add(
            "progression.return.first_session_cap",
            "return sets must be below recorded previous best",
          );
      }
      if (item.target.loadGrams <= before.target.loadGrams) continue;
      const goal = r.get(`goal.params.${p.goal}`),
        role = item.prescription?.goalRole ?? item.prescription?.block;
      const maxReps =
        p.goal === "strength"
          ? role === "accessory"
            ? goal.accessory.reps[1]
            : p.level === "beginner" &&
                p.trainingAgeWeeks <
                  r.get("goal.strength.beginner_rep_gate")
                    .weeks_trained_before_low_reps
              ? r.get("goal.strength.beginner_rep_gate")
                  .main_lift_reps_before_gate.max
              : goal.main_lift.reps[1]
          : (goal.reps?.max ?? e.default_dose[p.level]?.reps?.[1]);
      const newRule = r.get("progression.new.load_step"),
        week = Math.floor(p.trainingAgeWeeks) + 1,
        isNew =
          p.level === "beginner" &&
          week >= newRule.weeks[0] &&
          week <= newRule.weeks[1];
      const previousLoad = before.target.loadGrams;
      const loads = (
        p.availableLoadsKg?.[e.id] ??
        e.equipment_required.flatMap((k) => p.availableLoadsKg?.[k] ?? [])
      )
        .map((kg) => Math.round(kg * 1000))
        .filter((load) => load > previousLoad)
        .sort((a, b) => a - b);
      if (
        isNew &&
        (last.sets.length < before.sets ||
          last.sets.some((f) => (f.reps ?? 0) < maxReps) ||
          !loads.length ||
          item.target.loadGrams !== loads[0])
      )
        add(
          "progression.new.load_step",
          "novice load increase requires rep maximum and smallest available step",
        );
      const cap =
        p.population.kind === "older_adult"
          ? r.get("older.strength.progression").load_step_pct_max.default
          : r.get("progression.load.increment").max_step_pct;
      if (
        postpartumRisk &&
        (item.target.loadGrams >
          before.target.loadGrams * (1 + postpartumLoadStepCap(e, r) / 100) ||
          !loads.length ||
          item.target.loadGrams !== loads[0])
      )
        add(
          "postpartum.risk_modifiers",
          "postpartum load increase requires source lower bound and smallest legal available step",
        );
      const cautionJoints = p.cautions.filter(
        (joint) => joint !== "other" && (e.joint_load[joint] ?? 0) > 0,
      );
      for (const joint of cautionJoints) {
        const count = r.get("caution.progression_gate").hold_load_until.gte,
          jointRecords = records
            .filter((record) =>
              record.sets.some(
                (f) =>
                  !r.byExercise.has(f.exerciseId) ||
                  (r.byExercise.get(f.exerciseId)!.joint_load[joint] ?? 0) > 0,
              ),
            )
            .slice(-count);
        if (
          jointRecords.length < count ||
          !jointRecords.every((record) => lowJointSession(record, joint, r)) ||
          last.sets.length < before.sets ||
          last.sets.some((f) => (f.reps ?? 0) < maxReps)
        )
          add(
            "caution.progression_gate",
            "load progression requires complete low-pain joint sessions and completed rep maximum",
          );
      }
      if (
        !loads.includes(item.target.loadGrams) ||
        item.target.loadGrams > before.target.loadGrams * (1 + cap / 100)
      )
        add(
          p.population.kind === "older_adult"
            ? "older.strength.progression"
            : "progression.load.increment",
          "load increase exceeds available increment or source cap",
        );
      if (p.population.kind === "older_adult") {
        const events = [...(last.record.setFeedbackEvents ?? [])].sort(
          (a, b) =>
            a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
        );
        const adequate =
          last.sets.length >= before.sets &&
          last.sets.every((f) => {
            const event = events
              .filter(
                (ev) =>
                  ev.exerciseId === e.id &&
                  ev.itemIndex === f.itemIndex &&
                  ev.setIndex === f.setIndex,
              )
              .at(-1);
            return (
              event?.rir !== undefined &&
              event.rir >=
                r.get("older.strength.progression")
                  .requires_completed_reps_at_rir_gte
            );
          });
        if (!adequate)
          add(
            "older.strength.progression",
            "older load increase requires recorded completed reps at source RIR",
          );
      }
    }
  }
  return issues;
}
