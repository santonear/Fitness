import { z } from 'zod';
import { coachResponseSchema, type CoachRequest } from '../coach/contracts';
import { coachV8Exercises } from '../coach/response-adapter';
import { coachV8PromptHeader } from './coach-v8-prompt-registry';
import { coachV8PreviousPromptHeader } from './coach-v8-prompt-previous';
import { COACH_V8_PROMPT_VERSION, type CoachPromptRelease } from './coach-v8-version';
export function coachV8ProviderPrompt(request: CoachRequest, release: CoachPromptRelease = COACH_V8_PROMPT_VERSION) {
 if (release !== 'v8.1.0' && release !== 'v8.0.0') throw new Error('INVALID_PROMPT_VERSION');
 const header = release === 'v8.0.0' ? coachV8PreviousPromptHeader : coachV8PromptHeader;
 return [
  {role:'system' as const,content:`${header(request.task)}\nResponse schema: ${JSON.stringify(z.toJSONSchema(coachResponseSchema))}`},
  {role:'user' as const,content:JSON.stringify({request,catalog:coachV8Exercises(request).map(e=>({id:e.id,name:e.name[request.locale],equipment:e.equipment,metricType:e.metricType}))})},
 ];
}
