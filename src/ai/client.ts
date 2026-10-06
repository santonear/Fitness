import type {AiClient} from './workflow';
import {ControlService,type ControlConfig} from '../backend/control';
import type {ControlState,ControlStore} from '../backend/store';
import {exercises} from '../catalog/exercises';
import {z} from 'zod';
import {validateCandidate} from '../backend/contracts';
import {uuidSchema} from '../domain/schemas';
const count=z.number().int().nonnegative();
const publicErrors=new Set(['QUALIFICATION_REQUIRED','INVITE_NOT_FOUND','INVITE_INVALID','SUBJECT_EXPIRED','SUBJECT_NOT_FOUND','RECONCILIATION_REQUIRED','REQUEST_CONFLICT','REQUEST_IN_PROGRESS','RESULT_UNAVAILABLE','AI_DISABLED','REQUEST_COST_BOUND','INDIVIDUAL_QUOTA_EXHAUSTED','GLOBAL_BUDGET_EXHAUSTED','CONCURRENCY_LIMIT','NOT_SUBMITTED','ACCOUNTING_PENDING','CANCELLED','ALREADY_SUBMITTED','REQUEST_NOT_FOUND','STALE_RESTORE_GENERATION','STALE_INPUT','INVALID_INPUT','RANGE_TOO_LARGE','ORIGIN_DENIED','CONTROL_UNAVAILABLE','DATE_BOUND_EXCEEDED','INVALID_REQUEST','CONFIRMATION_REQUIRED']);
const statusSchema=z.object({expiresAt:count.max(8_640_000_000_000_000),period:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),used:z.object({understand:count,generate:count}),limits:z.object({understand:count,generate:count}),pending:count.optional(),reconciliationRequired:z.boolean().optional(),aiEnabled:z.boolean()});

export const disabledAiClient:AiClient={status:async()=>{throw new Error('AI_DISABLED');},redeem:async()=>{throw new Error('AI_DISABLED');},submit:async()=>{throw new Error('AI_DISABLED');},cancel:async()=>{}};
/** Explicit page-only demo. Reuses admission policy; no cookies/storage/network or real credentials. */
export async function createDemoAiClient():Promise<AiClient>{
 let state:ControlState={version:1,aiEnabled:false,recoveryRequired:false,invites:{},subjects:{},sessions:{},usages:{},budgets:{},requests:{},audit:[]};let queue:Promise<unknown>=Promise.resolve();
 const store:ControlStore={read:async()=>structuredClone(state),transact<T>(change:(state:ControlState)=>T):Promise<T>{const result=queue.then(()=>{const next=structuredClone(state);const output=change(next);state=next;return output;});queue=result.catch(()=>{});return result;}};
 const config:ControlConfig={mode:'local-test',timeZone:'UTC',k:1,budgetLimit:3500,maximumRequestCost:1000,requestBounds:{understand:0,generate:0},quotas:{understand:8,generate:4},maxInputBytes:65536,maxConcurrent:1,adminSecret:crypto.randomUUID(),digestSecret:crypto.randomUUID()};
 const service=new ControlService(store,config,{kind:'local-mock',call:async request=>{if(request.operation==='summary')throw new Error('AI_DISABLED');return {actualCost:0,result:request.operation==='understand'?{interpretedGoal:request.goalText}:{days:request.dates.map(date=>({date,exercises:[{exerciseId:exercises[0].id,order:0,targetSets:[{metricType:'reps_load',reps:8,loadGrams:0}],notes:'Local demo fixture / 本地演示样例'}]}))}};}});
 await service.enableMock(config.adminSecret,true);const issued=await service.issue(config.adminSecret);let session='';
 return {status:()=>service.status(session),redeem:async code=>{if(code!=='FITNESS-DEMO')throw new Error('INVITE_INVALID');session=(await service.redeem(issued.code)).token;},submit:request=>service.submit(session,request),cancel:requestId=>service.cancel(session,requestId).then(()=>{})};
}
export function createFetchAiClient(fetcher:typeof fetch=fetch):AiClient{
 async function request(path:string,data?:unknown,signal?:AbortSignal){let response:Response;try{response=await fetcher(`/api/v1/${path}`,{method:data===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',redirect:'manual',headers:data===undefined?undefined:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal});}catch{throw new Error('CONTROL_UNAVAILABLE');}
  if(response.redirected||response.status>=300&&response.status<400||response.type==='opaqueredirect')throw new Error('CONTROL_UNAVAILABLE');
  let body:unknown;try{body=await response.json();}catch{throw new Error('CONTROL_UNAVAILABLE');}if(!response.ok){const code=typeof body==='object'&&body&&'error' in body?body.error:undefined;throw new Error(typeof code==='string'&&publicErrors.has(code)?code:'CONTROL_UNAVAILABLE');}return body;
 }
 return {status:async()=>{const result=statusSchema.safeParse(await request('trial/status'));if(!result.success)throw new Error('CONTROL_UNAVAILABLE');return result.data;},redeem:async code=>{await request('trial/redeem',{code});},submit:async(payload,signal)=>{
  const response=z.object({requestId:uuidSchema,result:z.unknown(),context:z.strictObject({restoreGeneration:count.max(Number.MAX_SAFE_INTEGER),inputDigest:z.string().regex(/^[a-f0-9]{64}$/)}),accounting:z.enum(['settled','pending'])}).safeParse(await request(payload.operation==='understand'?'goals/interpret':'plans/generate',payload,signal));
  if(!response.success||response.data.requestId!==payload.requestId||response.data.context.restoreGeneration!==payload.restoreGeneration||response.data.context.inputDigest!==payload.sendConfirmation)throw new Error('CONTROL_UNAVAILABLE');
  try{return {...response.data,result:validateCandidate(payload,response.data.result)};}catch{throw new Error('CONTROL_UNAVAILABLE');}
 },cancel:async requestId=>{await request('requests/cancel',{requestId});}};
}
