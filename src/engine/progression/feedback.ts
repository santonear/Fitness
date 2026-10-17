import type { WorkoutRecord } from "../../domain/v8/contracts";
import { Rules } from "../data";

export interface SetFeedback {
  id?: string;
  itemIndex: number;
  setIndex: number;
  exerciseId: string;
  effort: "too_light" | "right" | "too_hard" | "discomfort";
  painScore?: number;
  painArea?: string;
  rir?: number;
  createdAt: string;
}
export interface Checkin {
  energyMotivation?: number;
  poorSleepNights?: number;
  sorenessResolved?: boolean;
  newOrWorseJointPain?: boolean;
}
export type RecordWithFeedback = WorkoutRecord & {
  setFeedbackEvents?: SetFeedback[];
  checkin?: Checkin;
};
export function events(record: WorkoutRecord, id: string): SetFeedback[] {
  const latest = new Map<string, SetFeedback>();
  for (const event of ((record as RecordWithFeedback).setFeedbackEvents ?? [])
    .filter((e) => e.exerciseId === id)
    .sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) ||
        (a.id ?? "").localeCompare(b.id ?? ""),
    ))
    latest.set(`${event.itemIndex}:${event.setIndex}`, event);
  return [...latest.values()].sort(
    (a, b) =>
      a.itemIndex - b.itemIndex ||
      a.setIndex - b.setIndex ||
      a.createdAt.localeCompare(b.createdAt),
  );
}
export function currentEvents(record: WorkoutRecord) {
  return [
    ...new Set(
      ((record as RecordWithFeedback).setFeedbackEvents ?? []).map(
        (e) => e.exerciseId,
      ),
    ),
  ].flatMap((id) => events(record, id));
}
export function facts(record: WorkoutRecord, id: string) {
  return record.sets
    .filter((s) => s.exerciseId === id)
    .sort((a, b) => a.setIndex - b.setIndex);
}
export function allJointSetsLow(
  record: WorkoutRecord,
  joint: string,
  r: Rules,
): boolean {
  if (
    record.status !== "complete" ||
    record.plannedSetCount <= 0 ||
    record.sets.length < record.plannedSetCount
  )
    return false;
  if (record.sets.some((f) => !r.byExercise.has(f.exerciseId))) return false;
  const actual = record.sets.filter(
      (f) => (r.byExercise.get(f.exerciseId)!.joint_load[joint] ?? 0) > 0,
    ),
    key = (f: { exerciseId: string; itemIndex: number; setIndex: number }) =>
      `${f.exerciseId}:${f.itemIndex}:${f.setIndex}`;
  const keys = new Set(actual.map(key));
  if (!actual.length || keys.size !== actual.length) return false;
  const reports = (record.setFeedbackEvents ?? []).filter(
      (event) => event.painArea === joint && keys.has(key(event)),
    ),
    max = r.get("pain.rule").bands[0].when.all[0].lte;
  return (
    actual.every((f) =>
      reports.some(
        (event) => key(event) === key(f) && event.painScore !== undefined,
      ),
    ) &&
    reports.every(
      (event) =>
        event.painScore !== undefined &&
        Number.isFinite(event.painScore) &&
        event.painScore >= 0 &&
        event.painScore <= max,
    )
  );
}
