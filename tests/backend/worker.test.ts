import { expect, it } from 'vitest';
import { ControlService, testConfig } from '../../src/backend/control';
import { SqliteControlStore } from '../../src/backend/sqlite-store';
import { confirmationFor } from '../../src/backend/contracts';
import { createWorker, readWorkerConfig } from '../../src/backend/worker';
import { createSupplierTransport, type ProviderCodec } from '../../src/backend/supplier-transport';
import { D1ControlStore, type D1Binding, type D1Statement } from '../../src/backend/d1-store';

const codec: ProviderCodec = { providerId: 'fixture-only', encode: request => ({ fixture: request.goalText }),
  decode: body => body as { result: unknown; actualCost?: number } };
const transportConfig = { endpoint: 'https://supplier.test/v1/model', allowedOrigin: 'https://supplier.test', apiKey: 'c'.repeat(40),
  timeoutMs: 100, maxResponseBytes: 256 };
const env = () => ({ CONTROL_MODE: 'external', CONTROL_ORIGINS: '["https://fitness.test"]',
  CONTROL_POLICY: JSON.stringify({ timeZone: 'UTC', k: 1, budgetLimit: 3500, maximumRequestCost: 1000,
    requestBounds: { understand: 100, generate: 300 }, quotas: { understand: 8, generate: 4 }, maxInputBytes: 65536, maxConcurrent: 4 }),
  CONTROL_ADMIN_SECRET: 'a'.repeat(40), CONTROL_DIGEST_SECRET: 'b'.repeat(40), SUPPLIER_API_KEY: 'c'.repeat(40),
  SUPPLIER_ENDPOINT: transportConfig.endpoint, SUPPLIER_ORIGIN: transportConfig.allowedOrigin, SUPPLIER_PROVIDER: 'fixture-only' });

it('Worker default-off health and API perform no store or supplier work', async () => {
  const worker = createWorker({ store: () => { throw new Error('must not access'); } });
  const health = await worker.fetch(new Request('https://fitness.test/api/v1/health'), {});
  expect(await health.json()).toEqual({ status: 'disabled', productionModelEnabled: false });
  const response = await worker.fetch(new Request('https://fitness.test/api/v1/trial/status'), {});
  expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: 'AI_DISABLED' });
});

it('Worker rejects missing/test credentials, unselected provider, absent D1 and inconsistent cost policy', async () => {
  for (const change of [{ CONTROL_ADMIN_SECRET: '' }, { CONTROL_DIGEST_SECRET: testConfig.digestSecret },
    { SUPPLIER_API_KEY: 'local-test-key'.repeat(4) }, { SUPPLIER_PROVIDER: 'unselected' },
    { CONTROL_POLICY: JSON.stringify({ ...JSON.parse(env().CONTROL_POLICY), unexpected: true }) }]) {
    expect(() => readWorkerConfig({ ...env(), ...change })).toThrow();
  }
  const worker = createWorker();
  const response = await worker.fetch(new Request('https://fitness.test/api/v1/trial/status'), env());
  expect(await response.json()).toEqual({ error: 'PROVIDER_SELECTION_REQUIRED' });
  const injected = createWorker({ codec });
  expect(await (await injected.fetch(new Request('https://fitness.test/api/v1/trial/status'), env())).json()).toEqual({ error: 'CONTROL_UNAVAILABLE' });
});

it('transport sends one bounded HTTPS request without redirects and returns decoded result', async () => {
  let captured: Request | undefined;
  const supplier = createSupplierTransport(transportConfig, codec, async (input, init) => {
    captured = new Request(input, init);
    return new Response(JSON.stringify({ result: { interpretedGoal: 'fixture' }, actualCost: 20 }));
  });
  const request = { goalText: 'synthetic fixture' } as never;
  expect(await supplier.call(request)).toEqual({ result: { interpretedGoal: 'fixture' }, actualCost: 20 });
  expect(captured?.url).toBe('https://supplier.test/v1/model'); expect(captured?.redirect).toBe('manual');
  expect(captured?.headers.get('authorization')).toBe(`Bearer ${'c'.repeat(40)}`);
  expect(await captured?.json()).toEqual({ fixture: 'synthetic fixture' });
});

it('transport rejects unsafe destinations and never retries failed, oversized or malformed upstream output', async () => {
  for (const endpoint of ['http://supplier.test/v1', 'https://other.test/v1', 'https://user:pass@supplier.test/v1', 'https://supplier.test/v1?key=secret']) {
    expect(() => createSupplierTransport({ ...transportConfig, endpoint }, codec, fetch)).toThrow('INVALID_SUPPLIER_CONFIG');
  }
  for (const response of [new Response('private', { status: 500 }), new Response('x'.repeat(257)), new Response('bad json')]) {
    let calls = 0;
    const supplier = createSupplierTransport(transportConfig, codec, async () => { calls++; return response; });
    await expect(supplier.call({ goalText: 'fixture' } as never)).rejects.toThrow('SUPPLIER_UNCERTAIN'); expect(calls).toBe(1);
  }
});

it('transport timeout aborts the only attempt and exposes no upstream error body', async () => {
  let calls = 0; let signal: AbortSignal | null | undefined;
  const supplier = createSupplierTransport({ ...transportConfig, timeoutMs: 5 }, codec, async (_input, init) => {
    calls++; signal = init?.signal;
    return new Promise<Response>((_resolve, reject) => signal?.addEventListener('abort', () => reject(new Error('private timeout'))));
  });
  await expect(supplier.call({ goalText: 'synthetic' } as never)).rejects.toThrow('SUPPLIER_UNCERTAIN');
  expect(signal?.aborted).toBe(true); expect(calls).toBe(1);
});

it('non-success upstream stream is cancelled before transport releases its timeout', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } }), { status: 500 });
  const supplier = createSupplierTransport(transportConfig, codec, async () => response);
  await expect(supplier.call({ goalText: 'synthetic' } as never)).rejects.toThrow('SUPPLIER_UNCERTAIN');
  expect(cancelled).toBe(true);
});

it('D1 protocol missing row, failed update and invalid changed counts never authorize a transaction', async () => {
  for (const failure of ['missing', 'failed', 'ambiguous']) {
    const statement: D1Statement = { bind() { return this; },
      first: async <T>() => failure === 'missing' ? null : { state: JSON.stringify({ version: 1, aiEnabled: false }), revision: 0 } as T,
      run: async () => ({ success: failure !== 'failed', meta: { changes: failure === 'ambiguous' ? 2 : 1 } }) };
    const binding: D1Binding = { withSession: () => ({ prepare: () => statement }) };
    await expect(new D1ControlStore(binding).transact(state => { state.aiEnabled = true; return 'authority'; }))
      .rejects.toMatchObject({ code: 'CONTROL_UNAVAILABLE' });
  }
});

it('credential retention removes expired access but never erases spent quota, request identity or pending accounting', async () => {
  const store = new SqliteControlStore(':memory:');
  try {
    let now = Date.parse('2026-01-01T00:00:00Z');
    const service = new ControlService(store, testConfig, { kind: 'local-mock', call: async () => ({ result: null }) }, () => now);
    const invite = await service.issue(testConfig.adminSecret), session = await service.redeem(invite.code);
    await store.transact(state => {
      state.budgets['2026-01'] = { spent: 50, reserved: 100 };
      state.usages[`${session.subjectId}:2026-01`] = { understand: 2, generate: 0 };
      state.requests['pending'] = { subjectId: session.subjectId, requestId: crypto.randomUUID(), inputDigest: 'digest', operation: 'understand',
        period: '2026-01', bound: 100, status: 'pending', cancelled: true };
      state.audit = Array.from({ length: 1500 }, (_, at) => ({ at, event: 'synthetic' }));
    });
    const before = await store.read(); now = Date.parse('2026-03-01T00:00:00Z');
    await service.retainLedger(testConfig.adminSecret);
    const after = await store.read(); expect(after.invites).toEqual({}); expect(after.sessions).toEqual({});
    expect(after.subjects).toEqual(before.subjects); expect(after.requests).toEqual(before.requests);
    expect(after.budgets).toEqual(before.budgets); expect(after.usages).toEqual(before.usages); expect(after.audit.length).toBeLessThanOrEqual(1000);
    await expect(service.status(session.token)).rejects.toMatchObject({ code: 'QUALIFICATION_REQUIRED' });
  } finally { store.close(); }
});

it('external handler enables only supplier admin route and settles bad candidates without automatic refunds', async () => {
  const store = new SqliteControlStore(':memory:'); let calls = 0;
  const worker = createWorker({ codec, store: () => store, transport: async () => {
    calls++; return new Response(JSON.stringify({ result: { wrong: 'private output' }, actualCost: 20 }));
  } });
  const request = (path: string, data: unknown, cookie?: string) => new Request(`https://fitness.test/api/v1/${path}`, { method: 'POST',
    headers: { Origin: 'https://fitness.test', Authorization: `Bearer ${'a'.repeat(40)}`, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(data) });
  try {
    const issued = await worker.fetch(request('admin/invites', {}), env()); const { code } = await issued.json() as { code: string };
    const redeemed = await worker.fetch(request('trial/redeem', { code }), env()); const cookie = redeemed.headers.get('set-cookie')!.split(';')[0];
    expect((await worker.fetch(request('admin/mock', { enabled: true }), env())).status).toBe(400);
    expect((await worker.fetch(request('admin/supplier', { enabled: true }), env())).status).toBe(200);
    const base = { operation: 'understand', contractVersion: 1, requestId: crypto.randomUUID(), goalText: 'synthetic', locale: 'en', restoreGeneration: 0 };
    const submitted = await worker.fetch(request('goals/interpret', { ...base, sendConfirmation: await confirmationFor(base) }, cookie), env());
    expect(await submitted.json()).toEqual({ error: 'INVALID_CANDIDATE' }); expect(calls).toBe(1);
    const state = await store.read(); expect(Object.values(state.budgets)[0]).toEqual({ spent: 20, reserved: 0 });
    expect(JSON.stringify(state)).not.toContain('private output');
  } finally { store.close(); }
});

it('external transport uses the same disabled ledger and uncertain billing reservation without retries', async () => {
  const store = new SqliteControlStore(':memory:'); let calls = 0;
  try {
    const service = new ControlService(store, { ...testConfig, mode: 'external', adminSecret: 'a'.repeat(40), digestSecret: 'b'.repeat(40) } as never,
      { kind: 'external-transport', call: async () => { calls++; throw new Error('upstream private'); } } as never);
    const session = await service.redeem((await service.issue('a'.repeat(40))).code);
    const value = { operation: 'understand', contractVersion: 1, requestId: crypto.randomUUID(), goalText: 'synthetic', locale: 'en', restoreGeneration: 0 };
    const request = { ...value, sendConfirmation: await confirmationFor(value) };
    await expect(service.submit(session.token, request)).rejects.toMatchObject({ code: 'AI_DISABLED' });
    expect(calls).toBe(0);
    await service.enableSupplier('a'.repeat(40), true);
    await expect(service.submit(session.token, request)).rejects.toMatchObject({ code: 'ACCOUNTING_PENDING' });
    await expect(service.submit(session.token, request)).rejects.toMatchObject({ code: 'REQUEST_IN_PROGRESS' });
    expect(calls).toBe(1);
    const state = await store.read(); expect(Object.values(state.budgets)[0]).toEqual({ spent: 0, reserved: 100 });
    expect(JSON.stringify(state)).not.toContain('upstream private');
  } finally { store.close(); }
});

it('malformed supplier envelopes always become pending and block new same-period admission', async () => {
  const malformed = [null, undefined, [], {}, { result: {}, actualCost: '10' },
    { result: {}, get actualCost() { throw new Error('private billing accessor'); } }];
  for (const envelope of malformed) {
    const store = new SqliteControlStore(':memory:'); let calls = 0;
    try {
      const service = new ControlService(store, testConfig, { kind: 'local-mock', call: async () => { calls++; return envelope as never; } });
      const session = await service.redeem((await service.issue(testConfig.adminSecret)).code); await service.enableMock(testConfig.adminSecret, true);
      const request = async () => {
        const base = { operation: 'understand', contractVersion: 1, requestId: crypto.randomUUID(), goalText: 'synthetic', locale: 'en', restoreGeneration: 0 };
        return { ...base, sendConfirmation: await confirmationFor(base) };
      };
      await expect(service.submit(session.token, await request())).rejects.toMatchObject({ code: 'ACCOUNTING_PENDING' });
      const state = await store.read(); expect(Object.values(state.requests)[0].status).toBe('pending');
      expect(Object.values(state.budgets)[0]).toEqual({ spent: 0, reserved: 100 });
      await expect(service.submit(session.token, await request())).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
      expect(calls).toBe(1);
    } finally { store.close(); }
  }
});

it('transport rejects redirects without following or forwarding credentials', async () => {
  let calls = 0; let redirect: RequestRedirect | undefined;
  const supplier = createSupplierTransport(transportConfig, codec, async (_input, init) => {
    calls++; redirect = init?.redirect;
    return new Response('redirect detail', { status: 302, headers: { Location: 'https://other.test/capture' } });
  });
  await expect(supplier.call({ goalText: 'synthetic' } as never)).rejects.toThrow('SUPPLIER_UNCERTAIN');
  expect(calls).toBe(1); expect(redirect).toBe('manual');
});
