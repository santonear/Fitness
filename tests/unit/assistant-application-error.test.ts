import {expect,it} from 'vitest';
import {assistantApplyErrorCopy} from '../../src/assistant/application-error';
import {assistantCopy} from '../../src/i18n/features/coach/assistant';
it.each(['zh','en'] as const)('uses distinct existing copy for stale and validation errors: %s',locale=>{
 expect(assistantApplyErrorCopy(new Error('STALE_CANDIDATE'),locale)).toBe(locale==='zh'?'资料或计划已变化，请重新查看建议。':'Your details or plan changed. Review a fresh suggestion.');
 expect(assistantApplyErrorCopy(new Error('TRAINING_CHANGED'),locale)).toBe(locale==='zh'?'这次训练已变化，请重新生成建议。':'This workout changed. Please request a new suggestion.');
 expect(assistantApplyErrorCopy(new Error('COMPLETED_ITEM_READ_ONLY'),locale)).toBe(locale==='zh'?'已完成的动作不能修改，请保留它们后再调整。':'Completed exercises cannot be changed. Keep them when adjusting the workout.');
 expect(assistantApplyErrorCopy(new Error('Invalid coach response: exercise outside supplied catalog'),locale)).toBe(assistantCopy[locale].model);
});
