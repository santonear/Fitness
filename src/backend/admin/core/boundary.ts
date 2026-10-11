import {AdminError,adminJson,type AdminContext,type AdminEnvironment} from './contracts';
import {administratorIdentity,requireFreshAccess} from '../../management-auth';
export type AdminHandler=(request:Request,context:AdminContext)=>Promise<Response|undefined>;
export function createAdminContext(request:Request,env:AdminEnvironment):AdminContext {const identity=administratorIdentity(request);if(!identity)throw new AdminError('ADMIN_REQUIRED',403);const now=Date.now();return {env,actor:identity.actor,now,fresh:requireFreshAccess(request),requestId:request.headers.get('x-request-id')??'',audit:async(action,objectId,result)=>{if(!env.ADMIN_DB)throw new AdminError('ADMIN_UNAVAILABLE',503);await env.ADMIN_DB.prepare('INSERT INTO admin_audit(id,actor,at,object_id,action,result) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),identity.actor,now,objectId.slice(0,80),action,result).run();}}}
export async function adminBoundary(request:Request,context:AdminContext,handle:AdminHandler):Promise<Response> {
 try {
 const path=new URL(request.url).pathname;
 if(request.method==='GET'&&path.endsWith('/session'))return adminJson({enabled:true,fresh:context.fresh,environment:context.env.ADMIN_ENVIRONMENT??'preview'});
 if(request.method!=='GET') {
 if(request.method!=='POST'||request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')throw new AdminError('ADMIN_REQUIRED',403);
 if(!/^[a-zA-Z0-9_-]{16,80}$/.test(context.requestId))throw new AdminError('REQUEST_ID_REQUIRED');
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AdminError('INVALID_CONTENT_TYPE');
 const body=await request.clone().text();if(new TextEncoder().encode(body).byteLength>32768)throw new AdminError('BODY_TOO_LARGE',413);
 }
 return await handle(request,context)??adminJson({error:'NOT_FOUND'},404);
 }catch(error){return adminJson({error:error instanceof AdminError?error.code:'ADMIN_UNAVAILABLE'},error instanceof AdminError?error.status:503)}
}
