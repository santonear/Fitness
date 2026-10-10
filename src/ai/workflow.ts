import type { AiRequest } from '../backend/contracts';
import { confirmationFor, goalConfirmationFor, validateRequest, validateCandidate } from '../backend/contracts';
export type PlanAiRequest=Exclude<AiRequest,{operation:'summary'}>;
export interface AiClient {
 status():Promise<{expiresAt:number;period:string;used:{understand:number;generate:number};limits:{understand:number;generate:number};maxDays?:number;resetAt?:number;timeZone?:string;maximumRequestCost?:number;requestBounds?:{understand:number;generate:number};budgetAvailable?:{understand:boolean;generate:boolean};pending?:number;reconciliationRequired?:boolean;planningReconciliationRequired?:boolean;aiEnabled:boolean}>;
 redeem(code:string):Promise<void>;
 submit(request:PlanAiRequest,signal?:AbortSignal):Promise<{requestId:string;result:unknown;context?:{restoreGeneration:number;inputDigest:string};accounting?:'settled'|'pending'}>;
 cancel(requestId:string):Promise<void>;
}
export class AiWorkflow {
 constructor(readonly client:AiClient){}
 goal='';confirmedGoal='';preview:PlanAiRequest|undefined;candidate:unknown;accounting:'settled'|'pending'|undefined;busy=false;error='';
 private approved='';private serial=0;private previewEpoch=0;private abort?:AbortController;private running?:PlanAiRequest;
 setGoal(value:string){if(value!==this.goal){this.goal=value;this.confirmedGoal='';this.invalidateInputs();}}
 confirmGoal(value:string){if(!value.trim())throw new Error('GOAL_CONFIRMATION_REQUIRED');this.confirmedGoal=value;this.invalidateInputs();}
 private async prepare(value:Record<string,unknown>):Promise<PlanAiRequest>{this.approved='';const epoch=this.previewEpoch;const request={...value,sendConfirmation:await confirmationFor(value)};const parsed=await validateRequest(request,1,65536);if(epoch!==this.previewEpoch)throw new Error('STALE_PREVIEW');if(parsed.operation==='summary')throw new Error('INVALID_INPUT');this.preview=parsed;return parsed;}
 async previewUnderstanding(locale:'en'|'zh',restoreGeneration:number){return this.prepare({contractVersion:1,requestId:crypto.randomUUID(),operation:'understand',goalText:this.goal,locale,restoreGeneration});}
 async previewGeneration(input:Omit<Extract<AiRequest,{operation:'generate'}>,'contractVersion'|'requestId'|'operation'|'goalText'|'confirmedGoal'|'goalConfirmation'|'sendConfirmation'>){
  if(!this.confirmedGoal)throw new Error('GOAL_CONFIRMATION_REQUIRED');
  return this.prepare({...input,contractVersion:1,requestId:crypto.randomUUID(),operation:'generate',goalText:this.goal,confirmedGoal:this.confirmedGoal,goalConfirmation:await goalConfirmationFor({goalText:this.goal,confirmedGoal:this.confirmedGoal})});
 }
 confirmSending(fingerprint:string){if(!this.preview||fingerprint!==this.preview.sendConfirmation)throw new Error('CONFIRMATION_REQUIRED');this.approved=fingerprint;}
 async send(){
  if(this.busy)throw new Error('REQUEST_IN_PROGRESS');if(!this.preview||this.approved!==this.preview.sendConfirmation)throw new Error('CONFIRMATION_REQUIRED');
  const request=structuredClone(this.preview),serial=++this.serial;this.running=request;this.abort=new AbortController();this.busy=true;this.error='';this.approved='';
  try{const response=await this.client.submit(request,this.abort.signal);if(serial!==this.serial)return;
   if(response.requestId!==request.requestId)throw new Error('STALE_RESPONSE');
   if(response.context&&(response.context.restoreGeneration!==request.restoreGeneration||response.context.inputDigest!==request.sendConfirmation))throw new Error('STALE_RESPONSE');
   this.candidate=validateCandidate(request,response.result);this.accounting=response.accounting;
  }catch(error){if(serial!==this.serial)return;this.error=error instanceof Error?error.message:'CONTROL_UNAVAILABLE';throw error;}
  finally{if(serial===this.serial){this.busy=false;this.running=undefined;}}
 }
 async cancel(){const request=this.running;const serial=++this.serial;this.abort?.abort();this.busy=false;this.approved='';this.error='CANCELLED_MAY_BE_CHARGED';if(request)try{await this.client.cancel(request.requestId);}catch{if(serial===this.serial)this.error='CANCELLED_ACCOUNTING_UNKNOWN';}}
 invalidateInputs(){++this.previewEpoch;this.preview=undefined;this.approved='';}
 dispose(){++this.serial;this.abort?.abort();this.busy=false;}
}
