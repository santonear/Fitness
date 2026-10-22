import { EngineProfile } from '../contracts';

import { Rules, stretchHoldRange } from '../data';

import { credit, prescribe, strengthRoles, Item, Template } from '../dose';

import { safety, SafetyState } from '../gates/strength-scoring';

import { hardEligible } from './legacy-candidates';

import { setSeconds, blockSeconds, estimatedSeconds } from '../fit/elapsed-time';

import { durationTier, timingRow, templateTargetMinutes } from './legacy-target';

import { safetyBlockMinimums } from './legacy-blocks';
import { plannedCooldown, priorityStretchGroups, requiredStretchGroups, shortStretchSession } from './legacy-cooldown';

export function ensureCooldown(
  template: Template,
  p: EngineProfile,
  r: Rules,
  s: SafetyState,
  reset = false,
  fullDefault = false,
) {
  if (s.population === 'postpartum' && s.phase === 1) return;
  if (!fullDefault) {
    const planned = plannedCooldown(template, p, r, s),
      previous = template.items.filter(i => i.prescription?.block === 'cooldown');
    if (
      previous.length === planned.items.length &&
      previous.every(item => planned.items.some(next => next.exerciseId === item.exerciseId))
    )
      template.items = template.items.map(item =>
        item.prescription?.block === 'cooldown'
          ? planned.items.find(next => next.exerciseId === item.exerciseId)!
          : item,
      );
    else template.items = [...template.items.filter(i => i.prescription?.block !== 'cooldown'), ...planned.items];
    return;
  }
  if (reset) template.items = template.items.filter(item => item.prescription?.block !== 'cooldown');
  const ctx = {
      profile: p,
      rules: r,
      safety: s,
      seed: 'source-cooldown',
      trace: [],
      used: new Set<string>(),
      ladders: new Set<string>(),
    },
    rule = r.get('session.cooldown.stretch'),
    holds = r.get('dose.stretch').hold_s,
    range = s.population === 'older_adult' ? holds.older_adult : holds.range,
    hold = Math.max(range[0], Math.min(range[1], s.cooldownHoldSeconds ?? rule.dose.default.hold_s)),
    groups =
      !fullDefault && s.cooldownPrimaryOnly && shortStretchSession(template, p, r, s)
        ? priorityStretchGroups(template, r)
        : requiredStretchGroups(template, r),
    plannedTarget = Math.min(rule.total_s_per_muscle_target, hold * rule.dose.default.sets);
  const covered = (group: string) =>
    template.items
      .filter(
        item =>
          item.prescription?.block === 'cooldown' &&
          r.byExercise.get(item.exerciseId)?.mobility_type === 'static' &&
          r.byExercise.get(item.exerciseId)?.stretch_targets?.includes(group) &&
          'durationSeconds' in item.target,
      )
      .reduce((sum, item) => sum + ('durationSeconds' in item.target ? item.sets * item.target.durationSeconds : 0), 0);
  const pool = r.data.exercises.filter(
    e =>
      e.modality === 'mobility' &&
      e.mobility_type === 'static' &&
      e.stretch_targets?.length &&
      e.use.includes('cooldown') &&
      e.difficulty <= r.get('select.difficulty.window').warmup_cooldown_max &&
      hardEligible(e, ctx),
  );
  for (const group of groups) {
    if (covered(group) >= plannedTarget) continue;
    const candidate = pool
      .filter(
        e =>
          e.stretch_targets!.includes(group) &&
          !template.items.some(
            i => i.exerciseId === e.id || (e.ladder.id && r.byExercise.get(i.exerciseId)?.ladder.id === e.ladder.id),
          ),
      )
      .sort(
        (a, b) =>
          Number(a.time.per_side) - Number(b.time.per_side) ||
          b.stretch_targets!.filter(g => groups.includes(g) && covered(g) < rule.total_s_per_muscle_target).length -
            a.stretch_targets!.filter(g => groups.includes(g) && covered(g) < rule.total_s_per_muscle_target).length ||
          a.id.localeCompare(b.id, 'en'),
      )[0];
    if (candidate) {
      const item = prescribe(candidate, p, r, s, 'cooldown', rule.dose.default.sets);
      item.sets = rule.dose.default.sets;
      const range = stretchHoldRange(candidate, r, s.population)!;
      item.target = {
        metricType: 'duration',
        durationSeconds: Math.max(range[0], Math.min(range[1], hold)),
      };
      template.items.push(item);
    }
  }
  const minimum = Math.max(
    timingRow(durationTier(templateTargetMinutes(template, p, r), p, r), r).cooldown * 60,
    safetyBlockMinimums(template, p, r).cooldownSeconds,
  );
  const existing = template.items.find(item => {
    const e = r.byExercise.get(item.exerciseId);
    return (
      item.prescription?.block === 'cooldown' &&
      e?.modality === 'cardio' &&
      e.use.includes('cooldown') &&
      hardEligible(e, ctx) &&
      'durationSeconds' in item.target &&
      (item.prescription.targetRpe?.[1] ?? Infinity) <= r.get('aerobic.intensity.rpe_scale').light_max
    );
  });
  if (existing && 'durationSeconds' in existing.target && blockSeconds(template, 'cooldown', r) < minimum) {
    const e = r.byExercise.get(existing.exerciseId)!,
      side = existing.prescription?.perSide || e.time.per_side ? r.get('session.time.model').per_side_multiplier : 1;
    existing.target.durationSeconds += Math.ceil(
      (minimum - blockSeconds(template, 'cooldown', r)) / (existing.sets * side),
    );
  }
  if (blockSeconds(template, 'cooldown', r) < minimum) {
    const e = r.data.exercises
      .filter(
        e =>
          e.modality === 'cardio' &&
          e.use.includes('cooldown') &&
          hardEligible(e, ctx) &&
          !template.items.some(i => i.exerciseId === e.id),
      )
      .sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id, 'en'))[0];
    if (e) {
      const item = prescribe(e, p, r, s, 'cooldown', 1),
        side = e.time.per_side ? r.get('session.time.model').per_side_multiplier : 1;
      item.target = {
        metricType: e.metricType === 'duration_distance' ? 'duration_distance' : 'duration',
        durationSeconds: Math.max(
          1,
          Math.ceil(
            (minimum - blockSeconds(template, 'cooldown', r) - r.get('duration.set.overhead').overhead_s_per_set) /
              side,
          ),
        ),
      };
      template.items.push(item);
    }
  }
}
