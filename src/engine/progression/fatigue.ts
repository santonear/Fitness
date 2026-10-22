import { engineCheckinSchema, type EngineCheckin, type EngineProfile, type ProgressionResult } from '../contracts';
import type { WorkoutRecord } from '../../domain/v8/contracts';
import { elapsedDays, Rules } from '../data';

import { currentEvents, facts, type RecordWithFeedback } from './feedback';
export function progressionFatigue(
  completed: WorkoutRecord[],
  options: { checkin?: EngineCheckin; templateId?: string } | undefined,
  p: EngineProfile,
  r: Rules,
  output: ProgressionResult,
) {
  const recent = completed.filter(
    h => elapsedDays(h.localDate, p.asOfDate!) <= r.get('deload.trigger.reactive').window_days,
  );
  const fatigue = r.get('deload.trigger.reactive');
  let flags = 0;
  const current = options?.checkin ? engineCheckinSchema.parse(options.checkin) : undefined;
  const observations = [...recent.map(h => (h as RecordWithFeedback).checkin), ...(current ? [current] : [])];
  if (
    observations.filter(
      answer => (answer?.energyMotivation ?? Infinity) <= fatigue.flags.low_energy_motivation.score_lte,
    ).length >= fatigue.flags.low_energy_motivation.occurrences_gte
  )
    flags++;
  if (
    observations.reduce((sum, answer) => sum + (answer?.poorSleepNights ?? 0), 0) >=
    fatigue.flags.poor_sleep.nights_sum_gte
  )
    flags++;
  if (
    observations.some(answer => answer?.newOrWorseJointPain) ||
    recent.some(h => currentEvents(h).some(e => (e.painScore ?? 0) >= r.get('pain.rule').bands[1].when.all[0].gte))
  )
    flags++;
  if (current?.newOrWorseJointPain) r.notice(output.notices, 'pain.copy.stop_exercise', 'warning');
  const worsened = new Set<string>();
  for (const e of r.data.exercises) {
    const records = recent.filter(h => facts(h, e.id).length).slice(-2);
    if (records.length < 2) continue;
    const [a, b] = records.map(h => facts(h, e.id));
    if (
      a.at(-1)?.loadGrams === b.at(-1)?.loadGrams &&
      (a.at(-1)?.reps ?? 0) - (b.at(-1)?.reps ?? 0) >= fatigue.flags.performance_drop.any[0].rep_drop_gte
    )
      worsened.add(e.id);
  }
  if (worsened.size >= fatigue.flags.performance_drop.any[0].distinct_exercises_gte) flags++;
  return { fatigue, flags, current };
}
