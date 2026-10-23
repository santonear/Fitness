import type { SessionTemplate } from '../../domain/v8/contracts';
import type { SuggestionInput, ReviewSuggestion, PlanProposal } from './contracts';
import { computeExerciseEvidence } from './evidence';
import { dayOf } from './charts';
import { estimatePlannedMinutes } from '../../domain/duration-estimate';
import { discomfortReplacement } from '../rules/basic-items';
import { DEFAULT_TIME_ZONE, addDays, todayIn } from '../../domain/local-date';

function reviewDate(input: SuggestionInput, workout: SuggestionInput['workouts'][number]): string {
  if (!input.timeZone) return workout.localDate;
  return dayOf(workout, input.timeZone);
}
function shortTemplate(source: SessionTemplate): SessionTemplate {
  const items = source.items.slice(0, 3).map(item => ({ ...structuredClone(item), sets: 2 }));
  const estimatedMinutes = estimatePlannedMinutes(items);
  return { ...structuredClone(source), name: `${estimatedMinutes} min`, estimatedMinutes, items };
}

export function recurringDiscomfort(input: SuggestionInput): string[] {
  const rows = input.workouts
    .filter(
      w =>
        w.planVersionId === input.plan.id &&
        reviewDate(input, w) >= input.previous.from &&
        reviewDate(input, w) <= input.current.to &&
        !['in_progress', 'abandoned'].includes(w.status),
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return [...new Set(rows.flatMap(w => computeExerciseEvidence(w).discomfortExerciseIds))].filter(id => {
    const attempts = rows.filter(
      w => w.sets.some(s => s.exerciseId === id) || w.substitutions?.some(s => s.fromExerciseId === id),
    );
    return (
      attempts.length >= 2 &&
      attempts.slice(0, 2).every(w => computeExerciseEvidence(w).discomfortExerciseIds.includes(id))
    );
  });
}

/** Pure candidates only. No saved plans or facts are mutated here. */
export function suggestChange(input: SuggestionInput): ReviewSuggestion | null {
  const { plan, current, previous } = input;
  const base: PlanProposal = {
    goalText: plan.goalText,
    weeklyTarget: plan.weeklyTarget,
    sessionMinutes: plan.sessionMinutes,
    scheduleOriginalText: plan.scheduleOriginalText,
    templates: structuredClone(plan.templates),
    reasons: ['', '', ''],
  };
  const candidate = (rule: ReviewSuggestion['rule'], proposal: PlanProposal, detail = ''): ReviewSuggestion | null => {
    const id = `${current.from}:${plan.id}:${rule}:${detail}`;
    if (input.dismissedIds.includes(id)) return null;
    for (const template of proposal.templates) {
      const original = plan.templates.find(item => item.id === template.id);
      if (!original || JSON.stringify(original.items) !== JSON.stringify(template.items)) {
        template.estimatedMinutes = estimatePlannedMinutes(template.items);
        if (/^\d+ min$/.test(template.name)) template.name = `${template.estimatedMinutes} min`;
      }
    }
    const durations = proposal.templates.map(t => t.estimatedMinutes).sort((a, b) => a - b);
    if (durations.length)
      proposal.sessionMinutes = Math.round(
        (durations[Math.floor((durations.length - 1) / 2)] + durations[Math.floor(durations.length / 2)]) / 2,
      );
    return { id, rule, summary: rule, basedOnVersionId: plan.id, proposal };
  };
  // A dismissed suggestion does not fall through into another suggestion this week.
  if (input.dismissedIds.some(id => id.startsWith(`${current.from}:${plan.id}:`))) return null;
  const rows = input.workouts
    .filter(
      w =>
        w.planVersionId === plan.id &&
        reviewDate(input, w) >= previous.from &&
        reviewDate(input, w) <= current.to &&
        !['in_progress', 'abandoned'].includes(w.status),
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  // Do not offer load increases while any relevant discomfort is unresolved.
  const discomfort = new Set(rows.flatMap(w => computeExerciseEvidence(w).discomfortExerciseIds));
  const repeated = recurringDiscomfort(input);
  if (repeated.length) {
    if (!input.profile) return null;
    for (const id of repeated) {
      const replacement = discomfortReplacement(id, input.profile);
      if (!replacement) continue;
      let changed = false;
      for (const template of base.templates)
        template.items = template.items.map(item => {
          if (item.exerciseId !== id) return item;
          changed = true;
          return structuredClone(replacement);
        });
      if (changed) return candidate('discomfort', base, id);
    }
    return null;
  }
  if (current.reasonCounts.time >= 2) {
    const affected = rows
      .filter(w => reviewDate(input, w) >= current.from && w.feedback?.reasons.includes('time'))
      .map(w => w.templateId);
    const source =
      plan.templates.find(
        t =>
          affected.includes(t.id) &&
          t.items.length >= 3 &&
          t.estimatedMinutes > estimatePlannedMinutes(shortTemplate(t).items),
      ) ??
      (!affected.some(Boolean)
        ? plan.templates.find(
            t => t.items.length >= 3 && t.estimatedMinutes > estimatePlannedMinutes(shortTemplate(t).items),
          )
        : undefined);
    if (source)
      return candidate(
        'time',
        { ...base, templates: base.templates.map(t => (t.id === source.id ? shortTemplate(source) : t)) },
        source.id,
      );
  }

  for (const id of new Set(plan.templates.flatMap(t => t.items.map(i => i.exerciseId)))) {
    if (discomfort.has(id)) continue;
    const relevant = rows.filter(
      w =>
        w.plannedExercises?.some(e => e.exerciseId === id) ||
        w.sets.some(s => s.exerciseId === id) ||
        w.substitutions?.some(s => s.fromExerciseId === id),
    );
    if (
      relevant.length >= 3 &&
      relevant.slice(0, 3).every(w => computeExerciseEvidence(w).easyCompletedExerciseIds.includes(id))
    ) {
      let changed = false;
      for (const template of base.templates)
        for (const item of template.items)
          if (item.exerciseId === id) {
            if (item.target.metricType === 'reps_load') {
              item.target.loadGrams += 1000;
              changed = true;
            } else if (item.target.metricType === 'reps') {
              item.target.reps += 1;
              changed = true;
            }
          }
      if (changed) return candidate('progression', base, id);
    }
  }
  if (current.complete >= plan.weeklyTarget && previous.complete >= plan.weeklyTarget && plan.weeklyTarget < 7)
    return candidate('frequency', { ...base, weeklyTarget: plan.weeklyTarget + 1 });
  // A newly saved plan is not evidence of two weeks without training.
  const completed = input.completedWeeks;
  if (
    completed &&
    input.todayLocalDate &&
    completed.every(w => w.to < input.todayLocalDate! && w.complete === 0) &&
    addDays(completed[0].to, 1) === completed[1].from &&
    todayIn(input.timeZone ?? DEFAULT_TIME_ZONE, plan.createdAt) < completed[0].from &&
    current.complete === 0 &&
    plan.weeklyTarget > 2
  ) {
    const source = plan.templates.find(t => t.items.length >= 3);
    if (source) return candidate('restart', { ...base, weeklyTarget: 2, templates: [shortTemplate(source)] });
  }
  return null;
}
