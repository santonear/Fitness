import {expect,it} from 'vitest';
import {assistantApplyErrorCopy} from '../../src/assistant/application-error';
import {assistantCopy} from '../../src/i18n/features/coach/assistant';
it.each(['zh','en'] as const)('uses distinct existing copy for stale and validation errors: %s',locale=>{
 for(const code of ['STALE_CANDIDATE','TRAINING_CHANGED'])expect(assistantApplyErrorCopy(new Error(code),locale)).toBe(assistantCopy[locale].stale);
 expect(assistantApplyErrorCopy(new Error('Invalid coach response: exercise outside supplied catalog'),locale)).toBe(assistantCopy[locale].model);
});
