import {afterEach,expect,it,vi} from 'vitest';
import {createFetchAiClient} from '../../src/ai/client';
import {claimDirectActivation,receiptKey} from '../../src/ai/trial-recovery';
const receipt='a'.repeat(64),id='0fb6e661-e282-49ef-bcc6-bcb31c3e9836';
const direct={id,kind:'new',state:'approved',createdAt:1,claimUntil:Date.now()+86400000,directlyActivated:true};
const active={expiresAt:Date.now()+86400000,period:'2026-10',used:{understand:0,generate:0},limits:{understand:8,generate:4},aiEnabled:true};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status});
afterEach(()=>vi.unstubAllGlobals());
function storage(value:string|null=receipt){vi.stubGlobal('localStorage',{getItem:(key:string)=>key===receiptKey?value:null});}
it('recovers direct activation once and coalesces simultaneous refreshes without model requests',async()=>{
 storage();let claimed=false;
 const fetcher=vi.fn(async(url:unknown,options?:RequestInit)=>{
  expect(options).toMatchObject({credentials:'same-origin',cache:'no-store',redirect:'manual'});
  if(url==='/api/v1/trial/status')return claimed?json(active):json({error:'QUALIFICATION_REQUIRED'},401);
  if(url==='/api/v1/trial/applications'){expect(JSON.parse(options!.body as string)).toEqual({receipt});return json([direct]);}
  if(url==='/api/v1/trial/claim'){expect(JSON.parse(options!.body as string)).toEqual({receipt,id});claimed=true;return json({});}
  throw Error('Unexpected request');
 });
 const client=createFetchAiClient(fetcher);expect(await Promise.all([client.status(),createFetchAiClient(fetcher).status()])).toEqual([active,active]);
 expect(fetcher).toHaveBeenCalledTimes(4);await client.status();expect(fetcher).toHaveBeenCalledTimes(5);
});
it.each([null,'bad'])('does not claim without a valid receipt (%s)',async(value)=>{
 storage(value);const fetcher=vi.fn(async()=>json({error:'QUALIFICATION_REQUIRED'},401));
 await expect(createFetchAiClient(fetcher).status()).rejects.toThrow('QUALIFICATION_REQUIRED');expect(fetcher).toHaveBeenCalledTimes(1);
});
it('storage denial does not prevent checking a valid existing session',async()=>{
 vi.stubGlobal('localStorage',{getItem:()=>{throw Error('Denied');}});
 await expect(createFetchAiClient(async()=>json(active)).status()).resolves.toEqual(active);
 await expect(createFetchAiClient(async()=>json({error:'QUALIFICATION_REQUIRED'},401)).status()).rejects.toThrow('QUALIFICATION_REQUIRED');
});
it.each([{state:'pending'},{state:'rejected'},{directlyActivated:false},{claimUntil:1}])('does not auto-claim ineligible applications %j',async(change)=>{
 const claim=vi.fn();expect(await claimDirectActivation(receipt,[{...direct,...change}],claim)).toBe(false);expect(claim).not.toHaveBeenCalled();
});
it('allows an unexpired previously claimed direct activation to restore its original browser session',async()=>{
 const claim=vi.fn();expect(await claimDirectActivation(receipt,[{...direct,state:'claimed'}],claim)).toBe(true);expect(claim).toHaveBeenCalledWith({receipt,id});
});
it('does not retry a claim if the resulting cookie/session remains unavailable',async()=>{
 storage();const fetcher=vi.fn(async(url:unknown)=>url==='/api/v1/trial/applications'?json([direct]):url==='/api/v1/trial/claim'?json({}):json({error:'QUALIFICATION_REQUIRED'},401));
 await expect(createFetchAiClient(fetcher).status()).rejects.toThrow('QUALIFICATION_REQUIRED');expect(fetcher).toHaveBeenCalledTimes(4);
});
it('does not claim on network failure, revoked subject or malformed status',async()=>{
 storage();for(const reply of [()=>Promise.reject(Error('Offline')),()=>Promise.resolve(json({error:'SUBJECT_NOT_FOUND'},401)),()=>Promise.resolve(json({}))]){
  const fetcher=vi.fn(reply);await expect(createFetchAiClient(fetcher).status()).rejects.toThrow();expect(fetcher).toHaveBeenCalledTimes(1);
 }
});
it('rejects malformed application data and a refused claim without manufacturing qualification',async()=>{
 storage();for(const apps of [[{...direct,id:'bad'}],[direct]]){
  const fetcher=vi.fn(async(url:unknown)=>url==='/api/v1/trial/applications'?json(apps):json({error:'QUALIFICATION_REQUIRED'},401));
  await expect(createFetchAiClient(fetcher).status()).rejects.toThrow();expect(fetcher.mock.calls.filter(([url])=>url==='/api/v1/trial/status')).toHaveLength(1);
 }
});

it('coalesces claims from separate mounted views using the same receipt and application',async()=>{
 const first=vi.fn(async()=>{}),second=vi.fn(async()=>{});
 expect(await Promise.all([claimDirectActivation(receipt,[direct],first),claimDirectActivation(receipt,[direct],second)])).toEqual([true,true]);
 expect(first).toHaveBeenCalledTimes(1);expect(second).not.toHaveBeenCalled();
});
