import { expect, it } from 'vitest';
import { createDeepSeekWorker } from '../../src/backend/deepseek-worker';
import { SqliteControlStore } from '../../src/backend/sqlite-store';
import { createFetchAiClient } from '../../src/ai/client';
import { sendCoach } from '../../src/coach/transport';
import { currentCoachEnvelope, currentCoachRefusal } from '../fixtures/current-coach-envelope';

it.each(['en', 'zh'] as const)('%s connects Worker, codec and V8 client through manual reconciliation without real network', async locale => {
  const store = new SqliteControlStore(':memory:'); let supplierCalls = 0, browserCookie = '';
  const env = { CONTROL_MODE: 'external', SUPPLIER_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'd'.repeat(40),
    CONTROL_ADMIN_SECRET: 'a'.repeat(40), CONTROL_DIGEST_SECRET: 'b'.repeat(40), CONTROL_ORIGINS: '["https://preview.test"]',
    CONTROL_POLICY: JSON.stringify({ timeZone: 'UTC', k: 1, budgetLimit: 3500, maximumRequestCost: 1000,
      requestBounds: { understand: 100, generate: 300 }, quotas: { understand: 8, generate: 4 }, maxInputBytes: 65536, maxConcurrent: 4 }) };
  const worker = createDeepSeekWorker({ store: () => store, transport: async () => {
    supplierCalls++;
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant',
      content: JSON.stringify(currentCoachRefusal) } }] }));
  } });
  const admin = async (path: string, body: unknown) => worker.fetch(new Request(`https://preview.test/api/v1/admin/${path}`, {
    method: 'POST', headers: { Origin: 'https://preview.test', Authorization: `Bearer ${env.CONTROL_ADMIN_SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), env);
  const transport: typeof fetch = async (input, init) => {
    const request = new Request(new URL(String(input), 'https://preview.test'), init);
    request.headers.set('Origin', 'https://preview.test'); if (browserCookie) request.headers.set('Cookie', browserCookie);
    const response = await worker.fetch(request, env);
    if (response.headers.has('set-cookie')) browserCookie = response.headers.get('set-cookie')!.split(';')[0];
    return response;
  };
  const client = createFetchAiClient(transport);
  try {
    const issue = await admin('invites', {}); const { code } = await issue.json() as { code: string };
    await client.redeem(code); expect((await admin('supplier', { enabled: true })).status).toBe(200);
    const first = await currentCoachEnvelope(locale);
    const result = await sendCoach(first.coach,new AbortController().signal,transport);
    expect(result.accounting).toBe('pending'); expect(result.response).toEqual(currentCoachRefusal);
    expect((await client.status()).reconciliationRequired).toBe(true);
    await expect(sendCoach(first.coach,new AbortController().signal,transport)).rejects.toThrow(); expect(supplierCalls).toBe(1);
    const report = await (await admin('report', {})).json() as { requests: { subjectId: string; requestId: string; status: string }[] };
    expect(report.requests).toHaveLength(1); expect(report.requests[0].status).toBe('pending');
    expect((await admin('settle', { subjectId: report.requests[0].subjectId, requestId: first.requestId, actualCost: 10 })).status).toBe(200);
    expect((await client.status()).reconciliationRequired).toBe(false);
    const state = await store.read(); expect(Object.values(state.budgets)[0]).toEqual({ spent: 10, reserved: 0 });
    const serialized = JSON.stringify(state); for (const value of ['synthetic goal', 'synthetic understanding', 'isolated synthetic candidate', env.DEEPSEEK_API_KEY]) expect(serialized).not.toContain(value);
  } finally { store.close(); }
});
