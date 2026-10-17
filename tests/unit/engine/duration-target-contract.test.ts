import {expect,it} from 'vitest';
import {generatePlan,validatePlan} from '../../../src/engine';
import {baseProfile} from '../../../tools/eval/training-engine-profiles';
it('validates the actual declared duration contract without reconstructing a V1 target',()=>{
 const profile=baseProfile(),original=generatePlan(profile),before=JSON.stringify(original);
 for(const minutes of [1,9,20.5,91,NaN,Infinity]){const plan=structuredClone(original);plan.templates[0].targetMinutes=minutes;expect(validatePlan(plan,profile),String(minutes)).toContainEqual(expect.objectContaining({code:'declared_target_invalid',ruleId:'duration.fit.bounds',severity:'error'}));}
 for(const minutes of [10,20,60,90,undefined]){const plan=structuredClone(original);plan.templates[0].targetMinutes=minutes;expect(validatePlan(plan,profile).some(issue=>issue.code==='declared_target_invalid')).toBe(false);expect(plan.templates[0].targetMinutes).toBe(minutes);}
 expect(JSON.stringify(original)).toBe(before);
});
