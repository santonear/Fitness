import { DatabaseSync } from 'node:sqlite';
import { expect, it, vi } from 'vitest';
import { DailyUsageStore, dailyUsageDDL, withDailyUsage } from '../../src/backend/daily-usage-store';
import type { D1Binding, D1Statement } from '../../src/backend/d1-store';
import { TelemetryStore, telemetryDDL } from '../../src/backend/telemetry-store';

function memoryStore() {
  const db = new DatabaseSync(':memory:'); db.exec(dailyUsageDDL); db.exec(telemetryDDL);
  const binding: D1Binding = {withSession:() => ({prepare(sql:string) {
    let values: (string|number)[] = [];
    const statement: D1Statement = {bind(...args:unknown[]) {values = args as (string|number)[];return statement;},
      async first<T>() {return (db.prepare(sql).get(...values) ?? null) as T|null;},
      async run() {return {success:true,meta:{changes:Number(db.prepare(sql).run(...values).changes)}};}};
    return statement;
  }})};
  return {store:new DailyUsageStore(binding),telemetry:new TelemetryStore(binding),close:() => db.close()};
}
it('aggregates batched anonymous counts by UTC day and rejects extra sensitive data',async () => {
  const {telemetry,close} = memoryStore();
  try {
    await telemetry.count('2026-10-11',{optedIn:true,event:'workout_completed',count:3},'counts');
    await telemetry.count('2026-10-11',{optedIn:true,event:'workout_completed'},'counts');
    expect((await telemetry.usage('2026-10-11')).counts.workout_completed).toBe(4);
    await expect(telemetry.count('2026-10-11',{optedIn:true,event:'workout_completed',count:1001},'counts')).rejects.toThrow();
    await expect(telemetry.count('2026-10-11',{optedIn:true,event:'workout_completed',userId:'private'},'counts')).rejects.toThrow();
    await expect(telemetry.count('2026-10-11',{type:'network',page:'plan',version:'v8',browser:'safari',message:'private'},'errors')).rejects.toThrow();
  } finally {close();}
});
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
