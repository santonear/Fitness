import { expect, it } from 'vitest';
import { onboardingKeys, validV4Answer, v4Complete, durations, localAgeAccess, type Answer } from '../../src/domain/onboarding-v4';
import { onboardingSchema } from '../../src/domain/guided-contracts';
import { validateGuidedProviderInput } from '../../src/backend/guided-provider';
import type { GuidedDialogueRequest } from '../../src/domain/guided-ai-contracts';
it('defines exactly twelve ordered questions and ten unique duration stops',()=>{
 expect(onboardingKeys).toEqual(['biologicalSex','age','heightCm','weightKg','waistCm','goal','experience','location','equipment','safety','schedule','preferences']);
 expect(durations).toEqual([30,40,50,60,70,80,90,100,110,120]);expect(new Set(durations).size).toBe(10);
});
it('validates numeric limits, sex choices and mutually exclusive restrictions',()=>{
 for(const age of [12,70])expect(validV4Answer('age',{status:'answered',value:age})).toBe(true);
 for(const age of [11,71,12.5])expect(validV4Answer('age',{status:'answered',value:age})).toBe(false);
 expect(validV4Answer('biologicalSex',{status:'answered',value:'其他或不确定'})).toBe(false);
 expect(validV4Answer('safety',{status:'answered',value:['无已知限制','custom']})).toBe(false);
 for(const hour of ['0','23'])for(const duration of durations)expect(validV4Answer('schedule',{status:'answered',value:[hour,String(duration)]})).toBe(true);
 expect(validV4Answer('schedule',{status:'answered',value:['24','60']})).toBe(false);
 expect(validV4Answer('schedule',{status:'answered',value:['12','65']})).toBe(false);
});
it('unknown values remain unknown; partial schedules can resume but cannot complete',()=>{
 const answers:Record<string,Answer>=Object.fromEntries(onboardingKeys.map(k=>[k,{status:'skipped'}]));expect(v4Complete(answers)).toBe(true);expect(localAgeAccess(answers)).toBe('unknown');
 answers.schedule={status:'answered',value:['0','']};expect(validV4Answer('schedule',answers.schedule)).toBe(true);expect(v4Complete(answers)).toBe(false);
 answers.age={status:'answered',value:12};expect(localAgeAccess(answers)).toBe('minor');answers.age.value=70;expect(localAgeAccess(answers)).toBe('adult');
});
it('legacy completion remains readable, V4 completion requires all questions',()=>{
 const base={id:crypto.randomUUID(),step:0,answers:{},completed:true,updatedAt:new Date().toISOString()};
 expect(onboardingSchema.safeParse(base).success).toBe(true);expect(onboardingSchema.safeParse({...base,version:4}).success).toBe(false);
 expect(onboardingSchema.safeParse({...base,version:4,answers:Object.fromEntries(onboardingKeys.map(k=>[k,{status:'skipped'}]))}).success).toBe(true);
});
it('server rejects unknown or minor V4 audience and explicit minor body before provider work',()=>{
 for(const request of [{onboardingVersion:4,scope:{}},{onboardingVersion:4,adultConfirmed:false,scope:{}},{scope:{body:{age:{value:17}}}}])expect(()=>validateGuidedProviderInput(request as GuidedDialogueRequest,14)).toThrow('ADULT_ONLY');
});

it('weekly frequency accepts 1–7 and retains legacy two-field schedules',()=>{
 for(const n of ['1','7',''])expect(validV4Answer('schedule',{status:'answered',value:['19','60',n]})).toBe(true);
 for(const n of ['0','8','1.5'])expect(validV4Answer('schedule',{status:'answered',value:['19','60',n]})).toBe(false);
 expect(validV4Answer('schedule',{status:'answered',value:['19','60']})).toBe(true);
});
