import { expect, it } from 'vitest';
import { createGeminiCodec, geminiEndpoint } from '../../src/backend/gemini';
import { createSupplierTransport } from '../../src/backend/supplier-transport';
import { validateCandidate } from '../../src/backend/contracts';
import { ControlService, testConfig } from '../../src/backend/control';
import { SqliteControlStore } from '../../src/backend/sqlite-store';
import { promptRequest, fourMetricCandidate } from '../fixtures/prompt-cases';

const codec = () => createGeminiCodec({ maxOutputTokens: 2048 });
const envelope = (result: unknown) => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(result) }] } }], usageMetadata: { totalTokenCount: 100 } });

it('Gemini isolates confirmed Chinese/English goal data and has no tools or body/history for understanding', async () => {
  for (const locale of ['zh', 'en'] as const) {
    const body = await codec().encode(await promptRequest(locale, 'understand')) as any;
    expect(JSON.parse(body.contents[0].parts[0].text)).toEqual({ goalText: locale === 'zh' ? '提高一般体能' : 'Improve general fitness', locale });
    expect(body.systemInstruction.parts[0].text).toContain('untrusted');
    expect(body.tools).toBeUndefined();
    expect(body.generationConfig.maxOutputTokens).toBe(2048);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseJsonSchema.required).toEqual(['interpretedGoal']);
  }
});

it('generation includes only the confirmed exact dates and reuses four-metric validation', async () => {
  const request = await promptRequest('zh');
  const body = await codec().encode(request) as any;
  const data = JSON.parse(body.contents[0].parts[0].text);
  expect(data.dates).toEqual(['2026-10-06']); expect(data.history).toBeUndefined();
  expect(data.requestId).toBeUndefined(); expect(data.sendConfirmation).toBeUndefined();
  const decoded = codec().decode(envelope(fourMetricCandidate()));
  expect(validateCandidate(request, decoded.result)).toEqual(fourMetricCandidate());
  expect(decoded.actualCost).toBeUndefined(); // Tokens are not a verified RMB bill.
  const invalid = fourMetricCandidate(); invalid.days[0].date = '2026-10-07';
  expect(() => validateCandidate(request, codec().decode(envelope(invalid)).result)).toThrow('INVALID_CANDIDATE');
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
    calls++; captured = new Request(input, init); return new Response(JSON.stringify(envelope({ interpretedGoal: 'General fitness' })));
  });
  expect((await supplier.call(await promptRequest('en', 'understand'))).result).toEqual({ interpretedGoal: 'General fitness' });
  expect(calls).toBe(1); expect(captured!.headers.get('x-goog-api-key')).toBe(config.apiKey);
  expect(captured!.headers.has('authorization')).toBe(false);
  expect(captured!.url).not.toContain(config.apiKey); expect(await captured!.text()).not.toContain(config.apiKey);
  const failed = createSupplierTransport(config, codec(), async () => { calls++; return new Response('private error', { status: 429 }); });
  await expect(failed.call(await promptRequest('en', 'understand'))).rejects.toThrow('SUPPLIER_UNCERTAIN'); expect(calls).toBe(2);
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
      calls++; return new Response(JSON.stringify(envelope({ interpretedGoal: 'General fitness' })));
    });
    const service = new ControlService(store, config, supplier);
    const session = await service.redeem((await service.issue(config.adminSecret)).code);
    const request = await promptRequest('en', 'understand');
    await expect(service.submit(session.token, request)).rejects.toMatchObject({ code: 'AI_DISABLED' }); expect(calls).toBe(0);
    await service.enableSupplier(config.adminSecret, true);
    await expect(service.submit(session.token, request)).rejects.toMatchObject({ code: 'ACCOUNTING_PENDING' });
    await expect(service.submit(session.token, request)).rejects.toMatchObject({ code: 'REQUEST_IN_PROGRESS' }); expect(calls).toBe(1);
    const state = await store.read(); expect(Object.values(state.requests)[0].status).toBe('pending');
    expect(Object.values(state.budgets)[0].reserved).toBe(config.requestBounds.understand);
    expect(JSON.stringify(state)).not.toContain('General fitness'); expect(JSON.stringify(state)).not.toContain('totalTokenCount');
  } finally { store.close(); }
});

it('optional failure diagnostics reveal only stage/status and never raw errors, keys or response bodies', async () => {
  const events: unknown[] = [];
  const config = { endpoint: geminiEndpoint('gemini-fixture'), allowedOrigin: 'https://generativelanguage.googleapis.com',
    apiKey: 'k'.repeat(40), timeoutMs: 1000, maxResponseBytes: 4096, onFailure: (event: unknown) => { events.push(event); } };
  for (const response of [new Response('private supplier detail', { status: 429 }), new Response('private malformed output', { status: 200 })]) {
    const supplier = createSupplierTransport(config, codec(), async () => response);
    await expect(supplier.call(await promptRequest('en', 'understand'))).rejects.toThrow('SUPPLIER_UNCERTAIN');
  }
  expect(events).toEqual([{ stage: 'http', httpStatus: 429 }, { stage: 'decode', httpStatus: 200 }]);
  expect(JSON.stringify(events)).not.toContain(config.apiKey); expect(JSON.stringify(events)).not.toContain('private');
});

it('Gemini schema preserves four distinct metrics using supported enum and inclusive integer bounds', async () => {
  const request = await promptRequest('en');
  const body = await codec().encode(request) as any;
  const schema = body.generationConfig.responseJsonSchema;
  const branches = schema.properties.days.items.properties.exercises.items.properties.targetSets.items.anyOf;
  expect(branches.map((branch: any) => branch.properties.metricType.enum)).toEqual([['reps_load'], ['reps'], ['duration'], ['duration_distance']]);
  expect(branches[0].properties.reps.minimum).toBe(1);
  expect(branches[0].properties.reps.maximum).toBeUndefined();
  expect(branches[0].properties.loadGrams.minimum).toBe(0);
  expect(JSON.stringify(schema)).not.toMatch(/"const"|"exclusiveMinimum"|"pattern"/);
  const invalid = fourMetricCandidate(); const set = invalid.days[0].exercises[0].targetSets[0];
  if ('reps' in set) set.reps = 0;
  expect(() => validateCandidate(request, invalid)).toThrow('INVALID_CANDIDATE');
  const unsafe = fourMetricCandidate(); const unsafeSet = unsafe.days[0].exercises[0].targetSets[0];
  if ('loadGrams' in unsafeSet) unsafeSet.loadGrams = Number.MAX_SAFE_INTEGER + 1;
  expect(() => validateCandidate(request, unsafe)).toThrow('INVALID_CANDIDATE');
});

it('avoids the provider-rejected nested array upper bound while retaining the local 32-exercise limit', async () => {
  const request = await promptRequest('en');
  const body = await codec().encode(request) as any;
  const exerciseHint = body.generationConfig.responseJsonSchema.properties.days.items.properties.exercises;
  expect(exerciseHint.maxItems).toBeUndefined();
  expect(exerciseHint.minItems).toBe(1);
  const candidate = fourMetricCandidate();
  candidate.days[0].exercises = Array.from({ length: 33 }, (_, order) => ({ ...candidate.days[0].exercises[0], order }));
  expect(() => validateCandidate(request, candidate)).toThrow('INVALID_CANDIDATE');
});
