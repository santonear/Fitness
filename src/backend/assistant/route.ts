import {sanitizeAssistantRequest,type AssistantEvent} from '../../assistant/contracts';
import {runAssistantModel,createAssistantProvider} from './model';
import {ASSISTANT_PROMPT_VERSION,assistantPromptRegistry} from './prompts';
import {AssistantAccessError,AssistantUsageStore,type UsageCall} from './admission';
import {D1ControlStore} from '../d1-store';
import {digest} from '../contracts';
import {FinanceStore} from '../admin/finance/runtime';
import {archiveLegacyUsage} from './usage-report';
import type {DeepSeekWorkerEnv} from '../deepseek-worker';
import type {FeatureConfigEnv} from '../feature-config';
export type AssistantEnv=DeepSeekWorkerEnv&FeatureConfigEnv&{ASSISTANT_MAX_OUTPUT_TOKENS?:string;ASSISTANT_MAX_ATTACHMENT_TOKENS?:string};
// Official pricing verified 2026-10-12: uncached peak CNY 2 / 8 per million. Display estimate, never admission.
export const assistantPrice={inputFenPerMillion:200,outputFenPerMillion:800,version:'deepseek-flash-2026-10-12-peak'};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function assistantSubject(request:Request,env:AssistantEnv){
 if(!env.CONTROL_DB||!env.CONTROL_DIGEST_SECRET)throw new AssistantAccessError('SERVICE_UNAVAILABLE',503);
 const cookies=(request.headers.get('cookie')??'').split(';').map(s=>s.trim()).filter(s=>s.startsWith('__Host-fitness_trial='));
 const token=cookies.length===1?cookies[0].slice('__Host-fitness_trial='.length):'';
 if(!/^[a-f0-9]{64}$/.test(token))throw new AssistantAccessError('QUALIFICATION_REQUIRED',401);
 const state=await new D1ControlStore(env.CONTROL_DB).read(),session=state.sessions[await digest(token,env.CONTROL_DIGEST_SECRET)],subject=session&&state.subjects[session.subjectId];
 if(!session||session.revoked||!subject||subject.revoked||subject.deletedAt||subject.expiresAt<=Date.now())throw new AssistantAccessError('QUALIFICATION_REQUIRED',401);
 if(!state.aiEnabled||env.CONTROL_MODE!=='external')throw new AssistantAccessError('AI_DISABLED',503);
 return {subjectId:session.subjectId,state};
}
async function readInput(request:Request){if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AssistantAccessError('INVALID_INPUT',400);const reader=request.body?.getReader();if(!reader)throw new AssistantAccessError('INVALID_INPUT',400);let size=0,text='';const decoder=new TextDecoder();try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>131072){await reader.cancel();throw new AssistantAccessError('INPUT_TOO_LARGE',413)}text+=decoder.decode(part.value,{stream:true})}return JSON.parse(text+decoder.decode())}finally{reader.releaseLock()}}
export async function handleAssistant(request:Request,env:AssistantEnv,runner=runAssistantModel):Promise<Response>{
 let releaseSetup:undefined|(()=>Promise<void>),cancelSetup:undefined|(()=>void);
 try{
  if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
  const url=new URL(request.url);if(url.protocol!=='https:'||request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'ORIGIN_DENIED'},403);
  let input;try{input=sanitizeAssistantRequest(await readInput(request))}catch(e){if(e instanceof AssistantAccessError)throw e;throw new AssistantAccessError('INVALID_INPUT',400)}
  const {subjectId,state}=await assistantSubject(request,env);
  if(!env.ADMIN_DB||!env.DEEPSEEK_API_KEY)throw new AssistantAccessError('MODEL_UNAVAILABLE',503);
  const config=(await new FinanceStore(env.ADMIN_DB).read()).versions.at(-1)?.config;
  const limit=config?.dailyMessageLimit??30;
  const store=new AssistantUsageStore(env.ADMIN_DB),now=Date.now();
  await archiveLegacyUsage(env.ADMIN_DB,state,now);
  let promptVersion=ASSISTANT_PROMPT_VERSION;
  const selected=await env.ADMIN_DB.prepare('SELECT version FROM admin_prompt_selection WHERE environment=? AND task=?').bind(env.ADMIN_ENVIRONMENT??'preview','ASSISTANT_CHAT').first<{version:string}>();
  if(selected){if(selected.version!==assistantPromptRegistry.current&&selected.version!==assistantPromptRegistry.previous&&selected.version!==assistantPromptRegistry.legacy)throw new AssistantAccessError('MODEL_UNAVAILABLE',503);promptVersion=selected.version}
  const abort=new AbortController(),signal=AbortSignal.any([request.signal,abort.signal,AbortSignal.timeout(150000)]);
  const provider=createAssistantProvider({apiKey:env.DEEPSEEK_API_KEY,baseUrl:'https://api.deepseek.com',model:'deepseek-flash',maxAttachmentTokens:env.ASSISTANT_MAX_ATTACHMENT_TOKENS?Number(env.ASSISTANT_MAX_ATTACHMENT_TOKENS):undefined,maxTokens:env.ASSISTANT_MAX_OUTPUT_TOKENS?Number(env.ASSISTANT_MAX_OUTPUT_TOKENS):undefined});
  const encoder=new TextEncoder();let disconnected=false;
  const releaseOwnedSetup=async()=>{
   const current=await store.read(subjectId);if(current?.active_request!==input.requestId)return;
   await store.finish(subjectId,input.requestId,input.context?.task??'CHAT',false,[{stage:'setup',result:'failed',inputTokens:0,outputTokens:0}],assistantPrice,Date.now(),'failed');
  };
  try{await store.admit(subjectId,input.requestId,input.timeZone,limit,now)}catch(e){
   // A write may commit even when its acknowledgement fails. Explicit admission refusals own no lease.
   if(!(e instanceof AssistantAccessError))releaseSetup=releaseOwnedSetup;
   throw e;
  }
  releaseSetup=releaseOwnedSetup;
  let begin!:()=>void;const ready=new Promise<void>(resolve=>{begin=resolve});
  cancelSetup=()=>{disconnected=true;abort.abort();begin()};
  const stream=new ReadableStream<Uint8Array>({async start(controller){
   await ready;if(disconnected)return;
   let success=false,result='failed',calls:UsageCall[]=[],done:AssistantEvent|undefined;
   const emit=(event:AssistantEvent)=>{if(!disconnected)controller.enqueue(encoder.encode('data: '+JSON.stringify(event)+'\n\n'))};
   try{for await(const event of runner(input,{provider,promptVersion,signal})){
    if(event.type==='done'){success=event.success;result=event.result??(success?'success':'failed');calls=event.calls??[{...event.usage,stage:'text',result}];done=event}else emit(event);
   }}catch(e){result=signal.aborted?'cancelled':e instanceof TypeError?'network_failed':'model_failed';if(!disconnected)emit({type:'error',code:result==='network_failed'?'NETWORK_ERROR':'MODEL_UNAVAILABLE'});}
   finally{if(!calls.length)calls=[{stage:'unknown',result}];try{await store.finish(subjectId,input.requestId,input.context?.task??'CHAT',success&&!signal.aborted,calls,assistantPrice,Date.now(),result);if(done&&!disconnected)emit(signal.aborted?{type:'error',code:'REQUEST_CANCELLED'}:done)}catch{if(!disconnected)emit({type:'error',code:'USAGE_UNAVAILABLE'})}if(!disconnected)controller.close()}
  },cancel(){disconnected=true;abort.abort()}});
  const response=new Response(stream,{headers:{'Content-Type':'text/event-stream;charset=utf-8','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'}});
  releaseSetup=undefined;cancelSetup=undefined;begin();return response;
 }catch(e){cancelSetup?.();if(releaseSetup)try{await releaseSetup()}catch{console.warn('assistant_setup_cleanup_failed')};return e instanceof AssistantAccessError?json({error:e.code,...(e.resetAt?{resetAt:new Date(e.resetAt).toISOString()}: {})},e.status):json({error:'SERVICE_UNAVAILABLE'},503)}
}

/** V2 qualification reads identity only; legacy budgets/reconciliation never enter this path. */
export async function assistantAccessStatus(request:Request,env:AssistantEnv){
 try{
  const url=new URL(request.url),origin=request.headers.get('origin'),site=request.headers.get('sec-fetch-site'),referer=request.headers.get('referer');
  const sameOriginGet=request.method==='GET'&&(origin===null||origin===url.origin)&&(
   site==='same-origin'||origin===url.origin||referer!==null&&(()=>{try{return new URL(referer).origin===url.origin}catch{return false}})()
  );
  if(url.protocol!=='https:'||site==='cross-site'||!['GET','POST'].includes(request.method))return json({error:'ORIGIN_DENIED'},403);
  if(request.method==='POST'?origin!==url.origin:!sameOriginGet)return json({error:'ORIGIN_DENIED'},403);
  if(!env.CONTROL_DB||!env.CONTROL_DIGEST_SECRET)return json({error:'SERVICE_UNAVAILABLE'},503);
  const raw=request.method==='GET'?{}:await readInput(request) as {receipt?:unknown};if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>k!=='receipt')||raw.receipt!==undefined&&(typeof raw.receipt!=='string'||!/^[a-f0-9]{64}$/.test(raw.receipt)))return json({error:'INVALID_INPUT'},400);
  const state=await new D1ControlStore(env.CONTROL_DB).read();
  const cookies=(request.headers.get('cookie')??'').split(';').map(s=>s.trim()).filter(s=>s.startsWith('__Host-fitness_trial='));const token=cookies.length===1?cookies[0].slice('__Host-fitness_trial='.length):'';
  const session=/^[a-f0-9]{64}$/.test(token)?state.sessions[await digest(token,env.CONTROL_DIGEST_SECRET)]:undefined;
  const owner=raw.receipt?await digest(`application:${raw.receipt}`,env.CONTROL_DIGEST_SECRET):undefined;
  const claimed=owner?Object.values(state.applications??{}).filter(a=>a.ownerDigest===owner&&a.state==='claimed'&&a.subjectId).sort((a,b)=>b.createdAt-a.createdAt)[0]:undefined;
  const id=session?.subjectId??claimed?.subjectId,subject=id?state.subjects[id]:undefined;
  if(!subject)return json({qualification:'none',sessionValid:false,assistantV2:true});
  const qualification=subject.revoked||subject.deletedAt?'revoked':subject.expiresAt<=Date.now()?'expired':'active';
  const aiEnabled=state.aiEnabled&&env.CONTROL_MODE==='external';
  return json({qualification,sessionValid:qualification==='active'&&!!session&&!session.revoked,expiresAt:subject.expiresAt,aiEnabled,summaryAvailable:aiEnabled,planningBudgetDisabled:true,assistantV2:true});
 }catch{return json({error:'SERVICE_UNAVAILABLE'},503)}
}

