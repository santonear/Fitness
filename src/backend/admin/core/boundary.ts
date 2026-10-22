import {AdminError,adminJson,requireAdminDb,type AdminContext,type AdminEnvironment} from './contracts';
import {administratorIdentity,requireFreshAccess} from '../../management-auth';
import {ZodError} from 'zod';
import { sha256Hex } from '../../../domain/hex';
import { readBodyBytes, sameOrigin } from '../../request';
type AdminHandler=(request:Request,context:AdminContext)=>Promise<Response|undefined>;
export function createAdminContext(request:Request,env:AdminEnvironment):AdminContext {const identity=administratorIdentity(request);if(!identity)throw new AdminError('ADMIN_REQUIRED',403);const now=Date.now();return {env,actor:identity.actor,now,fresh:requireFreshAccess(request),requestId:request.headers.get('x-request-id')??'',audit:async(action,objectId,result)=>{if(!env.ADMIN_DB)throw new AdminError('ADMIN_UNAVAILABLE',503);await env.ADMIN_DB.prepare('INSERT INTO admin_audit(id,actor,at,object_id,action,result) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),identity.actor,now,objectId.slice(0,80),action,result).run();}}}
export async function adminBoundary(request:Request,context:AdminContext,handle:AdminHandler):Promise<Response> {
 try {
 const path=new URL(request.url).pathname;
 if(request.method==='GET'&&path.endsWith('/session'))return adminJson({enabled:true,fresh:context.fresh,environment:context.env.ADMIN_ENVIRONMENT??'preview'});
 if(request.method!=='GET') {
 if(request.method!=='POST'||!sameOrigin(request,false))throw new AdminError('ADMIN_REQUIRED',403);
 if(!/^[a-zA-Z0-9_-]{16,80}$/.test(context.requestId))throw new AdminError('REQUEST_ID_REQUIRED');
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AdminError('INVALID_CONTENT_TYPE');
 const bytes=await readBodyBytes(request,32768,()=>new AdminError('BODY_TOO_LARGE',413),true);request=new Request(request,{body:bytes});
 const payload=new Uint8Array(new TextEncoder().encode(path).length+1+bytes.length);payload.set(new TextEncoder().encode(path));payload.set(bytes,payload.length-bytes.length);
 const fingerprint=await sha256Hex(payload);
 const db=requireAdminDb(context);
 await db.prepare('INSERT OR IGNORE INTO admin_operations(id,actor,fingerprint,status,created_at) VALUES(?,?,?,?,?)').bind(context.requestId,context.actor,fingerprint,'started',context.now).run();
 const operation=await db.prepare('SELECT actor,fingerprint FROM admin_operations WHERE id=?').bind(context.requestId).first<{actor:string;fingerprint:string}>();
 if(!operation||operation.actor!==context.actor||operation.fingerprint!==fingerprint)throw new AdminError('ADMIN_OPERATION_CONFLICT',409);
 }
 return await handle(request,context)??adminJson({error:'NOT_FOUND'},404);
 }catch(error){return adminJson({error:error instanceof AdminError?error.code:error instanceof ZodError?'INVALID_INPUT':'ADMIN_UNAVAILABLE'},error instanceof AdminError?error.status:error instanceof ZodError?400:503)}
}
