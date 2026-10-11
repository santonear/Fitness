import {expect,it} from 'vitest';
import {qualityLabel,qualityLabels} from '../../src/ui/admin/quality/copy';
it('localizes every quality category, scenario and error enum in both languages',()=>{
 for(const group of Object.keys(qualityLabels) as (keyof typeof qualityLabels)[])for(const value of Object.keys(qualityLabels[group])){
  expect(qualityLabel(group,value,zh=>zh)).toMatch(/[\u3400-\u9fff]/);
  expect(qualityLabel(group,value,(_zh,en)=>en)).not.toBe(value);
 }
 expect(qualityLabel('category','PRIVATE_RAW_CONTENT',zh=>zh)).toBe('其他或尚未记录');
 expect(qualityLabel('scenario','future_scenario',(_zh,en)=>en)).toBe('Other / not recorded');
});
