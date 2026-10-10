import { z } from 'zod';
import { coachResponseSchema, type CoachRequest } from '../coach/contracts';
import { coachV8Exercises } from '../coach/response-adapter';
import { coachV8PromptHeader } from './coach-v8-prompt-registry';
export function coachV8ProviderPrompt(request: CoachRequest) {
 return [
  {role:'system' as const,content:`${coachV8PromptHeader(request.task)}\nResponse schema: ${JSON.stringify(z.toJSONSchema(coachResponseSchema))}`},
  {role:'user' as const,content:JSON.stringify({request,catalog:coachV8Exercises(request).map(e=>({id:e.id,name:e.name[request.locale],equipment:e.equipment,metricType:e.metricType}))})},
 ];
}
