import { assistantAttachmentSchema, type AssistantRequest, type AssistantAttachment } from '../../assistant/contracts';
import { adaptCoachResponse, coachV8Exercises } from '../../coach/response-adapter';

/** Repair only mechanical catalog/default/bound errors; never invent identities or targets. */
export function repairAssistantAttachment(raw: unknown, request: AssistantRequest): { attachment: AssistantAttachment | null; repaired: boolean } {
  const input = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (input && typeof input === 'object' && 'attachment' in input && input.attachment === null) return { attachment: null, repaired: false };
  const value = structuredClone(input && typeof input === 'object' && 'attachment' in input ? input.attachment : input);
  if (!value || typeof value !== 'object') throw new Error('ATTACHMENT_SHAPE');
  let repaired = false;
  const catalog = request.context ? coachV8Exercises(request.context) : [];
  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    const item = node as Record<string, unknown>;
    if ('exerciseId' in item && !catalog.some(e => e.id === item.exerciseId)) {
      const name = typeof item.exerciseName === 'string' ? item.exerciseName : typeof item.exerciseId === 'string' ? item.exerciseId : '';
      const matches = catalog.filter(e => Object.values(e.name).some(n => n.toLowerCase() === name.toLowerCase()));
      if (matches.length === 1) { item.exerciseId = matches[0].id; delete item.exerciseName; repaired = true; }
    }
    for (const [key, min, max] of [['sets', 1, 10], ['reps', 1, 100], ['durationSeconds', 1, 7200], ['loadGrams', 0, 500000], ['estimatedMinutes', 15, 120], ['sessionMinutes', 15, 120], ['weeklyTarget', 1, 7]] as const) {
      if (typeof item[key] === 'number' && Number.isFinite(item[key])) {
        const bounded = Math.max(min, Math.min(max, Math.round(item[key] as number)));
        if (bounded !== item[key]) { item[key] = bounded; repaired = true; }
      }
    }
    if ('exerciseId' in item && 'target' in item && item.sets === undefined) { item.sets = 2; repaired = true; }
    Object.values(item).forEach(walk);
  }
  walk(value);
  const parsed = assistantAttachmentSchema.parse(value);
  if (parsed.type === 'clarify' || parsed.type === 'refused') throw new Error('CONVERSATION_ONLY');
  if (parsed.type !== 'exercise_info') {
    if (!request.adultConfirmed || !request.context) throw new Error('PLAN_NOT_ELIGIBLE');
    if(parsed.type === 'today_adjustment' && request.context.task === 'ADJUST_TODAY' && request.currentWorkout) {
      for(const index of new Set(request.currentWorkout.completedSets.map(set => set.itemIndex))) {
        if(JSON.stringify(parsed.template.items[index]) !== JSON.stringify(request.context.template.items[index])) throw new Error('COMPLETED_ITEM_CHANGED');
      }
    }
    return { attachment: adaptCoachResponse(request.context, parsed), repaired };
  }
  return { attachment: parsed, repaired };
}
