import { z } from 'zod';
import { adminJson } from '../core/contracts';

export interface CloudflareReleaseAdapterEnv {
  RELEASE_CLOUDFLARE_TOKEN?:string;
  RELEASE_CLOUDFLARE_ACCOUNT?:string;
  /** Fixed environment-to-Worker mapping, set by deployment operator, never from request. */
  RELEASE_WORKERS?:string;
}
const command=z.object({environment:z.enum(['preview','production']),expectedDeployment:z.string().uuid(),targetDeployment:z.string().uuid()}).strict();
/** Deploy as a private service binding only. No public route; no user data or provider calls. */
export function createCloudflareReleaseAdapter(transport:typeof fetch=fetch) {
  return {async fetch(request:Request,env:CloudflareReleaseAdapterEnv):Promise<Response> {
    if(request.method!=='POST'||new URL(request.url).pathname!=='/rollback')return adminJson({error:'NOT_FOUND'},404);
    const parsed=command.safeParse(await request.json().catch(()=>null));const requestId=request.headers.get('Idempotency-Key');
    if(!parsed.success||!requestId||!/^[-\w]{8,100}$/.test(requestId))return adminJson({error:'INVALID_RELEASE_COMMAND'},400);
    let rawMapping:unknown;try{rawMapping=JSON.parse(env.RELEASE_WORKERS??'{}');}catch{return adminJson({error:'RELEASE_ADAPTER_UNAVAILABLE'},503);}
    const mapping=z.object({preview:z.string().regex(/^[a-z0-9-]{1,63}$/).optional(),production:z.string().regex(/^[a-z0-9-]{1,63}$/).optional()}).strict().safeParse(rawMapping);
    if(!env.RELEASE_CLOUDFLARE_TOKEN||!env.RELEASE_CLOUDFLARE_ACCOUNT||!mapping.success||!mapping.data[parsed.data.environment])return adminJson({error:'RELEASE_ADAPTER_UNAVAILABLE'},503);
    const base=`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.RELEASE_CLOUDFLARE_ACCOUNT)}/workers/scripts/${mapping.data[parsed.data.environment]}/deployments`;
    const headers={Authorization:`Bearer ${env.RELEASE_CLOUDFLARE_TOKEN}`,'Content-Type':'application/json'};
    const readCurrent=async()=>{
      const response=await transport(base,{headers,signal:AbortSignal.timeout(10000)});
      const body=z.object({success:z.literal(true),result:z.object({deployments:z.array(z.object({versions:z.array(z.object({version_id:z.string(),percentage:z.number()}))}))})}).safeParse(await response.json());
      if(!response.ok||!body.success)throw new Error('DEPLOYMENT_UNAVAILABLE');
      const versions=body.data.result.deployments[0]?.versions;
      if(versions?.length!==1||versions[0].percentage!==100)throw new Error('SPLIT_DEPLOYMENT_UNSUPPORTED');
      return versions[0].version_id;
    };
    try {
      const current=await readCurrent();
      // A timed-out retry observes the exact target and does not deploy twice.
      if(current===parsed.data.targetDeployment)return adminJson({deploymentId:current,requestId});
      if(current!==parsed.data.expectedDeployment)return adminJson({error:'DEPLOYMENT_CHANGED'},409);
      const response=await transport(base,{method:'POST',headers,signal:AbortSignal.timeout(15000),body:JSON.stringify({strategy:'percentage',versions:[{version_id:parsed.data.targetDeployment,percentage:100}],annotations:{'workers/message':`admin rollback ${requestId}`}})});
      if(!response.ok)return adminJson({error:'OPERATION_RESULT_UNKNOWN'},503);
      if(await readCurrent()!==parsed.data.targetDeployment)return adminJson({error:'OPERATION_RESULT_UNKNOWN'},503);
      return adminJson({deploymentId:parsed.data.targetDeployment,requestId});
    }catch{return adminJson({error:'OPERATION_RESULT_UNKNOWN'},503);}
  }};
}
export default createCloudflareReleaseAdapter();
