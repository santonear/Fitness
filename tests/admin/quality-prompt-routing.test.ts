import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminDatabase } from '../../src/backend/admin/core/contracts';
const calls = vi.hoisted(() => ({ codec: vi.fn(), forward: vi.fn() }));
vi.mock('../../src/backend/worker', () => ({
  createWorker: (options: unknown) => {
    calls.codec(options);
    return { fetch: calls.forward };
  },
}));
import { createDeepSeekWorker } from '../../src/backend/deepseek-worker';
const origin = 'https://app.test';
function database(version: string | null = 'v8.0.0', unavailable = false) {
  const selected: unknown[][] = [];
  return {
    selected,
    db: {
      prepare: () => ({
        bind(...values: unknown[]) {
          selected.push(values);
          return this;
        },
        async first() {
          if (unavailable) throw Error('database offline');
          return version ? { version } : null;
        },
      }),
    } as unknown as AdminDatabase,
  };
}
function request(path: string, body: unknown) {
  return new Request(origin + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, authorization: 'Bearer preserved' },
    body: JSON.stringify(body),
  });
}
describe('managed prompt task routing', () => {
  beforeEach(() => {
    calls.codec.mockClear();
    calls.forward.mockReset();
    calls.forward.mockImplementation(async (req: Request, env: unknown) =>
      Response.json({ body: await req.json(), authorization: req.headers.get('authorization'), env }),
    );
  });
  it.each(['ONBOARD_PLAN', 'ADJUST_TODAY', 'MODIFY_PLAN', 'PERIOD_REVIEW'])(
    'selects the registered old prompt for %s and preserves the complete downstream body',
    async task => {
      const { db, selected } = database();
      const path = task === 'PERIOD_REVIEW' ? '/api/v1/stages/summarize' : '/api/v1/plans/generate';
      const body = {
        operation: task === 'PERIOD_REVIEW' ? 'summary' : 'generate',
        coach: { task, synthetic: 'fixture' },
        requestId: 'synthetic-request',
      };
      const response = await createDeepSeekWorker().fetch(request(path, body), {
        ADMIN_CONSOLE_ENABLED: 'true',
        ADMIN_ENVIRONMENT: 'preview',
        ADMIN_DB: db,
      });
      expect(response.status).toBe(200);
      expect(selected).toEqual([['preview', task]]);
      expect(await response.json()).toMatchObject({
        body,
        authorization: 'Bearer preserved',
        env: { FITNESS_COACH_PROMPT_RELEASE: 'v8.0.0' },
      });
      expect(calls.codec).toHaveBeenCalledTimes(1);
    },
  );
  it('keeps the old configured version without accessing management when the console is off', async () => {
    const { db, selected } = database();
    const response = await createDeepSeekWorker().fetch(
      request('/api/v1/stages/summarize', { coach: { task: 'PERIOD_REVIEW' } }),
      { ADMIN_CONSOLE_ENABLED: 'false', ADMIN_DB: db, FITNESS_COACH_PROMPT_RELEASE: 'v8.0.0' },
    );
    expect(response.status).toBe(200);
    expect(selected).toEqual([]);
    expect((await response.json()).env.FITNESS_COACH_PROMPT_RELEASE).toBe('v8.0.0');
  });
  it('rejects malformed JSON and mismatched task paths before codec or provider invocation', async () => {
    const worker = createDeepSeekWorker();
    expect(
      (await worker.fetch(new Request(origin + '/api/v1/plans/generate', { method: 'POST', body: '{broken' }), {}))
        .status,
    ).toBe(400);
    expect(
      (await worker.fetch(request('/api/v1/plans/generate', { coach: { task: 'PERIOD_REVIEW' } }), {})).status,
    ).toBe(400);
    expect(
      (await worker.fetch(request('/api/v1/stages/summarize', { coach: { task: 'ONBOARD_PLAN' } }), {})).status,
    ).toBe(400);
    expect(calls.codec).not.toHaveBeenCalled();
    expect(calls.forward).not.toHaveBeenCalled();
  });
  it('counts streamed bytes rather than Content-Length and cancels oversized source input', async () => {
    let cancelled = false;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(65537));
      },
      cancel() {
        cancelled = true;
      },
    });
    const req = new Request(origin + '/api/v1/stages/summarize', {
      method: 'POST',
      headers: { 'Content-Length': '1' },
      body: stream,
      duplex: 'half',
    } as RequestInit);
    expect((await createDeepSeekWorker().fetch(req, {})).status).toBe(413);
    expect(cancelled).toBe(true);
    expect(calls.forward).not.toHaveBeenCalled();
  });
  it('allows an exact 65536-byte legacy body to reach the existing request validator', async () => {
    const body = JSON.stringify({ text: 'x'.repeat(65525) });
    expect(new TextEncoder().encode(body).length).toBe(65536);
    const response = await createDeepSeekWorker().fetch(
      new Request(origin + '/api/v1/plans/generate', { method: 'POST', body }),
      {},
    );
    expect(response.status).toBe(200);
    expect((await response.json()).body).toEqual(JSON.parse(body));
  });
  it('fails closed on missing or broken managed configuration and unregistered versions', async () => {
    for (const db of [undefined, database('v8.0.0', true).db, database('v999').db]) {
      const response = await createDeepSeekWorker().fetch(
        request('/api/v1/stages/summarize', { coach: { task: 'PERIOD_REVIEW' } }),
        { ADMIN_CONSOLE_ENABLED: 'true', ADMIN_ENVIRONMENT: 'preview', ADMIN_DB: db },
      );
      expect(response.status).toBe(503);
    }
    expect(calls.forward).not.toHaveBeenCalled();
  });
});
