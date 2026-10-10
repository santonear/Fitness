import { z } from 'zod';
import { confirmationFor, type CoachEnvelope } from '../backend/contracts';
import { coachRequestSchema, type CoachRequest } from './contracts';
import { adaptCoachResponse } from './response-adapter';

/** Call only after the displayed request is explicitly approved. No retries or local writes. */
export async function sendCoach(request: CoachRequest, signal: AbortSignal, fetcher:typeof fetch=fetch) {
 signal.throwIfAborted();
 const parsed=coachRequestSchema.parse(request);
 if(parsed.sendConfirmation!==await confirmationFor(parsed))throw new Error('CONFIRMATION_REQUIRED');
 const base={contractVersion:1 as const,requestId:parsed.requestId,locale:parsed.locale,restoreGeneration:parsed.restoreGeneration,
  operation:parsed.task==='PERIOD_REVIEW'?'summary' as const:'generate' as const,goalText:parsed.task==='ONBOARD_PLAN'?parsed.profile.goalText:parsed.task==='MODIFY_PLAN'?parsed.plan.goalText:parsed.task,coach:parsed};
 const envelope:CoachEnvelope={...base,sendConfirmation:await confirmationFor(base)};
 const response=await fetcher(`/api/v1/${envelope.operation==='summary'?'stages/summarize':'plans/generate'}`,{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'manual',signal:AbortSignal.any([signal,AbortSignal.timeout(90000)]),headers:{'Content-Type':'application/json'},body:JSON.stringify(envelope)});
 if(response.redirected||response.type==='opaqueredirect'||response.status>=300&&response.status<400)throw new Error('CONTROL_UNAVAILABLE');
 const raw:unknown=await response.json();
 signal.throwIfAborted();
 if(!response.ok){const error=z.object({error:z.string().regex(/^[A-Z_]{1,64}$/)}).safeParse(raw);throw new Error(error.success?error.data.error:'CONTROL_UNAVAILABLE');}
 const result=z.object({requestId:z.string(),context:z.object({restoreGeneration:z.number(),inputDigest:z.string()}),result:z.unknown(),accounting:z.enum(['settled','pending'])}).parse(raw);
 if(result.requestId!==request.requestId||result.context.restoreGeneration!==request.restoreGeneration||result.context.inputDigest!==envelope.sendConfirmation)throw new Error('STALE_INPUT');
 return {response:adaptCoachResponse(request,result.result),accounting:result.accounting};
}
