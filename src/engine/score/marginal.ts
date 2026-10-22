import { type Plan, type PlanChange, type EngineProfile, type ScoreResult } from '../contracts';
import { Rules } from '../data';
import { type GenerationTimingBatch, type Session, type SessionFacts } from './types';
import { sessionFacts, aggregate } from './facts';
import { evaluate } from './evaluate';
import { targetSatisfactions } from './registry';
import { clamp } from './math';

export function marginalInBatch(
  plan: Plan,
  change: PlanChange,
  profile: EngineProfile,
  rules: Rules,
  timing?: GenerationTimingBatch,
): number {
  const index = plan.templates.findIndex(t => t.id === change.templateId);
  if (index < 0) return 0;
  const original = plan.templates[index],
    items = [...original.items];
  if (change.kind === 'add' && change.item) items.push(change.item);
  else if (change.kind === 'replace' && change.item && change.itemIndex !== undefined)
    items[change.itemIndex] = change.item;
  else if (change.kind === 'remove' && change.itemIndex !== undefined) {
    if (!Number.isInteger(change.itemIndex) || change.itemIndex < 0 || change.itemIndex >= items.length) return 0;
    items.splice(change.itemIndex, 1);
  } else if (change.kind === 'move-set' && change.fromIndex !== undefined && change.toIndex !== undefined) {
    if (!items[change.fromIndex] || !items[change.toIndex] || items[change.fromIndex].sets <= 1) return 0;
    items[change.fromIndex] = {
      ...items[change.fromIndex],
      sets: items[change.fromIndex].sets - 1,
    };
    items[change.toIndex] = {
      ...items[change.toIndex],
      sets: items[change.toIndex].sets + 1,
    };
  } else return 0;
  const after = {
      ...plan,
      templates: plan.templates.map((t, i) => (i === index ? { ...t, items } : t)),
    },
    fingerprint = Object.isFrozen(plan) ? 'immutable-baseline' : JSON.stringify([plan.templates, profile]),
    cached = marginalCache.get(plan);
  const reusable = cached?.fingerprint === fingerprint && cached.profile === profile && cached.rules === rules,
    parts = reusable ? cached.parts : plan.templates.map(t => sessionFacts(t, rules)),
    before = reusable ? cached.score : evaluate(plan, profile, rules, aggregate(parts), timing);
  marginalCache.set(plan, {
    fingerprint,
    profile,
    rules,
    score: before,
    parts,
  });
  const touched =
    change.kind === 'add'
      ? [items.length - 1]
      : change.kind === 'replace' || change.kind === 'remove'
        ? [change.itemIndex!]
        : [change.fromIndex!, change.toIndex!];
  const changed = (
    change.kind === 'remove' ? [original.items[change.itemIndex!]] : touched.flatMap(i => [original.items[i], items[i]])
  ).filter((item): item is Session['items'][number] => !!item);
  const blocks = new Set(changed.map(i => i.prescription?.block));
  const affected = new Set(['duration.fit.tolerance', `goal.params.${profile.goal}`]);
  const include = (ids: string[]) => ids.forEach(id => affected.add(id));
  if (changed.some(i => i.prescription?.structure === 'circuit')) include(['safety.session.warmup_cooldown']);
  if (changed.some(i => rules.byExercise.get(i.exerciseId)?.primary_pattern === 'balance'))
    include(['older.week.multicomponent', 'older.template.balance_required']);
  if (blocks.has('main') || blocks.has('accessory'))
    include([
      'safety.session.warmup_cooldown',
      'goal.floor.all',
      'week.coverage.patterns',
      'week.frequency.per_muscle',
      'week.recovery.spacing',
      'session.warmup.dynamic',
      'session.cooldown.stretch',
      'dose.sets_week.beginner',
      'dose.sets_week.intermediate',
      'dose.sets_week.goal_matrix',
      'dose.sets_exercise',
      'select.unilateral.weekly',
      'balance.week.pull_push',
      'balance.week.hinge_knee',
      'balance.week.core_three',
      'progression.new.weekly_sets',
      'older.week.strength',
      'pregnancy.week.target',
      'postpartum.weekly_target',
    ]);
  if (blocks.has('conditioning'))
    include([
      'caution.back.keep_active',
      'safety.session.warmup_cooldown',
      'goal.aerobic.baseline',
      'goal.interference.guard',
      'aerobic.target.weekly',
      'older.week.aerobic',
      'pregnancy.week.target',
      'postpartum.weekly_target',
    ]);
  if (blocks.has('warmup'))
    include([
      'safety.session.warmup_cooldown',
      'session.warmup.general',
      'session.warmup.dynamic',
      'session.warmup.balance_older',
      'session.warmup.no_long_static',
      'older.week.multicomponent',
      'older.template.balance_required',
    ]);
  if (blocks.has('cooldown'))
    include(['safety.session.warmup_cooldown', 'session.cooldown.stretch', 'older.week.flexibility']);
  if (blocks.has('balance')) include(['older.week.multicomponent', 'older.template.balance_required']);
  const f = aggregate(
      parts.map((part, i) =>
        i === index
          ? sessionFacts(after.templates[index], rules, Object.isFrozen(plan) ? part.contributions : undefined)
          : part,
      ),
    ),
    rows = new Map(before.perRule.map(row => [row.id, row]));
  for (const id of affected) {
    const rule = rules.byId.get(id);
    if (rule?.severity !== 'target') continue;
    const satisfaction = targetSatisfactions[id]?.({
      plan: after,
      p: profile,
      r: rules,
      f,
      v: rule.value ?? {},
      timing,
    });
    if (satisfaction == null) rows.delete(id);
    else
      rows.set(id, {
        id,
        weight: rule.weight ?? 1,
        satisfaction: clamp(satisfaction),
      });
  }
  const all = [...rows.values()],
    denominator = all.reduce((n, row) => n + row.weight, 0);
  return (
    (denominator ? all.reduce((n, row) => n + row.weight * row.satisfaction, 0) / denominator : 0) - before.quality
  );
}

export const marginalCache = new WeakMap<
  Plan,
  {
    fingerprint: string;
    profile: EngineProfile;
    rules: Rules;
    score: ScoreResult;
    parts: SessionFacts[];
  }
>();
