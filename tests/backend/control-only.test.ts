import { expect, it } from 'vitest';
import { createWorker } from '../../src/backend/worker';
import { SqliteControlStore } from '../../src/backend/sqlite-store';

const env = { CONTROL_MODE: 'control-only', CONTROL_ORIGINS: '["https://preview.test"]',
  CONTROL_ADMIN_SECRET: 'a'.repeat(40), CONTROL_DIGEST_SECRET: 'b'.repeat(40),
  CONTROL_POLICY: JSON.stringify({ timeZone: 'UTC', k: 1, budgetLimit: 500, maximumRequestCost: 100,
    requestBounds: { understand: 10, generate: 50 }, quotas: { understand: 8, generate: 4 }, maxInputBytes: 65536, maxConcurrent: 2 }) };
const post = (path: string, data: unknown, admin = env.CONTROL_ADMIN_SECRET) => new Request(`https://preview.test/api/v1/${path}`, {
  method: 'POST', headers: { Origin: 'https://preview.test', 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` }, body: JSON.stringify(data),
});

it('control-only can issue/redeem/status without provider credentials or network', async () => {
  const store = new SqliteControlStore(':memory:');
  const worker = createWorker({ store: () => store, transport: async () => { throw new Error('network forbidden'); } });
  try {
    expect(await (await worker.fetch(new Request('https://preview.test/api/v1/health'), env)).json()).toEqual({ status: 'control-only', productionModelEnabled: false });
    expect((await worker.fetch(post('admin/invites', {}, 'wrong'), env)).status).toBe(401);
    const issued = await worker.fetch(post('admin/invites', {}), env); expect(issued.status).toBe(200);
    const { code } = await issued.json() as { code: string };
    const redeemed = await worker.fetch(post('trial/redeem', { code }), env); expect(redeemed.status).toBe(200);
    expect((await worker.fetch(post('trial/redeem', { code }), env)).status).toBe(401);
    const cookie = redeemed.headers.get('set-cookie')!;
    expect(cookie).toContain('Secure; HttpOnly; SameSite=Strict');
    const status = await worker.fetch(new Request('https://preview.test/api/v1/trial/status', { headers: { Cookie: cookie.split(';')[0] } }), env);
    expect(status.status).toBe(200); expect((await status.json() as any).pending).toBe(0);
    expect((await worker.fetch(new Request('https://preview.test/api/v1/trial/status'), env)).status).toBe(401);
    const state = await store.read(); expect(Object.keys(state.subjects)).toHaveLength(1); expect(state.budgets).toEqual({}); expect(state.requests).toEqual({});
  } finally { store.close(); }
});

it('control-only denies both generation routes and both model switches even if ledger was previously enabled', async () => {
  const store = new SqliteControlStore(':memory:');
  const worker = createWorker({ store: () => store, transport: async () => { throw new Error('network forbidden'); } });
  try {
    await store.transact(state => { state.aiEnabled = true; }); const before = await store.read();
    for (const path of ['goals/interpret', 'plans/generate', 'admin/supplier', 'admin/mock']) {
      const response = await worker.fetch(post(path, { enabled: true }), env);
      expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: 'AI_DISABLED' });
    }
    expect(await store.read()).toEqual(before);
    const bad = { ...env, CONTROL_DIGEST_SECRET: env.CONTROL_ADMIN_SECRET };
    expect((await worker.fetch(new Request('https://preview.test/api/v1/health'), bad)).status).toBe(500);
  } finally { store.close(); }
});
