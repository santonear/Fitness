import {it,expect} from 'vitest';
import {createDemoAiClient,createFetchAiClient,disabledAiClient} from '../../src/ai/client';
import {confirmationFor} from '../../src/backend/contracts';
it('unknown server error details are not exposed',async()=>{await expect(createFetchAiClient(async()=>new Response(JSON.stringify({error:'private body and secret'}),{status:500})).redeem('code')).rejects.toThrow('CONTROL_UNAVAILABLE');});
it('default-off client never fabricates a qualification',async()=>{await expect(disabledAiClient.status()).rejects.toThrow('AI_DISABLED');});
it('local demo reuses qualification and counts but sends no network',async()=>{const client=await createDemoAiClient();await expect(client.status()).rejects.toThrow();await client.redeem('FITNESS-DEMO');const input={contractVersion:1 as const,requestId:crypto.randomUUID(),operation:'understand' as const,goalText:'Goal',locale:'en' as const,restoreGeneration:0};const request={...input,sendConfirmation:await confirmationFor(input)};expect((await client.submit(request)).result).toEqual({interpretedGoal:'Goal'});expect((await client.status()).used.understand).toBe(1);});
it('status network failure stays unknown and malformed status is rejected',async()=>{await expect(createFetchAiClient(async()=>{throw new Error('offline');}).status()).rejects.toThrow('CONTROL_UNAVAILABLE');await expect(createFetchAiClient(async()=>new Response('{}',{status:200})).status()).rejects.toThrow('CONTROL_UNAVAILABLE');});
it('fetch sends same-origin credentials and no retry',async()=>{let calls=0;const client=createFetchAiClient(async(url,options)=>{calls++;expect(url).toBe('/api/v1/trial/redeem');expect(options?.credentials).toBe('same-origin');return new Response(JSON.stringify({error:'QUALIFICATION_REQUIRED'}),{status:401});});await expect(client.redeem('code')).rejects.toThrow('QUALIFICATION_REQUIRED');expect(calls).toBe(1);});
it('unrenderable expiry and impossible month are unknown rather than crashing the status view',async()=>{
 const status={expiresAt:Date.now(),period:'2026-10',used:{understand:0,generate:0},limits:{understand:8,generate:4},aiEnabled:false};
 for(const value of [{...status,expiresAt:9e15},{...status,period:'2026-99'}])await expect(createFetchAiClient(async()=>new Response(JSON.stringify(value))).status()).rejects.toThrow('CONTROL_UNAVAILABLE');
});
