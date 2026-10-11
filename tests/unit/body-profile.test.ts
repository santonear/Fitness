import {expect,it} from 'vitest';
import {parseBodyText} from '../../src/application/rules/local-profile';
import {bodyComplete} from '../../src/domain/body-profile';
import {migrateBodyProfile} from '../../src/persistence/body-profile-migration';
import {emptyGuidedState} from '../../src/domain/guided-contracts';
const now='2026-10-12T00:00:00Z';
it.each(['男，34岁，167，70公斤','male, 34 years, 167 cm, 70 kg','男，34，167，70'])('parses explicit everyday body details: %s',text=>expect(parseBodyText(text)).toEqual({biologicalSex:'男性',age:34,heightCm:167,weightKg:70}));
it('does not infer missing facts or clamp invalid values',()=>{expect(parseBodyText('我想增肌')).toEqual({});expect(parseBodyText('女，99岁，260厘米，0公斤')).toEqual({biologicalSex:'女性'});expect(parseBodyText('腰围80厘米')).toEqual({waistCm:80});expect(bodyComplete(parseBodyText('男，34岁'))).toBe(false)});
it('accepts privacy choice and exact inclusive boundaries',()=>{expect(bodyComplete(parseBodyText('不愿透露，12岁，100厘米，30公斤'))).toBe(true);expect(bodyComplete(parseBodyText('女，70岁，230厘米，300公斤，腰围200厘米'))).toBe(true)});
it('projects legacy answers only once, leaves sources intact and requires confirmation',()=>{
 const profile={id:crypto.randomUUID(),revision:0,createdAt:now,updatedAt:now,locale:'zh' as const,timeZone:'Asia/Shanghai',units:'metric' as const,trainingPreferences:{updatedAt:now,heightCm:170,weightGrams:70000}};
 const guided={...emptyGuidedState(),onboarding:{id:crypto.randomUUID(),step:0,completed:false,updatedAt:now,answers:{age:{status:'answered' as const,value:34},biologicalSex:{status:'answered' as const,value:'男性'}}}};
 const original=JSON.stringify({profile,guided}),result=migrateBodyProfile(profile,guided,now);expect(result.bodyDetails?.values).toEqual({age:34,biologicalSex:'男性',heightCm:170,weightKg:70});expect(result.bodyDetails?.confirmedAt).toBeUndefined();expect(JSON.stringify({profile,guided})).toBe(original);expect(migrateBodyProfile(result,guided,now)).toEqual(result);
 const deleted={...result,bodyDetails:{values:{},source:'entered' as const,updatedAt:now,confirmedAt:now}};expect(migrateBodyProfile(deleted,guided,now)).toEqual(deleted);
});
