import { type EngineProfile, type RuleTrace } from '../contracts';
import type { SetFact } from '../../domain/v8/contracts';
import { Rules, type Exercise } from '../data';
import { effectiveGoalRole, newWeek, prescribe, type Item } from '../dose';

import { isHardEligible } from '../candidates';

import { runGates } from '../gates';

import { minimumLoadStep } from './load-step';
import type { SetFeedback } from './feedback';
export function createItemActions(
  e: Exercise,
  p: EngineProfile,
  r: Rules,
  gate: ReturnType<typeof runGates>,
  s: ReturnType<typeof runGates>['restrictions'],
  role: ReturnType<typeof effectiveGoalRole>,
  item: Item,
  sets: SetFact[],
  feedback: SetFeedback[],
  repMin: number,
  repMax: number,
  trace: RuleTrace[],
) {
  const setLoad = (pct: number) => {
    if (pct > 0) {
      if (newWeek(p, r) && (sets.length < item.sets || sets.some(f => (f.reps ?? 0) < repMax))) return false;
      if (
        p.cautions.some(joint => joint !== 'other' && (e.joint_load[joint] ?? 0) > 0) &&
        (sets.length < item.sets || sets.some(f => (f.reps ?? 0) < repMax))
      ) {
        r.trace(trace, 'caution.progression_gate', 'volume_before_load', {
          exerciseId: e.id,
        });
        return false;
      }
      if (
        p.population.kind === 'older_adult' &&
        (sets.length < item.sets ||
          sets.some(f => {
            const ev = feedback.find(ev => ev.itemIndex === f.itemIndex && ev.setIndex === f.setIndex);
            return (
              ev?.rir === undefined || ev.rir < r.get('older.strength.progression').requires_completed_reps_at_rir_gte
            );
          }))
      )
        return false;
    }
    if (item.target.metricType === 'reps_load' && item.target.loadGrams > 0) {
      const old = item.target.loadGrams;
      const next = minimumLoadStep(e, p, r, old, pct);
      if (old === next) return false;
      item.target.loadGrams = next;
      if (pct > 0) item.target.reps = repMin;
      return true;
    }
    return false;
  };
  const ladder = (delta: number) => {
    if (!e.ladder.id) return false;
    const possible = r.data.exercises
      .filter(
        other =>
          other.ladder.id === e.ladder.id &&
          (delta > 0 ? other.ladder.step > e.ladder.step : other.ladder.step < e.ladder.step) &&
          other.difficulty <= e.difficulty + r.get('ladder.step.up').max_difficulty_jump &&
          isHardEligible(other, p, gate, { rules: r }),
      )
      .sort((a, b) =>
        delta > 0 ? a.ladder.step - b.ladder.step : b.ladder.step - a.ladder.step || a.id.localeCompare(b.id),
      );
    const next = possible[0];
    if (!next) {
      if (delta < 0) item.sets = Math.max(1, item.sets - 1);
      return false;
    }
    const replacement = prescribe(next, p, r, s, role, item.sets);
    replacement.prescription!.block = item.prescription?.block ?? 'main';
    if (item.prescription?.goalRole) replacement.prescription!.goalRole = item.prescription.goalRole;
    if (item.prescription?.sourcePosition) replacement.prescription!.sourcePosition = item.prescription.sourcePosition;
    Object.assign(item, replacement);
    return true;
  };
  return { setLoad, ladder };
}
