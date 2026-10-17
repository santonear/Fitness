import type {CoachRequest} from './contracts';

/** Separate from body/history consent. No health-derived metadata crosses this projection. */
export function engineHealthScope(request:CoachRequest,includeHealth=false):CoachRequest{
 const copy=structuredClone(request);
 if(copy.engineProfile){delete copy.engineProfile.ageYears;delete copy.engineProfile.birthYearMonth;delete copy.engineProfile.bodyWeightKg;}
 // Local safety proofs are not questionnaire answers and are never needed by the model.
 if(copy.engineProfile){delete copy.engineProfile.powerOneRm;delete copy.engineProfile.painState;delete copy.engineProfile.cautionLevels;delete copy.engineProfile.postpartumSafety;delete copy.engineProfile.pregnancySafety;delete copy.engineProfile.olderSafety;delete copy.engineProfile.screening.activityEvidence;delete copy.engineProfile.screening.age45AdvisoryAck;}
 if(!includeHealth){
  delete copy.engineProfile;
  // Generic labels prevent local pregnancy/postpartum notes leaking through template names.
  const clean=(templates:{name:string;items:unknown[]}[])=>templates.forEach((template,index)=>{template.name=String.fromCharCode(65+index);for(const item of template.items)if(item&&typeof item==='object'&&'prescription' in item)delete item.prescription;});
  const derived=(template:{items:unknown[];estimatedSeconds?:number;durationScope?:string})=>copy.trainingEngine===true||template.estimatedSeconds!==undefined||template.durationScope!==undefined||template.items.some(item=>!!item&&typeof item==='object'&&'prescription'in item);
  if(copy.task==='ADJUST_TODAY'&&derived(copy.template))clean([copy.template]);
  if(copy.task==='MODIFY_PLAN'){
   const engineTemplates=copy.plan.templates.filter(derived);
   if(engineTemplates.length){clean(engineTemplates);copy.plan.reasons=[copy.plan.goalText,copy.plan.goalText,copy.plan.goalText];}
  }
 }
 return copy;
}

/** Network disclosure is a projection, never the source for local training operations. */
export function localEngineContext(routed:CoachRequest,sent:CoachRequest):CoachRequest{
 if(routed.task!==sent.task)throw Error('LOCAL_ENGINE_TASK_MISMATCH');
 return {...structuredClone(routed),requestId:sent.requestId,conversationId:sent.conversationId,restoreGeneration:sent.restoreGeneration,inputSnapshot:sent.inputSnapshot,sendConfirmation:sent.sendConfirmation,locale:sent.locale,timeZone:sent.timeZone};
}
