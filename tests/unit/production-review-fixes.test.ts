import {afterEach,expect,test,vi} from 'vitest';
import {readAccessStatus,accessReason,errorAccessReason} from '../../src/application/ai-access';
import {workoutSeconds,trainingMinutes} from '../../src/application/workout-duration';
import {computeWeekFacts} from '../../src/application/review/compute';
import {templateLabel} from '../../src/i18n/features/plan/labels';
import {ledgerProjection,ledgerRecentCosts,ledgerDailyCosts} from '../../src/backend/admin/finance/report';
import {initialState} from '../../src/backend/store';
import type {WorkoutRecord} from '../../src/domain/v8/contracts';
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers()});
test('server revocation wins over a browser receipt; concurrent checks share one call',async()=>{
 const saved=new Map([['fitness-trial-application-receipt-v1','a'.repeat(64)]]);vi.stubGlobal('localStorage',{getItem:(key:string)=>saved.get(key)??null,setItem:(key:string,value:string)=>saved.set(key,value)});
 const fetcher=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({qualification:'revoked',sessionValid:false,aiEnabled:true,expiresAt:Date.now()+86400000})));
 const [a,b]=await Promise.all([readAccessStatus(fetcher),readAccessStatus(fetcher)]);expect(a).toEqual(b);expect(fetcher).toHaveBeenCalledTimes(1);expect(accessReason(a)).toBe('invalid');expect(fetcher.mock.calls[0][0]).toBe('/api/v1/trial/access-status');
});
test('fallback distinguishes access, disabled service, quota and network',()=>{
 const active={qualification:'active' as const,sessionValid:true,expiresAt:Date.now()+86400000,aiEnabled:true,used:{generate:4},limits:{generate:4}};
 expect(accessReason({...active,sessionValid:false})).toBe('invalid');expect(accessReason({...active,aiEnabled:false})).toBe('disabled');expect(accessReason(active)).toBe('quota');expect(accessReason({...active,planningBudgetDisabled:true})).toBeUndefined();expect(errorAccessReason(Error('CONTROL_UNAVAILABLE'))).toBe('connection');
});
test('weekly patterns exclude last week and use the viewing timezone at midnight',()=>{
 const row=(id:string,startedAt:string):WorkoutRecord=>({id,startedAt,endedAt:new Date(Date.parse(startedAt)+61000).toISOString(),localDate:'2026-10-11',timeZone:'UTC',status:'partial',planVersionId:'plan',templateId:'A',plannedSetCount:2,sets:[],feedback:{reasons:['time']}});
 const records=[row('previous','2026-10-11T15:59:00Z'),row('current','2026-10-11T16:01:00Z')];
 const facts=computeWeekFacts({from:'2026-10-12',to:'2026-10-18',timeZone:'Asia/Shanghai',weeklyTarget:3,workouts:records,activities:[],bodyWeights:[]});
 expect(facts.partial).toBe(1);expect(facts.reasonCounts.time).toBe(1);expect(facts.incompleteTiming.weekday.overnight?.partial).toBe(1);expect(facts.incompleteTiming.weekend.evening.partial).toBe(0);
 expect(trainingMinutes(facts.trainingSeconds)).toBe(trainingMinutes(workoutSeconds(records[1].startedAt,records[1].endedAt)));
});
test.each([[-1,0],[43201,0],[43200,43200],[89,89]])('elapsed duration %s seconds has the same validity everywhere',(seconds,expected)=>{const start='2026-10-12T00:00:00Z';expect(workoutSeconds(start,new Date(Date.parse(start)+seconds*1000).toISOString())).toBe(expected)});
test('duration names follow locale without changing stored user names',()=>{expect(templateLabel({id:'same',name:'15 min'},'zh')).toBe('15 分钟');expect(templateLabel({id:'same',name:'15 分钟'},'en')).toBe('15 min');expect(templateLabel({id:'same',name:'My own workout'},'zh')).toBe('My own workout')});
test('ledger, daily and seven-day costs use the same requests and administrator day',()=>{
 const state=initialState();state.requests.one={subjectId:'subject',requestId:'request',inputDigest:'x',operation:'generate',period:'2026-10',bound:300,status:'settled',cancelled:false,actualCost:25,createdAt:Date.parse('2026-10-31T16:30:00Z')};state.budgets['2026-10']={spent:25,reserved:0};
 const sh=ledgerProjection(state,'2026-11','Asia/Shanghai');expect(sh.settledFen).toBe(25);expect(sh.rows[0].day).toBe('2026-11-01');expect(ledgerProjection(state,'2026-10','Asia/Shanghai').settledFen).toBe(0);
 const recent=ledgerRecentCosts(state,Date.parse('2026-11-01T01:00:00Z'),'Asia/Shanghai');expect(recent.rows[0].settledFen).toBe(sh.settledFen);expect(ledgerDailyCosts(state,'Asia/Shanghai')[0].settledFen).toBe(25);expect(ledgerProjection(state,'2026-10','Europe/Berlin').rows[0].day).toBe('2026-10-31');
});
