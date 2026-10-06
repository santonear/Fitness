import { expect, it } from 'vitest';
import { createDeepSeekWorker } from '../../src/backend/deepseek-worker';
import { SqliteControlStore } from '../../src/backend/sqlite-store';
import { createFetchAiClient } from '../../src/ai/client';
import { AiWorkflow } from '../../src/ai/workflow';
import { fourMetricCandidate } from '../fixtures/prompt-cases';

it.each(['en', 'zh'] as const)('%s connects Worker, codec, client and four-metric candidate through manual reconciliation without real network', async locale => {
  const store = new SqliteControlStore(':memory:'); let supplierCalls = 0, browserCookie = '';
  const env = { CONTROL_MODE: 'external', SUPPLIER_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'd'.repeat(40),
    CONTROL_ADMIN_SECRET: 'a'.repeat(40), CONTROL_DIGEST_SECRET: 'b'.repeat(40), CONTROL_ORIGINS: '["https://preview.test"]',
    CONTROL_POLICY: JSON.stringify({ timeZone: 'UTC', k: 1, budgetLimit: 3500, maximumRequestCost: 1000,
      requestBounds: { understand: 100, generate: 300 }, quotas: { understand: 8, generate: 4 }, maxInputBytes: 65536, maxConcurrent: 4 }) };
  const candidate = fourMetricCandidate();
  const worker = createDeepSeekWorker({ store: () => store, transport: async () => {
    supplierCalls++;
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant',
      content: JSON.stringify(supplierCalls === 1 ? { interpretedGoal: 'synthetic understanding' } : candidate) } }] }));
  } });
  const admin = async (path: string, body: unknown) => worker.fetch(new Request(`https://preview.test/api/v1/admin/${path}`, {
    method: 'POST', headers: { Origin: 'https://preview.test', Authorization: `Bearer ${env.CONTROL_ADMIN_SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), env);
  const client = createFetchAiClient(async (input, init) => {
    const request = new Request(new URL(String(input), 'https://preview.test'), init);
    request.headers.set('Origin', 'https://preview.test'); if (browserCookie) request.headers.set('Cookie', browserCookie);
    const response = await worker.fetch(request, env);
    if (response.headers.has('set-cookie')) browserCookie = response.headers.get('set-cookie')!.split(';')[0];
    return response;
  });
  try {
    const issue = await admin('invites', {}); const { code } = await issue.json() as { code: string };
    await client.redeem(code); expect((await admin('supplier', { enabled: true })).status).toBe(200);
    const flow = new AiWorkflow(client); flow.setGoal('synthetic goal');
    const first = await flow.previewUnderstanding(locale, 2); flow.confirmSending(first.sendConfirmation); await flow.send();
    expect(flow.accounting).toBe('pending'); expect(flow.candidate).toEqual({ interpretedGoal: 'synthetic understanding' });
    expect((await client.status()).reconciliationRequired).toBe(true);
    const blocked = await flow.previewUnderstanding(locale, 2); flow.confirmSending(blocked.sendConfirmation);
    await expect(flow.send()).rejects.toThrow('RECONCILIATION_REQUIRED'); expect(supplierCalls).toBe(1);
    const report = await (await admin('report', {})).json() as { requests: { subjectId: string; requestId: string; status: string }[] };
    expect(report.requests).toHaveLength(1); expect(report.requests[0].status).toBe('pending');
    expect((await admin('settle', { subjectId: report.requests[0].subjectId, requestId: first.requestId, actualCost: 10 })).status).toBe(200);
    expect((await client.status()).reconciliationRequired).toBe(false);
    flow.confirmGoal('synthetic understanding');
    const next = await flow.previewGeneration({ locale, restoreGeneration: 2, dates: ['2026-10-06'], timeZone: 'UTC', catalogVersion: 1, conditions: {} });
    flow.confirmSending(next.sendConfirmation); await flow.send();
    expect(flow.accounting).toBe('pending'); expect(flow.candidate).toEqual(candidate); expect(supplierCalls).toBe(2);
    const state = await store.read(); expect(Object.values(state.budgets)[0]).toEqual({ spent: 10, reserved: 300 });
    const serialized = JSON.stringify(state); for (const value of ['synthetic goal', 'synthetic understanding', 'isolated synthetic candidate', env.DEEPSEEK_API_KEY]) expect(serialized).not.toContain(value);
  } finally { store.close(); }
});
