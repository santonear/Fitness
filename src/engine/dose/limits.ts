import { type EngineProfile } from '../contracts';
import { Rules } from '../data';

export function newWeek(p: EngineProfile, r: Rules) {
  const cap = r.get('progression.new.week_caps');
  const week = Math.floor(p.trainingAgeWeeks) + 1;
  return p.level === 'beginner' && week <= 4
    ? week <= 1
      ? cap.week_1
      : week === 2
        ? cap.week_2
        : cap.week_3_4
    : undefined;
}

export function introductoryStartCap(r: Rules): number {
  const expression = r.get('progression.new.weekly_sets').week_1_max;
  const match = typeof expression === 'string' && /^min\(goal_start,\s*(\d+(?:\.\d+)?)\)$/.exec(expression);
  if (!match) throw new Error('Unsupported introductory weekly cap expression');
  return Number(match[1]);
}

export function volumeLimits(p: EngineProfile, r: Rules) {
  const level = r.get(`dose.sets_week.${p.level}`);
  const goal = r.get('dose.sets_week.goal_matrix')[p.goal][p.level];
  const params = r.get(`goal.params.${p.goal}`);
  let max = Math.min(goal.max, level.ceiling);
  const week = newWeek(p, r);
  if (week) {
    const v = r.get('progression.new.weekly_sets');
    max = Math.min(
      max,
      v.through_week_4_max,
      Math.min(goal.start, introductoryStartCap(r)) + Math.floor(p.trainingAgeWeeks) * v.weekly_increase_max,
    );
  }
  const generalMin =
    p.goal === 'start_moving'
      ? params.sets_per_muscle_week.min
      : Math.max(level.floor, params.sets_per_muscle_week.min);
  const intro = r.get('progression.new.weekly_sets');
  if (week && typeof intro.week_1_min !== 'number') throw new Error('Missing compiled introductory weekly minimum');
  return {
    min: Math.min(
      max,
      generalMin,
      week ? intro.week_1_min + Math.floor(p.trainingAgeWeeks) * intro.weekly_increase_max : Infinity,
    ),
    max,
    start: Math.min(max, goal.start),
  };
}
