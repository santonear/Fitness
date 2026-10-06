import {expect,it} from 'vitest';
import {statusFeedback} from '../../src/ai/status-feedback';
it('distinguishes personal allowance, project budget and unknown status in both languages',()=>{
 for(const locale of ['en','zh'] as const){
  const values=['INDIVIDUAL_QUOTA_EXHAUSTED','GLOBAL_BUDGET_EXHAUSTED','CONTROL_UNAVAILABLE'].map(code=>statusFeedback(code,locale));
  expect(new Set(values).size).toBe(3);
  expect(statusFeedback('private request body',locale)).not.toContain('private request body');
 }
 expect(statusFeedback('GLOBAL_BUDGET_EXHAUSTED','zh')).toContain('不是个人欠费');
});
