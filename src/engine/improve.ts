import { withinMobilityBudget } from './fit/mobility-budget';
import { beginDefaultScorerBatch } from './score';
import type { PipelineContext, Plan, Scorer, Slot, PlanChange, Pattern, EngineProfile } from './contracts';
import { Rules } from './data';
import { candidatesFor } from './candidates';
import { prescribe } from './dose';
import { checkHard } from './hard-checks';
import { estimateSeconds, retainsRequirements } from './fit';
import { sourceCorePatternGroups } from './skeleton';
import { isYogaSession } from './yoga-session';
/** This target applies at one RT day too; its own secondary-pattern policy is authoritative. */
export function missingCorePatterns(plan: Plan, p: EngineProfile, r: Rules): Set<Pattern> {
  const work = plan.templates.filter(t =>
    t.items.some(i => ['main', 'accessory'].includes(i.prescription?.block ?? '')),
  );
  if (!work.length || (p.population.kind === 'postpartum' && !p.population.cleared)) return new Set();
  const source = r.get('balance.week.core_three'),
    seen = new Set(
      work.flatMap(t =>
        t.items
          .filter(i => ['main', 'accessory'].includes(i.prescription?.block ?? ''))
          .flatMap(i => {
            const e = r.byExercise.get(i.exerciseId);
            return e ? [e.primary_pattern, ...(source.count_secondary_patterns ? e.secondary_patterns : [])] : [];
          }),
      ),
    ),
    missing = new Set<Pattern>();
  for (const group of sourceCorePatternGroups(work.length, r))
    if (!group.some(pattern => seen.has(pattern))) for (const pattern of group) missing.add(pattern);
  return missing;
}
/** Bounded best-improvement search. The input plan is never mutated. */
export function improve(plan: Plan, ctx: PipelineContext, scorer: Scorer, maxRounds = 3): Plan {
  let current = structuredClone(plan);
  const r = ctx.rules,
    p = ctx.profile;
  if (
    p.population.kind === 'postpartum' &&
    ctx.gate.restrictions.population === 'postpartum' &&
    ctx.gate.restrictions.phase === 1 &&
    r.get('postpartum.phase1').minutes_target === 'none'
  )
    return current;
  for (let round = 0; round < Math.min(3, Math.max(0, maxRounds)); round++) {
    Object.freeze(current);
    const endBatch = beginDefaultScorerBatch(scorer, current, p, r);
    try {
      let best = current,
        bestScore = scorer.score(current, p, r).quality;
      const baseline = bestScore;
      let bestChange: PlanChange | undefined;
      const coverage = r.get('week.coverage.patterns'),
        work = current.templates.filter(t =>
          t.items.some(i => ['main', 'accessory'].includes(i.prescription?.block ?? '')),
        ),
        missing = new Set<Pattern>();
      if (
        coverage.on_fail === 'promote_missing_pattern_to_next_free_acc_slot' &&
        work.length >= coverage.applies_when.rt_days_min
      ) {
        const patterns = new Set(
          work.flatMap(t =>
            t.items
              .filter(i => ['main', 'accessory'].includes(i.prescription?.block ?? ''))
              .flatMap(i => {
                const e = r.byExercise.get(i.exerciseId);
                return e ? [e.primary_pattern] : [];
              }),
          ),
        );
        for (const entry of Object.values(coverage.weekly_min_exposures)) {
          if (Array.isArray(entry)) {
            for (const pattern of entry as Pattern[]) if (!patterns.has(pattern)) missing.add(pattern);
          } else {
            const group = entry as { patterns: Pattern[]; min: number };
            if (
              work.filter(t =>
                t.items.some(i => {
                  const e = r.byExercise.get(i.exerciseId);
                  return !!e && group.patterns.includes(e.primary_pattern);
                }),
              ).length < group.min
            )
              for (const pattern of group.patterns) missing.add(pattern);
          }
        }
      }
      const coreMissing = missingCorePatterns(current, p, r);
      for (const pattern of coreMissing) missing.add(pattern);
      const consider = (change: PlanChange, make: () => Plan) => {
        if (scorer.marginal(current, change, p, r) <= bestScore - baseline) return;
        const next = make(),
          band = r.get('duration.fit.tolerance').band;
        if (
          current.templates.some((t, index) => {
            const target = (t.targetMinutes ?? p.sessionMinutes) * 60,
              before = estimateSeconds(t, r) / target,
              after = estimateSeconds(next.templates[index], r) / target;
            return before >= band[0] && before <= band[1] && (after < band[0] || after > band[1]);
          })
        )
          return;
        if (
          current.templates.some(
            (t, index) =>
              !retainsRequirements(t, next.templates[index], {
                ...ctx,
                plan: current,
              }),
          )
        )
          return;
        if (next.templates.some(t => !withinMobilityBudget(t, r))) return;
        for (const t of next.templates) {
          t.estimatedSeconds = estimateSeconds(t, r);
          t.estimatedMinutes = Math.ceil(t.estimatedSeconds / 60);
        }
        if (checkHard(next, p, ctx.gate, r).some(issue => issue.severity === 'error')) return;
        const score = scorer.score(next, p, r).quality;
        if (score > bestScore) {
          best = next;
          bestScore = score;
          bestChange = change;
        }
      };
      for (const [day, t] of current.templates.entries())
        for (const [index, item] of (isYogaSession(t) ? [] : t.items).entries()) {
          if (ctx.lockedItemIndexes?.includes(index)) continue;
          const e = r.byExercise.get(item.exerciseId);
          if (!e) continue;
          const free =
              item.prescription?.goalRole !== 'main' &&
              (item.prescription?.block === 'accessory' ||
                /^day-[a-f0-9]{8}-[^-]+-acc_\d+$/.test(item.prescription?.sourcePosition ?? '')),
            role = free && missing.size ? 'accessory' : (item.prescription?.block ?? 'main');
          const slot: Slot = {
            id: `improve-${index}`,
            role,
            patterns: [e.primary_pattern, ...(free ? [...missing] : [])],
            priority: 0,
            optional: false,
            sourceRuleId: 'select.rank',
          };
          for (const replacement of candidatesFor(slot, p, ctx.gate, {
            ...ctx,
            plan: current,
            currentWeekday: t.weekday,
            usedIds: new Set(t.items.map(i => i.exerciseId)),
            usedLadders: new Set(),
          })) {
            const dose = prescribe(replacement, p, r, ctx.gate.restrictions, slot.role, item.sets);
            if (dose.prescription) {
              if (item.prescription?.sourcePosition)
                dose.prescription.sourcePosition = item.prescription.sourcePosition;
              if (item.prescription?.goalRole) dose.prescription.goalRole = item.prescription.goalRole;
              dose.prescription.block = item.prescription?.block ?? slot.role;
            }
            consider(
              {
                kind: 'replace',
                templateId: t.id,
                itemIndex: index,
                item: dose,
              },
              () => {
                const next = structuredClone(current);
                next.templates[day].items[index] = dose;
                return next;
              },
            );
          }
          if (item.sets <= 1) continue;
          for (let to = 0; to < t.items.length; to++) {
            if (to === index || ctx.lockedItemIndexes?.includes(to)) continue;
            consider(
              {
                kind: 'move-set',
                templateId: t.id,
                fromIndex: index,
                toIndex: to,
              },
              () => {
                const next = structuredClone(current);
                next.templates[day].items[index].sets--;
                next.templates[day].items[to].sets++;
                return next;
              },
            );
          }
        }
      if (best === current) break;
      const old =
          bestChange?.kind === 'replace'
            ? current.templates.find(t => t.id === bestChange!.templateId)?.items[bestChange.itemIndex!]
            : undefined,
        cross =
          !!old &&
          r.byExercise.get(old.exerciseId)?.primary_pattern !==
            r.byExercise.get(bestChange!.item!.exerciseId)?.primary_pattern;
      current = best;
      ctx.trace.push({
        ruleId: cross
          ? coreMissing.has(r.byExercise.get(bestChange!.item!.exerciseId)!.primary_pattern)
            ? 'balance.week.core_three'
            : 'week.coverage.patterns'
          : 'select.rank',
        step: 'improve',
        reason: 'legal local quality gain',
        note: `round ${round + 1}`,
        details: {
          quality: bestScore,
          ...(cross ? { from: old!.exerciseId, to: bestChange!.item!.exerciseId } : {}),
        },
      });
    } finally {
      endBatch();
    }
  }
  return { ...current };
}
