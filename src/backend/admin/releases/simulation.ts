import {z} from 'zod';
import {AdminError,type AdminContext} from '../core/contracts';
import type {ReleasesEnv} from './model';
import {registeredReleases} from './deployment';
const result=z.object({mode:z.literal('preview-simulation'),actualDeploymentUnchanged:z.literal(true),selectedDeploymentId:z.string().uuid().nullable(),changedAt:z.string().nullable(),requestId:z.string().nullable(),checks:z.array(z.object({check:z.enum(['registered_previous','data_compatibility']),status:z.literal('passed')})).optional()}).strict();
export async function readPreviewSimulation(env:ReleasesEnv){if(env.ADMIN_ENVIRONMENT!=='preview'||!env.ADMIN_PREVIEW_SIMULATION)return null;try{const r=await env.ADMIN_PREVIEW_SIMULATION.fetch(new Request('https://preview-simulation/status'));return r.ok?result.parse(await r.json()):null;}catch{return null;}}
export async function simulateRollback(context:AdminContext<ReleasesEnv>,input:{environment:string;expectedCurrent:string;target:string}){
 if(context.env.ADMIN_ENVIRONMENT!=='preview'||input.environment!=='preview'||!context.env.ADMIN_PREVIEW_SIMULATION)throw new AdminError('PREVIEW_SIMULATION_UNAVAILABLE',503);
 const registry=registeredReleases(context.env).find(item=>item.environment==='preview');
 if(!registry?.previous||registry.current.id!==input.expectedCurrent||registry.previous.id!==input.target)throw new AdminError('UNREGISTERED_PREVIOUS_RELEASE',409);
 const response=await context.env.ADMIN_PREVIEW_SIMULATION.fetch(new Request('https://preview-simulation/simulate',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':context.requestId},body:JSON.stringify({environment:'preview',expectedDeployment:registry.current.deploymentId,targetDeployment:registry.previous.deploymentId})}));
 if(!response.ok)throw new AdminError('PREVIEW_SIMULATION_UNAVAILABLE',503);
 const body=result.parse(await response.json());if(body.requestId!==context.requestId||body.selectedDeploymentId!==registry.previous.deploymentId)throw new AdminError('OPERATION_RESULT_UNKNOWN',503);
 await context.audit('preview_simulation',input.target,'simulated');return body;
}
