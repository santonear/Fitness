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
