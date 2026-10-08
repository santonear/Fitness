import { afterEach, expect, it } from 'vitest';
import { SqliteControlStore } from '../../src/backend/sqlite-store';
import { ControlService, testConfig } from '../../src/backend/control';
import { createHandler } from '../../src/backend/http';
const stores: SqliteControlStore[]=[];
afterEach(()=>stores.splice(0).forEach(s=>s.close()));
function fixture(zone='Asia/Shanghai', at='2026-10-31T15:59:59Z') {
 const store=new SqliteControlStore(':memory:'); stores.push(store); let now=Date.parse(at);
 const config={...testConfig,timeZone:zone,k:7};
 const service=new ControlService(store,config,{kind:'local-mock',call:async()=>{throw new Error('no model call');}},()=>now);
 return {store,service,config,advance:(ms:number)=>{now+=ms;}};
}
async function claimed(f:ReturnType<typeof fixture>, receipt='a'.repeat(64)) {
 const id=crypto.randomUUID(); await f.service.applications.apply({receipt,id,kind:'new',name:'Test',note:''});
 await f.service.applications.review(id,'approve','','admin'); return {...await f.service.applications.claim(receipt,id),receipt};
}
it('returns actual policy and timezone reset, without any state mutation or ledger disclosure',async()=>{
 const f=fixture();const c=await claimed(f);const before=await f.store.read();
 const status=await f.service.status(c.token);
 expect(status).toMatchObject({maxDays:7,maximumRequestCost:1000,resetAt:Date.parse('2026-10-31T16:00:00Z'),budgetAvailable:{understand:true,generate:true}});
 const view=await f.service.accessStatus(undefined,c.receipt);
 expect(view).toMatchObject({qualification:'active',sessionValid:false}); expect(view).not.toHaveProperty('subjectId');expect(view).not.toHaveProperty('budgets');
 expect(await f.store.read()).toEqual(before);
});
it('reset follows the next month in a DST zone',async()=>{
 const f=fixture('America/New_York','2026-03-08T06:30:00Z');const c=await claimed(f);
 expect((await f.service.status(c.token)).resetAt).toBe(Date.parse('2026-04-01T04:00:00Z'));
});
it('reports the effective guided date limit when configured K exceeds the implementation envelope',async()=>{
 const f=fixture();const c=await claimed(f);const config={...f.config,k:15};
 const service=new ControlService(f.store,config,{kind:'local-mock',call:async()=>{throw new Error('unused');}},()=>Date.parse('2026-10-31T15:59:59Z'));
 expect((await service.status(c.token)).maxDays).toBe(14);
 expect(await service.accessStatus(c.token)).toMatchObject({qualification:'active',sessionValid:true,maxDays:14});
 expect(config.k).toBe(15);
});
it('distinguishes verified expired and revoked access, without reviving a session',async()=>{
 const f=fixture();const c=await claimed(f);f.advance(31*86400000);
 expect(await f.service.accessStatus(c.token)).toMatchObject({qualification:'expired',sessionValid:false});
 await f.service.retainLedger(f.config.adminSecret);
 expect(await f.service.accessStatus(c.token)).toEqual({qualification:'none',sessionValid:false});
 expect(await f.service.accessStatus(undefined,c.receipt)).toMatchObject({qualification:'expired',sessionValid:false});
 await f.service.revoke(f.config.adminSecret,c.subjectId);
 expect(await f.service.accessStatus(undefined,c.receipt)).toMatchObject({qualification:'revoked',sessionValid:false});
 await expect(f.service.status(c.token)).rejects.toMatchObject({code:'QUALIFICATION_REQUIRED'});
});
it('only a matching receipt may read its owner; a cookie cannot be switched by another receipt',async()=>{
 const f=fixture();const a=await claimed(f),b=await claimed(f,'b'.repeat(64));
 await f.service.revoke(f.config.adminSecret,b.subjectId);
 expect(await f.service.accessStatus(undefined,'c'.repeat(64))).toEqual({qualification:'none',sessionValid:false});
 expect(await f.service.accessStatus(a.token,b.receipt)).toMatchObject({qualification:'active',sessionValid:true,expiresAt:a.expiresAt});
 expect(await f.service.accessStatus(undefined,b.receipt)).toMatchObject({qualification:'revoked',sessionValid:false});
 expect(await f.service.accessStatus()).toEqual({qualification:'none',sessionValid:false});
});
it('reads operation budget and pending accounting separately, carrying prior reservations',async()=>{
 const f=fixture();const c=await claimed(f);
 await f.store.transact(s=>{s.budgets['2026-10']={spent:3300,reserved:0};});
 expect(await f.service.status(c.token)).toMatchObject({budgetAvailable:{understand:true,generate:false}});
 const config={...f.config,allowBoundedPending:true}; const service=new ControlService(f.store,config,{kind:'local-mock',call:async()=>{throw new Error('unused');}},()=>Date.parse('2026-10-31T15:59:59Z'));
 await f.store.transact(s=>{s.budgets['2026-09']={spent:0,reserved:300};});
 expect(await service.status(c.token)).toMatchObject({budgetAvailable:{understand:false,generate:false},reconciliationRequired:true});
});
it('HTTP read status enforces same-origin, strict inputs, ownership, and never emits a cookie',async()=>{
 const f=fixture();const c=await claimed(f);const handler=createHandler(f.service,{origins:['https://fitness.test'],maxBodyBytes:65536});
 const request=(body:unknown,origin:string|null='https://fitness.test')=>new Request('https://fitness.test/api/v1/trial/access-status',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
 const before=await f.store.read();const response=await handler(request({receipt:c.receipt}));
 expect(response.status).toBe(200);expect(response.headers.get('set-cookie')).toBeNull();expect(await response.json()).toMatchObject({qualification:'active',sessionValid:false});
 for(const origin of [null,'https://attacker.test']) expect((await handler(request({receipt:c.receipt},origin))).status).toBe(403);
 expect((await handler(request({receipt:'bad'}))).status).toBe(400);
 expect((await handler(request({subjectId:c.subjectId}))).status).toBe(400);
 expect(await (await handler(request({receipt:'c'.repeat(64)}))).json()).toEqual({qualification:'none',sessionValid:false});
 expect(await f.store.read()).toEqual(before);
});
