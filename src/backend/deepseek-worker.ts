import { createDeepSeekCodec, DEEPSEEK_ENDPOINT } from './deepseek';
import { createWorker, type WorkerEnv } from './worker';
import {readSelectedPromptVersion} from './admin/releases/runtime';

export interface DeepSeekWorkerEnv extends WorkerEnv { DEEPSEEK_API_KEY?: string; DEEPSEEK_PRICING_VERIFIED_UNTIL?: string; FITNESS_COACH_PROMPT_RELEASE?: string }

/** Separate opt-in entrypoint. Configuration and the control ledger both gate model access. */
export function createDeepSeekWorker(dependencies: Pick<NonNullable<Parameters<typeof createWorker>[0]>, 'store' | 'transport'> = {}) {
  return { async fetch(request: Request, env: DeepSeekWorkerEnv): Promise<Response> {
    const path = new URL(request.url).pathname;
    if(request.method==='POST'&&['/api/v1/plans/generate','/api/v1/stages/summarize'].includes(path)) {
      const failure = (error:string,status:number) => Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
      const reader=request.body?.getReader();
      if(!reader)return failure('INVALID_INPUT',400);
      const chunks:Uint8Array[]=[];let length=0;
      try {
        while(true){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>65536){await reader.cancel();return failure('BODY_TOO_LARGE',413)}chunks.push(part.value)}
      }catch{return failure('INVALID_INPUT',400)}finally{reader.releaseLock()}
      const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
      let body:unknown;try{body=JSON.parse(new TextDecoder().decode(bytes))}catch{return failure('INVALID_INPUT',400)}
      const headers=new Headers(request.headers);headers.delete('content-length');
      request=new Request(request,{headers,body:bytes});
      const coach=body&&typeof body==='object'&&!Array.isArray(body)?(body as {coach?:unknown}).coach:undefined;
      if(coach!==undefined){
        const task=coach&&typeof coach==='object'?(coach as {task?:unknown}).task:undefined;
        if(task!=='ONBOARD_PLAN'&&task!=='ADJUST_TODAY'&&task!=='MODIFY_PLAN'&&task!=='PERIOD_REVIEW')return failure('INVALID_INPUT',400);
        if((task==='PERIOD_REVIEW')!==(path==='/api/v1/stages/summarize'))return failure('INVALID_INPUT',400);
        if(env.ADMIN_CONSOLE_ENABLED==='true'){
          if(!env.ADMIN_DB)return failure('PROMPT_CONFIGURATION_UNAVAILABLE',503);
          try{env={...env,FITNESS_COACH_PROMPT_RELEASE:await readSelectedPromptVersion(env,task)}}catch{return failure('PROMPT_CONFIGURATION_UNAVAILABLE',503)}
        }
      }
    }
    if (env.FITNESS_COACH_PROMPT_RELEASE && !['v8.1.0','v8.0.0'].includes(env.FITNESS_COACH_PROMPT_RELEASE)) return new Response(null,{status:503});
    const worker = createWorker({ ...dependencies, codec: createDeepSeekCodec({ maxOutputTokens: 8192,
      coachPromptRelease: env.FITNESS_COACH_PROMPT_RELEASE === 'v8.0.0' ? 'v8.0.0' : 'v8.1.0',
      ...(env.DEEPSEEK_PRICING_VERIFIED_UNTIL ? { pricingVerifiedUntil: env.DEEPSEEK_PRICING_VERIFIED_UNTIL } : {}) }) });
    if (env.CONTROL_MODE !== 'external') return worker.fetch(request, env);
    const invalidDestination = (env.SUPPLIER_ENDPOINT !== undefined && env.SUPPLIER_ENDPOINT !== DEEPSEEK_ENDPOINT) ||
      (env.SUPPLIER_ORIGIN !== undefined && env.SUPPLIER_ORIGIN !== 'https://api.deepseek.com');
    if (env.SUPPLIER_PROVIDER !== 'deepseek' || invalidDestination) return new Response(JSON.stringify({
      error: env.SUPPLIER_PROVIDER !== 'deepseek' ? 'PROVIDER_SELECTION_REQUIRED' : 'INVALID_SUPPLIER_CONFIG',
    }), { status: env.SUPPLIER_PROVIDER !== 'deepseek' ? 503 : 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
    return worker.fetch(request, { ...env, SUPPLIER_API_KEY: env.DEEPSEEK_API_KEY,
      SUPPLIER_ENDPOINT: DEEPSEEK_ENDPOINT, SUPPLIER_ORIGIN: 'https://api.deepseek.com' });
  } };
}

export default createDeepSeekWorker();
