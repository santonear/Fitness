import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { provisionOperations } from '../../tools/release/provision-ops.mjs';

const env = {
  GITHUB_ACTIONS: 'true',
  GITHUB_REF: 'refs/heads/main',
  CLOUDFLARE_API_TOKEN: 'synthetic-only',
  CLOUDFLARE_ACCOUNT_ID: 'synthetic-only',
};
const id = '11111111-1111-4111-8111-111111111111';
const original = readFileSync('wrangler.production.jsonc', 'utf8');

it('resolves only the separate operations binding and applies only its migrations', () => {
  const run = vi.fn(args => (args[1] === 'list' ? JSON.stringify([{ name: 'fitness-ops-production', uuid: id }]) : ''));
  const write = vi.fn();
  provisionOperations({ env, run, read: () => original, write });
  const result = JSON.parse(write.mock.calls[0][1]),
    before = JSON.parse(original);
  expect(result.d1_databases.find(db => db.binding === 'FITNESS_OPS_DB').database_id).toBe(id);
  delete result.d1_databases.find(db => db.binding === 'FITNESS_OPS_DB').database_id;
  expect(result).toEqual(before);
  expect(run.mock.calls.map(([args]) => args)).toEqual([
    ['d1', 'list', '--json'],
    ['d1', 'migrations', 'apply', 'FITNESS_OPS_DB', '--remote', '--config', 'wrangler.production.jsonc'],
  ]);
});

it('creates a missing database once, never overwrites control or admin data', () => {
  let lists = 0;
  const run = vi.fn(args =>
    args[1] === 'list' ? JSON.stringify(++lists === 1 ? [] : [{ name: 'fitness-ops-production', uuid: id }]) : '',
  );
  provisionOperations({ env, run, read: () => original, write: vi.fn() });
  expect(run.mock.calls.filter(([args]) => args[1] === 'create')).toEqual([
    [['d1', 'create', 'fitness-ops-production', '--update-config=false']],
  ]);
});

it('refuses local runs and unverified database identities before writing config', () => {
  const run = vi.fn(),
    write = vi.fn();
  expect(() => provisionOperations({ env: {}, run, write })).toThrow('Protected main');
  expect(run).not.toHaveBeenCalled();
  expect(() =>
    provisionOperations({
      env,
      read: () => original,
      run: () => JSON.stringify([{ name: 'fitness-ops-production', uuid: 'not-an-id' }]),
      write,
    }),
  ).toThrow('identity not verified');
  expect(write).not.toHaveBeenCalled();
});

it('operations migration is idempotent and preserves existing statistics', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const sql = readFileSync('migrations/ops/0001_daily_usage.sql', 'utf8');
    db.exec(sql);
    db.exec("INSERT INTO ops_daily_usage VALUES('2026-10-19',2,3,4)");
    db.exec(sql);
    expect({ ...db.prepare('SELECT * FROM ops_daily_usage').get() }).toEqual({
      day: '2026-10-19',
      calls: 2,
      cost_fen: 3,
      reserved_fen: 4,
    });
  } finally {
    db.close();
  }
});
