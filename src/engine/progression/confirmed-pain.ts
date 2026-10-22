import { type EnginePlan, type EngineProfile, type ProgressionResult } from '../contracts';
import type { WorkoutRecord } from '../../domain/v8/contracts';
import { calendarDay, condition, Rules, stableString, type Exercise } from '../data';
import { type Item } from '../dose';

import { isHardEligible } from '../candidates';

import { runGates } from '../gates';

export function confirmedPainReplacements(
  history: WorkoutRecord[],
  value: EnginePlan,
  p: EngineProfile,
  r: Rules,
  s: ReturnType<typeof runGates>['restrictions'],
  output: ProgressionResult,
) {
  const protectedItems = new Set<Item>(),
    handledEvents = new Set<string>();
  const band = r
    .get('pain.rule')
    .bands.find((row: { action: string }) => row.action === 'stop_exercise_use_next_substitute');
  const records = [...new Map(history.map(record => [record.id, record])).values()];
  const confirmed = records
    .flatMap(record =>
      (record.painActions ?? []).flatMap(action => {
        const event = record.setFeedbackEvents?.find(event => event.id === action.eventId);
        const day = calendarDay(action.appliedAt, p.timeZone ?? 'UTC');
        const review = action.kind === 'review';
        if (
          (!review && (action.kind !== 'substitute' || !action.replacement)) ||
          !event ||
          event.effort !== 'discomfort' ||
          event.itemIndex !== action.itemIndex ||
          !condition(band.when, {} as Exercise, {
            pain: { current: event.painScore },
          }) ||
          !day ||
          day > p.asOfDate! ||
          !record.sets.some(
            fact =>
              fact.itemIndex === event.itemIndex &&
              fact.setIndex === event.setIndex &&
              fact.exerciseId === event.exerciseId,
          )
        )
          return [];
        handledEvents.add(`${record.id}:${event.id}`);
        const expired = records.some(
          next =>
            next.id !== record.id &&
            (next.status === 'complete' || next.status === 'partial') &&
            next.sets.length > 0 &&
            Date.parse(next.startedAt) > Date.parse(action.appliedAt) &&
            next.localDate <= p.asOfDate!,
        );
        return [{ record, action, event, expired }];
      }),
    )
    .sort((a, b) => b.action.appliedAt.localeCompare(a.action.appliedAt) || b.event.id.localeCompare(a.event.id));
  for (const template of value.templates) {
    const removed = new Set<Item>();
    for (const [index, item] of template.items.entries()) {
      const match = confirmed.find(({ record, action, event }) => {
        if (action.kind === 'review') return item.exerciseId === event.exerciseId;
        const original = record.templateSnapshot?.items[action.itemIndex]?.exerciseId;
        return (
          (record.templateId === template.id &&
            action.itemIndex === index &&
            [original, event.exerciseId, action.replacement?.exerciseId].includes(item.exerciseId)) ||
          item.exerciseId === event.exerciseId
        );
      });
      if (!match || match.expired) continue;
      const { action, event } = match;
      if (action.kind === 'review') {
        removed.add(item);
        output.diff.push({
          kind: 'remove',
          templateId: template.id,
          itemIndex: index,
          before: structuredClone(item),
        });
        r.trace(output.trace, 'pain.rule', 'review_without_confirmed_replacement_current_and_next', {
          exerciseId: event.exerciseId,
          eventId: event.id,
        });
        r.notice(output.notices, 'pain.copy.stop_exercise', 'warning');
        continue;
      }
      const replacement = structuredClone(action.replacement!) as Item;
      if (replacement.prescription) {
        if (item.prescription?.sourcePosition)
          replacement.prescription.sourcePosition = item.prescription.sourcePosition;
        else delete replacement.prescription.sourcePosition;
      }
      const profile = {
        ...p,
        cautions: [...new Set([...p.cautions, ...(event.painArea ? [event.painArea] : [])])],
      };
      const gate = runGates(profile, r),
        state = gate.restrictions,
        exercise = r.byExercise.get(replacement.exerciseId);
      const joint = r.get('redflag.joint_any'),
        back = r.get('redflag.back'),
        shoulder = r.get('redflag.shoulder');
      const known = [
        ...joint.items,
        ...back.emergency_items,
        ...back.urgent_items,
        ...shoulder.cardiac_route_items,
        ...shoulder.prompt_medical_items,
      ];
      const required = [
        ...joint.items,
        ...(event.painArea === 'back' ? [...back.emergency_items, ...back.urgent_items] : []),
        ...(event.painArea === 'shoulder' ? [...shoulder.cardiac_route_items, ...shoulder.prompt_medical_items] : []),
      ];
      const answers = action.redFlagAnswers;
      const confirmedAnswers =
        !!answers &&
        required.every(key => typeof answers[key] === 'boolean') &&
        Object.keys(answers).every(key => known.includes(key) && typeof answers[key] === 'boolean') &&
        (!Object.values(answers).some(Boolean) || s.user.professional_seen);
      const duplicate = template.items.some(
        other =>
          other !== item &&
          !removed.has(other) &&
          (other.exerciseId === replacement.exerciseId ||
            (exercise?.ladder.id && r.byExercise.get(other.exerciseId)?.ladder.id === exercise.ladder.id)),
      );
      if (
        !confirmedAnswers ||
        state.blocked ||
        replacement.exerciseId === event.exerciseId ||
        !exercise ||
        !isHardEligible(exercise, profile, gate, { rules: r }) ||
        duplicate ||
        (replacement.prescription?.rir[0] ?? -Infinity) < state.rirMin
      ) {
        removed.add(item);
        output.diff.push({
          kind: 'remove',
          templateId: template.id,
          itemIndex: index,
          before: structuredClone(item),
        });
        r.trace(output.trace, 'pain.rule', 'confirmed_pain_replacement_currently_unavailable', {
          exerciseId: item.exerciseId,
          replacementId: replacement.exerciseId,
        });
      } else {
        template.items[index] = replacement;
        protectedItems.add(replacement);
        if (stableString(item) !== stableString(replacement)) {
          output.diff.push({
            kind: 'replace',
            templateId: template.id,
            itemIndex: index,
            before: structuredClone(item),
            after: structuredClone(replacement),
          });
          output.suggestions.push({
            templateId: template.id,
            itemIndex: index,
            before: structuredClone(item),
            after: structuredClone(replacement),
            ruleId: 'pain.rule',
            summary: r.text('meta.copy.progression_adjusted'),
          });
        }
        r.trace(output.trace, 'pain.rule', 'reused_confirmed_pain_replacement_current_and_next', {
          exerciseId: event.exerciseId,
          replacementId: replacement.exerciseId,
          eventId: event.id,
        });
      }
      r.notice(output.notices, 'pain.copy.stop_exercise', 'warning');
    }
    template.items = template.items.filter(item => !removed.has(item));
  }
  value.templates = value.templates.filter(template => template.items.length > 0);
  return { protectedItems, handledEvents };
}
