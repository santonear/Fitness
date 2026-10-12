import {diffTemplates} from '../../assistant/template-diff';
import { assistantIntentSchema, type AssistantAttachment, type AssistantIntent, type AssistantRequest } from '../../assistant/contracts';
import { basicProposal } from '../../application/v8-workflow';
import { estimatePlannedMinutes } from '../../application/rules/duration-estimate';
import { selectAssistantCandidates, assistantMovement } from '../../catalog/ai-catalog';
import {applicableAssistantCandidates,lowerBodyAddition} from './applicable-candidates';
import { catalogMetadata } from '../../catalog/registry';
import { exercises } from '../../catalog/exercises';
import { coachResponseSchema } from '../../coach/contracts';
import type { PlannedItem, SessionTemplate } from '../../domain/v8/contracts';

type Candidate = ReturnType<typeof selectAssistantCandidates>[number];
const normal = (value: string) => value.toLocaleLowerCase().replace(/[\s_\-·]/g,'');
function distance(a:string,b:string){const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let last=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,last+(a[i-1]===b[j-1]?0:1));last=old;}}return row[b.length];}
export function resolveAssistantExercise(value:string|undefined,candidates:Candidate[]):Candidate|undefined{
 if(!value)return;
 const code=candidates.find(row=>row.code.toLowerCase()===value.toLowerCase());if(code)return code;
 const input=normal(value);
 const names=(row:Candidate)=>[row.exercise.name.zh,row.exercise.name.en,...catalogMetadata.get(row.exercise.id)?.aliases??[]].map(normal);
 const exact=candidates.filter(row=>names(row).includes(input));if(exact.length===1)return exact[0];
 const ranked=candidates.map(row=>({row,score:Math.min(...names(row).map(name=>distance(input,name)))})).sort((a,b)=>a.score-b.score);
 return ranked[0]&&ranked[0].score<=Math.max(2,Math.floor(input.length/4))&&ranked[0].score<ranked[1]?.score?ranked[0].row:undefined;
}
function newItem(candidate:Candidate):PlannedItem{
 const exercise=candidate.exercise;
 const target=exercise.metricType==='reps_load'?{metricType:'reps_load' as const,reps:8,loadGrams:0}:
  exercise.metricType==='reps'?{metricType:'reps' as const,reps:8}:
  exercise.metricType==='duration'?{metricType:'duration' as const,durationSeconds:30}:{metricType:'duration_distance' as const,durationSeconds:300};
 return {exerciseId:exercise.id,equipment:exercise.equipment,sets:2,target};
}
function coverPatterns(template:SessionTemplate,candidates:Candidate[]){
 const patterns=()=>new Set(template.items.map(item=>{
  const exercise=exercises.find(row=>row.id===item.exerciseId);return exercise?assistantMovement(exercise):'mobility';
 }));
 const required=['push','pull','core','lower'] as const;
 for(const mode of required){const current=patterns();const covered=Number(current.has('push'))+Number(current.has('pull'))+Number(current.has('core'))+Number(current.has('squat')||current.has('hinge'));if(covered>=3&&current.has('push'))break;
  if(mode==='lower'&&(current.has('squat')||current.has('hinge')))continue;
  if(mode!=='lower'&&current.has(mode))continue;
  const safe=candidates.find(row=>(mode==='lower'?row.mode==='squat'||row.mode==='hinge':row.mode===mode)&&!template.items.some(item=>item.exerciseId===row.exercise.id));
  if(safe)template.items.push(newItem(safe));
 }
}
function recalculate(template:SessionTemplate,minimum=15){template.estimatedMinutes=estimatePlannedMinutes(template.items,minimum);}
function fitDuration(template:SessionTemplate,minutes:number){
 const lower=Math.ceil(minutes*.9),upper=Math.floor(minutes*1.1);
 for(let attempts=0;attempts<100&&estimatePlannedMinutes(template.items,10)>upper;attempts++){
  const reducible=[...template.items].reverse().find(item=>item.sets>1);
  if(!reducible)break;
  reducible.sets--;
 }
 for(let attempts=0;attempts<100&&estimatePlannedMinutes(template.items,10)<lower;attempts++){
  const expandable=template.items.find(item=>item.sets<4);
  if(!expandable)break;
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
  return !!exercise&&[exercise.id,exercise.name.zh,exercise.name.en,...catalogMetadata.get(exercise.id)?.aliases??[]].some(name=>normal(name)===key);
 });
}
function explicitExistingReplacements(request:AssistantRequest):Extract<AssistantIntent,{kind:'plan_modify'}>['changes']{
 const context=request.context;
 if(context?.task!=='MODIFY_PLAN')return [];
 const text=normal(request.messages.at(-1)?.content??'');
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
function applyChanges(template:SessionTemplate,changes:Extract<AssistantIntent,{kind:'plan_modify'}>['changes'],candidates:Candidate[],locked=new Set<number>(),dropped:string[]=[]){
 let applied=0;
 for(const change of changes){
  if(change.session&&change.session!==template.id&&change.session!==template.name&&change.session!=='今天')continue;
  const index=findExistingItem(template,change.from);
  const previous=index>=0?exercises.find(row=>row.id===template.items[index].exerciseId):undefined;
  const matched=resolveAssistantExercise(change.to,candidates);
  const replacementModes=previous?assistantMovement(previous)==='carry'?['carry','pull','core']: [assistantMovement(previous)]:[];
  const to=matched&&matched.exercise.id!==previous?.id?matched:previous?candidates.find(row=>replacementModes.includes(row.mode)&&row.exercise.id!==previous.id&&!template.items.some(item=>item.exerciseId===row.exercise.id)):matched;
  if(change.op==='add'&&to&&!template.items.some(item=>item.exerciseId===to.exercise.id)){
   const before=estimatePlannedMinutes(template.items),added=newItem(to);
   template.items.push(added);
   while(added.sets<4&&estimatePlannedMinutes(template.items)<=before)added.sets++;
   applied++;
  }
  else if(change.op==='add'&&!to)dropped.push('unknown_or_unsafe_exercise');
  if(index<0||locked.has(index))continue;
  if(change.op==='replace'&&to&&to.exercise.id!==previous?.id){template.items[index]=newItem(to);applied++;if(change.to&&!matched)dropped.push('unsafe_replacement_substituted');}
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
/** The model may describe changes; identity, metrics and durations come only from code. */
export function assembleAssistantIntent(raw:unknown,request:AssistantRequest):{attachment:AssistantAttachment|null;dropped:string[];repaired:boolean}{
 const parsed=typeof raw==='string'?JSON.parse(raw):raw;
 const value=parsed&&typeof parsed==='object'&&'intent'in parsed?parsed.intent:parsed;
 let intent=assistantIntentSchema.parse(value);
 const context=request.context,candidates=applicableAssistantCandidates(request),dropped:string[]=[];
 if(!request.adultConfirmed||!context)return {attachment:null,dropped,repaired:false};
 const explicitReplacements=explicitExistingReplacements(request);
 if((intent.kind==='none'||intent.kind==='clarify')&&!explicitReplacements.length)return {attachment:null,dropped,repaired:false};
 if(explicitReplacements.length&&(intent.kind==='none'||intent.kind==='clarify'))intent={kind:'plan_modify',changes:explicitReplacements};
 const identity={requestId:context.requestId,restoreGeneration:context.restoreGeneration,mutationAllowed:false as const};
 if(intent.kind==='plan_new'&&context.task==='ONBOARD_PLAN'){
  const p=intent.params,profile={...context.profile,weeklyTarget:p.daysPerWeek??context.profile.weeklyTarget,sessionMinutes:p.minutesPerSession??context.profile.sessionMinutes,
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
  for(const template of proposal.templates){coverPatterns(template,candidates);recalculate(template);}
  return {attachment:coachResponseSchema.parse({...identity,type:'plan_proposal',proposal}),dropped,repaired:dropped.length>0};
 }
 if(intent.kind==='plan_modify'&&context.task==='MODIFY_PLAN'){
  const scope=namedPlanScope(request),scoped=scope.templates.size>0||scope.items.size>0;
  const changesToApply=intent.changes.filter(change=>!scope.items.size||(change.from&&scope.items.has(exercises.find(e=>[e.id,e.name.zh,e.name.en].some(name=>normal(name)===normal(change.from!)))?.id??''))).map(change=>({...change}));
  if(scope.templates.size)for(const change of changesToApply)if(!change.session)change.session=[...scope.templates][0];
  if(/加.*(?:练腿|腿部|下肢)|add.*(?:leg|lower.body)/i.test(request.messages.at(-1)?.content??'')){
   const safe=lowerBodyAddition(request);
   for(const change of changesToApply)if(change.op==='add'&&!resolveAssistantExercise(change.to,candidates)&&safe)change.to=safe.code;
  }
  for(const inferred of explicitReplacements){
   if(!changesToApply.some(change=>change.op==='replace'&&change.session===inferred.session&&normal(change.from??'')===normal(inferred.from??'')))changesToApply.push(inferred);
  }
  const proposal=structuredClone(context.plan);
  if(intent.params?.daysPerWeek)proposal.weeklyTarget=intent.params.daysPerWeek;
  if(intent.params?.preferredDays)proposal.preferredDays=intent.params.preferredDays.filter(day=>['mon','tue','wed','thu','fri','sat','sun'].includes(day)) as typeof proposal.preferredDays;
  if(intent.params?.minutesPerSession)proposal.sessionMinutes=Math.max(15,intent.params.minutesPerSession);
  for(const template of proposal.templates){
   if(scope.templates.size&&!scope.templates.has(template.id))continue;
   const filtered=changesToApply.filter(change=>!scope.templates.size||!change.session||scope.templates.has(change.session));
   applyChanges(template,filtered,candidates,new Set(),dropped);
   if(!scoped)coverPatterns(template,candidates);
   if(intent.params?.minutesPerSession&&!scoped)fitDuration(template,proposal.sessionMinutes);else recalculate(template);
   syncTemplateName(template,request.locale);
  }
  proposal.scheduleOriginalText=context.plan.scheduleOriginalText;
  if(explicitReplacements.length&&!context.plan.templates.some((before,index)=>
   before.items.some((item,itemIndex)=>item.exerciseId!==proposal.templates[index]?.items[itemIndex]?.exerciseId)))throw Error('NO_APPLICABLE_CHANGE');
  const changes=[...new Set(context.plan.templates.flatMap((before,index)=>proposal.templates[index]?templateDiff(before,proposal.templates[index],request.locale):[]))];
  if(context.plan.weeklyTarget!==proposal.weeklyTarget)changes.push(request.locale==='zh'?`每周${proposal.weeklyTarget}次`:`${proposal.weeklyTarget} times per week`);
  if(JSON.stringify(context.plan.preferredDays??[])!==JSON.stringify(proposal.preferredDays??[]))changes.push(request.locale==='zh'?'调整训练日':'Changed training days');
  if(!changes.length)throw Error('NO_APPLICABLE_CHANGE');
  changes.push(request.locale==='zh'?`预计${proposal.sessionMinutes}分钟`:`About ${proposal.sessionMinutes} minutes`);
  const reason=request.locale==='zh'?'按已确认的场地、器械和注意部位筛选动作。':'Exercises respect the confirmed place, equipment and cautions.';
  proposal.reasons=[changes[0],changes[1]??reason,request.locale==='zh'?`每次预计约${proposal.sessionMinutes}分钟。`:`About ${proposal.sessionMinutes} minutes per workout.`];
  return {attachment:coachResponseSchema.parse({...identity,type:'change_proposal',target:context.target,proposal,changes}),dropped,repaired:dropped.length>0};
 }
 if(intent.kind==='today_adjust'&&context.task==='ADJUST_TODAY'){
  const template=structuredClone(context.template),locked=new Set(request.currentWorkout?.completedSets.map(set=>set.itemIndex)??[]);
  applyChanges(template,intent.changes??[],candidates,locked,dropped);
  const latest=request.messages.at(-1)?.content??'';
  const focus=intent.focus??(/只练上半身|只练上肢|upper.body only/i.test(latest)?'upper':undefined);
  if(focus&&focus!=='full'){
   const accepts=(mode:string)=>focus==='upper'?['push','pull','core'].includes(mode):focus==='lower'?['squat','hinge','core'].includes(mode):focus==='core'?mode==='core':mode==='mobility';
   template.items=template.items.filter((item,index)=>locked.has(index)||accepts(assistantMovement(exercises.find(row=>row.id===item.exerciseId)!)));
   if(!template.items.length){const safe=candidates.find(row=>accepts(row.mode));if(safe)template.items.push(newItem(safe));}
   for(const mode of focus==='upper'?['push','pull','core']:focus==='lower'?['squat','hinge']:[]){
    if(!template.items.some(item=>assistantMovement(exercises.find(row=>row.id===item.exerciseId)!)===mode)){
     const safe=candidates.find(row=>row.mode===mode&&!template.items.some(item=>item.exerciseId===row.exercise.id));if(safe)template.items.push(newItem(safe));
    }
   }
  }
  const spokenMinutes=latest.match(/(\d{1,3})\s*(?:分钟|minutes?|mins?)/i);
  const desired=spokenMinutes?Number(spokenMinutes[1]):intent.minutes;
  if(desired)fitDuration(template,desired);else recalculate(template,10);
  if(desired&&Math.abs(template.estimatedMinutes-desired)>desired*.1)throw Error('NO_APPLICABLE_CHANGE');
  syncTemplateName(template,request.locale);
  const changes=templateDiff(context.template,template,request.locale);
  if(!changes.length)throw Error('NO_APPLICABLE_CHANGE');
  const cautions=/膝盖.{0,8}(?:疼|痛|不适|受伤|舒服|伤)|knee\s*(?:pain|injury|discomfort)/i.test(request.messages.at(-1)?.content??'');
  const summary=(request.locale==='zh'?`调整${diffTemplates([context.template],[template]).changes.length}项 · 预计${template.estimatedMinutes}分钟`:`${diffTemplates([context.template],[template]).changes.length} changes · about ${template.estimatedMinutes} minutes`)+(cautions?(request.locale==='zh'?' · 已避开加重膝盖负担的动作':' · Avoids high knee-load movements'):'');
  return {attachment:coachResponseSchema.parse({...identity,type:'today_adjustment',target:context.target,workoutId:context.workoutId,template,summary}),dropped,repaired:dropped.length>0};
 }
 if(intent.kind==='review'&&context.task==='PERIOD_REVIEW'){
  const f=context.facts,opening=request.locale==='zh'?`这段时间完成 ${f.complete} 次，部分完成 ${f.partial} 次。`:`${f.complete} complete and ${f.partial} partial sessions in this period.`;
  return {attachment:coachResponseSchema.parse({...identity,type:'review_summary',target:context.target,opening,encouragement:request.locale==='zh'?'这些记录可以帮助你调整下一步。':'These records can guide the next step.',gap:request.locale==='zh'?'按已有记录看即可。':'Only recorded activity is counted.',dataBoundary:[]}),dropped,repaired:false};
 }
 return {attachment:null,dropped,repaired:false};
}
