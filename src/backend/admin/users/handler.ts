import {z} from 'zod';
import {D1ControlStore} from '../../d1-store';
import {AdminError,adminJson,requireFreshContext,requireAdminDb,type AdminContext,type AdminDatabase} from '../core/contracts';
import type {ControlState} from '../../store';
export interface UsersContext extends AdminContext {forward:(operation:string,data:unknown)=>Promise<Response>}
const short=(id:string)=>id.slice(0,12);
export async function readUserState(c:AdminContext){if(!c.env.CONTROL_DB)throw new AdminError('CONTROL_UNAVAILABLE',503);return new D1ControlStore(c.env.CONTROL_DB).read()}
const previewUsers:Record<string,string>={'91000000-0001-4000-8000-000000000001':'normal','92000000-0002-4000-8000-000000000002':'expiring','93000000-0003-4000-8000-000000000003':'quota-unknown'};
export function userProjection(state:ControlState,now:number,environment?:string){return Object.entries(state.subjects).filter(([,v])=>!v.deletedAt).map(([id,s])=>({id:short(id),...(environment==='preview'&&Object.hasOwn(previewUsers,id)?{previewLabel:previewUsers[id]}:{}),expiresAt:s.expiresAt,revoked:s.revoked,expired:s.expiresAt<=now,usage:Object.entries(state.usages).filter(([key])=>key.startsWith(id+':')).map(([key,u])=>({period:key.slice(id.length+1),understand:u.understand,generate:u.generate,summary:u.summary??0}))}))}
function resolve(id:string,keys:string[]){if(!/^[a-f0-9-]{8,64}$/i.test(id))throw new AdminError('INVALID_OBJECT_ID');const found=keys.filter(k=>k.startsWith(id));if(found.length!==1)throw new AdminError('OBJECT_NOT_FOUND',404);return found[0]}
export const usersTodoSource={id:'users',evaluate:async(c:AdminContext)=>{const state=await readUserState(c);const pending=Object.values(state.applications??{}).filter(a=>a.state==='pending');return pending.length?[{id:'applications-pending',level:'info' as const,title:'新申请',text:`${pending.length} 份申请等待审核`,actions:[{label:'逐个审核',href:'/admin/applications'}]}]:[]}};
export async function pendingOver48h(c:AdminContext){const state=await readUserState(c);return Object.values(state.applications??{}).filter(a=>a.state==='pending'&&c.now-a.createdAt>48*3600000).length}
function csvRow(row:unknown[]){return row.map(v=>{const text=String(v??'');const safe=/^[\s\u0000-\u001f]*[=+@-]|^[\t\r\n]/.test(text)?"'"+text:text;return '"'+safe.replaceAll('"','""')+'"'}).join(',')+'\r\n'}
type AuditExportRow={id:string;actor:string;at:number;object_id:string;action:string;result:string};
async function exportAudit(db:AdminDatabase,c:UsersContext):Promise<Response>{
 const snapshot=await db.prepare('SELECT MAX(rowid) AS maximum FROM admin_audit').first<{maximum:number|null}>();
 const maximum=snapshot?.maximum??0;let cursor:{at:number;id:string}|undefined;let first=true;let done=false;
 await c.audit('audit-export','audit','pending');
 const encoder=new TextEncoder();
 const body=new ReadableStream<Uint8Array>({async pull(controller){
  if(done)return;
  try{
   const where=cursor?' AND (at<? OR (at=? AND id<?))':'';
   const values=cursor?[maximum,cursor.at,cursor.at,cursor.id]:[maximum];
   const items=(await db.prepare(`SELECT id,actor,at,object_id,action,result FROM admin_audit WHERE rowid<=?${where} ORDER BY at DESC,id DESC LIMIT 500`).bind(...values).all<AuditExportRow>()).results;
   const header=first?'\uFEFF'+csvRow(['actor','time','object','action','result']):'';first=false;
   const text=header+items.map(i=>csvRow([i.actor,new Date(i.at).toISOString(),short(i.object_id),i.action,i.result])).join('');
   if(items.length<500){await c.audit('audit-export','audit','success');done=true}
   else {const last=items.at(-1)!;cursor={at:last.at,id:last.id}}
   controller.enqueue(encoder.encode(text));if(done)controller.close();
  }catch(error){done=true;await c.audit('audit-export','audit','unknown').catch(()=>{});controller.error(error)}
 },async cancel(){if(!done){done=true;await c.audit('audit-export','audit','unknown').catch(()=>{})}}});
 return new Response(body,{headers:{'Content-Type':'text/csv;charset=utf-8','Content-Disposition':'attachment; filename="fitness-audit.csv"','Cache-Control':'no-store'}});
}
export async function handleUsers(request:Request,c:UsersContext):Promise<Response|undefined>{const url=new URL(request.url),part=url.pathname.split('/console/')[1];if(!part?.startsWith('users/')&&!['applications','audit','audit/export','templates'].includes(part))return;
 const db=requireAdminDb(c);
 if(request.method==='GET'){
 if(part==='templates')return adminJson({items:(await db.prepare('SELECT id,kind,text FROM admin_review_templates ORDER BY updated_at DESC').all()).results});
 if(part==='audit/export')return exportAudit(db,c);
 if(part==='audit'){const items=(await db.prepare('SELECT actor,at,object_id,action,result FROM admin_audit ORDER BY at DESC LIMIT 2000').all()).results;return adminJson({items})}
 const state=await readUserState(c);
 if(part==='users/status')return adminJson({aiEnabled:state.aiEnabled,recoveryRequired:state.recoveryRequired});
 if(part==='applications')return adminJson({items:Object.values(state.applications??{}).map(a=>({id:short(a.id),name:a.name,note:a.note,kind:a.kind,state:a.state,createdAt:a.createdAt,directlyActivated:a.directlyActivated??false}))});
 if(part==='users/list'){const q=(url.searchParams.get('q')??'').trim().toLowerCase();let items=userProjection(state,c.now,c.env.ADMIN_ENVIRONMENT);if(q)items=items.filter(s=>s.id.includes(q)||Object.values(state.applications??{}).some(a=>a.subjectId?.startsWith(s.id)&&a.name.toLowerCase().includes(q)));return adminJson({items,invites:Object.entries(state.invites).filter(([,i])=>!i.redeemed&&i.expiresAt>c.now).map(([id,i])=>({id:short(id),expiresAt:i.expiresAt}))})}
 if(part==='users/detail'){const id=resolve(url.searchParams.get('id')??'',Object.keys(state.subjects));const records=Object.values(state.requests).filter(r=>r.subjectId===id&&(r.createdAt===undefined||r.createdAt>=c.now-30*86400000)).map(r=>({id:short(r.requestId),operation:r.operation,status:r.status,costFen:r.actualCost??null,period:r.period,at:r.createdAt??null}));return adminJson({user:userProjection(state,c.now,c.env.ADMIN_ENVIRONMENT).find(s=>s.id===short(id)),requests:records,history:state.audit.filter(a=>a.subjectId===id).map(a=>({at:a.at,event:a.event.split(':')[0]})),timingAvailable:false})}
 }
 const raw=await request.json();
 if(part==='templates'){const v=z.strictObject({id:z.uuid(),kind:z.enum(['approve','reject']),text:z.string().trim().min(1).max(200),remove:z.boolean().optional()}).parse(raw);await db.prepare(v.remove?'DELETE FROM admin_review_templates WHERE id=?':'INSERT INTO admin_review_templates(id,kind,text,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,text=excluded.text,updated_at=excluded.updated_at').bind(...(v.remove?[v.id]:[v.id,v.kind,v.text,c.now])).run();await c.audit('template-update',v.id,'success');return adminJson({ok:true})}
 if(part==='users/action'){const v=z.strictObject({action:z.enum(['approve','reject','activate','delete','reissue','quota','revoke','invite','invite-revoke','cleanup','ai']),id:z.string().max(64).optional(),reason:z.string().max(200).optional(),enabled:z.boolean().optional()}).parse(raw);if(['delete','reissue','cleanup'].includes(v.action))requireFreshContext(c);const state=await readUserState(c);let op:string,data:unknown;
 if(['approve','reject','activate'].includes(v.action)){const id=resolve(v.id??'',Object.keys(state.applications??{}));op=v.action==='activate'?'application-activate':'application-review';data=v.action==='activate'?{id}:{id,decision:v.action==='approve'?'approve':'reject',reason:v.reason??''};if(v.action==='reject'&&!v.reason?.trim())throw new AdminError('REASON_REQUIRED')}
 else if(v.action==='invite'){op='invites';data={}}
 else if(v.action==='invite-revoke'){op='invites/revoke';data={inviteId:resolve(v.id??'',Object.keys(state.invites))}}
 else if(v.action==='cleanup'){op='application-retention';data={}}
 else if(v.action==='ai'){if(v.enabled===true)requireFreshContext(c);op='supplier';data={enabled:v.enabled===true}}
 else {const id=resolve(v.id??'',Object.keys(state.subjects));op=({delete:'subject-delete',reissue:'reissue',quota:'quota-restore',revoke:'revoke'} as Record<string,string>)[v.action];const policy=JSON.parse(c.env.CONTROL_POLICY??'{}');const parts=new Intl.DateTimeFormat('en-CA',{timeZone:policy.timeZone??'Asia/Shanghai',year:'numeric',month:'2-digit'}).formatToParts(c.now);const period=`${parts.find(p=>p.type==='year')?.value}-${parts.find(p=>p.type==='month')?.value}`;data=v.action==='quota'?{id:c.requestId,subjectId:id,period,reason:v.reason?.trim()||'管理员恢复额度'}:{subjectId:id}}
 const response=await c.forward(op,data);await c.audit(v.action,v.id??'system',response.ok?'success':'unknown');if(!response.ok)return response;const result=await response.json() as Record<string,unknown>;return adminJson({ok:true,...(typeof result.code==='string'?{code:result.code,expiresAt:result.expiresAt}:{} )})}
 return undefined;
}

