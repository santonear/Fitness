import { estimateSeconds } from '../../../src/engine/fit';
import { Rules } from '../../../src/engine/data';
import { cardioWorkCap } from '../../../src/engine/fit/cardio-cap';
import { runGates } from '../../../src/engine/gates';
import { fixtureProfile, planFixture } from './fixtures';

/** Hand-built, source-bounded positive control; scoring fixtures remain unchanged. */
export const boundedCardioProfile = {
  ...fixtureProfile,
  daysPerWeek: 1,
  sessionMinutes: 10,
};
export function boundedCardioPlanFixture() {
  const plan = planFixture(),
    template = plan.templates[0],
    rules = new Rules(),
    profile = boundedCardioProfile;
  const item = template.items[0],
    exercise = rules.byExercise.get(item.exerciseId)!;
  item.target = {
    metricType: 'duration',
    durationSeconds: cardioWorkCap(exercise, profile, rules, runGates(profile, rules)),
  };
  plan.sessionMinutes = profile.sessionMinutes;
  template.targetMinutes = profile.sessionMinutes;
  template.estimatedSeconds = estimateSeconds(template, rules);
  template.estimatedMinutes = Math.ceil(template.estimatedSeconds / 60);
  return plan;
}
