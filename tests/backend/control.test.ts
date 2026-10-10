import { afterEach, describe, expect, it } from 'vitest';
import { ControlService, testConfig } from '../../src/backend/control';
import { SqliteControlStore } from '../../src/backend/sqlite-store';
import { digest, confirmationFor, goalConfirmationFor } from '../../src/backend/contracts';
import { createHandler } from '../../src/backend/http';
import { EXERCISE_IDS } from '../../src/catalog/exercise-ids';
import { currentCoachEnvelope, currentCoachRefusal } from '../fixtures/current-coach-envelope';

const stores: SqliteControlStore[] = [];
async function newCoachRequest(){const r=await currentCoachEnvelope();r.requestId=crypto.randomUUID();r.coach.requestId=r.requestId;r.coach.sendConfirmation=await confirmationFor(r.coach);r.sendConfirmation=await confirmationFor(r);return r;}
afterEach(() => stores.splice(0).forEach(store => store.close()));
const input = () => ({ contractVersion: 1 as const, requestId: crypto.randomUUID(), operation: 'understand' as const,
  goalText: 'synthetic goal 私密目标', locale: 'en' as const, restoreGeneration: 2 });
async function setup(overrides = {}, supplier: (_value: unknown) => Promise<{ result: unknown; actualCost?: number }> = async () => ({ result: { interpretedGoal: 'synthetic interpretation' }, actualCost: 10 })) {
  const store = new SqliteControlStore(':memory:'); stores.push(store);
  let now = Date.parse('2026-01-31T23:59:00Z'); let calls = 0;
  const service = new ControlService(store, { ...testConfig, ...overrides }, { kind: 'local-mock', call: async value => { calls++; return supplier(value); } }, () => now);
  const admin = testConfig.adminSecret;
  const invite = await service.issue(admin); const session = await service.redeem(invite.code);
  const request = async () => { const value = input(); return { ...value, sendConfirmation: await confirmationFor(value) }; };
  return { store, service, admin, invite, session, request, calls: () => calls, time: (value: string) => { now = Date.parse(value); } };
}

describe('BE local control', () => {
  it('approved unlimited planning keeps uncertain records but admits a different request and subject',async()=>{
    let first=true;const f=await setup({planningBudgetDisabled:true,allowUncertainPlanningPending:true},async(value:any)=>{if(first){first=false;throw Error('uncertain');}return {result:{...currentCoachRefusal,requestId:value.requestId}};});
    await f.service.enableMock(f.admin,true);const failed=await newCoachRequest();
    await expect(f.service.submit(f.session.token,failed)).rejects.toMatchObject({code:'ACCOUNTING_PENDING'});
    const before=Object.values((await f.store.read()).requests)[0];
    expect(await f.service.status(f.session.token)).toMatchObject({reconciliationRequired:true,planningReconciliationRequired:false});
    await expect(f.service.submit(f.session.token,failed)).rejects.toMatchObject({code:'REQUEST_IN_PROGRESS'});
    const other=await f.service.redeem((await f.service.issue(f.admin)).code);
    await expect(f.service.submit(other.token,await newCoachRequest())).resolves.toMatchObject({accounting:'pending'});
    expect(Object.values((await f.store.read()).requests)[0]).toEqual(before);expect(before).toMatchObject({status:'pending',error:'SUPPLIER_UNCERTAIN'});expect(before.actualCost).toBeUndefined();expect(f.calls()).toBe(2);
  });
  it.each([{planningBudgetDisabled:true},{planningBudgetDisabled:false,allowUncertainPlanningPending:true}])('does not relax the gate without both explicit settings: %j',async settings=>{
    const f=await setup(settings,async()=>{throw Error('uncertain');});await f.service.enableMock(f.admin,true);
    await expect(f.service.submit(f.session.token,await newCoachRequest())).rejects.toMatchObject({code:'ACCOUNTING_PENDING'});
    await expect(f.service.submit(f.session.token,await newCoachRequest())).rejects.toMatchObject({code:'RECONCILIATION_REQUIRED'});expect(f.calls()).toBe(1);
  });
  it.each([true,false])('approved planning bypass never ignores corrupt accounting, recovery, disabled AI or revoked eligibility (bounded=%s)',async allowBoundedPending=>{
    const f=await setup({planningBudgetDisabled:true,allowUncertainPlanningPending:true,allowBoundedPending},async()=>{throw Error('uncertain');});await f.service.enableMock(f.admin,true);
    await expect(f.service.submit(f.session.token,await newCoachRequest())).rejects.toMatchObject({code:'ACCOUNTING_PENDING'});
    await f.store.transact(s=>{s.budgets['2026-01'].reserved++;});await expect(f.service.submit(f.session.token,await newCoachRequest())).rejects.toMatchObject({code:'RECONCILIATION_REQUIRED'});
    await f.store.transact(s=>{s.budgets['2026-01'].reserved--;});
    await f.store.transact(s=>{s.recoveryRequired=true;});await expect(f.service.submit(f.session.token,await newCoachRequest())).rejects.toMatchObject({code:'RECONCILIATION_REQUIRED'});
    await f.store.transact(s=>{s.recoveryRequired=false;s.aiEnabled=false;});await expect(f.service.submit(f.session.token,await newCoachRequest())).rejects.toMatchObject({code:'AI_DISABLED'});
    await f.store.transact(s=>{s.aiEnabled=true;s.subjects[f.session.subjectId].revoked=true;});await expect(f.service.submit(f.session.token,await newCoachRequest())).rejects.toMatchObject({code:'QUALIFICATION_REQUIRED'});expect(f.calls()).toBe(1);
  });
  it('planning exception does not waive uncertain summary accounting',async()=>{
    const f=await setup({planningBudgetDisabled:true,allowUncertainPlanningPending:true},async()=>{throw Error('uncertain');});await f.service.enableMock(f.admin,true);
    await expect(f.service.submit(f.session.token,await newCoachRequest())).rejects.toMatchObject({code:'ACCOUNTING_PENDING'});
    await f.store.transact(s=>{Object.values(s.requests)[0].operation='summary';});
    await expect(f.service.submit(f.session.token,await newCoachRequest())).rejects.toMatchObject({code:'RECONCILIATION_REQUIRED'});expect(f.calls()).toBe(1);
  });
  it('BE-T01 disables supplier by default, rejects invalid admin and qualification', async () => {
    const f = await setup();
    await expect(f.service.submit(f.session.token, await f.request())).rejects.toMatchObject({ code: 'AI_DISABLED' });
    await expect(f.service.enableMock('wrong', true)).rejects.toMatchObject({ code: 'ADMIN_REQUIRED' });
    await f.service.enableMock(f.admin, true);
    await expect(f.service.submit('wrong', await f.request())).rejects.toMatchObject({ code: 'QUALIFICATION_REQUIRED' });
    await f.service.revoke(f.admin, f.session.subjectId);
    await expect(f.service.submit(f.session.token, await f.request())).rejects.toMatchObject({ code: 'QUALIFICATION_REQUIRED' });
    expect(f.calls()).toBe(0);
  });
  it('BE-T02 redeems once and reissues without extending expiry, resetting quota or pending', async () => {
    const f = await setup(); const invite = await f.service.issue(f.admin);
    const results = await Promise.allSettled([f.service.redeem(invite.code), f.service.redeem(invite.code)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    await f.service.enableMock(f.admin, true); await f.service.submit(f.session.token, await f.request());
    const before = await f.service.status(f.session.token);
    const replacement = await f.service.redeem((await f.service.reissue(f.admin, f.session.subjectId)).code);
    expect((await f.service.status(replacement.token)).expiresAt).toBe(before.expiresAt);
    expect((await f.service.status(replacement.token)).used).toEqual(before.used);
    await expect(f.service.status(f.session.token)).rejects.toMatchObject({ code: 'QUALIFICATION_REQUIRED' });
    f.time('2026-02-08T00:00:00Z');
    const old = await f.service.issue(f.admin); f.time('2026-02-16T00:00:00Z');
    await expect(f.service.redeem(old.code)).rejects.toMatchObject({ code: 'INVITE_INVALID' });
    f.time('2026-03-03T00:00:00Z');
    await expect(f.service.status(replacement.token)).rejects.toMatchObject({ code: 'QUALIFICATION_REQUIRED' });
  });
  it('BE-T03 dedupes concurrent same IDs, conflicts changed input, never replays stored result', async () => {
    let finish!: (value: { result: { interpretedGoal: string }; actualCost: number }) => void;
    const f = await setup({}, () => new Promise(resolve => { finish = resolve; }));
    await f.service.enableMock(f.admin, true); const req = await f.request();
    const first = f.service.submit(f.session.token, req);
    while (!finish) await new Promise(resolve => setTimeout(resolve, 0));
    await expect(f.service.submit(f.session.token, req)).rejects.toMatchObject({ code: 'REQUEST_IN_PROGRESS' });
    const changed = { ...req, goalText: 'changed' }; changed.sendConfirmation = await confirmationFor(changed);
    await expect(f.service.submit(f.session.token, changed)).rejects.toMatchObject({ code: 'REQUEST_CONFLICT' });
    finish({ result: { interpretedGoal: 'ok' }, actualCost: 10 }); await first;
    await expect(f.service.submit(f.session.token, req)).rejects.toMatchObject({ code: 'RESULT_UNAVAILABLE' });
    expect(f.calls()).toBe(1);
  });
  it('BE-T04 reserves atomically before supplier with distinct budget/quota/bound denials', async () => {
    const f = await setup({ budgetLimit: 100, requestBounds: { understand: 100, generate: 200 } }); await f.service.enableMock(f.admin, true);
    const outcomes = await Promise.allSettled([f.service.submit(f.session.token, await f.request()), f.service.submit(f.session.token, await f.request())]);
    expect(outcomes.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(f.calls()).toBe(1);
    expect(outcomes.find(r => r.status === 'rejected')).toMatchObject({ reason: { code: 'GLOBAL_BUDGET_EXHAUSTED' } });
    const q = await setup({ quotas: { understand: 1, generate: 4 } }); await q.service.enableMock(q.admin, true);
    await q.service.submit(q.session.token, await q.request());
    await q.service.submit(q.session.token, await q.request());expect(q.calls()).toBe(2);
    const b = await setup({ maximumRequestCost: 50 }); await b.service.enableMock(b.admin, true);
    await expect(b.service.submit(b.session.token, await b.request())).rejects.toMatchObject({ code: 'REQUEST_COST_BOUND' });
  });
  it('BE-T05 uncertainty survives cancellation, month boundary, reissue and duplicate settlement', async () => {
    let reject!: (reason: Error) => void;
    const f = await setup({}, () => new Promise((_resolve, no) => { reject = no; })); await f.service.enableMock(f.admin, true);
    const req = await f.request(); const first = f.service.submit(f.session.token, req);
    while (!reject) await new Promise(resolve => setTimeout(resolve, 0));
    await f.service.cancel(f.session.token, req.requestId); reject(new Error('private upstream text'));
    await expect(first).rejects.toMatchObject({ code: 'ACCOUNTING_PENDING' });
    f.time('2026-02-01T00:01:00Z');
    await expect(f.service.submit(f.session.token, await f.request())).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
    const next = await f.service.redeem((await f.service.reissue(f.admin, f.session.subjectId)).code);
    await f.service.settle(f.admin, f.session.subjectId, req.requestId, 20);
    await f.service.settle(f.admin, f.session.subjectId, req.requestId, 20);
    await expect(f.service.settle(f.admin, f.session.subjectId, req.requestId, 21)).rejects.toMatchObject({ code: 'SETTLEMENT_CONFLICT' });
    const state = await f.store.read(); expect(state.budgets['2026-01'].spent).toBe(20); expect(state.budgets['2026-01'].reserved).toBe(0);
    expect((await f.service.status(next.token)).used.understand).toBe(0);
  });
  it('BE-T06/T07 rejects unconfirmed and changed payloads, exact dates and catalogue metrics', async () => {
    const f = await setup(); await f.service.enableMock(f.admin, true);
    const req = await f.request();
    await expect(f.service.submit(f.session.token, { ...req, goalText: 'changed' })).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });
    await expect(f.service.submit(f.session.token, { ...req, history: 'unexpected' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(f.calls()).toBe(0);
    const candidate = { days: [{ date: '2026-02-05', exercises: [{ exerciseId: EXERCISE_IDS.walking, order: 0, targetSets: [{ metricType: 'reps', reps: 10 }] }] }] };
    const g = await setup({ k: 2 }, async () => ({ result: candidate, actualCost: 10 })); await g.service.enableMock(g.admin, true);
    const base = { ...input(), operation: 'generate' as const, confirmedGoal: 'agreed', dates: ['2026-02-05', '2026-03-01'], timeZone: 'UTC', catalogVersion: 1, conditions: {} };
    const generate = { ...base, goalConfirmation: await goalConfirmationFor(base), sendConfirmation: await confirmationFor(base) };
    await expect(g.service.submit(g.session.token, generate)).rejects.toMatchObject({ code: 'INVALID_CANDIDATE' });
    expect(g.calls()).toBe(1);
  });
  it('BE-T08 stale restore generation rejects candidate application without supplier retry', async () => {
    const f = await setup(); await f.service.enableMock(f.admin, true); const response = await f.service.submit(f.session.token, await f.request());
    expect(() => f.service.assertApplicable(response.context, 3)).toThrowError('STALE_RESTORE_GENERATION'); expect(f.calls()).toBe(1);
  });
  it('BE-T09 persists control metadata only, keyed digests and no error or result body', async () => {
    const f = await setup(); await f.service.enableMock(f.admin, true); await f.service.submit(f.session.token, await f.request());
    const data = JSON.stringify(await f.store.read());
    for (const sensitive of ['私密目标', 'synthetic interpretation', f.invite.code, f.session.token, testConfig.adminSecret]) expect(data).not.toContain(sensitive);
    expect(await digest('a', 'one')).not.toBe(await digest('a', 'two'));
  });
  it('BE-T13 HTTP exact origins, secure cookies, JSON404 and protected admin', async () => {
    const f = await setup(); const handler = createHandler(f.service, { origins: ['https://local.test'], maxBodyBytes: 20000 });
    expect((await handler(new Request('https://local.test/api/nope'))).status).toBe(404);
    const code = (await f.service.issue(f.admin)).code;
    expect((await handler(new Request('https://local.test/api/v1/trial/redeem', { method: 'POST', headers: { Origin: 'https://evil.test', 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) }))).status).toBe(403);
    const redeemed = await handler(new Request('https://local.test/api/v1/trial/redeem', { method: 'POST', headers: { Origin: 'https://local.test', 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) }));
    expect(redeemed.headers.get('set-cookie')).toMatch(/__Host-fitness_trial=.*; Path=\/; Secure; HttpOnly; SameSite=Strict/);
    expect(JSON.stringify(await redeemed.json())).not.toContain('token');
    expect((await handler(new Request('https://local.test/api/v1/admin/invites', { method: 'POST', headers: { Origin: 'https://local.test', 'Content-Type': 'application/json' }, body: '{}' }))).status).toBe(401);
  });
  it('BE-T14 restored ledger remains paused until pending entries reconciled and explicit reopen', async () => {
    const f = await setup(); await f.service.enableMock(f.admin, true);
    await f.service.markLedgerRecovered(f.admin);
    await expect(f.service.submit(f.session.token, await f.request())).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
    await expect(f.service.enableMock(f.admin, true)).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
    await f.service.confirmReconciled(f.admin, { budgets: { '2026-01': 0 }, usages: { [`${f.session.subjectId}:2026-01`]: { understand: 0, generate: 0, summary: 0 } } }); await f.service.enableMock(f.admin, true);
    await f.service.submit(f.session.token, await f.request()); expect(f.calls()).toBe(1);
  });
  it('BE-T06 accepts sparse exact date sets beyond 12 weeks and rejects independent metric mismatch', async () => {
    const dates = ['2026-02-05', '2027-06-01'];
    const candidate = { days: dates.map(date => ({ date, exercises: [{ exerciseId: EXERCISE_IDS.walking, order: 0,
      targetSets: [{ metricType: 'duration_distance', durationSeconds: 10, distanceMeters: 0 }] }] })) };
    const f = await setup({ k: 2 }, async () => ({ result: candidate, actualCost: 10 })); await f.service.enableMock(f.admin, true);
    const generate = async (selectedDates: string[], overrides = {}) => {
      const base = { ...input(), operation: 'generate' as const, confirmedGoal: 'confirmed', dates: selectedDates, timeZone: 'Asia/Shanghai', catalogVersion: 1, conditions: {}, ...overrides };
      return { ...base, goalConfirmation: await goalConfirmationFor(base), sendConfirmation: await confirmationFor(base) };
    };
    expect((await f.service.submit(f.session.token, await generate(dates))).result).toEqual(candidate);
    await expect(f.service.submit(f.session.token, await generate([...dates, '2027-06-02']))).rejects.toMatchObject({ code: 'DATE_BOUND_EXCEEDED' });
    await expect(f.service.submit(f.session.token, await generate([dates[0], dates[0]]))).rejects.toMatchObject({ code: 'DUPLICATE_DATE' });
    const wrongGoal = await generate(dates); wrongGoal.goalConfirmation = '0'.repeat(64);
    await expect(f.service.submit(f.session.token, wrongGoal)).rejects.toMatchObject({ code: 'GOAL_CONFIRMATION_REQUIRED' });
    candidate.days[0].exercises[0].targetSets = [{ metricType: 'reps', reps: 10 }] as never;
    await expect(f.service.submit(f.session.token, await generate(dates))).rejects.toMatchObject({ code: 'INVALID_CANDIDATE' });
    expect(f.calls()).toBe(2);
  });
  it('BE-T05 missing cost delivers candidate but remains reserved indefinitely until reconciled, no auto retry', async () => {
    const f = await setup({}, async () => ({ result: { interpretedGoal: 'private' } })); await f.service.enableMock(f.admin, true);
    const req = await f.request();
    await expect(f.service.submit(f.session.token, req)).resolves.toMatchObject({ accounting: 'pending', result: { interpretedGoal: 'private' } });
    const before = await f.store.read(); f.time('2026-02-10T00:00:00Z');
    expect((await f.store.read()).budgets).toEqual(before.budgets);
    await expect(f.service.submit(f.session.token, req)).rejects.toMatchObject({ code: 'REQUEST_IN_PROGRESS' });
    expect(f.calls()).toBe(1);
    await f.service.markLedgerRecovered(f.admin);
    await expect(f.service.confirmReconciled(f.admin, { budgets: { '2026-02': 0 }, usages: {} })).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
    await f.service.settle(f.admin, f.session.subjectId, req.requestId, 80); await f.service.confirmReconciled(f.admin, { budgets: { '2026-01': 80, '2026-02': 0 }, usages: { [`${f.session.subjectId}:2026-01`]: { understand: 1, generate: 0, summary: 0 }, [`${f.session.subjectId}:2026-02`]: { understand: 0, generate: 0, summary: 0 } } });
    expect((await f.store.read()).aiEnabled).toBe(false);
  });
  it('BE-T05 declared cost beyond bound records actual charge and halts new calls', async () => {
    const f = await setup({}, async () => ({ result: { interpretedGoal: 'ok' }, actualCost: 101 })); await f.service.enableMock(f.admin, true);
    await f.service.submit(f.session.token, await f.request());
    expect((await f.store.read()).budgets['2026-01'].spent).toBe(101);
    await expect(f.service.submit(f.session.token, await f.request())).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
  });
  it('BE-T09 HTTP body cap and sanitized supplier/control errors', async () => {
    const f = await setup({}, async () => { throw new Error('private secret failure'); }); await f.service.enableMock(f.admin, true);
    const handler = createHandler(f.service, { origins: ['https://local.test'], maxBodyBytes: 2000 });
    const headers = { Origin: 'https://local.test', 'Content-Type': 'application/json', Cookie: `__Host-fitness_trial=${f.session.token}` };
    const response = await handler(new Request('https://local.test/api/v1/plans/generate', { method: 'POST', headers, body: JSON.stringify(await currentCoachEnvelope()) }));
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: 'ACCOUNTING_PENDING' });
    expect((await handler(new Request('https://local.test/api/v1/goals/interpret', { method: 'POST', headers, body: JSON.stringify({ padding: 'x'.repeat(2100) }) }))).status).toBe(413);
    expect(() => createHandler(f.service, { origins: [], maxBodyBytes: 2000 })).toThrowError('INVALID_HTTP_CONFIG');
  });
  it('BE-T13 safe same-origin GET works without Origin; explicit cross-origin GET is denied', async () => {
    const f = await setup(); const handler = createHandler(f.service, { origins: ['https://local.test'], maxBodyBytes: 2000 });
    const headers = { Cookie: `__Host-fitness_trial=${f.session.token}` };
    expect((await handler(new Request('https://local.test/api/v1/trial/status', { headers }))).status).toBe(200);
    expect((await handler(new Request('https://local.test/api/v1/trial/status', { headers: { ...headers, Origin: 'https://evil.test' } }))).status).toBe(403);
    expect((await handler(new Request('https://local.test/api/v1/trial/status', { headers: { ...headers, 'Sec-Fetch-Site': 'cross-site' } }))).status).toBe(403);
  });
  it('BE-T02 administrator reissue returns one-time replacement invite without adopting user cookie', async () => {
    const f = await setup(); const handler = createHandler(f.service, { origins: ['https://local.test'], maxBodyBytes: 2000 });
    const response = await handler(new Request('https://local.test/api/v1/admin/reissue', { method: 'POST', headers: {
      Origin: 'https://local.test', Authorization: `Bearer ${f.admin}`, 'Content-Type': 'application/json',
    }, body: JSON.stringify({ subjectId: f.session.subjectId }) }));
    expect(response.headers.get('set-cookie')).toBeNull();
    const invite = await response.json() as { code: string };
    await expect(f.service.status(f.session.token)).rejects.toMatchObject({ code: 'QUALIFICATION_REQUIRED' });
    const replacement = await f.service.redeem(invite.code); expect(replacement.subjectId).toBe(f.session.subjectId); expect(replacement.expiresAt).toBe(f.session.expiresAt);
    await expect(f.service.redeem(invite.code)).rejects.toMatchObject({ code: 'INVITE_INVALID' });
    const unused = await f.service.issue(f.admin); await f.service.revokeInvite(f.admin, unused.inviteId);
    await expect(f.service.redeem(unused.code)).rejects.toMatchObject({ code: 'INVITE_INVALID' });
  });
  it('BE-T14 reconciliation restores independently observed spent amounts and counts before reopening', async () => {
    const f = await setup(); await f.service.markLedgerRecovered(f.admin);
    await expect(f.service.confirmReconciled(f.admin, { budgets: {}, usages: {} })).rejects.toMatchObject({ code: 'RECONCILIATION_EVIDENCE_REQUIRED' });
    await f.service.confirmReconciled(f.admin, { budgets: { '2026-01': 3500 }, usages: { [`${f.session.subjectId}:2026-01`]: { understand: 2, generate: 1, summary: 0 } } });
    await f.service.enableMock(f.admin, true);
    await expect(f.service.submit(f.session.token, await f.request())).rejects.toMatchObject({ code: 'GLOBAL_BUDGET_EXHAUSTED' });
    expect((await f.service.status(f.session.token)).used.understand).toBe(2); expect(f.calls()).toBe(0);
  });
  it('BE-T14 refuses reopening without observed current-month counts for every known subject', async () => {
    const f = await setup(); await f.service.markLedgerRecovered(f.admin);
    await expect(f.service.confirmReconciled(f.admin, { budgets: { '2026-01': 0 }, usages: {} })).rejects.toMatchObject({ code: 'RECONCILIATION_EVIDENCE_REQUIRED' });
    expect((await f.store.read()).recoveryRequired).toBe(true);
  });
});

it('temporary planning bypass admits generation and records costs above the former limits', async () => {
  const date='2026-02-05';
  const f=await setup({planningBudgetDisabled:true,allowBoundedPending:true,budgetLimit:1,maximumRequestCost:1,quotas:{understand:0,generate:1}},async()=>({result:{days:[{date,exercises:[{exerciseId:EXERCISE_IDS.walking,order:0,targetSets:[{metricType:'duration_distance',durationSeconds:600,distanceMeters:0}]}]}]},actualCost:500}));
  await f.service.enableMock(f.admin,true);
  const base={contractVersion:1 as const,requestId:crypto.randomUUID(),operation:'generate' as const,locale:'en' as const,restoreGeneration:0,goalText:'Walk regularly',confirmedGoal:'Walk regularly',dates:[date],timeZone:'UTC',catalogVersion:1,conditions:{}};
  const request={...base,goalConfirmation:await goalConfirmationFor(base),sendConfirmation:await confirmationFor(base)};
  expect((await f.service.submit(f.session.token,request)).accounting).toBe('settled');
  expect((await f.service.status(f.session.token)).used.generate).toBe(1);
  const next={...base,requestId:crypto.randomUUID()};await expect(f.service.submit(f.session.token,{...next,goalConfirmation:await goalConfirmationFor(next),sendConfirmation:await confirmationFor(next)})).rejects.toMatchObject({code:'INDIVIDUAL_QUOTA_EXHAUSTED'});
  expect(await f.store.read()).toMatchObject({aiEnabled:true,recoveryRequired:false,budgets:{'2026-01':{spent:500,reserved:0}}});
});
