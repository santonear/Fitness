import type { EngineProfile, RuleTrace } from "../contracts";
import type { WorkoutRecord } from "../../domain/v8/contracts";
import { Rules } from "../data";
export function offerScheduledDeload(
  completed: WorkoutRecord[],
  p: EngineProfile,
  r: Rules,
  trace: RuleTrace[],
) {
  const schedule = r.get("deload.trigger.scheduled");
  const trainingWeeks = new Set(
    completed.map((h) => {
      const d = new Date(h.localDate);
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      return d.toISOString().slice(0, 10);
    }),
  );
  if (
    p.trainingAgeWeeks >= schedule.new_user_no_scheduled_first_training_weeks &&
    trainingWeeks.size >= schedule.offer_after_training_weeks.default
  )
    r.trace(
      trace,
      "deload.trigger.scheduled",
      "scheduled_deload_offered_not_automatically_accepted",
    );
  return schedule;
}
