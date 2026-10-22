import { postpartumVolumeStepCap, postpartumMuscleSets } from '../postpartum-risk';
import { type EngineCheckin, type EnginePlan, type EngineProfile, type RuleTrace } from '../contracts';
import type { WorkoutRecord } from '../../domain/v8/contracts';
import { Rules, type Exercise } from '../data';
import { type Item } from '../dose';

import { runGates } from '../gates';

import { allJointSetsLow } from './feedback';
export function applyRecoveryGuards(
  p: EngineProfile,
  r: Rules,
  e: Exercise,
  s: ReturnType<typeof runGates>['restrictions'],
  completed: WorkoutRecord[],
  item: Item,
  before: Item,
  current: EngineCheckin | undefined,
  postpartumRisk: boolean,
  postpartumBaseline: Map<string, number> | undefined,
  value: EnginePlan,
  trace: RuleTrace[],
  ruleId: string,
) {
  // Unknown pain history is not evidence of two pain-free sessions.
  const relevant = p.cautions.filter(c => c !== 'other' && (e.joint_load[c] ?? 0) > 0);
  const painFree = relevant.every(joint => {
    const jointRecords = completed
      .filter(record =>
        record.sets.some(
          f => !r.byExercise.has(f.exerciseId) || (r.byExercise.get(f.exerciseId)!.joint_load[joint] ?? 0) > 0,
        ),
      )
      .slice(-r.get('caution.progression_gate').hold_load_until.gte);
    return (
      jointRecords.length >= r.get('caution.progression_gate').hold_load_until.gte &&
      jointRecords.every(record => allJointSetsLow(record, joint, r))
    );
  });
  const repeated =
    !s.user.professional_seen &&
    p.painState?.some(
      state =>
        state.pattern === e.primary_pattern && (state.repeatEvents ?? 0) >= r.get('pain.repeat_referral').when.gte,
    );
  if (
    ((relevant.length && !painFree) || repeated) &&
    ((item.target.metricType === 'reps_load' &&
      before.target.metricType === 'reps_load' &&
      item.target.loadGrams > before.target.loadGrams) ||
      e.id !== item.exerciseId)
  ) {
    Object.assign(item, before);
    ruleId = '';
    r.trace(trace, 'caution.progression_gate', 'complete_low_pain_joint_sessions_required', { exerciseId: e.id });
  }
  if (current?.sorenessResolved === false || current?.newOrWorseJointPain === true) {
    const increased =
      item.sets > before.sets ||
      ('reps' in item.target && 'reps' in before.target && item.target.reps > before.target.reps) ||
      ('loadGrams' in item.target && 'loadGrams' in before.target && item.target.loadGrams > before.target.loadGrams) ||
      ('durationSeconds' in item.target &&
        'durationSeconds' in before.target &&
        item.target.durationSeconds > before.target.durationSeconds) ||
      (item.exerciseId !== before.exerciseId &&
        (r.byExercise.get(item.exerciseId)?.difficulty ?? Infinity) > e.difficulty);
    if (increased) {
      Object.assign(item, before);
      ruleId = '';
      r.trace(trace, 'volume.week.increase', 'unresolved_current_recovery_holds_progression', { exerciseId: e.id });
    }
  }
  if (postpartumRisk && item.sets > before.sets) {
    const cap = postpartumVolumeStepCap(r);
    while (
      item.sets > before.sets &&
      [...postpartumMuscleSets(value, r)].some(([group, sets]) => sets - (postpartumBaseline!.get(group) ?? 0) > cap)
    )
      item.sets--;
  }
  return ruleId;
}
