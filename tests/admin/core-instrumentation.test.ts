import {describe,it,expect,vi} from 'vitest';
import {initialState,type ControlStore} from '../../src/backend/store';
import {trackFinanceChanges,syncFinanceMetadata} from '../../src/backend/admin/core/instrumentation';
import type {AdminDatabase} from '../../src/backend/admin/core/contracts';
import {idempotentAdminStore} from '../../src/backend/admin/core/idempotent-store';
const {record}=vi.hoisted(()=>({record:vi.fn(async()=>{})}));
vi.mock('../../src/backend/admin/finance',()=>({recordFinanceEvent:record}));
describe('finance metadata projection',()=>{
 it('preserves replay values when finance tracking sits inside receipt storage',async()=>{
  const state=initialState();const base:ControlStore={read:async()=>structuredClone(state),transact:async change=>change(state)};
  const tracked=trackFinanceChanges(base);const store=idempotentAdminStore(tracked.store,'operation','fingerprint','owner');
  const action=vi.fn(()=>({id:'10000000-0000-4000-8000-000000000001',state:'approved'}));
  expect(await store.transact(action)).toEqual(await store.transact(action));expect(action).toHaveBeenCalledTimes(1);
  expect(state.adminReceipts?.operation.value).toEqual({id:'10000000-0000-4000-8000-000000000001',state:'approved'});
 });
 it('records only committed changed requests and never invents dates for old records',async()=>{
  const state=initialState();const r={subjectId:'s',requestId:'r',inputDigest:'private',operation:'generate' as const,period:'2026-10',bound:300,status:'reserved' as const,cancelled:false};
  state.requests.old={...r};state.requests.new={...r,createdAt:Date.UTC(2026,9,11)};
  const store:ControlStore={read:async()=>structuredClone(state),transact:async change=>change(state)};
  const tracked=trackFinanceChanges(store);
  await tracked.store.read();expect(tracked.changed.size).toBe(0);
  await tracked.store.transact(s=>{s.requests.new.status='submitted';s.requests.old.status='submitted'});
  expect([...tracked.changed]).toEqual(['new']);
  record.mockClear();await syncFinanceMetadata(store,{} as AdminDatabase,tracked.changed);
  expect(record).toHaveBeenCalledTimes(1);expect(record.mock.calls[0]).toBeDefined();
  expect(record).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({day:'2026-10-11',status:'pending',costFen:0,reservedFen:300}));
  state.requests.new.status='released';record.mockClear();await syncFinanceMetadata(store,{} as AdminDatabase,['new']);
  expect(record).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({status:'released',costFen:0,reservedFen:0}));
 });
 it('does not treat a reservation or empty read as a supplier call',async()=>{
  const read=vi.fn(async()=>initialState());record.mockClear();await syncFinanceMetadata({read,transact:vi.fn()},{} as AdminDatabase,[]);expect(read).not.toHaveBeenCalled();expect(record).not.toHaveBeenCalled();
 });
});
