import { selectAiExercises, selectAssistantCandidates } from '../catalog/ai-catalog';
import { exercises } from '../catalog/exercises';
import { checkCoachLanguage, type CoachLanguageViolation } from '../application/rules/coach-language';
import { guidedServiceLimits as limits } from '../domain/guided-limits';
import { coachRequestSchema, coachResponseSchema, type AdaptCoachResponse, type CoachRequest, type CoachResponse } from './contracts';
import { reviewCountClaimsMatch } from './review-facts-validation';

const responseTypes = {
  ONBOARD_PLAN: 'plan_proposal', ADJUST_TODAY: 'today_adjustment',
  MODIFY_PLAN: 'change_proposal', PERIOD_REVIEW: 'review_summary',
} as const;
type Template = Extract<CoachResponse, { type: 'today_adjustment' }>['template'];
export class CoachLanguageError extends Error {
  constructor(public readonly categories: CoachLanguageViolation[]) { super('Invalid coach response: coach language'); }
}

function requireCondition(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid coach response: ${message}`);
}
function bounded(value: unknown, max: number) {
  const encoded = typeof value === 'string' ? value : JSON.stringify(value);
  requireCondition(typeof encoded === 'string' && new TextEncoder().encode(encoded).byteLength <= max, 'payload limit');
}

/** Same bounded vocabulary must be supplied to the provider and checked on return. */
export function coachV8Exercises(request: CoachRequest) {
  if(request.candidateContext){
    const candidates=selectAssistantCandidates({version:'fitness-assistant-v2',requestId:request.requestId,conversationId:request.conversationId,locale:request.locale,timeZone:request.timeZone,adultConfirmed:request.adultConfirmed,context:request,preferences:request.candidateContext.preferences,messages:[{role:'user',content:'instruction'in request?request.instruction:(request.messages.at(-1)?.content??(request.task==='ONBOARD_PLAN'?request.profile.goalText:''))}]}).map(row=>row.exercise);
    const retained=request.task==='ADJUST_TODAY'?request.template.items.map(i=>i.exerciseId):request.task==='MODIFY_PLAN'?request.plan.templates.flatMap(t=>t.items.map(i=>i.exerciseId)):[];
    requireCondition(new Set(retained).size<=64,'referenced catalog limit');
    requireCondition(retained.every(id=>exercises.some(exercise=>exercise.id===id)),'unknown referenced exercise');
    return [...new Map([...candidates,...exercises.filter(e=>retained.includes(e.id))].map(e=>[e.id,e])).values()];
  }
  const referenced = request.task === 'ADJUST_TODAY' ? request.template.items.map(item => item.exerciseId)
    : request.task === 'MODIFY_PLAN' ? request.plan.templates.flatMap(template => template.items.map(item => item.exerciseId)) : [];
  const ids = new Set(referenced);
  requireCondition(ids.size <= 64, 'referenced catalog limit');
  const retained = exercises.filter(exercise => ids.has(exercise.id));
  requireCondition(retained.length === ids.size, 'unknown referenced exercise');
  const boundedCatalog = (selected: typeof exercises) => [...new Map([...retained, ...selected].map(exercise => [exercise.id, exercise])).values()].slice(0, 64);
  switch (request.task) {
    case 'ONBOARD_PLAN': return selectAiExercises(request.profile.goalText, request.profile);
    case 'ADJUST_TODAY': return boundedCatalog(selectAiExercises(request.instruction, request.template));
    case 'MODIFY_PLAN': return boundedCatalog(selectAiExercises(request.plan.goalText, request.plan, request.instruction));
    case 'PERIOD_REVIEW': return selectAiExercises('general fitness', request.facts);
  }
}

function validateTemplates(templates: Template[], request: CoachRequest) {
  const vocabulary = new Map(coachV8Exercises(request).map(exercise => [exercise.id, exercise]));
  requireCondition(new Set(templates.map(template => template.id)).size === templates.length, 'duplicate template');
  for (const template of templates) {
    for (const item of template.items) {
      const exercise = vocabulary.get(item.exerciseId);
      requireCondition(!!exercise, 'exercise outside supplied catalog');
      requireCondition(item.target.metricType === exercise.metricType, 'exercise metric mismatch');
    }
  }
}

/** Pure parsing/validation. Never grants permission to persist a proposal. */
export const adaptCoachResponse: AdaptCoachResponse = (input, raw) => {
  bounded(input, limits.maxInputBytes);
  const request = coachRequestSchema.parse(input);
  bounded(raw, limits.maxOutputBytes);
  const response = coachResponseSchema.parse(typeof raw === 'string' ? JSON.parse(raw) : raw);
  // Check generated prose only; copied goals and user conditions are not coach speech.
  const prose = response.type === 'review_summary' ? [response.opening, response.encouragement, response.gap, ...response.dataBoundary, ...(response.suggestion ? [response.suggestion.summary, ...response.suggestion.proposal.reasons] : [])]
    : response.type === 'plan_proposal' ? response.proposal.reasons
    : response.type === 'change_proposal' ? [...response.changes, ...response.proposal.reasons]
    : response.type === 'today_adjustment' ? [response.summary]
    : response.type === 'clarify' ? [response.question] : [response.reason];
  const violations = [...new Set(prose.flatMap(checkCoachLanguage))];
  if (violations.length) throw new CoachLanguageError(violations);
  requireCondition(response.requestId === request.requestId, 'request identity');
  requireCondition(response.restoreGeneration === request.restoreGeneration, 'restore generation');
  if (response.type === 'clarify' || response.type === 'refused') return response;
  requireCondition(response.type === responseTypes[request.task], 'task mismatch');
  if (response.type === 'review_summary' && request.task === 'PERIOD_REVIEW') {
    requireCondition([response.opening,response.encouragement,response.gap,...response.dataBoundary].every(text => reviewCountClaimsMatch(request.facts,text)),'review fact count mismatch');
  }
  if ('target' in response) {
    requireCondition('target' in request, 'missing target');
    requireCondition(response.target.planId === request.target.planId &&
      response.target.versionId === request.target.versionId &&
      response.target.revision === request.target.revision, 'target mismatch');
  }
  if (response.type === 'today_adjustment') {
    requireCondition(request.task === 'ADJUST_TODAY' && response.workoutId === request.workoutId, 'workout mismatch');
    validateTemplates([response.template], request);
  }
  const proposal = 'proposal' in response ? response.proposal : response.type === 'review_summary' ? response.suggestion?.proposal : undefined;
  if (proposal) {
    validateTemplates(proposal.templates, request);
    if (request.task === 'ONBOARD_PLAN') {
      requireCondition(proposal.templates.length >= 1 && proposal.templates.length <= 3, 'initial template count');
      requireCondition(proposal.goalText === request.profile.goalText &&
        proposal.scheduleOriginalText === request.profile.scheduleOriginalText, 'onboarding conditions changed');
    }
  }
  return response;
};
