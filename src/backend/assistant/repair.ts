import { assistantAttachmentSchema, type AssistantRequest, type AssistantAttachment } from '../../assistant/contracts';
import { adaptCoachResponse, coachV8Exercises } from '../../coach/response-adapter';
import { ZodError } from 'zod';
import { coachResponseSchema } from '../../coach/contracts';

export class AttachmentValidationError extends Error {
  constructor(public readonly code: 'ATTACHMENT_SCHEMA'|'ATTACHMENT_IDENTITY'|'ATTACHMENT_CATALOG'|'ATTACHMENT_CONDITIONS'|'ATTACHMENT_LANGUAGE',public readonly feedback:string=code) { super(code); }
}
export function repairAssistantAttachment(raw: unknown, request: AssistantRequest): { attachment: AssistantAttachment | null; repaired: boolean } {
  try { return repairAttachment(raw,request); }
  catch(error) {
    const message=error instanceof Error?error.message:'';
    const code=error instanceof Error && error.name==='ZodError' || error instanceof SyntaxError ? 'ATTACHMENT_SCHEMA'
      : /identity|generation|target mismatch|workout mismatch/.test(message)?'ATTACHMENT_IDENTITY'
      : /exercise|catalog/.test(message)?'ATTACHMENT_CATALOG'
      : /initial template|onboarding conditions|COMPLETED_ITEM_CHANGED/.test(message)?'ATTACHMENT_CONDITIONS'
      : /coach language/.test(message)?'ATTACHMENT_LANGUAGE':'ATTACHMENT_SCHEMA';
    const fields=new Set('requestId restoreGeneration mutationAllowed type proposal goalText weeklyTarget sessionMinutes scheduleOriginalText template templates id name estimatedMinutes items exerciseId equipment sets target metricType reps loadGrams durationSeconds distanceMeters reasons workoutId summary changes opening encouragement gap dataBoundary suggestion planId versionId revision'.split(' '));
    const guidance={ATTACHMENT_SCHEMA:'Use the supplied response schema with all required fields.',ATTACHMENT_IDENTITY:'Echo requestId, restoreGeneration, target and workoutId exactly from context.',ATTACHMENT_CATALOG:'Use supplied catalog IDs and the exact catalog metric type.',ATTACHMENT_CONDITIONS:'Preserve confirmed goal, weekly target, minutes and original schedule; initial plans require 2 or 3 templates at the confirmed minutes. Preserve completed items.',ATTACHMENT_LANGUAGE:'Use neutral prose without commands, judgment, exaggerated praise, emoji or exclamation.'};
    const paths=error instanceof ZodError?error.issues.slice(0,8).map(issue=>`${issue.path.map(segment=>typeof segment==='number'?segment:fields.has(String(segment))?String(segment):'?').join('.')||'response'}: ${issue.code}${'expected' in issue?` expected ${String(issue.expected)}`:''}`).join('; '):'';
    throw new AttachmentValidationError(code,`${code}: ${guidance[code]} ${paths}`.slice(0,1000));
  }
}

/** Repair only mechanical catalog/default/bound errors; never invent identities or targets. */
function repairAttachment(raw: unknown, request: AssistantRequest): { attachment: AssistantAttachment | null; repaired: boolean } {
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
  const parsed = value.type === 'exercise_info' ? assistantAttachmentSchema.parse(value) : coachResponseSchema.parse(value);
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
