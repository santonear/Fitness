import {assistantCopy} from '../i18n/features/coach/assistant';
export function assistantApplyErrorCopy(error:unknown,locale:'zh'|'en'){
 const value=error instanceof Error?error.message:'';
 if(value==='COMPLETED_ITEM_READ_ONLY')return locale==='zh'?'已完成的动作不能修改，请保留它们后再调整。':'Completed exercises cannot be changed. Keep them when adjusting the workout.';
 if(value==='TRAINING_CHANGED')return locale==='zh'?'这次训练已变化，请重新生成建议。':'This workout changed. Please request a new suggestion.';
 if(['STALE_CANDIDATE','STALE_INPUT','STALE_REVISION'].includes(value))return locale==='zh'?'资料或计划已变化，请重新查看建议。':'Your details or plan changed. Review a fresh suggestion.';
 if(value.startsWith('Invalid coach response:'))return assistantCopy[locale].model;
 return locale==='zh'?'这次应用尚未确认，请重试。':'This application is not confirmed. Please try again.';
}
