import { expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteControlStore } from '../../src/backend/sqlite-store';
import { D1ControlStore, type D1Binding, type D1Statement } from '../../src/backend/d1-store';
import { initialState } from '../../src/backend/store';
import { ControlService, testConfig } from '../../src/backend/control';
import { confirmationFor } from '../../src/backend/contracts';
import { MAX_LEDGER_JSON_BYTES, serializeLedger } from '../../src/backend/ledger-capacity';

it('SQLite transaction rolls back entire control state on callback failure and persists committed metadata', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'fitness-backend-test-')); const path = join(directory, 'control.sqlite');
  const store = new SqliteControlStore(path);
  try {
    await expect(store.transact(state => { state.aiEnabled = true; state.budgets['2026-01'] = { spent: 10, reserved: 20 }; throw new Error('failure'); })).rejects.toThrow('failure');
    expect(await store.read()).toEqual(initialState());
    await store.transact(state => { state.budgets['2026-01'] = { spent: 10, reserved: 20 }; });
    const second = new SqliteControlStore(path);
    try { expect((await second.read()).budgets['2026-01']).toEqual({ spent: 10, reserved: 20 }); }
    finally { second.close(); }
  } finally { store.close(); rmSync(directory, { recursive: true }); }
});

// Protocol simulator only: these results do not verify Cloudflare D1 consistency/transactions.
it('D1 CAS zero changes never grants authority; retries reread the authoritative revision', async () => {
  let revision = 0; let state = initialState(); let misses = 1; let calls = 0;
  const binding: D1Binding = { withSession: mode => {
    expect(mode).toBe('first-primary');
    return { prepare: sql => {
      let values: unknown[] = [];
      const statement: D1Statement = {
        bind: (...args) => { values = args; return statement; },
        first: async <T>() => ({ state: JSON.stringify(state), revision }) as T,
        run: async () => {
          calls++; expect(sql).toContain('revision=?');
          if (misses-- > 0) { revision++; state.budgets['2026-01'] = { spent: 35, reserved: 0 }; return { success: true, meta: { changes: 0 } }; }
          if (values[1] !== revision) return { success: true, meta: { changes: 0 } };
          state = JSON.parse(values[0] as string); revision++; return { success: true, meta: { changes: 1 } };
        },
      }; return statement;
    } };
  } };
  const store = new D1ControlStore(binding);
  const authorized = await store.transact(ledger => {
    const remaining = 100 - (ledger.budgets['2026-01']?.spent ?? 0);
    ledger.aiEnabled = true; return remaining;
  });
  expect(authorized).toBe(65); expect(calls).toBe(2);
  misses = 100;
  await expect(store.transact(ledger => { ledger.aiEnabled = true; return 'must not grant'; })).rejects.toMatchObject({ code: 'CONTROL_CONTENTION' });
});

it('separate SQLite connections share atomic budget admission without partial quota occupation', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'fitness-backend-concurrency-')); const path = join(directory, 'control.sqlite');
  const one = new SqliteControlStore(path), two = new SqliteControlStore(path); let calls = 0;
  const config = { ...testConfig, budgetLimit: 100 }; const now = () => Date.parse('2026-01-01T00:00:00Z');
  const supplier = { kind: 'local-mock' as const, call: async () => { calls++; return { result: { interpretedGoal: 'ok' }, actualCost: 100 }; } };
  const a = new ControlService(one, config, supplier, now), b = new ControlService(two, config, supplier, now);
  try {
    const invite = await a.issue(config.adminSecret), session = await a.redeem(invite.code); await a.enableMock(config.adminSecret, true);
    const request = async () => {
      const base = { operation: 'understand', contractVersion: 1, requestId: crypto.randomUUID(), goalText: 'synthetic', locale: 'en', restoreGeneration: 0 };
      return { ...base, sendConfirmation: await confirmationFor(base) };
    };
    const results = await Promise.allSettled([a.submit(session.token, await request()), b.submit(session.token, await request())]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1); expect(calls).toBe(1);
    const state = await two.read(); expect(state.budgets['2026-01']).toEqual({ spent: 100, reserved: 0 });
    expect(state.usages[`${session.subjectId}:2026-01`].understand).toBe(1);
  } finally { one.close(); two.close(); rmSync(directory, { recursive: true }); }
});

it('ledger capacity measures UTF8 at exact candidate boundary and rejects one byte over', () => {
  const state = initialState(); state.audit.push({ at: 1, event: '训练' });
  const baseBytes = new TextEncoder().encode(JSON.stringify(state)).byteLength;
  state.audit[0].event += 'x'.repeat(MAX_LEDGER_JSON_BYTES - baseBytes);
  expect(new TextEncoder().encode(serializeLedger(state)).byteLength).toBe(1_900_000);
  state.audit[0].event += 'x'; expect(() => serializeLedger(state)).toThrowError('CONTROL_CAPACITY_EXHAUSTED');
});

it('capacity rejection rolls back reservation and never calls supplier', async () => {
  const store = new SqliteControlStore(':memory:', 2000); let calls = 0;
  const service = new ControlService(store, testConfig, { kind: 'local-mock', call: async () => { calls++; return { result: { interpretedGoal: 'ok' }, actualCost: 10 }; } });
  try {
    const invite = await service.issue(testConfig.adminSecret), session = await service.redeem(invite.code); await service.enableMock(testConfig.adminSecret, true);
    await store.transact(state => {
      state.audit.push({ at: 1, event: '' });
      const size = new TextEncoder().encode(JSON.stringify(state)).byteLength;
      state.audit[state.audit.length - 1].event = 'x'.repeat(2000 - size);
    });
    const before = await store.read();
    const base = { operation: 'understand', contractVersion: 1, requestId: crypto.randomUUID(), goalText: 'synthetic', locale: 'en', restoreGeneration: 0 };
    await expect(service.submit(session.token, { ...base, sendConfirmation: await confirmationFor(base) })).rejects.toMatchObject({ code: 'CONTROL_CAPACITY_EXHAUSTED' });
    expect(calls).toBe(0); expect(await store.read()).toEqual(before);
  } finally { store.close(); }
});
