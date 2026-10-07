import { expect, it } from 'vitest';
import { ControlService, testConfig } from '../../src/backend/control';
import { SqliteControlStore } from '../../src/backend/sqlite-store';
import { createHandler } from '../../src/backend/http';
import { createFitnessWorker } from '../../src/backend/fitness-worker';

it('admin can issue, list and revoke an invite; redemption is once-only and leaves budget unchanged', async () => {
  const store = new SqliteControlStore(':memory:');
  try {
    const now = Date.parse('2026-10-07T00:00:00Z');
    const service = new ControlService(store, testConfig, { kind: 'local-mock', call: async () => { throw Error('No model calls'); } }, () => now);
    const handler = createHandler(service, { origins: ['https://fitness.test'], maxBodyBytes: 65536 });
    const worker = createFitnessWorker({ fetch: (request: Request) => handler(request) }, async () => true);
    const post = (path: string, body: unknown) => worker.fetch(new Request(`https://fitness.test/api/v1/management/${path}`, {
      method: 'POST', headers: { origin: 'https://fitness.test', 'content-type': 'application/json' }, body: JSON.stringify(body),
    }), { CONTROL_ADMIN_SECRET: testConfig.adminSecret });
    const before = await store.read();
    const response = await post('invites', {}); expect(response.status).toBe(200);
    const invite = await response.json() as { code: string; inviteId: string; expiresAt: number };
    expect(invite.code).toMatch(/^[a-f0-9]{64}$/); expect(invite.expiresAt).toBe(now + 7 * 86400000);
    const report = await service.managementReport(testConfig.adminSecret);
    expect(report.invites).toEqual([{ inviteId: invite.inviteId, expiresAt: invite.expiresAt }]);
    expect(JSON.stringify(report)).not.toContain(invite.code);
    const session = await service.redeem(invite.code);
    expect(session.expiresAt).toBe(now + 30 * 86400000);
    await expect(service.redeem(invite.code)).rejects.toMatchObject({ code: 'INVITE_INVALID' });
    const second = await (await post('invites', {})).json() as typeof invite;
    expect((await post('invites/revoke', { inviteId: second.inviteId })).status).toBe(200);
    await expect(service.redeem(second.code)).rejects.toMatchObject({ code: 'INVITE_INVALID' });
    expect((await service.managementReport(testConfig.adminSecret)).invites).toEqual([]);
    expect((await store.read()).budgets).toEqual(before.budgets);
    expect((await store.read()).requests).toEqual(before.requests);
  } finally { store.close(); }
});
