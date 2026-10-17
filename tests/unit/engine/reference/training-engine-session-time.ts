/** Legacy independent unit-test reference only; never used by V2 generation or acceptance. */
import {postpartumPhase} from '../../../../tools/eval/training-engine-quality';
import type {EnginePlan,EngineProfile,ValidationIssue} from '../../../../src/engine/contracts';
import type {SessionTemplate,PlannedItem} from '../../../../src/domain/v8/contracts';
import {Rules} from '../../../../src/engine/data';
import {independentTemplateTarget} from './training-engine-template-target';
import {authoredBodyweightMain} from './training-engine-source-warmup';

const rules=new Rules();
export function actualSetSeconds(item:PlannedItem):number {
 const exercise=rules.byExercise.get(item.exerciseId);if(!exercise)return 0;
 const overhead=rules.get('duration.set.overhead'),sides=item.prescription?.perSide||exercise.time.per_side?rules.get('session.time.model').per_side_multiplier:1;
 const work='durationSeconds'in item.target?item.target.durationSeconds:'reps'in item.target?item.target.reps*(item.prescription?.secondsPerRep??exercise.time.s_per_rep??rules.get('duration.rep.seconds').default_if_unknown):0;
 return work*sides+(exercise.modality==='mobility'?overhead.mobility_overhead_s_per_set:overhead.overhead_s_per_set);
}
/** Actual source-backed work and per-set overhead; deliberately ignores displayed estimates. */
export function actualBlockSeconds(template:SessionTemplate,block:'warmup'|'cooldown'):number {
 return template.items.filter(item=>item.prescription?.block===block).reduce((total,item)=>total+item.sets*actualSetSeconds(item),0);
}
/** Only a source-replayed identity and prescription can contribute a main-item ramp to safety. */
export function independentWarmupAudit(template:SessionTemplate,profile:EngineProfile):{seconds:number;issues:ValidationIssue[]}{
 const issues:ValidationIssue[]=[],source=rules.get('session.warmup.ramp_sets'),model=rules.get('duration.ramp.sets'),minutes=independentTemplateTarget(template,profile).minutes;let firstLoaded=false,seconds=actualBlockSeconds(template,'warmup');
 for(const [itemIndex,item]of template.items.entries()){
  const e=rules.byExercise.get(item.exerciseId),p=item.prescription;if(!e||!p)continue;let expected=0;
  const working=['main','accessory'].includes(p.block??''),compound=e.modality==='strength'&&e.nsca_class==='compound',loaded=working&&compound&&e.metricType==='reps_load'&&item.target.metricType==='reps_load'&&e.time.setup_s>=15&&minutes>=30;
  if(loaded){if(!firstLoaded)expected=model.first_loaded_compound.ramp_s;else if(e.time.setup_s===60)expected=model.later_barbell_compound.ramp_s;firstLoaded=true;}
  const main=authoredBodyweightMain(item,template,profile,minutes);
  if(working&&main&&compound&&e.equipment_required.every(value=>value==='none')&&e.metricType==='reps'&&'reps'in item.target){const reps=Math.ceil(item.target.reps*source.bodyweight_main.target_rep_fraction),side=p.perSide||e.time.per_side?rules.get('session.time.model').per_side_multiplier:1;expected=source.bodyweight_main.sets*(reps*(profile.goal==='mobility'?Math.max(rules.get('goal.params.mobility').rep_duration_min_s,e.time.s_per_rep??rules.get('duration.rep.seconds').default_if_unknown):(p.secondsPerRep??e.time.s_per_rep??rules.get('duration.rep.seconds').default_if_unknown))*side+rules.get('duration.set.overhead').overhead_s_per_set);}
  const actual=p.warmupSeconds??0;if(actual===0)continue;if(actual!==expected){issues.push({code:'external_ramp_source',ruleId:'session.warmup.ramp_sets',severity:'error',reason:`ramp_actual:${actual};source_identity_seconds:${expected}`,templateId:template.id,itemIndex});continue;}seconds+=expected;
 }
 return {seconds,issues};
}
function independentRoundRest(members:PlannedItem[],structure:'superset'|'circuit'):number{
 const source=rules.get('duration.rest.block')[structure],values=members.map(item=>item.prescription?.roundRestSeconds),range=source.after_round_range_s;
 return structure==='superset'&&members.length>=2&&values.every(value=>typeof value==='number'&&Number.isInteger(value)&&value>=range[0]&&value<=range[1]&&value===values[0])?values[0]!:source.after_round_s;
}
/** The optional value is valid only on a real, consistently prescribed superset. */
export function independentRoundRestIssues(plan:EnginePlan):ValidationIssue[]{
 const issues:ValidationIssue[]=[],range=rules.get('duration.rest.block').superset.after_round_range_s;
 for(const template of plan.templates)for(const [itemIndex,item]of template.items.entries()){
  const p=item.prescription,value=p?.roundRestSeconds;if(value===undefined)continue;
  const members=p?.groupId?template.items.filter(member=>member.prescription?.groupId===p.groupId):[];
  const valid=p?.structure==='superset'&&members.length>=2&&!['warmup','cooldown','mobility'].includes(p.block)&&Number.isInteger(value)&&value>=range[0]&&value<=range[1]&&members.every(member=>member.prescription?.structure==='superset'&&member.prescription.roundRestSeconds===value);
  if(!valid)issues.push({code:'external_round_rest',ruleId:'duration.rest.block',severity:'error',reason:'explicit_round_rest_outside_authored_superset_contract',templateId:template.id,itemIndex});
 }
 return issues;
}
/** A round visits only the stations that still have one of their actual prescribed sets. */
export function independentlyGroupedSeconds(members:PlannedItem[],structure:'superset'|'circuit'):number {
 if(members.length<2)throw Error('Grouped timing requires at least two actual members');
 const rest=rules.get('duration.rest.block')[structure],rounds=Math.max(...members.map(item=>item.sets));
 let total=members.reduce((sum,item)=>sum+(rules.byExercise.get(item.exerciseId)?.time.setup_s??0)+(item.prescription?.warmupSeconds??0),rules.get('duration.transition.setup').buffer_s);
 for(let round=0;round<rounds;round++){
  const active=members.filter(item=>item.sets>round);
  total+=active.reduce((sum,item)=>sum+actualSetSeconds(item),0);
  total+=Math.max(0,active.length-1)*(rest.between_exercises_s??rest.between_stations_s);
  if(round<rounds-1)total+=independentRoundRest(members,structure);
 }
 return total;
}
/** The current contract has no interval/HIIT recipe. RIR is never treated as aerobic RPE. */
export function independentlyApplicableSessionTypes(template:SessionTemplate,profile?:EngineProfile):string[]{
 if(template.durationScope==='untargeted'&&profile&&postpartumPhase(profile)===1)return [];
 const types:string[]=[];
 if(template.items.some(item=>item.prescription?.structure==='circuit'))types.push('circuit');
 const moderate=rules.get('aerobic.intensity.rpe_scale').moderate[0];
 const cardio=template.items.some(item=>{
  if(item.prescription?.block!=='conditioning'||rules.byExercise.get(item.exerciseId)?.modality!=='cardio')return false;
  const rpe=(item.prescription as {targetRpe?:[number,number]}).targetRpe;
  // Missing legacy intensity uses the authored conditioning default, rather than assuming low effort.
  return rpe?rpe[1]>=moderate:rules.get('aerobic.bout.any_length').min_intensity==='moderate';
 });
 if(cardio)types.push('aerobic_moderate_plus');return types;
}
export function independentSessionTimeIssues(plan:EnginePlan,profile:EngineProfile):ValidationIssue[]{
 const rule=rules.get('safety.session.warmup_cooldown'),issues:ValidationIssue[]=[];
 for(const template of plan.templates){
  const ramp=independentWarmupAudit(template,profile);issues.push(...ramp.issues);
  const target=independentTemplateTarget(template,profile).minutes,durations=rules.get('session.durations.allowed'),allowed=durations.minutes.filter((value:number)=>value<=target).at(-1)??durations.minutes[0],tier=profile.level==='beginner'&&allowed===90?durations.min90_beginner_fallback:allowed;
  const row=rules.get(rule.other_sessions).by_session_min.filter((value:{session:number})=>value.session<=tier).at(-1),general=rules.get('session.warmup.general'),dynamic=rules.get('session.warmup.dynamic'),warm=template.items.filter(i=>i.prescription?.block==='warmup'),resistance=template.items.some(i=>{const e=rules.byExercise.get(i.exerciseId);return e&&['strength','isometric'].includes(e.modality)&&e.primary_pattern!=='balance';});
  const work=(item:PlannedItem)=>'durationSeconds'in item.target?item.sets*item.target.durationSeconds*(item.prescription?.perSide||rules.byExercise.get(item.exerciseId)?.time.per_side?rules.get('session.time.model').per_side_multiplier:1):0,generalSeconds=warm.filter(i=>rules.byExercise.get(i.exerciseId)?.modality==='cardio').reduce((sum,i)=>sum+work(i),0),dynamics=warm.filter(i=>rules.byExercise.get(i.exerciseId)?.mobility_type==='dynamic'),dynamicSeconds=dynamics.reduce((sum,i)=>sum+work(i),0);
  const applicable=independentlyApplicableSessionTypes(template,profile).some(type=>rule.applies_to_session_types.includes(type)),generalItems=warm.filter(i=>rules.byExercise.get(i.exerciseId)?.modality==='cardio');
  const integerFill=(()=>{if(generalItems.length!==1)return false;const item=generalItems[0],e=rules.byExercise.get(item.exerciseId)!;if(!('durationSeconds'in item.target))return false;const factor=item.sets*(item.prescription?.perSide||e.time.per_side?rules.get('session.time.model').per_side_multiplier:1),other=ramp.seconds-item.sets*actualSetSeconds(item),overhead=item.sets*rules.get('duration.set.overhead').overhead_s_per_set,minimum=rule.warmup_min_minutes*60;return item.target.durationSeconds===Math.max(1,Math.ceil((minimum-other-overhead)/factor))&&ramp.seconds>=minimum&&ramp.seconds<minimum+factor;})();
  const exactSafetyFill=applicable&&(ramp.seconds===rule.warmup_min_minutes*60||integerFill);
  if(resistance&&generalSeconds){const sourceRange=general.seconds_by_duration[String(tier)],range=Array.isArray(sourceRange)?sourceRange:[sourceRange,sourceRange];if(generalSeconds<range[0]||generalSeconds>range[1]&&!exactSafetyFill)issues.push({code:'external_general_warmup_range',ruleId:'session.warmup.general',severity:'error',reason:`general_actual_work:${generalSeconds};source_range:${range[0]},${range[1]}`,templateId:template.id});}
  if(dynamics.length&&(dynamicSeconds<dynamic.seconds[0]||dynamicSeconds>dynamic.seconds[1]||dynamics.length<dynamic.exercises[0]||dynamics.length>dynamic.exercises[1]))issues.push({code:'external_dynamic_warmup_range',ruleId:'session.warmup.dynamic',severity:'error',reason:`dynamic_actual_work:${dynamicSeconds};actions:${dynamics.length};source_range:${dynamic.seconds[0]},${dynamic.seconds[1]}`,templateId:template.id});
  if(template.durationScope==='untargeted'&&postpartumPhase(profile)!==1)issues.push({code:'external_untargeted_scope',ruleId:'postpartum.phase1',severity:'error',reason:'untargeted_scope_outside_source_postpartum_phase_one',templateId:template.id});
  const types=independentlyApplicableSessionTypes(template,profile);if(!types.some(type=>rule.applies_to_session_types.includes(type)))continue;
  for(const block of ['warmup','cooldown'] as const){const actual=block==='warmup'?ramp.seconds:actualBlockSeconds(template,block),minimum=(block==='warmup'?rule.warmup_min_minutes:Math.max(rule.cooldown_min_minutes,row.cooldown))*60;
   if(actual<minimum)issues.push({code:`safety_${block}_duration`,ruleId:'safety.session.warmup_cooldown',severity:'error',reason:`actual_${block}_seconds:${actual}<${minimum}`,templateId:template.id});
  }
 }
 return issues;
}
