import { type Plan, type EngineProfile, type ScoreResult } from '../contracts';
import { Rules } from '../data';
import { type Facts, type GenerationTimingBatch } from './types';
import { targetSatisfactions } from './registry';
import { clamp } from './math';
export function evaluate(
  plan: Plan,
  p: EngineProfile,
  r: Rules,
  f: Facts,
  timing?: GenerationTimingBatch,
): ScoreResult {
  const perRule = r.data.rules
    .filter(rule => rule.severity === 'target')
    .flatMap(rule => {
      const satisfaction = targetSatisfactions[rule.id]?.({
        plan,
        p,
        r,
        f,
        v: rule.value ?? {},
        timing,
      });
      return satisfaction == null
        ? []
        : [
            {
              id: rule.id,
              weight: rule.weight ?? 1,
              satisfaction: clamp(satisfaction),
            },
          ];
    });
  return {
    quality: perRule.length
      ? perRule.reduce((n, x) => n + x.weight * x.satisfaction, 0) / perRule.reduce((n, x) => n + x.weight, 0)
      : 0,
    perRule,
    advice: r.data.rules
      .filter(rule => rule.severity === 'advice')
      .map(rule => ({
        id: rule.id,
        satisfied:
          rule.id === 'balance.week.carry_ground'
            ? f.items.some(i => (rule.value?.patterns ?? []).includes(r.byExercise.get(i.exerciseId)?.primary_pattern))
            : false,
      })),
  };
}
