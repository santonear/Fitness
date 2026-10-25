import type { SetFeedbackEvent, WorkoutRecord } from '../domain/v8/contracts';
import { Rules, condition, type Exercise } from '../engine/data';
import type { Caution } from '../engine/contracts';
import type { EngineProfile } from '../engine/contracts';
import { redFlagQuestionKeys } from '../engine/gates/redflag-items';
type Review = NonNullable<EngineProfile['screening']['redFlagReview']>;
/** Derive known danger from retained training facts; withdrawing profile storage cannot declare it resolved. */
export function historyDangerReview(history: WorkoutRecord[], stored?: Review): Review | undefined {
  const positive = history.flatMap(record =>
    (record.painActions ?? []).flatMap(action => {
      const event = record.setFeedbackEvents?.find(event => event.id === action.eventId);
      return event?.painArea && Object.values(action.redFlagAnswers ?? {}).some(Boolean) ? [{ action, event }] : [];
    }),
  );
  if (!positive.length) return stored;
  const latest = Math.max(...positive.map(row => Date.parse(row.action.appliedAt)));
  if (stored?.professionalSeenAt && Date.parse(stored.professionalSeenAt) >= latest) return stored;
  const areas = [...new Set([...(stored?.areas ?? []), ...positive.map(row => row.event.painArea!)])],
    questionKeys = [...new Set([...painQuestionKeys(areas), ...(stored?.questionKeys ?? [])])];
  const answers: Record<string, boolean> = {};
  for (const source of [...positive.map(row => row.action.redFlagAnswers), stored?.answers])
    for (const [key, value] of Object.entries(source ?? {})) answers[key] = answers[key] === true || value;
  const requiredAt = [...positive.map(row => row.action.appliedAt), ...(stored ? [stored.requiredAt] : [])]
    .sort((a, b) => Date.parse(a) - Date.parse(b))
    .at(-1)!;
  return {
    requiredAt,
    areas,
    questionKeys,
    answers,
    ...(questionKeys.every(key => typeof answers[key] === 'boolean') ? { answeredAt: requiredAt } : {}),
  };
}
export function painQuestionKeys(areas: Caution[]) {
  return redFlagQuestionKeys(new Rules(), areas);
}
/** Append order represents an explicit correction; never edit the earlier fact. */
export function latestSetFeedback(record: WorkoutRecord) {
  const rows = new Map<string, SetFeedbackEvent>();
  for (const event of record.setFeedbackEvents ?? [])
    rows.set(`${event.itemIndex}:${event.setIndex}:${event.exerciseId}`, event);
  return [...rows.values()];
}
/** Ending or abandoning a workout does not answer its outstanding safety questions. */
export function pendingPainReviews(history: WorkoutRecord[]) {
  const bands = new Rules().get('pain.rule').bands as { when: unknown; action: string }[];
  return history.flatMap(record => {
    const processed = new Set(record.painActions?.map(action => action.eventId));
    return latestSetFeedback(record)
      .filter(
        event =>
          event.effort === 'discomfort' &&
          !processed.has(event.id) &&
          bands.some(
            band =>
              band.action !== 'continue' &&
              condition(band.when, {} as Exercise, { pain: { current: event.painScore } }),
          ),
      )
      .map(event => ({ workoutId: record.id, event }));
  });
}
