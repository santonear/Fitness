import { afterEach, expect, it } from 'vitest';
import { SqliteControlStore } from '../../src/backend/sqlite-store';
import { TrialApplications } from '../../src/backend/trial-applications';
import { ControlService, testConfig } from '../../src/backend/control';
import { createHandler } from '../../src/backend/http';
const DAY = 86400000;
const stores: SqliteControlStore[] = [];
it('rotating receipts cannot bypass the atomic global admission throttle; retries still work', async () => {
  const f = fixture();
  const inputs = Array.from({ length: 8 }, (_, n) => ({ ...f.input, id: crypto.randomUUID(), receipt: n.toString(16).repeat(64) }));
  const results = await Promise.allSettled(inputs.map(input => f.service.apply(input)));
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(5);
  expect(results.filter(r => r.status === 'rejected').every(r => r.reason.code === 'APPLICATION_BUSY')).toBe(true);
  const winner = results.findIndex(r => r.status === 'fulfilled');
  expect((await f.service.apply(inputs[winner])).id).toBe(inputs[winner].id);
  f.advance(1 / 24);
  expect((await f.service.apply(inputs[7])).id).toBe(inputs[7].id);
});
it('a full application queue rejects new records without changing qualification or billing', async () => {
  const f = fixture();
  await f.service.apply(f.input);
  await f.store.transact(state => {
    const original = state.applications![f.input.id];
    for (let n = 1; n < 200; n++) {
      const id = crypto.randomUUID();
      state.applications![id] = { ...original, id };
    }
    state.budgets['2026-10'] = { spent: 1, reserved: 300 };
  });
  const before = await f.store.read();
  await expect(f.service.apply({ ...f.input, receipt: 'b'.repeat(64), id: crypto.randomUUID() }))
    .rejects.toMatchObject({ code: 'APPLICATION_CAPACITY' });
  expect(await f.store.read()).toEqual(before);
  // A lost response remains recoverable even when the queue has since filled.
  expect((await f.service.apply(f.input)).id).toBe(f.input.id);
});
it('ledger size rejection rolls back the application and its audit entry together', async () => {
  const store = new SqliteControlStore(':memory:', 512); stores.push(store);
  const service = new TrialApplications(store, testConfig.digestSecret);
  const before = await store.read();
  await expect(service.apply({ receipt: 'c'.repeat(64), id: crypto.randomUUID(), kind: 'new', name: 'Test', note: '测'.repeat(300) }))
    .rejects.toMatchObject({ code: 'CONTROL_CAPACITY_EXHAUSTED' });
  expect(await store.read()).toEqual(before);
});
it('another receipt cannot list or claim an approved application or recover its session', async () => {
  const f = fixture(); await f.service.apply(f.input);
  await f.service.review(f.input.id, 'approve', '', 'owner');
  const before = await f.store.read();
  expect(await f.service.list('b'.repeat(64))).toEqual([]);
  await expect(f.service.claim('b'.repeat(64), f.input.id)).rejects.toMatchObject({ code: 'APPLICATION_NOT_FOUND' });
  expect(await f.store.read()).toEqual(before);
  await f.service.claim(f.receipt, f.input.id);
  const claimed = await f.store.read();
  await expect(f.service.claim('b'.repeat(64), f.input.id)).rejects.toMatchObject({ code: 'APPLICATION_NOT_FOUND' });
  expect(await f.store.read()).toEqual(claimed);
});
afterEach(() => stores.splice(0).forEach(s => s.close()));
function fixture() {
  const store = new SqliteControlStore(':memory:'); stores.push(store);
  let now = Date.parse('2026-10-07T00:00:00Z');
  const service = new TrialApplications(store, testConfig.digestSecret, () => now);
  const receipt = 'a'.repeat(64);
  const input = { receipt, id: crypto.randomUUID(), kind: 'new' as const, name: 'Tester', note: '' };
  return { store, service, input, receipt, advance: (days: number) => { now += days * DAY; }, now: () => now };
}
it('duplicate application, parallel approvals and lost claim response issue one subject', async () => {
  const f = fixture(); await f.service.apply(f.input); await f.service.apply(f.input);
  await Promise.all([f.service.review(f.input.id, 'approve', '', 'owner'), f.service.review(f.input.id, 'approve', '', 'owner')]);
  const [a, b] = await Promise.all([f.service.claim(f.receipt, f.input.id), f.service.claim(f.receipt, f.input.id)]);
  expect(a).toEqual(b); expect(Object.keys((await f.store.read()).subjects)).toHaveLength(1);
  expect(JSON.stringify(await f.store.read())).not.toContain(f.receipt);
  expect(JSON.stringify(await f.service.report())).not.toContain(a.token);
});
it('receipt mismatch and unapproved claims cannot grant qualification', async () => {
  const f = fixture(); await f.service.apply(f.input);
  await expect(f.service.claim('b'.repeat(64), f.input.id)).rejects.toMatchObject({ code: 'APPLICATION_NOT_FOUND' });
  await expect(f.service.claim(f.receipt, f.input.id)).rejects.toMatchObject({ code: 'APPLICATION_NOT_APPROVED' });
  await f.service.review(f.input.id, 'reject', 'Not available', 'owner');
  await expect(f.service.review(f.input.id, 'approve', '', 'owner')).rejects.toMatchObject({ code: 'APPLICATION_CONFLICT' });
});
it('unclaimed approval expires after seven days', async () => {
  const f = fixture(); await f.service.apply(f.input); await f.service.review(f.input.id, 'approve', '', 'owner'); f.advance(7);
  await expect(f.service.claim(f.receipt, f.input.id)).rejects.toMatchObject({ code: 'INVITE_INVALID' });
});
it.each([1, 31])('extension after %i days is idempotent and preserves billing and usage', async days => {
  const f = fixture(); await f.service.apply(f.input); await f.service.review(f.input.id, 'approve', '', 'owner');
  const original = await f.service.claim(f.receipt, f.input.id);
  await f.store.transact(s => { s.usages[`${original.subjectId}:2026-10`] = { understand: 3, generate: 1 }; s.budgets['2026-10'] = { spent: 1, reserved: 300 }; });
  f.advance(days); const extension = { ...f.input, id: crypto.randomUUID(), kind: 'extend' as const };
  await f.service.apply(extension); const before = await f.store.read();
  await f.service.review(extension.id, 'approve', '', 'owner'); await f.service.review(extension.id, 'approve', '', 'owner');
  const next = await f.service.claim(f.receipt, extension.id), after = await f.store.read();
  expect(next.subjectId).toBe(original.subjectId); expect(next.expiresAt).toBe(Math.max(original.expiresAt, f.now()) + 30 * DAY);
  expect(after.usages).toEqual(before.usages); expect(after.budgets).toEqual(before.budgets); expect(after.requests).toEqual(before.requests);
  await expect(f.service.claim(f.receipt, f.input.id)).rejects.toMatchObject({ code: 'QUALIFICATION_REQUIRED' });
});
it('replacement keeps expiry and blocks old session recovery', async () => {
  const f = fixture(); await f.service.apply(f.input); await f.service.review(f.input.id, 'approve', '', 'owner'); const old = await f.service.claim(f.receipt, f.input.id); f.advance(1);
  const next = { ...f.input, kind: 'replace' as const, id: crypto.randomUUID() }; await f.service.apply(next); await f.service.review(next.id, 'approve', '', 'owner');
  await expect(f.service.claim(f.receipt, f.input.id)).rejects.toMatchObject({ code: 'QUALIFICATION_REQUIRED' });
  expect((await f.service.claim(f.receipt, next.id)).expiresAt).toBe(old.expiresAt);
});
it('revocation cannot be undone by pending approval or claim', async () => {
  const f = fixture(); await f.service.apply(f.input); await f.service.review(f.input.id, 'approve', '', 'owner'); const old = await f.service.claim(f.receipt, f.input.id); f.advance(1);
  const next = { ...f.input, kind: 'extend' as const, id: crypto.randomUUID() }; await f.service.apply(next);
  await f.store.transact(s => { s.subjects[old.subjectId].revoked = true; });
  await expect(f.service.review(next.id, 'approve', '', 'owner')).rejects.toMatchObject({ code: 'QUALIFICATION_REQUIRED' });
});
it('retention removes closed application data but keeps control facts', async () => {
  const f = fixture(); await f.service.apply(f.input); await f.service.review(f.input.id, 'reject', '', 'owner'); f.advance(30);
  expect(await f.service.retain()).toEqual({ removed: 1 }); expect(await f.service.list(f.receipt)).toEqual([]);
  expect((await f.store.read()).audit.length).toBeGreaterThan(0);
});
it('HTTP admission fails closed without anti-abuse configuration, admin stays protected', async () => {
  const f = fixture(); const control = new ControlService(f.store, testConfig, { kind: 'local-mock', call: async () => ({ result: {} }) });
  const handler = createHandler(control, { origins: ['https://fitness.test'], maxBodyBytes: 4096 });
  const send = (path: string, body: unknown) => handler(new Request(`https://fitness.test/api/v1/${path}`, { method: 'POST', headers: { origin: 'https://fitness.test', 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  expect((await send('trial/apply', { ...f.input, proof: '' })).status).toBe(503);
  expect((await send('admin/applications', {})).status).toBe(401);
  const working = createHandler(control, { origins: ['https://fitness.test'], maxBodyBytes: 4096, verifyApplication: async proof => proof === 'valid' });
  const response = await working(new Request('https://fitness.test/api/v1/trial/apply', { method: 'POST', headers: { origin: 'https://fitness.test', 'content-type': 'application/json' }, body: JSON.stringify({ ...f.input, proof: 'valid' }) }));
  expect(response.status).toBe(200);
});
it('HTTP application, administrator approval, atomic claim and status use the same ledger', async () => {
  const f = fixture(); const control = new ControlService(f.store, testConfig, { kind: 'local-mock', call: async () => { throw new Error('no model calls permitted'); } }, f.now);
  const handler = createHandler(control, { origins: ['https://fitness.test'], maxBodyBytes: 4096, verifyApplication: async () => true });
  const post = (path: string, data: unknown, admin = false) => handler(new Request(`https://fitness.test/api/v1/${path}`, { method: 'POST', headers: { origin: 'https://fitness.test', 'content-type': 'application/json', ...(admin ? { authorization: `Bearer ${testConfig.adminSecret}` } : {}) }, body: JSON.stringify(data) }));
  expect((await post('trial/apply', { ...f.input, proof: 'fixture' })).status).toBe(200);
  expect((await post('admin/application-review', { id: f.input.id, decision: 'approve', reason: '' }, true)).status).toBe(200);
  const claim = await post('trial/claim', { receipt: f.receipt, id: f.input.id }); expect(claim.status).toBe(200);
  const cookie = claim.headers.get('set-cookie')!; expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('SameSite=Strict');
  const response = await handler(new Request('https://fitness.test/api/v1/trial/status', { headers: { cookie: cookie.split(';')[0] } }));
  expect(response.status).toBe(200); expect((await response.json()).used).toEqual({ understand: 0, generate: 0, summary: 0 });
  const report = await post('admin/applications', {}, true); const text = await report.text(); expect(text).not.toContain(f.receipt); expect(text).not.toContain('ownerDigest');
  expect((await f.store.read()).budgets).toEqual({});
});
it('parallel extension requests cannot create two outstanding applications for one subject', async () => {
  const f = fixture(); await f.service.apply(f.input); await f.service.review(f.input.id, 'approve', '', 'owner'); await f.service.claim(f.receipt, f.input.id); f.advance(1);
  const results = await Promise.allSettled([1,2].map(() => f.service.apply({ ...f.input, id: crypto.randomUUID(), kind: 'extend' })));
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  await expect(f.service.apply({ ...f.input, id: crypto.randomUUID() })).rejects.toMatchObject({ code: 'USE_EXTENSION' });
});
it('retention holds unresolved charges and waits thirty days after actual settlement', async () => {
  const f = fixture(); await f.service.apply(f.input); await f.service.review(f.input.id, 'approve', '', 'owner'); const trial = await f.service.claim(f.receipt, f.input.id);
  const requestId = crypto.randomUUID();
  await f.store.transact(s => { s.budgets['2026-10'] = { spent: 0, reserved: 300 }; s.requests[`${trial.subjectId}:${requestId}`] = { subjectId: trial.subjectId, requestId, operation: 'understand', inputDigest: 'test', period: '2026-10', bound: 300, status: 'pending', cancelled: false }; });
  f.advance(90); expect(await f.service.retain()).toEqual({ removed: 0 });
  const control = new ControlService(f.store, testConfig, { kind: 'local-mock', call: async () => ({ result: {} }) }, f.now);
  await control.settle(testConfig.adminSecret, trial.subjectId, requestId, 1);
  expect(await f.service.retain()).toEqual({ removed: 0 }); f.advance(30);
  expect(await f.service.retain()).toEqual({ removed: 1 }); expect((await f.store.read()).budgets['2026-10']).toEqual({ spent: 1, reserved: 0 });
  expect((await f.store.read()).subjects[trial.subjectId]).toBeDefined();
});
