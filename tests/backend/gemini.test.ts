import { currentCoachEnvelope, currentCoachRefusal } from '../fixtures/current-coach-envelope';
import { expect, it } from 'vitest';
import { createGeminiCodec, geminiEndpoint } from '../../src/backend/gemini';
import { createSupplierTransport } from '../../src/backend/supplier-transport';
import { validateCandidate } from '../../src/backend/contracts';
import { ControlService, testConfig } from '../../src/backend/control';
import { SqliteControlStore } from '../../src/backend/sqlite-store';
import { promptRequest, fourMetricCandidate } from '../fixtures/prompt-cases';

const codec = () => createGeminiCodec({ maxOutputTokens: 2048 });
const envelope = (result: unknown) => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(result) }] } }], usageMetadata: { totalTokenCount: 100 } });

it.each(['en','zh'] as const)('Gemini accepts current %s and rejects retired generation', async locale => {
 const body = await codec().encode(await currentCoachEnvelope(locale)) as any;
 expect(JSON.parse(body.contents[0].parts[0].text).request.locale).toBe(locale);
 expect(body.tools).toBeUndefined();
 await expect(codec().encode(await promptRequest(locale))).rejects.toThrow('AI_CONTRACT_RETIRED');
});

it('rejects blocked, truncated, empty, ambiguous and tool responses without exposing output', () => {
  for (const body of [{}, { promptFeedback: { blockReason: 'SAFETY' }, ...envelope({}) },
    { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{' }] } }] },
    { candidates: [{ finishReason: 'STOP', content: { parts: [{ functionCall: {} }] } }] },
    { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'private malformed text' }] } }] },
    { candidates: [...envelope({}).candidates, ...envelope({}).candidates] }]) {
    expect(() => codec().decode(body)).toThrow('INVALID_CANDIDATE');
  }
});

it('thought parts are not parsed as result and multiple final text parts are joined', () => {
  expect(codec().decode({ candidates: [{ finishReason: 'STOP', content: { parts: [
    { text: 'private reasoning', thought: true }, { text: '{"interpretedGoal":', thoughtSignature: 'opaque' }, { text: '"General fitness"}' },
  ] } }] }).result).toEqual({ interpretedGoal: 'General fitness' });
});

it('Gemini key is sent only in its header, never URL/body; one attempt on rate limit', async () => {
  const endpoint = geminiEndpoint('gemini-fixture'); let calls = 0; let captured: Request | undefined;
  const config = { endpoint, allowedOrigin: 'https://generativelanguage.googleapis.com', apiKey: 'k'.repeat(40), timeoutMs: 1000, maxResponseBytes: 4096 };
  const supplier = createSupplierTransport(config, codec(), async (input, init) => {
    calls++; captured = new Request(input, init); return new Response(JSON.stringify(envelope(currentCoachRefusal)));
  });
  expect((await supplier.call(await currentCoachEnvelope('en'))).result).toEqual(currentCoachRefusal);
  expect(calls).toBe(1); expect(captured!.headers.get('x-goog-api-key')).toBe(config.apiKey);
  expect(captured!.headers.has('authorization')).toBe(false);
  expect(captured!.url).not.toContain(config.apiKey); expect(await captured!.text()).not.toContain(config.apiKey);
  const failed = createSupplierTransport(config, codec(), async () => { calls++; return new Response('private error', { status: 429 }); });
  await expect(failed.call(await currentCoachEnvelope('en'))).rejects.toThrow('SUPPLIER_UNCERTAIN'); expect(calls).toBe(2);
});

it('invalid model/config/input is rejected before any request', async () => {
  for (const model of ['', '../other', 'gemini-x?key=secret', 'gemini-x:streamGenerateContent']) expect(() => geminiEndpoint(model)).toThrow('INVALID_SUPPLIER_CONFIG');
  for (const maxOutputTokens of [0, -1, 1.5, 8193]) expect(() => createGeminiCodec({ maxOutputTokens })).toThrow('INVALID_SUPPLIER_CONFIG');
  await expect(codec().encode({} as never)).rejects.toThrow('INVALID_INPUT');
});

it('token-only Gemini response preserves budget reservation and deduplication until billing is verified', async () => {
  const store = new SqliteControlStore(':memory:'); let calls = 0;
  try {
    const config = { ...testConfig, mode: 'external' as const, adminSecret: 'a'.repeat(40), digestSecret: 'b'.repeat(40) };
    const supplier = createSupplierTransport({ endpoint: geminiEndpoint('gemini-fixture'), allowedOrigin: 'https://generativelanguage.googleapis.com',
      apiKey: 'k'.repeat(40), timeoutMs: 1000, maxResponseBytes: 4096 }, codec(), async () => {
      calls++; return new Response(JSON.stringify(envelope(currentCoachRefusal)));
    });
    const service = new ControlService(store, config, supplier);
    const session = await service.redeem((await service.issue(config.adminSecret)).code);
    const request = await currentCoachEnvelope('en');
    await expect(service.submit(session.token, request)).rejects.toMatchObject({ code: 'AI_DISABLED' }); expect(calls).toBe(0);
    await service.enableSupplier(config.adminSecret, true);
    await expect(service.submit(session.token, request)).resolves.toMatchObject({ accounting: 'pending', result: currentCoachRefusal });
    await expect(service.submit(session.token, request)).rejects.toMatchObject({ code: 'REQUEST_IN_PROGRESS' }); expect(calls).toBe(1);
    const state = await store.read(); expect(Object.values(state.requests)[0].status).toBe('pending');
    expect(Object.values(state.budgets)[0].reserved).toBe(config.requestBounds.generate);
    expect(JSON.stringify(state)).not.toContain('General fitness'); expect(JSON.stringify(state)).not.toContain('totalTokenCount');
  } finally { store.close(); }
});

it('optional failure diagnostics reveal only stage/status and never raw errors, keys or response bodies', async () => {
  const events: unknown[] = [];
  const config = { endpoint: geminiEndpoint('gemini-fixture'), allowedOrigin: 'https://generativelanguage.googleapis.com',
    apiKey: 'k'.repeat(40), timeoutMs: 1000, maxResponseBytes: 4096, onFailure: (event: unknown) => { events.push(event); } };
  for (const response of [new Response('private supplier detail', { status: 429 }), new Response('private malformed output', { status: 200 })]) {
    const supplier = createSupplierTransport(config, codec(), async () => response);
    await expect(supplier.call(await currentCoachEnvelope('en'))).rejects.toThrow('SUPPLIER_UNCERTAIN');
  }
  expect(events).toEqual([{ stage: 'http', httpStatus: 429 }, { stage: 'decode', httpStatus: 200 }]);
  expect(JSON.stringify(events)).not.toContain(config.apiKey); expect(JSON.stringify(events)).not.toContain('private');
});
