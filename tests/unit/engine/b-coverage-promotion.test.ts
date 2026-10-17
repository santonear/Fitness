import {it,expect} from 'vitest';
import {Rules} from '../../../src/engine/data';
import {createContext} from '../../../src/engine/pipeline';
import {isHardEligible} from '../../../src/engine/candidates';
import {fillSlots} from '../../../src/engine/fill';
import {prescribe} from '../../../src/engine/dose';
import {scorePlan,marginal} from '../../../src/engine/score';
import type {Pattern,Slot} from '../../../src/engine/contracts';
import {fixtureProfile,planFixture} from './fixtures';
const rules=new Rules(),slot:Slot={id:'free-acc',role:'accessory',patterns:['squat'],priority:1,optional:true,sourceRuleId:'session.conditioning.slot'};
export function coverageContext(missing:Pattern='hinge'){
 const profile={...structuredClone(fixtureProfile),level:'intermediate' as const,trainingAgeWeeks:30},ctx=createContext(profile,0,rules),required=rules.get('week.coverage.patterns').weekly_min_exposures.each_once as Pattern[];
 const items=required.filter(pattern=>pattern!==missing).map(pattern=>{const e=rules.data.exercises.find(e=>e.primary_pattern===pattern&&isHardEligible(e,profile,ctx.gate,ctx))!;return prescribe(e,profile,rules,ctx.gate.restrictions,'main',2);});
 ctx.plan={...planFixture(),weeklyTarget:profile.daysPerWeek,templates:[{id:'prior-work',name:'Prior',estimatedMinutes:30,items}]};return ctx;
}
it.each(['hinge','pull_vertical'] as const)('promotes a source-missing %s pattern into an existing free accessory slot',missing=>{
 const ctx=coverageContext(missing),result=fillSlots([slot],ctx,{score:scorePlan,marginal});
 expect(result.items).toHaveLength(1);expect(rules.byExercise.get(result.items[0].exerciseId)?.primary_pattern).toBe(missing);expect(result.items[0].prescription?.block).toBe('accessory');
 expect(ctx.trace.some(t=>t.ruleId==='week.coverage.patterns'&&t.step==='fill')).toBe(true);
});
it('preserves main and user-locked accessory pattern requests',()=>{
 for(const locked of [false,true]){const ctx=coverageContext();if(locked)ctx.lockedItemIndexes=[0];const requested=locked?slot:{...slot,role:'main' as const};
  const result=fillSlots([requested],ctx,{score:scorePlan,marginal});expect(rules.byExercise.get(result.items[0].exerciseId)?.primary_pattern).toBe('squat');
 }
});
it('keeps the original accessory pool when a missing pattern has no hard-safe candidate',()=>{
 const ctx=coverageContext();ctx.profile.preferences.excludedExerciseIds=rules.data.exercises.filter(e=>e.primary_pattern==='hinge').map(e=>e.id);
 const result=fillSlots([slot],ctx,{score:scorePlan,marginal});expect(rules.byExercise.get(result.items[0].exerciseId)?.primary_pattern).toBe('squat');
});

it('does not apply weekly coverage promotion before its scheduled RT-day condition or over a focused request',()=>{
 for(const mode of ['one-day','upper-focus'] as const){const ctx=coverageContext();if(mode==='one-day')ctx.plan!.templates=[];else ctx.focus='upper';const result=fillSlots([slot],ctx,{score:scorePlan,marginal});expect(rules.byExercise.get(result.items[0].exerciseId)?.primary_pattern).toBe('squat');}
});
