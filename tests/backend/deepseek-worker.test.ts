import { expect, it, vi } from 'vitest';
import { createDeepSeekWorker, type DeepSeekWorkerEnv } from '../../src/backend/deepseek-worker';
import { SqliteControlStore } from '../../src/backend/sqlite-store';
import { confirmationFor } from '../../src/backend/contracts';

const env = (): DeepSeekWorkerEnv => ({ CONTROL_MODE: 'external', SUPPLIER_PROVIDER: 'deepseek',
  DEEPSEEK_API_KEY: 'd'.repeat(40), SUPPLIER_API_KEY: 'g'.repeat(40),
  CONTROL_ADMIN_SECRET: 'a'.repeat(40), CONTROL_DIGEST_SECRET: 'b'.repeat(40),
  CONTROL_ORIGINS: '["https://preview.test"]',
  CONTROL_POLICY: JSON.stringify({ timeZone: 'UTC', k: 1, budgetLimit: 3500, maximumRequestCost: 1000,
    requestBounds: { understand: 100, generate: 300 }, quotas: { understand: 8, generate: 4 }, maxInputBytes: 65536, maxConcurrent: 4 }) });
const post = (path: string, data: unknown, cookie?: string, admin = 'a'.repeat(40)) => new Request(`https://preview.test/api/v1/${path}`, {
  method: 'POST', headers: { Origin: 'https://preview.test', 'Content-Type': 'application/json',
    Authorization: `Bearer ${admin}`, ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(data),
});

it('DeepSeek entrypoint defaults off without accessing the store or transport', async () => {
  const store = vi.fn(() => { throw new Error('unexpected store'); });
  const transport = vi.fn(async () => { throw new Error('unexpected network'); });
  const worker = createDeepSeekWorker({ store, transport });
  expect(await (await worker.fetch(new Request('https://preview.test/api/v1/health'), {})).json())
    .toEqual({ status: 'disabled', productionModelEnabled: false });
  expect((await worker.fetch(post('plans/generate', {}), { CONTROL_MODE: 'disabled' })).status).toBe(503);
  expect(store).not.toHaveBeenCalled(); expect(transport).not.toHaveBeenCalled();
});

it('control-only keeps credential-independent local qualification and denies model switches', async () => {
  const store = new SqliteControlStore(':memory:'); const transport = vi.fn(async () => { throw new Error('unexpected network'); });
  const worker = createDeepSeekWorker({ store: () => store, transport });
  const controlEnv = { ...env(), CONTROL_MODE: 'control-only', DEEPSEEK_API_KEY: undefined };
  try {
    await store.transact(state => { state.aiEnabled = true; });
    expect(await (await worker.fetch(new Request('https://preview.test/api/v1/health'), controlEnv)).json())
      .toEqual({ status: 'control-only', productionModelEnabled: false });
    expect((await worker.fetch(post('admin/invites', {}), controlEnv)).status).toBe(200);
    for (const path of ['goals/interpret', 'plans/generate', 'admin/supplier', 'admin/mock'])
      expect((await worker.fetch(post(path, {}), controlEnv)).status).toBe(503);
    expect(transport).not.toHaveBeenCalled();
  } finally { store.close(); }
});

it('external assembly rejects unselected providers and arbitrary destinations before store access', async () => {
  const store = vi.fn(() => { throw new Error('unexpected store'); });
  const worker = createDeepSeekWorker({ store });
  for (const change of [{ SUPPLIER_PROVIDER: 'gemini' }, { SUPPLIER_PROVIDER: undefined },
    { SUPPLIER_ENDPOINT: 'https://api.deepseek.com/other' }, { SUPPLIER_ORIGIN: 'https://other.test' }]) {
    expect((await worker.fetch(post('admin/invites', {}), { ...env(), ...change })).status).toBeGreaterThanOrEqual(500);
  }
  expect(store).not.toHaveBeenCalled();
});

it('external assembly requires its own distinct server key, never falls back to Gemini credentials', async () => {
  const store = vi.fn(() => { throw new Error('unexpected store'); });
  const worker = createDeepSeekWorker({ store });
  for (const key of [undefined, '', 'a'.repeat(40), 'b'.repeat(40)]) {
    const response = await worker.fetch(post('admin/invites', {}), { ...env(), DEEPSEEK_API_KEY: key });
    expect(await response.json()).toEqual({ error: 'INVALID_CONTROL_CONFIG' });
  }
  expect(store).not.toHaveBeenCalled();
});

it('DeepSeek requests require origin, qualification and explicit ledger activation; valid output with unknown cost stays pending', async () => {
  const store = new SqliteControlStore(':memory:'); let captured: Request | undefined;
  const transport = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    captured = new Request(input, init);
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop',
      message: { role: 'assistant', content: '{"interpretedGoal":"synthetic interpretation"}' } }],
      usage: { prompt_tokens: 20, completion_tokens: 10 } }));
  });
  const worker = createDeepSeekWorker({ store: () => store, transport }); const config = env();
  try {
    expect((await worker.fetch(post('admin/supplier', { enabled: true }, undefined, 'wrong'), config)).status).toBe(401);
    const issued = await worker.fetch(post('admin/invites', {}), config); const { code } = await issued.json() as { code: string };
    const redeemed = await worker.fetch(post('trial/redeem', { code }), config); const cookie = redeemed.headers.get('set-cookie')!.split(';')[0];
    const base = { operation: 'understand', contractVersion: 1, requestId: crypto.randomUUID(), goalText: 'synthetic goal', locale: 'en', restoreGeneration: 0 };
    const data = { ...base, sendConfirmation: await confirmationFor(base) };
    expect(await (await worker.fetch(post('goals/interpret', data, cookie), config)).json()).toEqual({ error: 'AI_DISABLED' });
    expect(transport).not.toHaveBeenCalled();
    expect((await worker.fetch(post('admin/supplier', { enabled: true }), config)).status).toBe(200);
    expect((await worker.fetch(post('goals/interpret', data), config)).status).toBe(401);
    const wrongOrigin = post('goals/interpret', data, cookie); wrongOrigin.headers.set('Origin', 'https://other.test');
    expect((await worker.fetch(wrongOrigin, config)).status).toBe(403);
    expect(transport).not.toHaveBeenCalled();
    expect(await (await worker.fetch(post('goals/interpret', data, cookie), config)).json()).toEqual({ error: 'ACCOUNTING_PENDING' });
    expect(captured!.url).toBe('https://api.deepseek.com/chat/completions');
    expect(captured!.redirect).toBe('manual'); expect(captured!.headers.get('authorization')).toBe(`Bearer ${config.DEEPSEEK_API_KEY}`);
    expect(captured!.headers.get('x-goog-api-key')).toBeNull();
    const payload = await captured!.json() as { model: string; max_tokens: number }; expect(payload.model).toBe('deepseek-flash'); expect(payload.max_tokens).toBe(2048);
    expect(await (await worker.fetch(post('goals/interpret', data, cookie), config)).json()).toEqual({ error: 'REQUEST_IN_PROGRESS' });
    expect(transport).toHaveBeenCalledTimes(1);
    const state = await store.read(); expect(Object.values(state.budgets)[0]).toEqual({ spent: 0, reserved: 100 });
    expect(Object.values(state.requests)[0].status).toBe('pending');
    for (const value of ['synthetic goal', 'synthetic interpretation', config.DEEPSEEK_API_KEY!]) expect(JSON.stringify(state)).not.toContain(value);
  } finally { store.close(); }
});
