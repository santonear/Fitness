import { describe,expect,it } from 'vitest';
import { dateWeeklyTarget,legacyPlanGroups } from '../../src/domain/v8/legacy-groups';
import { emptyGuidedState } from '../../src/domain/guided-contracts';
import type { Plan,PlanVersion } from '../../src/domain/models';
const plan=(id:string)=>({id,model:'date-day',status:'active',currentVersionId:`${id}-v`} as Plan);
const version=(id:string,requestId?:string)=>({id:`${id}-v`,planId:id,generationMetadata:requestId?{requestId}:undefined} as PlanVersion);
describe('explicit old generation groups',()=>{
 it('averages dates across the covered weeks and clamps',()=>{expect(dateWeeklyTarget(['2026-10-01','2026-10-03','2026-10-08','2026-10-10'])).toBe(2);expect(dateWeeklyTarget(['2026-10-01'])).toBe(1);expect(dateWeeklyTarget([])).toBe(1);expect(dateWeeklyTarget(Array.from({length:7},(_,i)=>`2026-10-0${i+1}`))).toBe(7);});
 it('merges only explicit simultaneous candidate members',()=>{const state=emptyGuidedState();state.events.push({id:crypto.randomUUID(),createdAt:'2026-10-10T00:00:00Z',action:'created',after:'independent-candidate:one',reason:'["a","b"]'} as typeof state.events[number]);expect(legacyPlanGroups([plan('a'),plan('b'),plan('c')],[version('a'),version('b'),version('c')],[state])).toEqual([['a','b'],['c']]);});
 it('does not group unrelated or archived dates by names or timestamps',()=>{expect(legacyPlanGroups([plan('a'),{...plan('b'),status:'archived'}],[version('a','same'),version('b','same')],[])).toEqual([['a'],['b']]);});
 it('groups shared request IDs and preserves unknown evidence',()=>{expect(legacyPlanGroups([plan('a'),plan('b')],[version('a','same'),version('b','same')],[])).toEqual([['a','b']]);expect(legacyPlanGroups([plan('a'),plan('b')],[version('a'),version('b')],[])).toEqual([['a'],['b']]);});
});
