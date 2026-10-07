import { expect, it, vi } from 'vitest';
import { generateKeyPair, SignJWT } from 'jose';
import { verifyAdministrator } from '../../src/backend/management-auth';
import { verifyApplicationProof } from '../../src/backend/application-verification';
import { createFitnessWorker } from '../../src/backend/fitness-worker';
const env = { ADMIN_ACCESS_ISSUER: 'https://fitness-test.cloudflareaccess.com', ADMIN_ACCESS_AUD: 'fitness-management', ADMIN_EMAIL: 'owner@example.test' };
it('validates signature, issuer, audience, expiry and one allowed administrator', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const sign = (email = env.ADMIN_EMAIL, aud = env.ADMIN_ACCESS_AUD, exp: string | number = '5m') => new SignJWT({ email }).setProtectedHeader({ alg: 'RS256' }).setIssuedAt().setExpirationTime(exp).setSubject('owner-id').setIssuer(env.ADMIN_ACCESS_ISSUER).setAudience(aud).sign(privateKey);
  const request = (token: string) => new Request('https://fitness.test/admin', { headers: { 'cf-access-jwt-assertion': token } });
  expect(await verifyAdministrator(request(await sign()), env, async () => publicKey)).toBe(true);
  expect(await verifyAdministrator(request(await sign('other@example.test')), env, async () => publicKey)).toBe(false);
  expect(await verifyAdministrator(request(await sign(undefined, 'other-app')), env, async () => publicKey)).toBe(false);
  expect(await verifyAdministrator(request(await sign(undefined, undefined, 1)), env, async () => publicKey)).toBe(false);
  const other = await generateKeyPair('RS256');
  expect(await verifyAdministrator(request(await sign()), env, async () => other.publicKey)).toBe(false);
  expect(await verifyAdministrator(request(await sign()), {})).toBe(false);
  expect(await verifyAdministrator(new Request('https://fitness.test/admin', { headers: { 'cf-access-authenticated-user-email': env.ADMIN_EMAIL } }), env)).toBe(false);
});
it('protects both management UI and APIs without touching local training routes', async () => {
  const assets = vi.fn(async () => new Response('public app'));
  const worker = createFitnessWorker();
  for (const path of ['/admin', '/admin/applications', '/api/v1/management/applications', '/api/v1/management/quota-restore']) {
    expect((await worker.fetch(new Request(`https://fitness.test${path}`), { ASSETS: { fetch: assets } })).status).toBe(403);
  }
  expect(assets).not.toHaveBeenCalled();
  expect((await worker.fetch(new Request('https://fitness.test/workout'), { ASSETS: { fetch: assets } })).status).toBe(200);
});
it('server validates Turnstile hostname and action; outage does not bypass verification', async () => {
  const result = (body: unknown) => vi.fn(async () => Response.json(body)) as unknown as typeof fetch;
  expect(await verifyApplicationProof('proof', 'secret', 'fitness.test', result({ success: true, hostname: 'fitness.test', action: 'trial_application' }))).toBe(true);
  expect(await verifyApplicationProof('proof', 'secret', 'fitness.test', result({ success: true, hostname: 'attacker.test', action: 'trial_application' }))).toBe(false);
  expect(await verifyApplicationProof('proof', 'secret', 'fitness.test', result({ success: true, hostname: 'fitness.test', action: 'other' }))).toBe(false);
  expect(await verifyApplicationProof('proof', 'secret', 'fitness.test', vi.fn(async () => { throw new Error('offline'); }))).toBe(false);
});
it.each(['application-review', 'quota-restore'])('management gateway enforces same-origin and server credentials for %s', async operation => {
  const handler = vi.fn(async (request: Request) => {
    expect(new URL(request.url).pathname).toBe(`/api/v1/admin/${operation}`);
    expect(request.headers.get('authorization')).toBe('Bearer server-only-secret');
    expect(await request.json()).toEqual({ id: 'test' });
    return Response.json({ ok: true });
  });
  const worker = createFitnessWorker({ fetch: handler }, async () => true);
  const request = (origin: string) => new Request(`https://fitness.test/api/v1/management/${operation}`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ id: 'test' }) });
  expect((await worker.fetch(request('https://attacker.test'), { CONTROL_ADMIN_SECRET: 'server-only-secret' })).status).toBe(403);
  expect(handler).not.toHaveBeenCalled();
  expect((await worker.fetch(request('https://fitness.test'), { CONTROL_ADMIN_SECRET: 'server-only-secret' })).status).toBe(200);
});
