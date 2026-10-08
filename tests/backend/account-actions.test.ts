import { afterEach, expect, it } from 'vitest';
import { SqliteControlStore } from '../../src/backend/sqlite-store';
import { ControlService, testConfig } from '../../src/backend/control';
import { createHandler } from '../../src/backend/http';
const stores: SqliteControlStore[] = [];
afterEach(() => stores.splice(0).forEach(s => s.close()));
function fixture() {
  const store = new SqliteControlStore(':memory:'); stores.push(store); let now = Date.now();
  const service = new ControlService(store, testConfig, { kind: 'local-mock', call: async () => { throw Error('unexpected model call'); } }, () => now);
  const input = { id: crypto.randomUUID(), receipt: 'a'.repeat(64), kind: 'new' as const, name: 'User', note: '' };
  return { store, service, input, now: () => now, advance: () => { now += 86400000; } };
}
it('direct activation starts 30 days immediately and retries preserve expiry and usage', async () => {
  const f = fixture(); await f.service.applications.apply(f.input);
  const activated = await f.service.activateApplication(testConfig.adminSecret, f.input.id);
  expect(activated).toMatchObject({ directlyActivated: true, state: 'approved', expiresAt: f.now() + 30 * 86400000 });
  f.advance(); const before = await f.store.read();
  await f.service.activateApplication(testConfig.adminSecret, f.input.id); expect(await f.store.read()).toEqual(before);
  await expect(f.service.applications.claim('b'.repeat(64), f.input.id)).rejects.toMatchObject({ code: 'APPLICATION_NOT_FOUND' });
  const claimed = await f.service.applications.claim(f.input.receipt, f.input.id);
  expect(claimed.expiresAt).toBe(activated.expiresAt); expect((await f.service.status(claimed.token)).subjectId).toBe(claimed.subjectId);
  const after = await f.store.read(); await f.service.activateApplication(testConfig.adminSecret, f.input.id); expect(await f.store.read()).toEqual(after);
});
it('deletion invalidates sessions, replacement codes and receipts without altering accounting', async () => {
  const f = fixture(); await f.service.applications.apply(f.input); await f.service.activateApplication(testConfig.adminSecret, f.input.id);
  const c = await f.service.applications.claim(f.input.receipt, f.input.id);
  const replacement = await f.service.reissue(testConfig.adminSecret, c.subjectId);
  await f.store.transact(s => { s.usages[c.subjectId + ':2026-10'] = { understand: 3, generate: 2 }; s.budgets['2026-10'] = { spent: 2, reserved: 0 }; });
  const before = await f.store.read(); await f.service.deleteSubject(testConfig.adminSecret, c.subjectId);
  const after = await f.store.read();
  expect(after.budgets).toEqual(before.budgets); expect(after.usages).toEqual(before.usages); expect(after.requests).toEqual(before.requests);
  expect(after.subjects[c.subjectId].deletedAt).toBe(f.now());
  await expect(f.service.status(c.token)).rejects.toMatchObject({ code: 'QUALIFICATION_REQUIRED' });
  await expect(f.service.redeem(replacement.code)).rejects.toMatchObject({ code: 'INVITE_INVALID' });
  await expect(f.service.reissue(testConfig.adminSecret, c.subjectId)).rejects.toMatchObject({ code: 'SUBJECT_EXPIRED' });
  await expect(f.service.activateApplication(testConfig.adminSecret, f.input.id)).rejects.toMatchObject({ code: 'QUALIFICATION_REQUIRED' });
  await expect(f.service.applications.claim(f.input.receipt, f.input.id)).rejects.toMatchObject({ code: 'QUALIFICATION_REQUIRED' });
  const report = await f.service.managementReport(testConfig.adminSecret); expect(report.report.subjects).toEqual([]); expect(report.applications).toEqual([]);
  await f.service.deleteSubject(testConfig.adminSecret, c.subjectId); expect(await f.store.read()).toEqual(after);
});
it('replacement belongs to the same user and preserves expiry and recorded quota', async () => {
  const f = fixture(); const c = await f.service.redeem((await f.service.issue(testConfig.adminSecret)).code);
  const replacement = await f.service.reissue(testConfig.adminSecret, c.subjectId);
  const redeemed = await f.service.redeem(replacement.code); expect(redeemed.subjectId).toBe(c.subjectId); expect(redeemed.expiresAt).toBe(c.expiresAt);
  await expect(f.service.status(c.token)).rejects.toMatchObject({ code: 'QUALIFICATION_REQUIRED' });
  await expect(f.service.redeem(replacement.code)).rejects.toMatchObject({ code: 'INVITE_INVALID' });
});
it('a deleted direct activation cannot be claimed before first login', async () => {
  const f = fixture(); await f.service.applications.apply(f.input);
  const active = await f.service.activateApplication(testConfig.adminSecret, f.input.id);
  await f.service.deleteSubject(testConfig.adminSecret, active.subjectId!);
  await expect(f.service.applications.claim(f.input.receipt, f.input.id)).rejects.toMatchObject({ code: 'QUALIFICATION_REQUIRED' });
});
it('direct activation expiry is not renewed by a delayed first claim', async () => {
  const f = fixture(); await f.service.applications.apply(f.input);
  await f.service.activateApplication(testConfig.adminSecret, f.input.id);
  for (let n = 0; n < 30; n++) f.advance();
  await expect(f.service.applications.claim(f.input.receipt, f.input.id)).rejects.toMatchObject({ code: 'INVITE_INVALID' });
  const before = await f.store.read(); await f.service.activateApplication(testConfig.adminSecret, f.input.id); expect(await f.store.read()).toEqual(before);
});
it('authenticated HTTP activation and deletion enforce admin and origin checks', async () => {
  const f = fixture(); await f.service.applications.apply(f.input);
  const origin = 'https://fitness.test'; const handler = createHandler(f.service, { origins: [origin], maxBodyBytes: 10000 });
  const post = (op: string, data: unknown, secret = testConfig.adminSecret, from = origin) => handler(new Request(origin + '/api/v1/admin/' + op, { method: 'POST', headers: { Origin: from, Authorization: 'Bearer ' + secret, 'Content-Type': 'application/json' }, body: JSON.stringify(data) }));
  expect((await post('application-activate', { id: f.input.id }, 'wrong')).status).toBe(401);
  expect((await post('application-activate', { id: f.input.id }, testConfig.adminSecret, 'https://other.test')).status).toBe(403);
  const active = await post('application-activate', { id: f.input.id }); expect(active.status).toBe(200);
  const { subjectId } = await active.json() as { subjectId: string };
  expect((await post('subject-delete', { subjectId }, 'wrong')).status).toBe(401);
  expect((await post('subject-delete', { subjectId })).status).toBe(200);
});
it('new HTTP mutations require administrator authentication and strict input', async () => {
  const f = fixture(); const origin = 'https://fitness.test'; const handler = createHandler(f.service, { origins: [origin], maxBodyBytes: 10000 });
  for (const operation of ['application-activate', 'subject-delete']) {
    const request = (authorization?: string) => new Request(origin + '/api/v1/admin/' + operation, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) }, body: '{}' });
    expect((await handler(request())).status).toBe(401);
    expect((await handler(request('Bearer ' + testConfig.adminSecret))).status).toBe(400);
  }
});

