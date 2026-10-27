import { loadedPreference } from '../candidates/loaded-preference';
import type {
  EnginePlan,
  EngineProfile,
  EngineResult,
  SubstituteReason,
  PipelineContext,
  SessionDraft,
} from '../contracts';
import type { PlannedItem } from '../../domain/v8/contracts';
import { Rules, restrictedAdjacentIds, type Exercise } from '../data';
import { prescribe, effectiveGoalRole } from '../dose';
import { createContext } from '../pipeline';
import { candidatesFor, isHardEligible } from '../candidates';
import { prioritizeCautionSubstitutions } from '../candidates/caution-substitutions';

import { checkHard } from '../hard-checks';
import { isYogaSession } from '../yoga-session';
import { substituteYogaPose } from '../yoga';

import { result } from './result';
import { FOCUS, slotFor, retainSource } from './shared';
export function substituteItem(
  item: PlannedItem,
  p: EngineProfile,
  reason: SubstituteReason,
  r: Rules,
  context?: PipelineContext,
): EngineResult<PlannedItem> {
  const ctx = context ?? createContext(p, 0, r),
    original = r.byExercise.get(item.exerciseId),
    i = item as SessionDraft['items'][number];
  if (!original || ctx.gate.status === 'blocked') return result(structuredClone(item), [], r, p);
  const prior = i.prescription?.excludedPreviousIds ?? [],
    patterns = original.primary_pattern === 'carry' ? FOCUS.core : [original.primary_pattern],
    slot = slotFor(i, patterns);
  ctx.usedIds = new Set([...ctx.usedIds, item.exerciseId, ...prior]);
  if (isYogaSession({ items: [i] })) {
    const pose = substituteYogaPose(i, ctx.usedIds, ctx);
    if (!pose) return result(structuredClone(item), [], r, p);
    pose.prescription!.excludedPreviousIds = [...prior, item.exerciseId];
    return result<PlannedItem>(pose, [{ kind: 'replace', itemIndex: 0, before: item, after: pose }], r, p);
  }
  const pool = candidatesFor(slot, p, ctx.gate, ctx).filter(
      e =>
        e.id !== item.exerciseId &&
        (!FOCUS.upper.includes(original.primary_pattern) ||
          (FOCUS.upper.includes(e.primary_pattern) && ['strength', 'power', 'isometric'].includes(e.modality))) &&
        ((!original.flags.includes('walking_carry') && !p.preferences.cannotDo.includes('walking_carry')) ||
          !e.flags.includes('walking_carry')) &&
        (original.primary_pattern !== 'carry' || patterns.includes(e.primary_pattern)),
    ),
    pregnancyRow =
      p.population.kind === 'pregnant'
        ? r
            .get('pregnancy.substitute')
            .map.find(
              (row: { from_pattern: string; from_position?: string | string[] }) =>
                row.from_pattern === original.primary_pattern &&
                (!row.from_position ||
                  (Array.isArray(row.from_position) ? row.from_position : [row.from_position]).some(position =>
                    original.position.includes(position),
                  )),
            )
        : undefined,
    ranked = pregnancyRow
      ? pregnancyRow.to_slugs.flatMap((slug: string) => {
          const exercise = r.data.exercises.find(e => e.slug === slug);
          return exercise &&
            exercise.id !== item.exerciseId &&
            !ctx.usedIds.has(exercise.id) &&
            !restrictedAdjacentIds(ctx.plan?.templates ?? [], ctx.currentWeekday, r).has(exercise.id) &&
            isHardEligible(exercise, p, ctx.gate, ctx)
            ? [{ exercise, ruleId: 'pregnancy.substitute', row: undefined }]
            : [];
        })
      : prioritizeCautionSubstitutions(original, pool, p, r, ctx.gate.restrictions.user),
    choice = ranked
      .sort((a: { exercise: Exercise }, b: { exercise: Exercise }) =>
        pregnancyRow || p.cautions.length
          ? 0
          : Number(b.exercise.primary_pattern === original.primary_pattern) -
              Number(a.exercise.primary_pattern === original.primary_pattern) ||
            loadedPreference(b.exercise, p, r) - loadedPreference(a.exercise, p, r),
      )
      .find(
        ({ exercise, row }: { exercise: Exercise; row?: { dose?: { seconds?: { min: number; max: number } } } }) => {
          if (pregnancyRow) {
            const preview = retainSource(
                prescribe(exercise, p, r, ctx.gate.restrictions, effectiveGoalRole(i, p, r), item.sets),
                i,
              ),
              template = {
                id: 'pregnancy-substitute',
                name: '',
                estimatedMinutes: p.sessionMinutes,
                items: [preview],
              },
              plan: EnginePlan = {
                weeklyTarget: p.daysPerWeek,
                sessionMinutes: p.sessionMinutes,
                templates: [template],
                meta: {
                  engineVersion: '2',
                  rulesVersion: r.data.rulesVersion,
                  seed: ctx.profileHash,
                },
                trace: [],
                notices: [],
                gates: ctx.gate.reasons,
              };
            if (
              checkHard(plan, p, ctx.gate, r).some(issue => issue.severity === 'error' && issue.itemIndex !== undefined)
            )
              return false;
          }
          if (!row?.dose?.seconds || exercise.modality !== 'isometric') return true;
          const source = r.get('dose.isometric'),
            range = source[p.level].hold_s;
          return (
            Math.max(row.dose.seconds.min, range[0]) <= Math.min(row.dose.seconds.max, range[1], source.hold_s_max)
          );
        },
      ),
    replacement = choice?.exercise;
  if (!replacement) return result(structuredClone(item), [], r, p);
  const next = retainSource(
    prescribe(replacement, p, r, ctx.gate.restrictions, effectiveGoalRole(i, p, r), item.sets),
    i,
  );
  next.prescription!.excludedPreviousIds = [...prior, item.exerciseId];
  if (choice.row?.cue) {
    const key =
      choice.row.cue === 'neutral_wrist_on_handles'
        ? 'caution.copy.labels.wrist_neutral'
        : choice.row.cue === 'partial_range'
          ? 'pain.copy.shorter_range'
          : `caution.copy.labels.${choice.row.cue}`;
    next.prescription!.safetyCue = r.text(key);
  }
  if (choice.row?.dose?.seconds && 'durationSeconds' in next.target) {
    const bounds = choice.row.dose.seconds,
      source = r.get('dose.isometric'),
      range = source[p.level].hold_s,
      min = replacement.modality === 'isometric' ? Math.max(bounds.min, range[0]) : bounds.min,
      max = replacement.modality === 'isometric' ? Math.min(bounds.max, range[1], source.hold_s_max) : bounds.max;
    next.target.durationSeconds = Math.max(min, Math.min(max, next.target.durationSeconds));
  }
  if (choice.ruleId)
    ctx.trace.push({
      ruleId: choice.ruleId,
      step: 'operation',
      reason: 'first available source table replacement passing all hard filters',
      details: {
        exerciseId: replacement.id,
        ...(choice.row?.cue ? { cue: choice.row.cue } : {}),
      },
    });
  ctx.trace.push({
    ruleId: reason === 'pain' ? 'caution.substitute.priority' : 'equipment.downgrade',
    step: 'operation',
    reason: 'hard filtered replacement',
  });
  const out = result<PlannedItem>(next, [{ kind: 'replace', itemIndex: 0, before: item, after: next }], r, p);
  out.trace.push(...ctx.trace);
  return out;
}
