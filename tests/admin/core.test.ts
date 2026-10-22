import { describe, it, expect } from 'vitest';
import { createTodoRegistry } from '../../src/backend/admin/core/todos';
import { requireFreshAccess, verifyAdministrator } from '../../src/backend/management-auth';
import { generateKeyPair, SignJWT } from 'jose';
describe('admin foundation', () => {
  it('orders unified sources and rejects duplicate source identities', async () => {
    const r = createTodoRegistry<null>();
    r.registerTodoSource({
      id: 'a',
      evaluate: () => [{ id: 'low', level: 'info', title: 'x', text: 'x', actions: [] }],
    });
    r.registerTodoSource({
      id: 'b',
      evaluate: () => [{ id: 'high', level: 'alert', title: 'x', text: 'x', actions: [] }],
    });
    expect((await r.evaluate(null)).map(x => x.id)).toEqual(['high', 'low']);
    expect(() => r.registerTodoSource({ id: 'a', evaluate: () => [] })).toThrow();
  });
  it('requires verified JWT iat within five minutes, rejects unsigned and stale', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const now = Math.floor(Date.now() / 1000);
    const env = {
      ADMIN_ACCESS_ISSUER: 'https://test.cloudflareaccess.com',
      ADMIN_ACCESS_AUD: 'admin',
      ADMIN_EMAIL: 'admin@example.test',
    };
    for (const age of [0, 299, 301]) {
      const token = await new SignJWT({ email: env.ADMIN_EMAIL })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuer(env.ADMIN_ACCESS_ISSUER)
        .setAudience('admin')
        .setSubject('admin')
        .setIssuedAt(now - age)
        .setExpirationTime(now + 3600)
        .sign(privateKey);
      const request = new Request('https://app.test/admin', { headers: { 'cf-access-jwt-assertion': token } });
      expect(requireFreshAccess(request)).toBe(false);
      expect(await verifyAdministrator(request, env, async () => publicKey)).toBe(true);
      expect(requireFreshAccess(request, 300, now * 1000)).toBe(age <= 300);
    }
  });
});
