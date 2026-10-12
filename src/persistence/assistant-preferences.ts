import type {CoachRequest,CoachResponse} from '../coach/contracts';
import type {AiMemoryNote} from '../domain/models';
import {aiMemoryNoteSchema} from '../domain/schemas';
import {exercises} from '../catalog/exercises';
import {repository} from './repository';

export type AssistantPreference=Pick<AiMemoryNote,'kind'|'value'> & {kind:NonNullable<AiMemoryNote['kind']>;value:NonNullable<AiMemoryNote['value']>};
const same=(a:AssistantPreference,b:AssistantPreference)=>a.kind===b.kind&&JSON.stringify(a.value)===JSON.stringify(b.value);
const proposalOf=(response:CoachResponse)=>'proposal' in response?response.proposal:response.type==='review_summary'?response.suggestion?.proposal:undefined;

/** A plan acceptance confirms structured changes; chatting alone never creates memory. */
export function confirmedPreferenceChanges(request:CoachRequest,response:CoachResponse,userMessage:string):AssistantPreference[]{
 const proposal=proposalOf(response),result:AssistantPreference[]=[];
 if(!proposal)return result;
 if(proposal.preferredDays?.length&&(request.task==='ONBOARD_PLAN'||request.task==='MODIFY_PLAN'&&JSON.stringify(proposal.preferredDays)!==JSON.stringify(request.plan.preferredDays)))result.push({kind:'preferred_days',value:proposal.preferredDays});
 if(request.task==='ONBOARD_PLAN'){
  for(const caution of request.profile.cautions)result.push({kind:'caution_area',value:caution});
  if(request.profile.equipment.length)result.push({kind:'equipment',value:request.profile.equipment});
 }
 if(/(?:不能跳|不跳|避免跳|can't jump|cannot jump|no jumping)/i.test(userMessage))result.push({kind:'cannot_do',value:'jumping'});
 if(request.task==='MODIFY_PLAN'&&/(?:不会做|不想做|不要做|讨厌|can't do|cannot do|avoid)/i.test(userMessage)){
  request.plan.templates.forEach((before,index)=>before.items.forEach((item,itemIndex)=>{
   const replacement=proposal.templates[index]?.items[itemIndex];
   const name=exercises.find(exercise=>exercise.id===item.exerciseId)?.name;
   if(replacement&&replacement.exerciseId!==item.exerciseId&&name&&[name.zh,name.en].some(label=>label&&userMessage.toLowerCase().includes(label.toLowerCase())))result.push({kind:'dislike_exercise',value:item.exerciseId});
  }));
 }
 return result.filter((item,index)=>result.findIndex(other=>same(item,other))===index);
}

export const assistantPreferences={
 async list(){return (await repository.db.aiMemoryNotes.toArray()).filter((note):note is AiMemoryNote&AssistantPreference=>!!note.kind&&note.value!==undefined).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));},
 async forRequest():Promise<AssistantPreference[]>{return (await this.list()).slice(0,30).map(({kind,value})=>({kind,value}));},
 async save(items:AssistantPreference[],locale:'zh'|'en'){
  if(!items.length)return [] as AiMemoryNote[];
  return repository.write(async()=>{
   const existing=await repository.db.aiMemoryNotes.toArray(),present=existing.filter((note):note is AiMemoryNote&AssistantPreference=>!!note.kind&&note.value!==undefined),created:AiMemoryNote[]=[];
   for(const item of items){if(present.some(note=>same(note,item))||created.some(note=>same(note as AiMemoryNote&AssistantPreference,item))||present.length+created.length>=30)continue;
    const now=new Date().toISOString(),note=aiMemoryNoteSchema.parse({id:crypto.randomUUID(),createdAt:now,updatedAt:now,revision:0,memoRevision:0,generatorVersion:'assistant-v3.0.0',locale,suggestion:'',explanation:'',...item});
    created.push(note);
   }
   if(created.length)await repository.db.aiMemoryNotes.bulkAdd(created);
   return created;
  });
 },
 async remove(ids:string[]){if(!ids.length)return;await repository.write(async()=>{const notes=await repository.db.aiMemoryNotes.bulkGet(ids);if(notes.some(note=>!note?.kind))throw Error('PREFERENCE_NOT_FOUND');await repository.db.aiMemoryNotes.bulkDelete(ids);});},
};
