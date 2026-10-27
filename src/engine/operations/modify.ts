import type { Change, EngineChange, EnginePlan, EngineProfile, EngineResult } from '../contracts';

import { Rules } from '../data';
import { prescribe, effectiveGoalRole, strengthRoles } from '../dose';
import { createContext, generatePlan } from '../pipeline';
import { candidatesFor } from '../candidates';

import { fitDuration } from '../fit';

import { changes, result } from './result';
import { slotFor, legal, insertWork, retainSource } from './shared';
import { adjust } from './adjust';
import { substituteItem } from './substitute';
import { isYogaSession, YOGA_POSITION_PREFIX } from '../yoga-session';
import { chosenYogaItem, settleYogaSession } from '../yoga';
export function modify(
  plan: EnginePlan,
  p: EngineProfile,
  requests: EngineChange[],
  r: Rules,
): EngineResult<EnginePlan> {
  let value = structuredClone(plan),
    profile = structuredClone(p);
  const diff: Change[] = [];
  for (const req of requests) {
    if (req.op === 'frequency' && req.daysPerWeek) {
      const next = generatePlan({ ...profile, daysPerWeek: req.daysPerWeek }, { rules: r });
      if (!next.templates.length) continue;
      diff.push({
        kind: 'frequency',
        before: value.weeklyTarget,
        after: next.weeklyTarget,
      });
      value = next;
      profile = { ...profile, daysPerWeek: req.daysPerWeek };
      continue;
    }
    for (const t of value.templates.filter(t => !req.templateId || req.templateId === t.id)) {
      const before = structuredClone(t),
        index = req.itemIndex ?? t.items.findIndex(i => i.exerciseId === req.exerciseId),
        item = t.items[index],
        ctx = createContext(profile, 0, r);
      ctx.plan = value;
      ctx.currentWeekday = t.weekday;
      const yoga = isYogaSession(t);
      if (req.op === 'shorten' && req.minutes) {
        Object.assign(t, adjust(t, profile, { minutes: req.minutes }, r, ctx).value);
        diff.push(...changes(before, t));
        continue;
      }
      if (req.op === 'remove' && item) t.items.splice(index, 1);
      else if (req.op === 'replace' && item) {
        if (!req.replacementId) {
          ctx.usedIds = new Set(t.items.map(i => i.exerciseId));
          t.items[index] = substituteItem(item, profile, 'dislike', r, ctx).value as typeof item;
        } else if (yoga) {
          ctx.usedIds = new Set(t.items.map(i => i.exerciseId));
          const chosen = chosenYogaItem(item, req.replacementId, ctx);
          if (chosen) t.items[index] = chosen;
        } else {
          ctx.usedIds = new Set(t.items.map(i => i.exerciseId));
          const e = candidatesFor(slotFor(item, []), profile, ctx.gate, ctx).find(e => e.id === req.replacementId);
          if (e)
            t.items[index] = retainSource(
              prescribe(
                e,
                profile,
                r,
                ctx.gate.restrictions,
                profile.goal === 'strength'
                  ? (strengthRoles(t.items, profile, r).get(item) ?? effectiveGoalRole(item, profile, r))
                  : effectiveGoalRole(item, profile, r),
                item.sets,
              ),
              item,
            );
        }
      } else if (req.op === 'add' && req.exerciseId && yoga) {
        // Only another safe pose joins a yoga session, just before the closing rest.
        ctx.usedIds = new Set(t.items.map(i => i.exerciseId));
        const last = t.items.at(-1)!,
          extra = {
            ...structuredClone(last),
            prescription: {
              ...last.prescription!,
              block: 'mobility' as const,
              sourcePosition: `${YOGA_POSITION_PREFIX}extra`,
            },
          },
          chosen = t.items.some(i => i.exerciseId === req.exerciseId)
            ? undefined
            : chosenYogaItem(extra, req.exerciseId, ctx);
        if (chosen) t.items.splice(Math.max(0, t.items.length - 1), 0, chosen);
      } else if (req.op === 'add' && req.exerciseId) {
        ctx.usedIds = new Set(t.items.map(i => i.exerciseId));
        const e = candidatesFor(
          {
            id: 'add',
            role: 'accessory',
            patterns: [],
            priority: 0,
            optional: true,
            sourceRuleId: 'select.rank',
          },
          profile,
          ctx.gate,
          ctx,
        ).find(e => e.id === req.exerciseId);
        if (e) insertWork(t.items, prescribe(e, profile, r, ctx.gate.restrictions, 'accessory', 1));
      } else if (req.op === 'set_volume' && item) {
        if (req.sets) item.sets = req.sets;
        if (req.reps && 'reps' in item.target) item.target.reps = req.reps;
        if (req.durationSeconds && 'durationSeconds' in item.target) item.target.durationSeconds = req.durationSeconds;
        if (req.loadGrams && item.target.metricType === 'reps_load') item.target.loadGrams = req.loadGrams;
      }
      // A yoga session keeps its own sequence; holds and extra sets settle back into its length.
      if (yoga) settleYogaSession(t, profile, ctx);
      const { slots: _, ...fitted } = yoga
        ? { ...t, slots: [] }
        : fitDuration({ ...t, slots: [] }, profile.sessionMinutes, ctx);
      if (legal(fitted, profile, ctx)) {
        Object.assign(t, fitted);
        diff.push(...changes(before, t));
      } else Object.assign(t, before);
    }
  }
  return result(value, diff, r, profile);
}
