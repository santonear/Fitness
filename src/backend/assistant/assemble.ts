import { assistantIntentSchema, type AssistantAttachment, type AssistantIntent, type AssistantRequest } from '../../assistant/contracts';
import { basicProposal } from '../../application/v8-workflow';
import { estimatePlannedMinutes } from '../../application/rules/duration-estimate';
import { selectAssistantCandidates, assistantMovement } from '../../catalog/ai-catalog';
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
 while(estimatePlannedMinutes(template.items)>minutes){
  const reducible=[...template.items].reverse().find(item=>item.sets>1);
  if(!reducible)break;
  reducible.sets--;
 }
 recalculate(template);
}
function findExistingItem(template:SessionTemplate,value:string|undefined):number{
 if(!value)return -1;
 const key=normal(value);
 return template.items.findIndex(item=>{
  const exercise=exercises.find(row=>row.id===item.exerciseId);
  return !!exercise&&[exercise.id,exercise.name.zh,exercise.name.en,...catalogMetadata.get(exercise.id)?.aliases??[]].some(name=>normal(name)===key);
 });
}
function applyChanges(template:SessionTemplate,changes:Extract<AssistantIntent,{kind:'plan_modify'}>['changes'],candidates:Candidate[],locked=new Set<number>(),dropped:string[]=[]){
 let applied=0;
 for(const change of changes){
  if(change.session&&change.session!==template.id&&change.session!==template.name&&change.session!=='今天')continue;
  const index=findExistingItem(template,change.from);
  const to=resolveAssistantExercise(change.to,candidates);
  if(change.op==='add'&&to&&!template.items.some(item=>item.exerciseId===to.exercise.id)){
   const before=estimatePlannedMinutes(template.items),added=newItem(to);
   template.items.push(added);
   while(added.sets<4&&estimatePlannedMinutes(template.items)<=before)added.sets++;
   applied++;
  }
  else if(change.op==='add'&&!to)dropped.push('unknown_or_unsafe_exercise');
  if(index<0||locked.has(index))continue;
  if(change.op==='replace'&&to){template.items[index]=newItem(to);applied++;}
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
 const intent=assistantIntentSchema.parse(value);
 const context=request.context,candidates=selectAssistantCandidates(request),dropped:string[]=[];
 if(!request.adultConfirmed||!context||intent.kind==='none'||intent.kind==='clarify')return {attachment:null,dropped,repaired:false};
 const identity={requestId:context.requestId,restoreGeneration:context.restoreGeneration,mutationAllowed:false as const};
 if(intent.kind==='plan_new'&&context.task==='ONBOARD_PLAN'){
  const p=intent.params,profile={...context.profile,weeklyTarget:p.daysPerWeek??context.profile.weeklyTarget,sessionMinutes:p.minutesPerSession??context.profile.sessionMinutes,
   place:context.profile.place,equipment:context.profile.equipment,
   preferredDays:p.preferredDays?.filter(day=>['mon','tue','wed','thu','fri','sat','sun'].includes(day)) as typeof context.profile.preferredDays??context.profile.preferredDays,
   cautions:[...new Set([...context.profile.cautions,...(p.cautionAreas??[]).filter(area=>['knee','back','shoulder','wrist','other'].includes(area))])] as typeof context.profile.cautions};
  const proposal=basicProposal({...profile,confirmedAt:new Date().toISOString()},request.locale);
  if(!proposal||!proposal.templates.length)throw Error('NO_SAFE_PLAN');
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
  const proposal=structuredClone(context.plan);
  if(intent.params?.daysPerWeek)proposal.weeklyTarget=intent.params.daysPerWeek;
  if(intent.params?.preferredDays)proposal.preferredDays=intent.params.preferredDays.filter(day=>['mon','tue','wed','thu','fri','sat','sun'].includes(day)) as typeof proposal.preferredDays;
  if(intent.params?.minutesPerSession)proposal.sessionMinutes=Math.max(15,intent.params.minutesPerSession);
  let applied=0;
  for(const template of proposal.templates){applied+=applyChanges(template,intent.changes,candidates,new Set(),dropped);coverPatterns(template,candidates);if(intent.params?.minutesPerSession)fitDuration(template,proposal.sessionMinutes);else recalculate(template);}
  if(intent.changes.some(change=>change.op==='add')&&!intent.params?.minutesPerSession){
   const lengths=proposal.templates.map(template=>template.estimatedMinutes).sort((a,b)=>a-b);
   proposal.sessionMinutes=Math.round((lengths[Math.floor((lengths.length-1)/2)]+lengths[Math.ceil((lengths.length-1)/2)])/2);
  }
  if(intent.changes.length&&!applied&&!intent.params?.daysPerWeek&&!intent.params?.minutesPerSession&&!intent.params?.preferredDays?.length)throw Error('NO_APPLICABLE_CHANGE');
  const changes=intent.changes.map(change=>`${change.op}: ${change.from??''} ${change.to??''}`.trim());
  return {attachment:coachResponseSchema.parse({...identity,type:'change_proposal',target:context.target,proposal,changes:changes.length?changes:['Adjusted the plan.']}),dropped,repaired:dropped.length>0};
 }
 if(intent.kind==='today_adjust'&&context.task==='ADJUST_TODAY'){
  const template=structuredClone(context.template),locked=new Set(request.currentWorkout?.completedSets.map(set=>set.itemIndex)??[]);
  applyChanges(template,intent.changes??[],candidates,locked,dropped);
  const desired=intent.minutes;
  if(desired){while(estimatePlannedMinutes(template.items,10)>desired){const candidate=template.items.map((item,index)=>({item,index})).reverse().find(({item,index})=>!locked.has(index)&&item.sets>1);if(!candidate)break;candidate.item.sets--;}}
  recalculate(template,10);
  const summary=request.locale==='zh'?`已整理本次训练，预计 ${template.estimatedMinutes} 分钟。`:`This workout is estimated at ${template.estimatedMinutes} minutes.`;
  return {attachment:coachResponseSchema.parse({...identity,type:'today_adjustment',target:context.target,workoutId:context.workoutId,template,summary}),dropped,repaired:dropped.length>0};
 }
 if(intent.kind==='review'&&context.task==='PERIOD_REVIEW'){
  const f=context.facts,opening=request.locale==='zh'?`这段时间完成 ${f.complete} 次，部分完成 ${f.partial} 次。`:`${f.complete} complete and ${f.partial} partial sessions in this period.`;
  return {attachment:coachResponseSchema.parse({...identity,type:'review_summary',target:context.target,opening,encouragement:request.locale==='zh'?'这些记录可以帮助你调整下一步。':'These records can guide the next step.',gap:request.locale==='zh'?'按已有记录看即可。':'Only recorded activity is counted.',dataBoundary:[]}),dropped,repaired:false};
 }
 return {attachment:null,dropped,repaired:false};
}
