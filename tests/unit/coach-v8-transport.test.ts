import { describe, expect, it, vi } from 'vitest';
import { approveCoachScope, coachScope, coachScopeFields } from '../../src/coach/consent';
import { sendCoach } from '../../src/coach/transport';
import { confirmationFor, validateTransportRequest } from '../../src/backend/contracts';
import type { CoachRequest } from '../../src/coach/contracts';

const id = '11111111-1111-4111-8111-111111111111';
const request: CoachRequest = { version:'fitness-coach-v8',requestId:id,conversationId:id,restoreGeneration:2,inputSnapshot:'revision:4',sendConfirmation:'preview',locale:'zh',timeZone:'Asia/Shanghai',adultConfirmed:true,messages:[],task:'ONBOARD_PLAN',profile:{goalText:'练出习惯',weeklyTarget:2,sessionMinutes:20,scheduleOriginalText:'每次20分钟',place:'home',equipment:[],adultConfirmed:true,cautions:[]},body:{age:25,weight:65},history:'private history' };

describe('coach transport consent and identity',()=>{
 it('omits optional fields until individually chosen and discloses every actual field',()=>{
  const scope=coachScope(request);
  expect(scope).not.toHaveProperty('body'); expect(scope).not.toHaveProperty('history');
  expect(coachScope(request,true)).toHaveProperty('body'); expect(coachScope(request,true)).not.toHaveProperty('history');
  expect(coachScope(request,false,true)).toHaveProperty('history');
  expect(coachScopeFields(scope).map(f=>f.key)).toEqual(Object.keys(scope).filter(k=>k!=='sendConfirmation'));
  expect(request.history).toBe('private history');
 });
 it('binds both confirmations and validates the returned identity without retries',async()=>{
  const approved=await approveCoachScope(coachScope(request));
  const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>{
   const envelope=JSON.parse(String(init?.body));
   expect(await validateTransportRequest(envelope,7,100000)).toEqual(envelope);
   return Response.json({requestId:id,context:{restoreGeneration:2,inputDigest:envelope.sendConfirmation},accounting:'settled',result:{type:'clarify',question:'想在哪里练？',requestId:id,restoreGeneration:2,mutationAllowed:false}});
  });
  expect((await sendCoach(approved,new AbortController().signal,fetcher as typeof fetch)).response.type).toBe('clarify');
  expect(fetcher).toHaveBeenCalledTimes(1);
  await expect(sendCoach({...approved,history:'changed'},new AbortController().signal,fetcher as typeof fetch)).rejects.toThrow('CONFIRMATION_REQUIRED');
  expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('rejects known minors even when adultConfirmed is true',async()=>{
  const coach=await approveCoachScope({...request,body:{age:17}});
  const base={contractVersion:1,requestId:id,locale:'zh',restoreGeneration:2,operation:'generate',goalText:request.profile.goalText,coach};
  await expect(validateTransportRequest({...base,sendConfirmation:await confirmationFor(base)},7,100000)).rejects.toThrow();
 });
 it('does not dispatch an already cancelled request',async()=>{
  const controller=new AbortController();controller.abort();const fetcher=vi.fn();
  await expect(sendCoach(await approveCoachScope(request),controller.signal,fetcher)).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();
 });
});

