import { intervalSatisfaction, mean } from './math';
import { resistance, feasibleWeekly } from './helpers';
import { sessionCooldownStretch } from './batch-helpers';
import { type Satisfaction } from './types';
export const targetGroup05: Record<string, Satisfaction> = {
  'session.warmup.no_long_static': c => {
    const values: number[] = [];
    for (const t of c.f.sessions) {
      const warm = t.items.filter(i => i.prescription?.block === 'warmup'),
        statics = warm.filter(i => c.r.byExercise.get(i.exerciseId)?.mobility_type === 'static'),
        totals: Record<string, number> = {};
      for (const i of statics)
        for (const group of c.r.byExercise.get(i.exerciseId)?.stretch_targets ?? [])
          totals[group] =
            (totals[group] ?? 0) + ('durationSeconds' in i.target ? i.sets * i.target.durationSeconds : 0);
      for (const i of statics) {
        const e = c.r.byExercise.get(i.exerciseId)!,
          seconds = 'durationSeconds' in i.target ? i.target.durationSeconds : Infinity,
          followup = warm
            .slice(warm.indexOf(i) + 1)
            .some(next => c.r.byExercise.get(next.exerciseId)?.mobility_type === 'dynamic'),
          groups = e.stretch_targets ?? [];
        values.push(
          intervalSatisfaction(seconds, 0, c.v.short_static_allowed_s_max) *
            Number(followup) *
            Number(e.use.includes(c.v.warmup_slot_requires_use)) *
            mean(groups.map(g => intervalSatisfaction(totals[g], 0, c.v.pre_training_static_hold_s_per_muscle_max))),
        );
      }
    }
    return values.length ? mean(values) : null;
  },
  'session.cooldown.stretch': c =>
    !resistance(c) || c.p.sessionMinutes <= c.v.exempt_when_session_minutes_max
      ? null
      : mean(c.f.rt.map(t => sessionCooldownStretch(c, t))),
  'dose.sets_week.beginner': c => (c.p.level === 'beginner' && resistance(c) ? feasibleWeekly(c) : null),
  'dose.sets_week.intermediate': c => (c.p.level === 'intermediate' && resistance(c) ? feasibleWeekly(c) : null),
};
