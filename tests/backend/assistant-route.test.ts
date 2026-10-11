import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { assistantAccessStatus, handleAssistant, type AssistantEnv } from '../../src/backend/assistant/route';
import { initialState, type ControlState } from '../../src/backend/store';
import { digest } from '../../src/backend/contracts';
import type { AdminDatabase, AdminStatement } from '../../src/backend/admin/core/contracts';
import type { AssistantEvent, AssistantRequest } from '../../src/assistant/contracts';

const open: DatabaseSync[] = [];
afterEach(() => { for (const db of open.splice(0)) db.close(); vi.restoreAllMocks(); });
const token = 'a'.repeat(64), subject = 'route-test-subject';
const id = '11111111-1111-4111-8111-111111111111';
const body: AssistantRequest = {version:'fitness-assistant-v2',requestId:id,conversationId:id,locale:'en',timeZone:'Asia/Shanghai',adultConfirmed:true,messages:[{role:'user',content:'Hello'}]};
const complete: AssistantEvent = {type:'done',success:true,result:'success',usage:{inputTokens:12,outputTokens:4},calls:[{stage:'text',result:'success',inputTokens:12,outputTokens:4}],promptVersion:'assistant-v2.1.0'};
type Runner = NonNullable<Parameters<typeof handleAssistant>[2]>;
const success: Runner = async function* () { yield {type:'text_delta',delta:'Hello.'}; yield complete; };
async function setup(change?: (state: ControlState) => void) {
  const db = new DatabaseSync(':memory:'); open.push(db);
  db.exec(readFileSync(new URL('../../migrations/admin/1_assistant_v2.sql',import.meta.url),'utf8'));
  db.exec('CREATE TABLE control_ledger(id INTEGER PRIMARY KEY,revision INTEGER,state TEXT); CREATE TABLE admin_finance(id INTEGER PRIMARY KEY,state TEXT); CREATE TABLE admin_prompt_selection(environment TEXT,task TEXT,version TEXT)');
  const state = initialState(); state.aiEnabled = true;
  state.subjects[subject] = {expiresAt:Date.now()+86400000,revoked:false};
  state.sessions[await digest(token,'secret-for-test')] = {subjectId:subject,revoked:false};
  change?.(state);
  db.prepare('INSERT INTO control_ledger VALUES(1,0,?)').run(JSON.stringify(state));
  db.prepare('INSERT INTO admin_finance VALUES(1,?)').run(JSON.stringify({versions:[],announcement:null,receipts:{}}));
  const binding: AdminDatabase = { prepare(sql) {
    let values: (string|number|null)[] = [];
    const statement: AdminStatement = {bind(...args) { values = args as typeof values; return statement; },async first<T>() { return (db.prepare(sql).get(...values) ?? null) as T|null; },async all<T>() { return {results:db.prepare(sql).all(...values) as T[]}; },async run() { return {success:true,meta:{changes:Number(db.prepare(sql).run(...values).changes)}}; }};
    return statement;
  }, async batch(statements) { db.exec('BEGIN'); try { const results = []; for (const statement of statements) results.push(await statement.run()); db.exec('COMMIT'); return results; } catch(error) { db.exec('ROLLBACK'); throw error; } } };
  const env: AssistantEnv = {CONTROL_DB:{withSession:() => binding},ADMIN_DB:binding,CONTROL_DIGEST_SECRET:'secret-for-test',CONTROL_MODE:'external',DEEPSEEK_API_KEY:'never-used-test-key'};
  const request = (headers: Record<string,string> = {}, signal?: AbortSignal) => new Request('https://preview.test/api/v1/assistant/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://preview.test',Cookie:`__Host-fitness_trial=${token}`,...headers},body:JSON.stringify(body),signal});
  return {db,env,request,state};
}
function events(raw: string): AssistantEvent[] {return raw.split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));}
it('streams an authenticated response, records actual usage, increments exactly one daily message without contacting provider',async () => {
  const {db,env,request} = await setup(); const network = vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('network forbidden'));
  const response = await handleAssistant(request(),env,success);
  expect(response.status).toBe(200); expect(response.headers.get('content-type')).toContain('text/event-stream');
  expect(events(await response.text()).map(e => e.type)).toEqual(['text_delta','done']);
  expect(db.prepare('SELECT used,active_request FROM assistant_daily').get()).toMatchObject({used:1,active_request:null});
  expect(db.prepare('SELECT input_tokens,output_tokens,result FROM assistant_usage').get()).toMatchObject({input_tokens:12,output_tokens:4,result:'success'});
  expect(network).not.toHaveBeenCalled();
});
it.each(['missing-cookie','revoked-session','revoked-subject','expired','ai-off','origin'] as const)('rejects %s before invoking runner',async kind => {
  const {env,request} = await setup(state => { if(kind==='revoked-session') Object.values(state.sessions)[0].revoked=true; if(kind==='revoked-subject') state.subjects[subject].revoked=true; if(kind==='expired') state.subjects[subject].expiresAt=0; if(kind==='ai-off') state.aiEnabled=false; });
  let calls=0; const runner: Runner = async function* () { calls++; yield complete; };
  const response=await handleAssistant(request(kind==='missing-cookie'?{Cookie:''}:kind==='origin'?{Origin:'https://evil.test'}:{}),env,runner);
  expect(response.status).toBe(kind==='ai-off'?503:kind==='origin'?403:401); expect(calls).toBe(0);
});
it('old pending requests are archived without blocking or rewriting legacy accounting',async () => {
  const {db,env,request}=await setup(state => {state.requests.old={subjectId:subject,requestId:'old',inputDigest:'old',operation:'generate',period:'2026-10',bound:300,status:'pending',cancelled:false}; state.budgets['2026-10']={spent:42,reserved:300};});
  const before=db.prepare('SELECT state FROM control_ledger').get();
  const response=await handleAssistant(request(),env,success); await response.text();
  expect(response.status).toBe(200); expect(db.prepare('SELECT state FROM control_ledger').get()).toEqual(before);
  expect(db.prepare('SELECT label FROM assistant_legacy_archive').get()).toMatchObject({label:'archived_unaccounted'});
});
it('attachment failure retains text, records failed calls and leaves daily count unchanged',async () => {
  const {db,env,request}=await setup();
  const runner: Runner = async function* () { yield {type:'text_delta',delta:'Your answer.'}; yield {type:'attachment_failed',code:'ATTACHMENT_UNAVAILABLE'}; yield {...complete,success:false,result:'attachment_failed',calls:[{stage:'text',result:'success',inputTokens:10,outputTokens:5},{stage:'attachment',result:'failed'}]}; };
  const response=await handleAssistant(request(),env,runner); expect(events(await response.text()).map(e=>e.type)).toEqual(['text_delta','attachment_failed','done']);
  expect(db.prepare('SELECT used,active_request FROM assistant_daily').get()).toMatchObject({used:0,active_request:null});
  expect(db.prepare("SELECT input_tokens,estimated_fen FROM assistant_usage WHERE stage='attachment'").get()).toMatchObject({input_tokens:null,estimated_fen:null});
});
it('persists a repaired attachment call and counts the successful conversation once',async () => {
  const {db,env,request}=await setup();
  const runner:Runner=async function*(){yield {...complete,result:'repaired',calls:[{stage:'text',result:'success',inputTokens:10,outputTokens:5},{stage:'attachment',result:'repaired',inputTokens:20,outputTokens:8}]};};
  const response=await handleAssistant(request(),env,runner);await response.text();
  expect(db.prepare("SELECT result FROM assistant_usage WHERE stage='attachment'").get()).toMatchObject({result:'repaired'});
  expect(db.prepare('SELECT used FROM assistant_daily').get()).toMatchObject({used:1});
});
it('daily limit returns local resetAt before generation',async () => {
  const {db,env,request}=await setup(); const reset=Date.now()+60000;
  db.prepare('INSERT INTO assistant_daily(subject_id,day,time_zone,reset_at,used) VALUES(?,?,?,?,30)').run(subject,'2026-10-12','Asia/Shanghai',reset);
  let calls=0; const runner:Runner=async function*(){calls++;yield complete;};
  const response=await handleAssistant(request(),env,runner); expect(response.status).toBe(429); expect(await response.json()).toEqual({error:'DAILY_MESSAGE_LIMIT',resetAt:new Date(reset).toISOString()}); expect(calls).toBe(0);
});
it('disconnect aborts generation, releases lease and does not consume daily message',async () => {
  const {db,env,request}=await setup();
  const runner: Runner = async function* (_input,options) { yield {type:'text_delta',delta:'Partial.'}; await new Promise<void>(resolve=>{if(options.signal?.aborted)resolve();else options.signal?.addEventListener('abort',()=>resolve(),{once:true});}); yield {...complete,success:false,result:'failed'}; };
  const response=await handleAssistant(request(),env,runner); const reader=response.body!.getReader(); await reader.read(); await reader.cancel();
  await vi.waitFor(()=>expect(db.prepare('SELECT used,active_request,lease_until FROM assistant_daily').get()).toMatchObject({used:0,active_request:null,lease_until:0}));
});

it('V2 access status ignores legacy pending and omits retired monthly counters',async()=>{
 const {env,request}=await setup(state=>{state.requests.old={subjectId:subject,requestId:'old',inputDigest:'old',operation:'generate',period:'2026-10',bound:300,status:'pending',cancelled:false};});
 const headers=request().headers;
 const response=await assistantAccessStatus(new Request('https://preview.test/api/v1/trial/access-status',{method:'POST',headers,body:'{}'}),env);
 expect(response.status).toBe(200);const data=await response.json();
 expect(data).toMatchObject({qualification:'active',sessionValid:true,aiEnabled:true,summaryAvailable:true,assistantV2:true});
 expect(data).not.toHaveProperty('used');expect(data).not.toHaveProperty('reconciliationRequired');
});
