import {z} from 'zod';
import {canonical,confirmationFor,validateCandidate,type StageSummaryRequest} from '../backend/contracts';
import {summaryResultSchema} from '../backend/summary-contract';
import {uuidSchema} from '../domain/schemas';
import type {StageSummaryResult} from '../application/stage-summary';
type PreparedStage=Extract<StageSummaryResult,{ok:true}>;
const count=z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const quota=z.object({understand:count,generate:count,summary:count.optional()});
const statusSchema=z.object({expiresAt:count.max(8_640_000_000_000_000),period:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),used:quota,limits:quota,pending:count.optional(),reconciliationRequired:z.boolean().optional(),aiEnabled:z.boolean(),summaryAvailable:z.boolean().optional()});
const publicErrors=new Set(['QUALIFICATION_REQUIRED','SUBJECT_EXPIRED','SUBJECT_NOT_FOUND','AI_DISABLED','SUMMARY_DISABLED','INDIVIDUAL_QUOTA_EXHAUSTED','GLOBAL_BUDGET_EXHAUSTED','RECONCILIATION_REQUIRED','ACCOUNTING_PENDING','REQUEST_IN_PROGRESS','REQUEST_CONFLICT','RESULT_UNAVAILABLE','CONCURRENCY_LIMIT','REQUEST_COST_BOUND','RANGE_TOO_LARGE','INVALID_INPUT','CONFIRMATION_REQUIRED','CONTROL_UNAVAILABLE','NOT_SUBMITTED','CANCELLED','ALREADY_SUBMITTED','REQUEST_NOT_FOUND']);
export type SummaryStatus=z.infer<typeof statusSchema>;
export type SummaryResponse={requestId:string;result:z.infer<typeof summaryResultSchema>;context:{restoreGeneration:number;inputDigest:string};accounting:'settled'|'pending'};
export function summaryEligible(status:SummaryStatus|undefined){return Boolean(status?.aiEnabled&&status.summaryAvailable===true&&status.used.summary!==undefined&&status.limits.summary!==undefined&&status.used.summary<status.limits.summary&&!status.reconciliationRequired&&(status.pending??0)===0);}
export async function createSummaryRequest(result:PreparedStage,locale:'en'|'zh'):Promise<StageSummaryRequest>{
 const value={contractVersion:1 as const,requestId:crypto.randomUUID(),operation:'summary' as const,locale,restoreGeneration:result.manifest.restoreGeneration,stage:{selection:result.selection,range:result.range,sourceRevision:result.manifest.dataRevision,capturedAt:result.manifest.capturedAt,payload:result.payload,goals:result.goals,completionLinks:result.completionLinks}};
 return {...value,sendConfirmation:await confirmationFor(value)};
}
/** Capture timestamps and unrelated library revisions do not change selected facts. */
export function assertSummaryCurrent(request:StageSummaryRequest,fresh:StageSummaryResult){
 if(!fresh.ok)throw new Error('STALE_STAGE');
 if(fresh.manifest.restoreGeneration!==request.restoreGeneration)throw new Error('STALE_RESTORE_GENERATION');
 const comparable=(stage:StageSummaryRequest['stage'])=>{const {capturedAt:_capturedAt,sourceRevision:_revision,payload,...fields}=stage;const {capturedAt:_payloadCaptured,dataRevision:_payloadRevision,...facts}=payload;return canonical({...fields,payload:facts});};
 const stage={selection:fresh.selection,range:fresh.range,sourceRevision:fresh.manifest.dataRevision,capturedAt:fresh.manifest.capturedAt,payload:fresh.payload,goals:fresh.goals,completionLinks:fresh.completionLinks};
 if(comparable(request.stage)!==comparable(stage))throw new Error('STALE_STAGE');
}
export function createSummaryClient(fetcher:typeof fetch=fetch){
 async function request(path:string,data?:unknown,signal?:AbortSignal):Promise<unknown>{
  let response:Response;try{response=await fetcher(`/api/v1/${path}`,{method:data===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',redirect:'manual',headers:data===undefined?undefined:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal});}catch{throw new Error('CONTROL_UNAVAILABLE');}
  if(response.redirected||response.type==='opaqueredirect'||response.status>=300&&response.status<400)throw new Error('CONTROL_UNAVAILABLE');
  let body:unknown;try{body=await response.json();}catch{throw new Error('CONTROL_UNAVAILABLE');}
  if(!response.ok){const code=body&&typeof body==='object'&&'error'in body?body.error:undefined;throw new Error(typeof code==='string'&&publicErrors.has(code)?code:'CONTROL_UNAVAILABLE');}return body;
 }
 return {async status(){const result=statusSchema.safeParse(await request('trial/status'));if(!result.success)throw new Error('CONTROL_UNAVAILABLE');return result.data;},async submit(input:StageSummaryRequest,signal?:AbortSignal):Promise<SummaryResponse>{
  const response=z.object({requestId:uuidSchema,result:z.unknown(),context:z.strictObject({restoreGeneration:count,inputDigest:z.string().regex(/^[a-f0-9]{64}$/)}),accounting:z.enum(['settled','pending'])}).safeParse(await request('stages/summarize',input,signal));
  if(!response.success||response.data.requestId!==input.requestId||response.data.context.restoreGeneration!==input.restoreGeneration||response.data.context.inputDigest!==input.sendConfirmation)throw new Error('CONTROL_UNAVAILABLE');
  try{return {...response.data,result:summaryResultSchema.parse(validateCandidate(input,response.data.result))};}catch{throw new Error('CONTROL_UNAVAILABLE');}
 },async cancel(requestId:string){await request('requests/cancel',{requestId});}};
}
