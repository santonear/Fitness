import { DatabaseSync } from 'node:sqlite';
import { expect, it, vi } from 'vitest';
import { DailyUsageStore, dailyUsageDDL, withDailyUsage } from '../../src/backend/daily-usage-store';
import type { D1Binding, D1Statement } from '../../src/backend/d1-store';

function memoryStore() {
  const db = new DatabaseSync(':memory:'); db.exec(dailyUsageDDL);
  const binding: D1Binding = {withSession:() => ({prepare(sql:string) {
    let values: (string|number)[] = [];
    const statement: D1Statement = {bind(...args:unknown[]) {values = args as (string|number)[];return statement;},
      async first<T>() {return (db.prepare(sql).get(...values) ?? null) as T|null;},
      async run() {return {success:true,meta:{changes:Number(db.prepare(sql).run(...values).changes)}};}};
    return statement;
  }})};
  return {store:new DailyUsageStore(binding),close:() => db.close()};
}
it('atomically aggregates UTC calls, reservations and actual fees without overspending',async () => {
  const {store,close} = memoryStore();
  try {
    const attempts = await Promise.allSettled(Array.from({length:3},() => store.reserve('2026-10-11',40,{calls:3,costFen:100})));
    expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(2);
    expect(await store.get('2026-10-11')).toEqual({day:'2026-10-11',calls:2,costFen:0,reservedFen:80});
    await store.settle('2026-10-11',40,10);
    expect((await store.get('2026-10-11')).reservedFen).toBe(40);
    expect((await store.get('2026-10-11')).costFen).toBe(10);
    await store.reserve('2026-10-12',40,{calls:1,costFen:40});
    expect((await store.get('2026-10-12')).calls).toBe(1);
  } finally {close();}
});
it('retains unknown fees and refuses missing bounds before contacting supplier', async () => {
  const {store,close} = memoryStore();
  try {
    const call = vi.fn(async () => ({result:{}}));
    const wrapped = withDailyUsage({kind:'external-transport',call,costUpperBoundFen:() => 30},store,{calls:2,costFen:60},() => new Date('2026-10-11T23:59:00Z'));
    await wrapped.call({} as never);
    expect((await store.get('2026-10-11')).reservedFen).toBe(30);
    const missing = withDailyUsage({kind:'external-transport',call},store,{calls:2,costFen:60});
    await expect(missing.call({} as never)).rejects.toThrow('DAILY_USAGE_FALLBACK');
    expect(call).toHaveBeenCalledTimes(1);
  } finally {close();}
});
