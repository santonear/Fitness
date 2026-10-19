import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { handleUsers, userProjection, type UsersContext } from '../../src/backend/admin/users/handler';
import { initialState } from '../../src/backend/store';
import type { AdminDatabase, AdminStatement } from '../../src/backend/admin/core/contracts';

function fixture() {
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync('migrations/admin/1_core.sql','utf8'));
 const pageSizes:number[]=[];let injectBackdated=false;
 const db:AdminDatabase={prepare(sql){let values:(string|number|null)[]=[];const statement:AdminStatement={bind(...args){values=args as typeof values;return statement},async first<T>(){return(sqlite.prepare(sql).get(...values)??null) as T|null},async all<T>(){const results=sqlite.prepare(sql).all(...values) as T[];if(sql.includes('rowid<=')){pageSizes.push(results.length);if(injectBackdated){injectBackdated=false;sqlite.prepare('INSERT INTO admin_audit(id,actor,at,object_id,action,result) VALUES(?,?,?,?,?,?)').run('late','late',0,'late','LATE_BACKDATED_INSERT','success')}}return{results}},async run(){return{success:true,meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}}}};return statement},async batch(statements){return Promise.all(statements.map(statement=>statement.run()))}};
 const audits:string[]=[];
 const context:UsersContext={env:{ADMIN_DB:db},actor:'admin',now:100000,fresh:true,requestId:crypto.randomUUID(),forward:async()=>{throw Error('Unexpected mutation')},audit:async(action,object,result)=>{audits.push(result);sqlite.prepare('INSERT INTO admin_audit(id,actor,at,object_id,action,result) VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(),'admin',100000,object,action,result)}};
 return{sqlite,db,context,audits,pageSizes,inject:()=>{injectBackdated=true}};
}
describe('preview-only identities and complete audit export',()=>{
 it('labels only the three exact synthetic UUIDs in an explicit preview environment',()=>{
  const state=initialState();const ids=['91000000-0001-4000-8000-000000000001','92000000-0002-4000-8000-000000000002','93000000-0003-4000-8000-000000000003','91000000-0001-4000-8000-000000000099'];
  for(const id of ids)state.subjects[id]={expiresAt:100,revoked:false};
  expect(userProjection(state,1,'preview').map(row=>row.previewLabel)).toEqual(['normal','expiring','quota-unknown',undefined]);
  for(const environment of ['production',undefined,'local'])for(const row of userProjection(state,1,environment))expect(row).not.toHaveProperty('previewLabel');
 });
 it('applies the preview-only projection on list and detail management responses',async()=>{
  const {context}=fixture();const state=initialState();const id='91000000-0001-4000-8000-000000000001';state.subjects[id]={expiresAt:999999,revoked:false};
  context.env.CONTROL_DB={withSession:()=>({prepare:()=>({bind(){return this},async first<T>(){return{state:JSON.stringify(state)} as T},async run(){return{success:true,meta:{changes:0}}}})})};
  for(const environment of ['preview','production'] as const){context.env.ADMIN_ENVIRONMENT=environment;for(const path of ['users/list','users/detail?id=91000000-0001']){const response=await handleUsers(new Request('https://app.test/api/v1/management/console/'+path),context);const value=await response!.json();const user=value.user??value.items[0];expect(user.previewLabel).toBe(environment==='preview'?'normal':undefined)}}
 });
 it('exports more than 2000 rows in bounded pages without duplicates or later inserts',async()=>{
  const {sqlite,context,audits,pageSizes,inject}=fixture();const insert=sqlite.prepare('INSERT INTO admin_audit(id,actor,at,object_id,action,result) VALUES(?,?,?,?,?,?)');
  sqlite.exec('BEGIN');for(let i=0;i<2507;i++)insert.run(String(i).padStart(8,'0'),'admin',Math.floor(i/100),'12345678-1234-4321-abcd-123456789012',`event-${i}`,'success');sqlite.exec('COMMIT');
  inject();const response=await handleUsers(new Request('https://app.test/api/v1/management/console/audit/export'),context);const bytes=new Uint8Array(await response!.arrayBuffer());
  expect([...bytes.slice(0,3)]).toEqual([239,187,191]);const text=new TextDecoder().decode(bytes);
  const exported=[...text.matchAll(/event-(\d+)/g)].map(match=>Number(match[1]));
  expect(exported).toHaveLength(2507);expect(new Set(exported).size).toBe(2507);expect(exported).toEqual(Array.from({length:2507},(_,i)=>2506-i));
  expect(pageSizes.every(size=>size<=500)).toBe(true);expect(pageSizes.length).toBe(6);
  expect(text).not.toContain('LATE_BACKDATED_INSERT');expect(text).not.toContain('audit-export');
  expect(text.includes('"12345678"')).toBe(true);expect(text.includes('12345678-')).toBe(false);expect(audits).toEqual(['pending','success']);
 });
 it('quotes CSV and neutralizes formula prefixes including leading control characters',async()=>{
  const {sqlite,context}=fixture();sqlite.prepare('INSERT INTO admin_audit(id,actor,at,object_id,action,result) VALUES(?,?,?,?,?,?)').run('one','=HYPERLINK("https://bad")',1,'@formula',' \t+SUM(1,2)','-1+1');
  const response=await handleUsers(new Request('https://app.test/api/v1/management/console/audit/export'),context);const text=await response!.text();
  expect(text).toContain('"\'=HYPERLINK(""https://bad"")"');expect(text).toContain('"\'@formula"');expect(text).toContain('"\' \t+SUM(1,2)"');expect(text).toContain('"\'-1+1"');
 });
});
