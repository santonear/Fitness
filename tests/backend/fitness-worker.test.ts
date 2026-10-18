import { expect, it, vi } from 'vitest';
import { createFitnessWorker } from '../../src/backend/fitness-worker';
it('routes API to default-disabled control and never falls through to SPA assets', async () => {
  const assets = vi.fn(async () => new Response('<html>SPA</html>'));
  const worker = createFitnessWorker();
  for (const path of ['/api', '/api/v1/stages/summarize', '/api/v1/unknown']) {
    const response = await worker.fetch(new Request(`https://preview.test${path}`), { ASSETS: { fetch: assets } });
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: 'AI_DISABLED' });
  }
  const health = await worker.fetch(new Request('https://preview.test/api/v1/health'), {});
  expect(await health.json()).toEqual({ status: 'disabled', productionModelEnabled: false });
  expect(assets).not.toHaveBeenCalled();
});
it('delegates local UI routes without injecting control credentials and handles missing binding', async () => {
  const assets = vi.fn(async (request: Request) => new Response(new URL(request.url).pathname));
  const response = await createFitnessWorker().fetch(new Request('https://preview.test/progress'), { ASSETS: { fetch: assets } });
  expect(await response.text()).toBe('/progress'); expect(assets).toHaveBeenCalledTimes(1);
  expect((await createFitnessWorker().fetch(new Request('https://preview.test/'), {})).status).toBe(503);
});
it('config read failures are 503, never successful all-off responses; explicit false still works',async()=>{
 const worker=createFitnessWorker(),request=new Request('https://preview.test/api/v1/features');
 for(const get of [async()=>{throw Error('KV offline');},async()=>null,async()=>'{broken',async()=>JSON.stringify({planLifecycle:'false'})]){
  const response=await worker.fetch(request,{FITNESS_FEATURE_CONFIG:{get}});expect(response.status).toBe(503);expect(await response.text()).toBe('');
 }
 const response=await worker.fetch(request,{FITNESS_FEATURE_FLAGS:JSON.stringify({planLifecycle:false})});expect(response.status).toBe(200);expect((await response.json()).flags.planLifecycle).toBe(false);
});
it('public config preserves missing keys and server security gates still fail closed',async()=>{
 const worker=createFitnessWorker(),request=new Request('https://preview.test/api/v1/features');
 const response=await worker.fetch(request,{FITNESS_FEATURE_FLAGS:'{"nutrition":true}'});expect((await response.json()).flags).toEqual({nutrition:true});
 expect((await worker.fetch(request,{})).status).toBe(503);
 const {readFeatureFlags}=await import('../../src/backend/feature-config');expect((await readFeatureFlags({FITNESS_FEATURE_CONFIG:{get:async()=>{throw Error('offline');}}})).systemNotifications).toBe(false);
});
it('push config is a feature-off answer, never an HTTP error, when the push service is missing or disabled',async()=>{
 const worker=createFitnessWorker(),config=()=>new Request('https://preview.test/api/v1/push/config');
 const unbound=await worker.fetch(config(),{FITNESS_FEATURE_FLAGS:JSON.stringify({pwaOffline:true,systemNotifications:true})});
 expect(unbound.status).toBe(200);expect(await unbound.json()).toEqual({enabled:false,reason:'unconfigured'});
 const push=vi.fn(async()=>Response.json({enabled:true,publicKey:'k'}));
 const off=await worker.fetch(config(),{PUSH:{fetch:push},FITNESS_FEATURE_FLAGS:JSON.stringify({pwaOffline:true,systemNotifications:false})});
 expect(off.status).toBe(200);expect(await off.json()).toEqual({enabled:false,reason:'disabled'});expect(push).not.toHaveBeenCalled();
 const on=await worker.fetch(config(),{PUSH:{fetch:push},FITNESS_FEATURE_FLAGS:JSON.stringify({pwaOffline:true,systemNotifications:true})});
 expect(await on.json()).toEqual({enabled:true,publicKey:'k'});
 // Writing a subscription without a service is still refused.
 expect((await worker.fetch(new Request('https://preview.test/api/v1/push/subscription',{method:'POST'}),{FITNESS_FEATURE_FLAGS:JSON.stringify({systemNotifications:true})})).status).toBe(503);
});
