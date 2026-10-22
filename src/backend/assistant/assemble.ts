import {assembleEngineIntent} from './engine-assemble';
import {estimatedDurationLabel} from '../../i18n/features/plan/labels';
import {diffTemplates} from '../../assistant/template-diff';
import {sameExerciseFamily} from '../../catalog/exercise-family';
import {manualTrainingItems} from '../../application/rules/manual-items';
import {sessionDuration} from '../../application/rules/session-duration';
import {explicitScheduleChange} from '../../application/picked-schedule';
import { assistantIntentSchema, type AssistantAttachment, type AssistantIntent, type AssistantRequest } from '../../assistant/contracts';
import { basicProposal } from '../../application/v8-workflow';
import { estimatePlannedMinutes } from '../../domain/duration-estimate';
import { selectAssistantCandidates, assistantMovement } from '../../catalog/ai-catalog';
import {applicableAssistantCandidates,lowerBodyAddition} from './applicable-candidates';
import { catalogMetadata } from '../../catalog/registry';
import { exercises } from '../../catalog/exercises';
import { coachResponseSchema } from '../../coach/contracts';
import type { PlannedItem, SessionTemplate } from '../../domain/v8/contracts';

type Candidate = ReturnType<typeof selectAssistantCandidates>[number];
const normal = (value: string) => value.toLocaleLowerCase().replace(/[\s_\-·]/g,'');
export function resolveAssistantExercise(value:string|undefined,candidates:Candidate[]):Candidate|undefined{
 if(!value)return;
 const code=candidates.find(row=>row.code.toLowerCase()===value.toLowerCase());if(code)return code;
 const input=normal(value);
 const names=(row:Candidate)=>[row.exercise.name.zh,row.exercise.name.en,...catalogMetadata.get(row.exercise.id)?.aliases??[]].map(normal);
 const exact=candidates.filter(row=>names(row).includes(input));if(exact.length===1)return exact[0];
 const contained=candidates.filter(row=>input.length>=2&&names(row).some(name=>name.includes(input)||input.includes(name)));
 return contained.length===1?contained[0]:undefined;
}
function newItem(candidate:Candidate):PlannedItem{
 const exercise=candidate.exercise;
 const target=exercise.metricType==='reps_load'?{metricType:'reps_load' as const,reps:8,loadGrams:0}:
  exercise.metricType==='reps'?{metricType:'reps' as const,reps:8}:
  exercise.metricType==='duration'?{metricType:'duration' as const,durationSeconds:30}:{metricType:'duration_distance' as const,durationSeconds:300};
 return {exerciseId:exercise.id,equipment:exercise.equipment,sets:2,target};
}
function replacementItem(previous:PlannedItem,candidate:Candidate):PlannedItem{
 const next=newItem(candidate);next.sets=previous.sets;
 if(previous.target.metricType===candidate.exercise.metricType)next.target=structuredClone(previous.target);
 else{
  const defaults=manualTrainingItems([candidate.exercise.id])[0].target;
  if('reps'in next.target)next.target.reps='reps'in defaults?defaults.reps:8;
  if('durationSeconds'in next.target)next.target.durationSeconds='durationSeconds'in defaults?defaults.durationSeconds:20;
 }
 if(next.target.metricType==='reps_load')next.target.loadGrams=0;
 return next;
}
function coverPatterns(template:SessionTemplate,candidates:Candidate[]){
 const patterns=()=>new Set(template.items.map(item=>{
  const exercise=exercises.find(row=>row.id===item.exerciseId);return exercise?assistantMovement(exercise):'mobility';
 }));
 const required=['push','pull','core','lower'] as const;
 for(const mode of required){const current=patterns();const covered=Number(current.has('push'))+Number(current.has('pull'))+Number(current.has('core'))+Number(current.has('squat')||current.has('hinge'));if(covered>=3&&current.has('push'))break;
  if(mode==='lower'&&(current.has('squat')||current.has('hinge')||current.has('lower')))continue;
  if(mode!=='lower'&&current.has(mode))continue;
  const safe=candidates.find(row=>(mode==='lower'?row.mode==='squat'||row.mode==='hinge'||row.mode==='lower':row.mode===mode)&&!template.items.some(item=>item.exerciseId===row.exercise.id));
  if(safe)template.items.push(newItem(safe));
 }
}
function recalculate(template:SessionTemplate,minimum=15){template.estimatedMinutes=estimatePlannedMinutes(template.items,minimum);}
function fitDuration(template:SessionTemplate,minutes:number,candidates:Candidate[]=[],locked=new Set<number>()){
 const lower=Math.ceil(minutes*.9),upper=Math.floor(minutes*1.1);
 for(let attempts=0;attempts<100&&estimatePlannedMinutes(template.items,10)>upper;attempts++){
  const reducible=template.items.filter((item,index)=>item.sets>1&&!locked.has(index)).sort((a,b)=>b.sets-a.sets)[0];
  if(!reducible)break;
  reducible.sets--;
 }
 for(let attempts=0;attempts<100&&estimatePlannedMinutes(template.items,10)<lower;attempts++){
  const expandable=template.items.filter((item,index)=>item.sets<4&&!locked.has(index)).sort((a,b)=>a.sets-b.sets)[0];
  if(!expandable){
   const counts=new Map<string,number>();for(const item of template.items){const exercise=exercises.find(e=>e.id===item.exerciseId);if(exercise){const mode=assistantMovement(exercise);counts.set(mode,(counts.get(mode)??0)+1);}}
   const extra=candidates.filter(row=>['push','pull','squat','hinge','lower','core','cardio'].includes(row.mode)&&!template.items.some(item=>item.exerciseId===row.exercise.id)).sort((a,b)=>(counts.get(a.mode)??0)-(counts.get(b.mode)??0))[0];
   if(!extra||template.items.length>=12)break;template.items.push({...newItem(extra),sets:1});continue;
  }
  expandable.sets++;
 }
 recalculate(template,10);
}
function syncTemplateName(template:SessionTemplate,locale:'zh'|'en'){
 template.name=template.name.replace(/\s*[（(]\s*\d+\s*(?:分钟|minutes?|mins?)\s*[）)]/gi,'').trim();
 if(!template.name)template.name=locale==='zh'?'训练':'Workout';
}
function itemName(id:string,locale:'zh'|'en'){return exercises.find(row=>row.id===id)?.name[locale]??id;}
function templateDiff(before:SessionTemplate,after:SessionTemplate,locale:'zh'|'en'){
 return diffTemplates([before],[after]).changes.map(change=>{
  const name=itemName(change.item.exerciseId,locale);
  return change.kind==='replaced'?(locale==='zh'?`将${itemName(change.previous!.exerciseId,locale)}换成${name}`:`Replaced ${itemName(change.previous!.exerciseId,locale)} with ${name}`):change.kind==='removed'?(locale==='zh'?`移除${name}`:`Removed ${name}`):change.kind==='added'?(locale==='zh'?`加入${name}`:`Added ${name}`):(locale==='zh'?`调整${name}的训练量`:`Changed the volume for ${name}`);
 });
}
function findExistingItem(template:SessionTemplate,value:string|undefined):number{
 if(!value)return -1;
 const key=normal(value);
 return template.items.findIndex(item=>{
  const exercise=exercises.find(row=>row.id===item.exerciseId);
  return !!exercise&&[exercise.id,exercise.name.zh,exercise.name.en,...catalogMetadata.get(exercise.id)?.aliases??[]].some(name=>normal(name)===key||key.length>=2&&normal(name).includes(key));
 });
}
function explicitExistingReplacements(request:AssistantRequest):Extract<AssistantIntent,{kind:'plan_modify'}>['changes']{
 const context=request.context;
 if(context?.task!=='MODIFY_PLAN')return [];
 const raw=request.messages.at(-1)?.content??'';
 const directed=raw.match(/(?:把|将)\s*(.+?)\s*(?:换成|替换为|换为)\s*(.+?)(?:[，。；;]|$)/i)??raw.match(/(?:replace|swap)\s+(.+?)\s+(?:with|for)\s+(.+?)(?:[.;]|$)/i);
 if(directed){return context.plan.templates.flatMap(template=>{const index=findExistingItem(template,directed[1].trim());return index<0?[]:[{session:template.id,op:'replace' as const,from:template.items[index].exerciseId,to:directed[2].trim()}];});}
 const text=normal(raw);
 if(!/(换|替换|不要|别安排|移除|replace|remove|swap|avoid)/i.test(text))return [];
 const changes:Extract<AssistantIntent,{kind:'plan_modify'}>['changes']=[];
 const scope=namedPlanScope(request);
 for(const template of context.plan.templates.filter(template=>!scope.templates.size||scope.templates.has(template.id)))for(const item of template.items){
  const exercise=exercises.find(row=>row.id===item.exerciseId);
  if(!exercise)continue;
  const names=[exercise.name.zh,exercise.name.en,...catalogMetadata.get(exercise.id)?.aliases??[]].map(normal).filter(name=>name.length>=3);
  const farmerAlias=catalogMetadata.get(exercise.id)?.slug==='dumbbell-farmers-walk'&&/农夫行走|farmer.?s?.?walk/i.test(text);
  if(farmerAlias||names.some(name=>text.includes(name)))changes.push({session:template.id,op:'replace',from:exercise.id});
 }
 return changes;
}
function namedPlanScope(request:AssistantRequest){
 const templates=new Set<string>(),items=new Set<string>();
 if(request.context?.task!=='MODIFY_PLAN')return {templates,items};
 const text=request.messages.at(-1)?.content??'';
 for(const template of request.context.plan.templates){
  for(const label of [template.id,template.name]){
   const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   if(new RegExp(`(?:^|[^a-z0-9])${escaped}\\s*(?:里|中|训练|的|workout|session)|(?:workout|session)\\s+${escaped}(?:\\b|$)`,'i').test(text))templates.add(template.id);
  }
  for(const item of template.items){const exercise=exercises.find(e=>e.id===item.exerciseId);if(exercise&&[exercise.name.zh,exercise.name.en,...catalogMetadata.get(item.exerciseId)?.aliases??[]].some(name=>name.length>=3&&normal(text).includes(normal(name))))items.add(item.exerciseId);}
 }
 return {templates,items};
}
function applyChanges(template:SessionTemplate,changes:Extract<AssistantIntent,{kind:'plan_modify'}>['changes'],candidates:Candidate[],locked=new Set<number>(),dropped:string[]=[],existingItems:PlannedItem[]=template.items,explicitTarget=false){
 let applied=0;
 for(const change of changes){
  if(change.session&&change.session!==template.id&&change.session!==template.name&&change.session!=='今天')continue;
  const index=findExistingItem(template,change.from);
  const previous=index>=0?exercises.find(row=>row.id===template.items[index].exerciseId):undefined;
  const matched=resolveAssistantExercise(change.to,candidates);
  const replacementModes=previous?assistantMovement(previous)==='carry'?['carry','pull','core']: [assistantMovement(previous)]:[];
  const compatible=(row:Candidate)=>replacementModes.includes(row.mode)&&(assistantMovement(previous!)!=='push'||['chest','shoulders','upper-arms'].includes(catalogMetadata.get(row.exercise.id)?.bodyPart??''))&&!existingItems.some(item=>item.exerciseId!==previous!.id&&sameExerciseFamily(exercises.find(e=>e.id===item.exerciseId)!,row.exercise));
  const to=previous?(matched&&matched.exercise.id!==previous.id&&(explicitTarget||compatible(matched))?matched:explicitTarget&&change.to?undefined:candidates.find(row=>row.exercise.id!==previous.id&&compatible(row))):matched;
  if(change.op==='add'&&to&&!existingItems.some(item=>sameExerciseFamily(exercises.find(e=>e.id===item.exerciseId)!,to.exercise))){
   const before=estimatePlannedMinutes(template.items),added=newItem(to);
   template.items.push(added);
   while(added.sets<4&&estimatePlannedMinutes(template.items)<=before)added.sets++;
   applied++;
  }
  else if(change.op==='add'&&!to)dropped.push('unknown_or_unsafe_exercise');
  if(index<0||locked.has(index))continue;
  if(change.op==='replace'&&to&&to.exercise.id!==previous?.id){template.items[index]=replacementItem(template.items[index],to);applied++;if(change.to&&!matched)dropped.push('unsafe_replacement_substituted');}
  else if(change.op==='replace'&&!to)dropped.push('unknown_or_unsafe_exercise');
  if(change.op==='remove'&&template.items.length>1&&(!locked.size||index>Math.max(...locked))){template.items.splice(index,1);applied++;}
  if(change.op==='set_volume'||change.op==='shorten'){
   const item=template.items[index];item.sets=Math.max(1,Math.min(4,change.sets??(change.op==='shorten'?item.sets-1:item.sets)));
   if(change.reps&&'reps'in item.target){const reps=Number.parseInt(change.reps,10);if(Number.isFinite(reps))item.target.reps=Math.max(1,Math.min(100,reps));}
   if(change.seconds&&'durationSeconds'in item.target)item.target.durationSeconds=Math.max(1,Math.min(7200,change.seconds));
   applied++;
  }
 }
 return applied;
}
/** Picked calendar days stay fixed unless the latest user message explicitly asks to change days. */
export function daysLocked(request:AssistantRequest):boolean{
 return !!request.context?.schedule&&!explicitScheduleChange(request.messages.at(-1)?.content??'');
}
/** The model may describe changes; identity, metrics and durations come only from code. */
export function assembleAssistantIntent(raw:unknown,request:AssistantRequest):{attachment:AssistantAttachment|null;dropped:string[];repaired:boolean}{
 const parsed=typeof raw==='string'?JSON.parse(raw):raw;
 const value=parsed&&typeof parsed==='object'&&'intent'in parsed?parsed.intent:parsed;
 let intent=assistantIntentSchema.parse(value);
 if(request.context?.trainingEngine)return assembleEngineIntent(intent,request);
 const context=request.context,candidates=applicableAssistantCandidates(request),dropped:string[]=[];
 if(!request.adultConfirmed||!context)return {attachment:null,dropped,repaired:false};
 const explicitReplacements=explicitExistingReplacements(request);
 if((intent.kind==='none'||intent.kind==='clarify')&&!explicitReplacements.length)return {attachment:null,dropped,repaired:false};
 if(explicitReplacements.length&&(intent.kind==='none'||intent.kind==='clarify'))intent={kind:'plan_modify',changes:explicitReplacements};
 const identity={requestId:context.requestId,restoreGeneration:context.restoreGeneration,mutationAllowed:false as const};
 if(intent.kind==='plan_new'&&context.task==='ONBOARD_PLAN'){
  // Calendar-picked days are fixed: the model's day count or weekdays never replace them unless the user asked.
  const p=daysLocked(request)?{...intent.params,daysPerWeek:undefined,preferredDays:undefined}:intent.params,profile={...context.profile,weeklyTarget:p.daysPerWeek??context.profile.weeklyTarget,sessionMinutes:sessionDuration(request.messages.at(-1)?.content??'')??p.minutesPerSession??context.profile.sessionMinutes,
   place:context.profile.place,equipment:context.profile.equipment,
   preferredDays:p.preferredDays?.filter(day=>['mon','tue','wed','thu','fri','sat','sun'].includes(day)) as typeof context.profile.preferredDays??context.profile.preferredDays,
   cautions:[...new Set([...context.profile.cautions,...(p.cautionAreas??[]).filter(area=>['knee','back','shoulder','wrist','other'].includes(area))])] as typeof context.profile.cautions};
  const proposal=basicProposal({...profile,confirmedAt:new Date().toISOString()},request.locale);
  if(!proposal||!proposal.templates.length)throw Error('NO_SAFE_PLAN');
  for(const template of proposal.templates){
   const used=new Set<string>();
   template.items=template.items.flatMap(item=>{
    const original=exercises.find(exercise=>exercise.id===item.exerciseId);
    const candidate=candidates.find(row=>row.exercise.id===item.exerciseId)
     ??candidates.find(row=>original&&row.mode===assistantMovement(original)&&!used.has(row.exercise.id));
    if(!candidate){dropped.push('outside_client_catalog');return [];}
    used.add(candidate.exercise.id);
    if(candidate.exercise.id===item.exerciseId)return [item];
    dropped.push('outside_client_catalog_substituted');
    return [{...newItem(candidate),sets:item.sets}];
   });
   coverPatterns(template,candidates);
   if(!template.items.length)throw Error('NO_SAFE_PLAN');
  }
  for(const pick of intent.picks??[]){const candidate=resolveAssistantExercise(pick.code,candidates);if(!candidate){dropped.push('unknown_exercise');continue;}
   const [slot,mode]=pick.slot.split(':');const template=proposal.templates.find(row=>row.id===slot||row.name===slot);
   if(!template){dropped.push('unknown_slot');continue;}
   const index=template.items.findIndex(item=>{const exercise=exercises.find(row=>row.id===item.exerciseId);return exercise&&assistantMovement(exercise)===mode;});
   if(index<0){dropped.push('unknown_pattern');continue;}template.items[index]=newItem(candidate);
  }
  for(const template of proposal.templates){
   coverPatterns(template,candidates);
   if(/瘦|减脂|体脂|fat_loss|fat loss|weight loss/i.test(profile.goalText)||p.goal==='fat_loss'){
    const cardio=candidates.find(row=>row.mode==='cardio'&&!/run|jump|hop|climber|lunge/i.test(row.exercise.name.en));
    if(cardio&&!template.items.some(item=>candidates.find(row=>row.exercise.id===item.exerciseId)?.mode==='cardio'))template.items.push(newItem(cardio));
   }
   fitDuration(template,profile.sessionMinutes,candidates);
  }
  return {attachment:coachResponseSchema.parse({...identity,type:'plan_proposal',proposal}),dropped,repaired:dropped.length>0};
 }
 if(intent.kind==='plan_modify'&&context.task==='MODIFY_PLAN'){
  const scope=namedPlanScope(request),scoped=scope.templates.size>0||scope.items.size>0;
  const changesToApply=intent.changes.filter(change=>change.op==='add'||!scope.items.size||context.plan.templates.some(template=>findExistingItem(template,change.from)>=0)).map(change=>({...change}));
  if(explicitReplacements.some(change=>change.to)){
   for(let index=changesToApply.length-1;index>=0;index--)if(changesToApply[index].op==='replace'&&!explicitReplacements.some(change=>context.plan.templates.some(template=>template.id===change.session&&findExistingItem(template,change.from)===findExistingItem(template,changesToApply[index].from))))changesToApply.splice(index,1);
  }
  if(scope.templates.size)for(const change of changesToApply)if(!change.session)change.session=[...scope.templates][0];
  const additions=changesToApply.filter(change=>change.op==='add');
  const additionName=context.instruction.match(/(?:加|增加|add)\s*(?:一个|one\s+)?\s*(.+?)(?:[。；;]|$)/i)?.[1];
  const explicitlyAdded=resolveAssistantExercise(additionName,candidates);
  if(explicitlyAdded)for(const change of additions)change.to=explicitlyAdded.code;
  const singleAddition=!/(?:[2-9二两三四五六七八九])\s*(?:个|项|动作)|\b[2-9]\s+(?:exercises|movements)/i.test(request.messages.at(-1)?.content??'');
  if(singleAddition&&additions.length){
   const destination=scope.templates.size?[...scope.templates][0]:[...context.plan.templates].sort((a,b)=>a.estimatedMinutes-b.estimatedMinutes)[0].id;
   let retained=false;
   for(let i=changesToApply.length-1;i>=0;i--)if(changesToApply[i].op==='add'){if(retained)changesToApply.splice(i,1);else{changesToApply[i].session=destination;retained=true;}}
  }
  if(/加.*(?:练腿|腿部|下肢)|add.*(?:leg|lower.body)/i.test(request.messages.at(-1)?.content??'')){
   const safe=lowerBodyAddition(request);
   for(const change of changesToApply)if(change.op==='add'){const choice=resolveAssistantExercise(change.to,candidates);if(!choice||context.plan.templates.some(template=>template.items.some(item=>sameExerciseFamily(exercises.find(e=>e.id===item.exerciseId)!,choice.exercise))))change.to=safe?.code;}
  }
  for(const inferred of explicitReplacements){
   const existing=changesToApply.find(change=>change.op==='replace'&&(!change.session||change.session===inferred.session)&&context.plan.templates.some(template=>template.id===inferred.session&&findExistingItem(template,change.from)===findExistingItem(template,inferred.from)));
   if(existing&&inferred.to)existing.to=inferred.to;
   else if(!existing)changesToApply.push(inferred);
  }
  const proposal=structuredClone(context.plan);
  const explicitMinutes=sessionDuration(context.instruction);
  if(intent.params&&daysLocked(request))intent={...intent,params:{...intent.params,daysPerWeek:undefined,preferredDays:undefined}};
  if(intent.params?.daysPerWeek)proposal.weeklyTarget=intent.params.daysPerWeek;
  if(intent.params?.daysPerWeek&&proposal.preferredDays&&proposal.preferredDays.length!==proposal.weeklyTarget){
   const order=['mon','tue','wed','thu','fri','sat','sun'] as const;
   proposal.preferredDays=[...new Set([...proposal.preferredDays,...order])].slice(0,proposal.weeklyTarget);
  }
  if(intent.params?.preferredDays)proposal.preferredDays=intent.params.preferredDays.filter(day=>['mon','tue','wed','thu','fri','sat','sun'].includes(day)) as typeof proposal.preferredDays;
  if(explicitMinutes)proposal.sessionMinutes=Math.max(15,explicitMinutes);
  for(const template of proposal.templates){
   if(scope.templates.size&&!scope.templates.has(template.id))continue;
   const filtered=changesToApply.filter(change=>!scope.templates.size||!change.session||scope.templates.has(change.session));
   applyChanges(template,filtered,candidates,new Set(),dropped,context.plan.templates.flatMap(t=>t.items),/(?:换成|替换为|换为|replace.+with|swap.+for)/i.test(context.instruction));
   if(explicitMinutes)fitDuration(template,proposal.sessionMinutes,candidates);else recalculate(template);
   syncTemplateName(template,request.locale);
  }
  proposal.scheduleOriginalText=context.plan.scheduleOriginalText;
  if(explicitReplacements.length&&!context.plan.templates.some((before,index)=>
   before.items.some((item,itemIndex)=>item.exerciseId!==proposal.templates[index]?.items[itemIndex]?.exerciseId)))throw Error('NO_APPLICABLE_CHANGE');
  const changes=[...new Set(context.plan.templates.flatMap((before,index)=>proposal.templates[index]?templateDiff(before,proposal.templates[index],request.locale):[]))];
  if(context.plan.weeklyTarget!==proposal.weeklyTarget)changes.push(request.locale==='zh'?`每周${proposal.weeklyTarget}次`:`${proposal.weeklyTarget} times per week`);
  if(JSON.stringify(context.plan.preferredDays??[])!==JSON.stringify(proposal.preferredDays??[]))changes.push(request.locale==='zh'?'调整训练日':'Changed training days');
  if(!changes.length)throw Error('NO_APPLICABLE_CHANGE');
  changes.push(request.locale==='zh'?`预计${estimatedDurationLabel(proposal.templates,request.locale)}`:`About ${estimatedDurationLabel(proposal.templates,request.locale)}`);
  const reason=request.locale==='zh'?'按已确认的场地、器械和注意部位筛选动作。':'Exercises respect the confirmed place, equipment and cautions.';
  proposal.reasons=[changes[0],changes[1]??reason,request.locale==='zh'?`每次预计约${estimatedDurationLabel(proposal.templates,request.locale)}。`:`About ${estimatedDurationLabel(proposal.templates,request.locale)} per workout.`];
  return {attachment:coachResponseSchema.parse({...identity,type:'change_proposal',target:context.target,proposal,changes}),dropped,repaired:dropped.length>0};
 }
 if(intent.kind==='today_adjust'&&context.task==='ADJUST_TODAY'){
  const template=structuredClone(context.template),locked=new Set(request.currentWorkout?.completedSets.map(set=>set.itemIndex)??[]);
  applyChanges(template,intent.changes??[],candidates,locked,dropped);
  const latest=request.messages.at(-1)?.content??'';
  if(/膝盖.{0,8}(?:疼|痛|不适|受伤|舒服|伤)|knee\s*(?:pain|injury|discomfort)/i.test(latest)){
   for(let index=0;index<template.items.length;index++){
    const exercise=exercises.find(row=>row.id===template.items[index].exerciseId);
    if(!locked.has(index)&&exercise&&/squat|lunge|leg.press|jump|hop|burpee/i.test(exercise.name.en)){
     const replacement=candidates.find(row=>row.mode==='hinge'&&!template.items.some(item=>item.exerciseId===row.exercise.id));
     if(replacement)template.items[index]=replacementItem(template.items[index],replacement);
    }
   }
  }
  const focus=intent.focus??(/只练上半身|只练上肢|upper.body only/i.test(latest)?'upper':undefined);
  if(focus&&focus!=='full'){
   const accepts=(mode:string)=>focus==='upper'?['push','pull','core'].includes(mode):focus==='lower'?['squat','hinge','lower','core'].includes(mode):focus==='core'?mode==='core':mode==='mobility';
   const lastCompleted=locked.size?Math.max(...locked):-1;
   template.items=template.items.filter((item,index)=>index<=lastCompleted||accepts(assistantMovement(exercises.find(row=>row.id===item.exerciseId)!)));
   if(!template.items.length){const safe=candidates.find(row=>accepts(row.mode));if(safe)template.items.push(newItem(safe));}
   for(const mode of focus==='upper'?['push','pull','core']:focus==='lower'?['squat','hinge']:[]){
    if(!template.items.some(item=>assistantMovement(exercises.find(row=>row.id===item.exerciseId)!)===mode)){
     const safe=candidates.find(row=>row.mode===mode&&!template.items.some(item=>item.exerciseId===row.exercise.id));if(safe)template.items.push(newItem(safe));
    }
   }
  }
  const spokenMinutes=sessionDuration(latest);
  const desired=spokenMinutes??(intent.changes?.some(change=>change.op==='replace')?undefined:intent.minutes);
  if(desired)fitDuration(template,desired,candidates,locked);else recalculate(template,10);
  if(desired&&Math.abs(template.estimatedMinutes-desired)>desired*.1)throw Error('NO_APPLICABLE_CHANGE');
  syncTemplateName(template,request.locale);
  const changes=templateDiff(context.template,template,request.locale);
  if(!changes.length)throw Error('NO_APPLICABLE_CHANGE');
  const cautions=/膝盖.{0,8}(?:疼|痛|不适|受伤|舒服|伤)|knee\s*(?:pain|injury|discomfort)/i.test(request.messages.at(-1)?.content??'')&&template.items.every(item=>{const exercise=exercises.find(row=>row.id===item.exerciseId);return !!exercise&&!/squat|lunge|leg.press|jump|hop|burpee/i.test(exercise.name.en);});
  const summary=(request.locale==='zh'?`调整${diffTemplates([context.template],[template]).changes.length}项 · 预计${template.estimatedMinutes}分钟`:`${diffTemplates([context.template],[template]).changes.length} changes · about ${template.estimatedMinutes} minutes`)+(cautions?(request.locale==='zh'?' · 已避开加重膝盖负担的动作':' · Avoids high knee-load movements'):'');
  return {attachment:coachResponseSchema.parse({...identity,type:'today_adjustment',target:context.target,workoutId:context.workoutId,template,summary}),dropped,repaired:dropped.length>0};
 }
 if(intent.kind==='review'&&context.task==='PERIOD_REVIEW'){
  const f=context.facts,opening=request.locale==='zh'?`这段时间完成 ${f.complete} 次，部分完成 ${f.partial} 次。`:`${f.complete} complete and ${f.partial} partial sessions in this period.`;
  return {attachment:coachResponseSchema.parse({...identity,type:'review_summary',target:context.target,opening,encouragement:request.locale==='zh'?'这些记录可以帮助你调整下一步。':'These records can guide the next step.',gap:request.locale==='zh'?'按已有记录看即可。':'Only recorded activity is counted.',dataBoundary:[]}),dropped,repaired:false};
 }
 return {attachment:null,dropped,repaired:false};
}
