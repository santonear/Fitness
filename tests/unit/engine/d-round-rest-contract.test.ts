import {expect,it} from 'vitest';
import {checkHard} from '../../../src/engine/hard-checks';
import {Rules} from '../../../src/engine/data';
import {runGates} from '../../../src/engine/gates';
import {fixtureProfile,planFixture} from './fixtures';
const rules=new Rules(),range=rules.get('duration.rest.block').superset.after_round_range_s;
function fixture(){const plan=planFixture(),item=plan.templates[0].items[0];item.prescription={...item.prescription!,structure:'superset',groupId:'pair',roundRestSeconds:range[0]};plan.templates[0].items.push(structuredClone(item));return plan;}
const errors=(plan:ReturnType<typeof fixture>)=>checkHard(plan,fixtureProfile,runGates(fixtureProfile,rules),rules).filter(i=>i.code.startsWith('round_rest_'));
it.each(['below','above','fractional','inconsistent','missing_member','straight','circuit','singleton','no_group','warmup'] as const)('rejects invalid explicit round rest: %s',mode=>{
 const plan=fixture(),items=plan.templates[0].items;
 if(mode==='below'||mode==='above'||mode==='fractional')for(const item of items)item.prescription!.roundRestSeconds=mode==='below'?range[0]-1:mode==='above'?range[1]+1:range[0]+0.5;
 if(mode==='inconsistent')items[1].prescription!.roundRestSeconds=range[1];
 if(mode==='missing_member')delete items[1].prescription!.roundRestSeconds;
 if(mode==='straight'||mode==='circuit')for(const item of items)item.prescription!.structure=mode;
 if(mode==='singleton')items.pop();
 if(mode==='no_group')for(const item of items)delete item.prescription!.groupId;
 if(mode==='warmup')items[1].prescription!.block='warmup';
 expect(errors(plan).length).toBeGreaterThan(0);expect(errors(plan).every(i=>i.ruleId==='duration.rest.block')).toBe(true);
});
it.each([undefined,range[0],range[1]])('accepts the implicit default or a consistent authored boundary: %s',value=>{const plan=fixture();for(const item of plan.templates[0].items){if(value===undefined)delete item.prescription!.roundRestSeconds;else item.prescription!.roundRestSeconds=value;}expect(errors(plan)).toEqual([]);});
