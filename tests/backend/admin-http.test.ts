import { afterEach, expect, it } from 'vitest';
import { ControlService, testConfig } from '../../src/backend/control';
import { SqliteControlStore } from '../../src/backend/sqlite-store';
import { createHandler } from '../../src/backend/http';
const stores: SqliteControlStore[] = [];
afterEach(() => stores.splice(0).forEach(store => store.close()));
it('requires admin and same-origin for metadata reports without changing the ledger', async () => {
  const store = new SqliteControlStore(':memory:'); stores.push(store);
  const service = new ControlService(store, testConfig, { kind: 'local-mock', call: async () => { throw new Error('no model calls'); } });
  const issued = await service.issue(testConfig.adminSecret); await service.redeem(issued.code);
  const handler = createHandler(service, { origins: ['https://preview.test'], maxBodyBytes: 65536 });
  const report = (admin?: string, origin = 'https://preview.test', data = {}) => handler(new Request('https://preview.test/api/v1/admin/report', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(admin ? { Authorization: `Bearer ${admin}` } : {}) }, body: JSON.stringify(data),
  }));
  const before = await store.read();
  expect((await report()).status).toBe(401);
  expect((await report('incorrect')).status).toBe(401);
  expect((await report(testConfig.adminSecret, 'https://other.test')).status).toBe(403);
  expect((await report(testConfig.adminSecret, 'https://preview.test', { extra: true } as {})).status).toBe(400);
  const response = await report(testConfig.adminSecret); expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const text = await response.text();
  expect(text).not.toContain(issued.code); expect(text).not.toContain('inputDigest'); expect(text).not.toContain('sessions');
  expect(JSON.parse(text).subjects).toHaveLength(1);
  expect(await store.read()).toEqual(before);
});
