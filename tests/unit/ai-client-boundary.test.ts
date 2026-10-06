import {describe,it,expect,vi} from 'vitest';
import {createDemoAiClient,createFetchAiClient} from '../../src/ai/client';
import {AiWorkflow} from '../../src/ai/workflow';
import {exercises} from '../../src/catalog/exercises';

async function understanding(){const flow=new AiWorkflow(createFetchAiClient());flow.setGoal('Synthetic goal');return flow.previewUnderstanding('en',0);}
async function generation(){const flow=new AiWorkflow(createFetchAiClient());flow.setGoal('Synthetic goal');flow.confirmGoal('Synthetic interpretation');return flow.previewGeneration({locale:'en',restoreGeneration:0,dates:['2026-10-06'],timeZone:'UTC',catalogVersion:1,conditions:{}});}
function json(value:unknown,status=200){return new Response(JSON.stringify(value),{status});}
function metadata(request:Awaited<ReturnType<typeof understanding>>){return {context:{restoreGeneration:request.restoreGeneration,inputDigest:request.sendConfirmation},accounting:'settled' as const};}

describe('fetch AI response boundary',()=>{
 it('accepts the real control service success envelope and returns only the public candidate fields',async()=>{
  const demo=await createDemoAiClient();await demo.redeem('FITNESS-DEMO');const request=await understanding();const envelope=await demo.submit(request);
  expect(envelope).toMatchObject({accounting:'settled',context:{restoreGeneration:0,inputDigest:request.sendConfirmation}});
  await expect(createFetchAiClient(async()=>json(envelope)).submit(request)).resolves.toEqual({...metadata(request),requestId:request.requestId,result:{interpretedGoal:request.goalText}});
 });
 it('accepts a validated matching understanding and applies transport safeguards',async()=>{
  const request=await understanding();const fetcher=vi.fn(async(_url:unknown,options?:RequestInit)=>{expect(options).toMatchObject({credentials:'same-origin',cache:'no-store',redirect:'manual'});return json({...metadata(request),requestId:request.requestId,result:{interpretedGoal:'Synthetic interpretation'}});});
  await expect(createFetchAiClient(fetcher).submit(request)).resolves.toEqual({...metadata(request),requestId:request.requestId,result:{interpretedGoal:'Synthetic interpretation'}});expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('rejects malformed envelopes and mismatched request identity',async()=>{
  const request=await understanding();for(const body of [null,{}, {requestId:'invalid',result:{interpretedGoal:'Goal'}},{requestId:crypto.randomUUID(),result:{interpretedGoal:'Goal'}},{requestId:request.requestId,result:{interpretedGoal:123}},{requestId:request.requestId,result:{interpretedGoal:'Goal',privateDetail:'not public'}}]){
   await expect(createFetchAiClient(async()=>json(body&&typeof body==='object'?{...metadata(request),...body}:body)).submit(request)).rejects.toThrow('CONTROL_UNAVAILABLE');
  }
 });
 it('checks generated candidate dates, catalog identities and metric semantics',async()=>{
  const request=await generation();const candidate={days:[{date:'2026-10-06',exercises:[{exerciseId:exercises[0].id,order:0,targetSets:[{metricType:'reps_load',reps:8,loadGrams:0}],notes:''}]}]};
  await expect(createFetchAiClient(async()=>json({...metadata(request),requestId:request.requestId,result:candidate})).submit(request)).resolves.toEqual({...metadata(request),requestId:request.requestId,result:candidate});
  for(const result of [{days:[]},{days:[{...candidate.days[0],date:'2026-10-07'}]},{days:[{...candidate.days[0],exercises:[{...candidate.days[0].exercises[0],exerciseId:'unknown'}]}]},{days:[{...candidate.days[0],exercises:[{...candidate.days[0].exercises[0],targetSets:[{metricType:'duration',durationSeconds:10}]}]}]}])await expect(createFetchAiClient(async()=>json({...metadata(request),requestId:request.requestId,result})).submit(request)).rejects.toThrow('CONTROL_UNAVAILABLE');
 });
 it('rejects redirects without reading their bodies or retrying',async()=>{
  const response=new Response(null,{status:302,headers:{Location:'https://untrusted.example'}});const read=vi.spyOn(response,'json');const fetcher=vi.fn(async()=>response);
  await expect(createFetchAiClient(fetcher).redeem('synthetic')).rejects.toThrow('CONTROL_UNAVAILABLE');expect(read).not.toHaveBeenCalled();expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('requires matching context and accounting and accepts valid pending candidates',async()=>{
  const request=await understanding(),valid={...metadata(request),requestId:request.requestId,result:{interpretedGoal:'Goal'}};
  for(const extra of [{context:undefined},{accounting:undefined},{accounting:'released'},{context:{restoreGeneration:1,inputDigest:request.sendConfirmation}},{context:{restoreGeneration:0,inputDigest:'0'.repeat(64)}}])await expect(createFetchAiClient(async()=>json({...valid,...extra})).submit(request)).rejects.toThrow('CONTROL_UNAVAILABLE');
  await expect(createFetchAiClient(async()=>json({...valid,accounting:'pending'})).submit(request)).resolves.toEqual({...valid,accounting:'pending'});
 });
 it('rejects unexpectedly followed redirects and sanitizes unreadable/network responses',async()=>{
  const response=json({});Object.defineProperty(response,'redirected',{value:true});
  for(const fetcher of [async()=>response,async()=>new Response('private error'),async()=>{throw new Error('private error');}])await expect(createFetchAiClient(fetcher).redeem('synthetic')).rejects.toThrow('CONTROL_UNAVAILABLE');
 });
 it('only exposes approved error codes, never supplier messages',async()=>{
  for(const [body,error] of [[{error:'ACCOUNTING_PENDING',message:'private'},'ACCOUNTING_PENDING'],[{error:'private supplier message'},'CONTROL_UNAVAILABLE'],[{error:{message:'private'}},'CONTROL_UNAVAILABLE']] as const)await expect(createFetchAiClient(async()=>json(body,502)).redeem('synthetic')).rejects.toThrow(error);
 });
});
