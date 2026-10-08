import {describe,it,expect} from 'vitest';
import {bodyKeys,finishBody,storedStep,visibleStep} from '../../src/domain/onboarding-v5';
describe('V5 presentation over compatible field storage',()=>{
 it('maps all old positions and new stages without losing body progress',()=>{
  expect(Array.from({length:13},(_,n)=>visibleStep(n))).toEqual([0,1,2,2,2,3,4,5,6,7,8,9,10]);
  for(let stage=0;stage<=10;stage++)expect(visibleStep(storedStep(stage))).toBe(stage);
 });
 it('skips only missing metrics; never stores samples or creates measurements',()=>{
  const answers={heightCm:{status:'answered' as const,value:181}};
  expect(finishBody(answers)).toEqual({heightCm:answers.heightCm,weightKg:{status:'skipped'},waistCm:{status:'skipped'}});
  expect(Object.keys(answers)).toEqual(['heightCm']);expect(bodyKeys).toHaveLength(3);
 });
});
