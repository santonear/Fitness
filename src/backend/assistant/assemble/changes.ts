import { diffTemplates } from '../../../assistant/template-diff';
import { sameExerciseFamily } from '../../../catalog/exercise-family';
import { manualTrainingItems } from '../../../application/rules/manual-items';
import { explicitScheduleChange } from '../../../application/picked-schedule';
import type { AssistantIntent, AssistantRequest } from '../../../assistant/contracts';
import { estimatePlannedMinutes } from '../../../domain/duration-estimate';
import { selectAssistantCandidates, assistantMovement } from '../../../catalog/ai-catalog';
import { catalogMetadata } from '../../../catalog/registry';
import { exercises } from '../../../catalog/exercises';
import type { PlannedItem, SessionTemplate } from '../../../domain/v8/contracts';

type Candidate = ReturnType<typeof selectAssistantCandidates>[number];
const normal = (value: string) => value.toLocaleLowerCase().replace(/[\s_\-·]/g, '');
export function resolveAssistantExercise(value: string | undefined, candidates: Candidate[]): Candidate | undefined {
  if (!value) return;
  const code = candidates.find(row => row.code.toLowerCase() === value.toLowerCase());
  if (code) return code;
  const input = normal(value);
  const names = (row: Candidate) =>
    [row.exercise.name.zh, row.exercise.name.en, ...(catalogMetadata.get(row.exercise.id)?.aliases ?? [])].map(normal);
  const exact = candidates.filter(row => names(row).includes(input));
  if (exact.length === 1) return exact[0];
  const contained = candidates.filter(
    row => input.length >= 2 && names(row).some(name => name.includes(input) || input.includes(name)),
  );
  return contained.length === 1 ? contained[0] : undefined;
}
export function newItem(candidate: Candidate): PlannedItem {
  const exercise = candidate.exercise;
  const target =
    exercise.metricType === 'reps_load'
      ? { metricType: 'reps_load' as const, reps: 8, loadGrams: 0 }
      : exercise.metricType === 'reps'
        ? { metricType: 'reps' as const, reps: 8 }
        : exercise.metricType === 'duration'
          ? { metricType: 'duration' as const, durationSeconds: 30 }
          : { metricType: 'duration_distance' as const, durationSeconds: 300 };
  return { exerciseId: exercise.id, equipment: exercise.equipment, sets: 2, target };
}
export function replacementItem(previous: PlannedItem, candidate: Candidate): PlannedItem {
  const next = newItem(candidate);
  next.sets = previous.sets;
  if (previous.target.metricType === candidate.exercise.metricType) next.target = structuredClone(previous.target);
  else {
    const defaults = manualTrainingItems([candidate.exercise.id])[0].target;
    if ('reps' in next.target) next.target.reps = 'reps' in defaults ? defaults.reps : 8;
    if ('durationSeconds' in next.target)
      next.target.durationSeconds = 'durationSeconds' in defaults ? defaults.durationSeconds : 20;
  }
  if (next.target.metricType === 'reps_load') next.target.loadGrams = 0;
  return next;
}
export function coverPatterns(template: SessionTemplate, candidates: Candidate[]) {
  const patterns = () =>
    new Set(
      template.items.map(item => {
        const exercise = exercises.find(row => row.id === item.exerciseId);
        return exercise ? assistantMovement(exercise) : 'mobility';
      }),
    );
  const required = ['push', 'pull', 'core', 'lower'] as const;
  for (const mode of required) {
    const current = patterns();
    const covered =
      Number(current.has('push')) +
      Number(current.has('pull')) +
      Number(current.has('core')) +
      Number(current.has('squat') || current.has('hinge'));
    if (covered >= 3 && current.has('push')) break;
    if (mode === 'lower' && (current.has('squat') || current.has('hinge') || current.has('lower'))) continue;
    if (mode !== 'lower' && current.has(mode)) continue;
    const safe = candidates.find(
      row =>
        (mode === 'lower' ? row.mode === 'squat' || row.mode === 'hinge' || row.mode === 'lower' : row.mode === mode) &&
        !template.items.some(item => item.exerciseId === row.exercise.id),
    );
    if (safe) template.items.push(newItem(safe));
  }
}
export function recalculate(template: SessionTemplate, minimum = 15) {
  template.estimatedMinutes = estimatePlannedMinutes(template.items, minimum);
}
export function fitDuration(
  template: SessionTemplate,
  minutes: number,
  candidates: Candidate[] = [],
  locked = new Set<number>(),
) {
  const lower = Math.ceil(minutes * 0.9),
    upper = Math.floor(minutes * 1.1);
  for (let attempts = 0; attempts < 100 && estimatePlannedMinutes(template.items, 10) > upper; attempts++) {
    const reducible = template.items
      .filter((item, index) => item.sets > 1 && !locked.has(index))
      .sort((a, b) => b.sets - a.sets)[0];
    if (!reducible) break;
    reducible.sets--;
  }
  for (let attempts = 0; attempts < 100 && estimatePlannedMinutes(template.items, 10) < lower; attempts++) {
    const expandable = template.items
      .filter((item, index) => item.sets < 4 && !locked.has(index))
      .sort((a, b) => a.sets - b.sets)[0];
    if (!expandable) {
      const counts = new Map<string, number>();
      for (const item of template.items) {
        const exercise = exercises.find(e => e.id === item.exerciseId);
        if (exercise) {
          const mode = assistantMovement(exercise);
          counts.set(mode, (counts.get(mode) ?? 0) + 1);
        }
      }
      const extra = candidates
        .filter(
          row =>
            ['push', 'pull', 'squat', 'hinge', 'lower', 'core', 'cardio'].includes(row.mode) &&
            !template.items.some(item => item.exerciseId === row.exercise.id),
        )
        .sort((a, b) => (counts.get(a.mode) ?? 0) - (counts.get(b.mode) ?? 0))[0];
      if (!extra || template.items.length >= 12) break;
      template.items.push({ ...newItem(extra), sets: 1 });
      continue;
    }
    expandable.sets++;
  }
  recalculate(template, 10);
}
export function syncTemplateName(template: SessionTemplate, locale: 'zh' | 'en') {
  template.name = template.name.replace(/\s*[（(]\s*\d+\s*(?:分钟|minutes?|mins?)\s*[）)]/gi, '').trim();
  if (!template.name) template.name = locale === 'zh' ? '训练' : 'Workout';
}
function itemName(id: string, locale: 'zh' | 'en') {
  return exercises.find(row => row.id === id)?.name[locale] ?? id;
}
export function templateDiff(before: SessionTemplate, after: SessionTemplate, locale: 'zh' | 'en') {
  return diffTemplates([before], [after]).changes.map(change => {
    const name = itemName(change.item.exerciseId, locale);
    return change.kind === 'replaced'
      ? locale === 'zh'
        ? `将${itemName(change.previous!.exerciseId, locale)}换成${name}`
        : `Replaced ${itemName(change.previous!.exerciseId, locale)} with ${name}`
      : change.kind === 'removed'
        ? locale === 'zh'
          ? `移除${name}`
          : `Removed ${name}`
        : change.kind === 'added'
          ? locale === 'zh'
            ? `加入${name}`
            : `Added ${name}`
          : locale === 'zh'
            ? `调整${name}的训练量`
            : `Changed the volume for ${name}`;
  });
}
export function findExistingItem(template: SessionTemplate, value: string | undefined): number {
  if (!value) return -1;
  const key = normal(value);
  return template.items.findIndex(item => {
    const exercise = exercises.find(row => row.id === item.exerciseId);
    return (
      !!exercise &&
      [exercise.id, exercise.name.zh, exercise.name.en, ...(catalogMetadata.get(exercise.id)?.aliases ?? [])].some(
        name => normal(name) === key || (key.length >= 2 && normal(name).includes(key)),
      )
    );
  });
}
export function explicitExistingReplacements(
  request: AssistantRequest,
): Extract<AssistantIntent, { kind: 'plan_modify' }>['changes'] {
  const context = request.context;
  if (context?.task !== 'MODIFY_PLAN') return [];
  const raw = request.messages.at(-1)?.content ?? '';
  const directed =
    raw.match(/(?:把|将)\s*(.+?)\s*(?:换成|替换为|换为)\s*(.+?)(?:[，。；;]|$)/i) ??
    raw.match(/(?:replace|swap)\s+(.+?)\s+(?:with|for)\s+(.+?)(?:[.;]|$)/i);
  if (directed) {
    return context.plan.templates.flatMap(template => {
      const index = findExistingItem(template, directed[1].trim());
      return index < 0
        ? []
        : [
            {
              session: template.id,
              op: 'replace' as const,
              from: template.items[index].exerciseId,
              to: directed[2].trim(),
            },
          ];
    });
  }
  const text = normal(raw);
  if (!/(换|替换|不要|别安排|移除|replace|remove|swap|avoid)/i.test(text)) return [];
  const changes: Extract<AssistantIntent, { kind: 'plan_modify' }>['changes'] = [];
  const scope = namedPlanScope(request);
  for (const template of context.plan.templates.filter(
    template => !scope.templates.size || scope.templates.has(template.id),
  ))
    for (const item of template.items) {
      const exercise = exercises.find(row => row.id === item.exerciseId);
      if (!exercise) continue;
      const names = [exercise.name.zh, exercise.name.en, ...(catalogMetadata.get(exercise.id)?.aliases ?? [])]
        .map(normal)
        .filter(name => name.length >= 3);
      const farmerAlias =
        catalogMetadata.get(exercise.id)?.slug === 'dumbbell-farmers-walk' && /农夫行走|farmer.?s?.?walk/i.test(text);
      if (farmerAlias || names.some(name => text.includes(name)))
        changes.push({ session: template.id, op: 'replace', from: exercise.id });
    }
  return changes;
}
export function namedPlanScope(request: AssistantRequest) {
  const templates = new Set<string>(),
    items = new Set<string>();
  if (request.context?.task !== 'MODIFY_PLAN') return { templates, items };
  const text = request.messages.at(-1)?.content ?? '';
  for (const template of request.context.plan.templates) {
    for (const label of [template.id, template.name]) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (
        new RegExp(
          `(?:^|[^a-z0-9])${escaped}\\s*(?:里|中|训练|的|workout|session)|(?:workout|session)\\s+${escaped}(?:\\b|$)`,
          'i',
        ).test(text)
      )
        templates.add(template.id);
    }
    for (const item of template.items) {
      const exercise = exercises.find(e => e.id === item.exerciseId);
      if (
        exercise &&
        [exercise.name.zh, exercise.name.en, ...(catalogMetadata.get(item.exerciseId)?.aliases ?? [])].some(
          name => name.length >= 3 && normal(text).includes(normal(name)),
        )
      )
        items.add(item.exerciseId);
    }
  }
  return { templates, items };
}
export function applyChanges(
  template: SessionTemplate,
  changes: Extract<AssistantIntent, { kind: 'plan_modify' }>['changes'],
  candidates: Candidate[],
  locked = new Set<number>(),
  dropped: string[] = [],
  existingItems: PlannedItem[] = template.items,
  explicitTarget = false,
) {
  let applied = 0;
  for (const change of changes) {
    if (
      change.session &&
      change.session !== template.id &&
      change.session !== template.name &&
      change.session !== '今天'
    )
      continue;
    const index = findExistingItem(template, change.from);
    const previous = index >= 0 ? exercises.find(row => row.id === template.items[index].exerciseId) : undefined;
    const matched = resolveAssistantExercise(change.to, candidates);
    const replacementModes = previous
      ? assistantMovement(previous) === 'carry'
        ? ['carry', 'pull', 'core']
        : [assistantMovement(previous)]
      : [];
    const compatible = (row: Candidate) =>
      replacementModes.includes(row.mode) &&
      (assistantMovement(previous!) !== 'push' ||
        ['chest', 'shoulders', 'upper-arms'].includes(catalogMetadata.get(row.exercise.id)?.bodyPart ?? '')) &&
      !existingItems.some(
        item =>
          item.exerciseId !== previous!.id &&
          sameExerciseFamily(
            exercises.find(e => e.id === item.exerciseId)!,
            row.exercise,
          ),
      );
    const to = previous
      ? matched && matched.exercise.id !== previous.id && (explicitTarget || compatible(matched))
        ? matched
        : explicitTarget && change.to
          ? undefined
          : candidates.find(row => row.exercise.id !== previous.id && compatible(row))
      : matched;
    if (
      change.op === 'add' &&
      to &&
      !existingItems.some(item =>
        sameExerciseFamily(
          exercises.find(e => e.id === item.exerciseId)!,
          to.exercise,
        ),
      )
    ) {
      const before = estimatePlannedMinutes(template.items),
        added = newItem(to);
      template.items.push(added);
      while (added.sets < 4 && estimatePlannedMinutes(template.items) <= before) added.sets++;
      applied++;
    } else if (change.op === 'add' && !to) dropped.push('unknown_or_unsafe_exercise');
    if (index < 0 || locked.has(index)) continue;
    if (change.op === 'replace' && to && to.exercise.id !== previous?.id) {
      template.items[index] = replacementItem(template.items[index], to);
      applied++;
      if (change.to && !matched) dropped.push('unsafe_replacement_substituted');
    } else if (change.op === 'replace' && !to) dropped.push('unknown_or_unsafe_exercise');
    if (change.op === 'remove' && template.items.length > 1 && (!locked.size || index > Math.max(...locked))) {
      template.items.splice(index, 1);
      applied++;
    }
    if (change.op === 'set_volume' || change.op === 'shorten') {
      const item = template.items[index];
      item.sets = Math.max(1, Math.min(4, change.sets ?? (change.op === 'shorten' ? item.sets - 1 : item.sets)));
      if (change.reps && 'reps' in item.target) {
        const reps = Number.parseInt(change.reps, 10);
        if (Number.isFinite(reps)) item.target.reps = Math.max(1, Math.min(100, reps));
      }
      if (change.seconds && 'durationSeconds' in item.target)
        item.target.durationSeconds = Math.max(1, Math.min(7200, change.seconds));
      applied++;
    }
  }
  return applied;
}
/** Picked calendar days stay fixed unless the latest user message explicitly asks to change days. */
export function daysLocked(request: AssistantRequest): boolean {
  return !!request.context?.schedule && !explicitScheduleChange(request.messages.at(-1)?.content ?? '');
}
