import {assistantCopy} from '../i18n/features/coach/assistant';
export function assistantApplyErrorCopy(error:unknown,locale:'zh'|'en'){
 const value=error instanceof Error?error.message:'';
 return ['STALE_CANDIDATE','TRAINING_CHANGED'].includes(value)?assistantCopy[locale].stale:assistantCopy[locale].model;
}
