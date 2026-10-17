/** Legacy independent unit-test reference only; never used by V2 generation or acceptance. */
import {Rules} from '../../../../src/engine/data';
import type {EngineProfile} from '../../../../src/engine/contracts';
import type {SessionTemplate,PlannedItem} from '../../../../src/domain/v8/contracts';
import {independentElapsedAllocation} from './training-engine-goal-share';
import {independentStartCooldown} from './training-engine-start-cooldown';
import {independentSourceRampSeconds,independentWarmupPool} from './training-engine-source-warmup';
import {independentlyPossibleIds,postpartumPhase} from '../../../../tools/eval/training-engine-quality';
const r=new Rules(),mean=(range:number[])=>Math.ceil((range[0]+range.at(-1)!)/2);
export function independentStartAllocation(p:EngineProfile){const goal=r.get('goal.params.start_moving'),week=Math.floor(p.trainingAgeWeeks)+1,cap=r.get('progression.new.week_caps'),intro=p.level==='beginner'&&week<=4?week<=1?cap.week_1:week===2?cap.week_2:cap.week_3_4:undefined;let rtDays=Math.min(goal.rt_sessions_week.default,goal.rt_sessions_week.max,p.daysPerWeek,intro?.rt_sessions_max??intro?.rt_sessions?.[0]??p.daysPerWeek);if(p.population.kind==='older_adult')rtDays=Math.min(rtDays,r.get('older.week.strength').days_per_week.max);if(p.population.kind==='postpartum')rtDays=postpartumPhase(p)===1?0:Math.min(rtDays,r.get('postpartum.phase2').strength_days_per_week);const otherDays=p.daysPerWeek-rtDays,aerobicDays=otherDays||p.daysPerWeek,seconds=Math.ceil(Math.max(goal.aerobic_moderate_equiv_min_week.week1[0],r.get('aerobic.progression.ramp').week1_floor_min)*60/aerobicDays);return {rtDays,otherDays,aerobicDays,seconds};}
export function independentStartAerobicQuota(p:EngineProfile):number{return independentStartAllocation(p).seconds;}
/** Rebuilds source work with legal source reps/holds; arbitrary rest, conditioning and estimates are not inputs. */
export function independentStartTarget(t:SessionTemplate,p:EngineProfile):number|undefined{
 if(p.goal!=='start_moving'||postpartumPhase(p)===1)return undefined;
 const allocation=independentStartAllocation(p),resistance=t.items.some(i=>['main','accessory'].includes(i.prescription?.block??'')),quota=resistance&&allocation.otherDays?0:allocation.seconds,possible=new Set(independentlyPossibleIds(p));if(quota&&!t.items.some(i=>i.prescription?.block==='conditioning'&&r.byExercise.get(i.exerciseId)?.modality==='cardio')&&!r.data.exercises.some(e=>possible.has(e.id)&&e.modality==='cardio'&&e.use.includes('conditioning')))return undefined;
 // Without a safe cooldown filler we cannot assert that the mandatory block is reconstructible.
 if(!r.data.exercises.some(e=>possible.has(e.id)&&e.modality==='cardio'&&e.use.includes('cooldown')))return undefined;
 const goal=r.get('goal.params.start_moving'),table=r.get('duration.capacity.table'),short=table.sessions.find((row:{ramp_s:number})=>row.ramp_s>0).minutes,model=table.model_params,rest=r.get('dose.rest.table');
 const work:PlannedItem[]=t.items.filter(i=>['main','accessory','balance'].includes(i.prescription?.block??'')).flatMap(i=>{
  const e=r.byExercise.get(i.exerciseId);if(!e)return [];
  const item=structuredClone(i),count=Math.max(goal.sets_per_exercise.min,Math.min(goal.sets_per_exercise.max,i.sets));item.sets=count;
  let repRange=[goal.reps.min,goal.reps.max];if(p.population.kind==='older_adult'){const dose=r.get('older.strength.dose'),range=p.trainingAgeWeeks<r.get('older.strength.progression').intro_phase_weeks.default?dose.reps_phase_intro:dose.reps_phase_strength;repRange=[range.min,range.max];}
  let minimum=Math.max(repRange[0],r.get('dose.reps.bounds').min[p.level]);
  if(p.screening.restingBp!=='known_below_threshold')minimum=Math.max(minimum,r.get('safety.hypertension.limits').min_reps_per_set);
  const modeled=e.time.per_side&&['squat','lunge','hinge','isolation_lower'].includes(e.primary_pattern)?model.single_leg_reps_per_side:e.nsca_class==='isolation'?model.isolation_reps:model.compound_reps,reps='reps'in i.target?Math.max(minimum,Math.min(repRange[1],i.target.reps)):p.sessionMinutes<=short?minimum:Math.max(minimum,Math.min(repRange[1],modeled)),iso=r.get('dose.isometric')[p.level].hold_s;
  const seconds=e.modality==='mobility'?Math.max(e.stretch_hold_s?.[0]??0,Math.min(e.stretch_hold_s?.[1]??Infinity,r.get('dose.stretch').hold_s.default)):e.modality==='isometric'?('durationSeconds'in i.target?Math.max(iso[0],Math.min(iso[1],i.target.durationSeconds)):p.sessionMinutes<=short?iso[0]:mean(iso)):mean(e.default_dose[p.level]?.seconds??[60]);
  item.target=e.modality==='mobility'||e.modality==='isometric'||e.modality==='cardio'||['duration','duration_distance'].includes(e.metricType)?{metricType:e.metricType==='duration_distance'?'duration_distance':'duration',durationSeconds:seconds}:e.metricType==='reps_load'?{metricType:'reps_load',reps,loadGrams:0}:{metricType:'reps',reps};
  item.prescription={pattern:e.primary_pattern,block:i.prescription!.block,rir:[goal.rir.min,goal.rir.max],restSeconds:mean(e.modality==='isometric'?rest.isometric_core.default:rest[e.nsca_class==='isolation'?'isolation':'other_compound'].default),structure:i.prescription?.structure??'straight',perSide:e.time.per_side,secondsPerRep:e.time.s_per_rep??r.get('duration.rep.seconds').default_if_unknown};
  for(const key of ['groupId','roundRestSeconds','sourcePosition'] as const)if(i.prescription?.[key]!==undefined)Object.assign(item.prescription,{[key]:i.prescription[key]});return [item];
 });
 const pool=independentWarmupPool(p);if(!pool)return undefined;
 const side= r.get('session.time.model').per_side_multiplier,dynamicRule=r.get('session.warmup.dynamic'),general=r.get('session.warmup.general'),safety=r.get('safety.session.warmup_cooldown'),tiers=r.get('session.durations.allowed'),overhead=r.get('duration.set.overhead');
 const dynamics=t.items.filter(i=>i.prescription?.block==='warmup'&&r.byExercise.get(i.exerciseId)?.mobility_type==='dynamic').map(i=>{const e=r.byExercise.get(i.exerciseId)!,factor=e.time.per_side?side:1;return {exerciseId:e.id,equipment:i.equipment,sets:1,target:{metricType:'duration' as const,durationSeconds:Math.ceil(dynamicRule.seconds[0]/factor)},prescription:{pattern:e.primary_pattern,block:'warmup' as const,rir:[goal.rir.min,goal.rir.max] as [number,number],restSeconds:0,perSide:e.time.per_side}};});
 const applicable=quota>0||work.some(i=>i.prescription?.structure==='circuit'),hasResistance=work.some(i=>{const e=r.byExercise.get(i.exerciseId);return e?.primary_pattern!=='balance'&&['strength','isometric'].includes(e?.modality??'');});
 let target=p.sessionMinutes;
 for(let pass=0;pass<=tiers.minutes.length;pass++){
  let tier=tiers.minutes.filter((n:number)=>n<=target).at(-1)??tiers.minutes[0];if(p.level==='beginner'&&tier===90)tier=tiers.min90_beginner_fallback;
  const normalized=structuredClone(work),ramps=independentSourceRampSeconds(normalized,p,target);for(const [index,item]of normalized.entries())if(item.prescription){if(ramps[index])item.prescription.warmupSeconds=ramps[index];else delete item.prescription.warmupSeconds;}
  const movements=structuredClone(dynamics),rampSeconds=ramps.reduce((sum,n)=>sum+n,0),dynamicWork=()=>movements.reduce((sum,i)=>sum+i.target.durationSeconds*(i.prescription.perSide?side:1),0),dynamicSeconds=()=>dynamicWork()+movements.length*overhead.mobility_overhead_s_per_set;
  const existing=t.items.find(i=>i.prescription?.block==='conditioning'&&r.byExercise.get(i.exerciseId)?.modality==='cardio'),aerobic=existing?r.byExercise.get(existing.exerciseId):pool.filter(e=>e.modality==='cardio'&&e.use.includes('conditioning')).sort((a,b)=>Number(a.use.includes('cooldown'))-Number(b.use.includes('cooldown'))||a.id.localeCompare(b.id,'en'))[0];
  if(quota&&(!aerobic||!pool.some(e=>e.id===aerobic.id)))return undefined;
  const used=[...normalized,...movements,...(quota&&aerobic?[{exerciseId:aerobic.id}]:[])],canGeneral=applicable?!hasResistance||target>=general.include_when.session_minutes_min:target>=general.include_when.session_minutes_min;
  let generalItem:PlannedItem|undefined,generalSeconds=0;
  if(canGeneral){const choices=pool.filter(e=>e.modality==='cardio'&&e.use.includes('warmup')&&!general.exclude_flags.some((flag:string)=>e.flags.includes(flag))&&(!applicable||e.difficulty<=r.get('select.difficulty.window').warmup_cooldown_max)&&!used.some(i=>i.exerciseId===e.id||e.ladder.id&&r.byExercise.get(i.exerciseId)?.ladder.id===e.ladder.id)).sort((a,b)=>Number(a.use.includes('cooldown'))-Number(b.use.includes('cooldown'))||(applicable?a.difficulty-b.difficulty:0)||a.id.localeCompare(b.id,'en')),e=choices[0];
   // With only a shared cardio candidate the order of safety/cold selection needs a separate proof.
   if(applicable&&e?.use.includes('cooldown'))return undefined;
   if(e){const factor=e.time.per_side?side:1,range=general.seconds_by_duration[String(tier)],bounds=Array.isArray(range)?range:[range,range],needed=Math.max(1,Math.ceil((safety.warmup_min_minutes*60-rampSeconds-dynamicSeconds()-overhead.overhead_s_per_set)/factor)),seconds=applicable?hasResistance?Math.max(bounds[0],Math.min(bounds[1],needed)):needed:Array.isArray(range)?range[1]:range;generalSeconds=seconds*factor+overhead.overhead_s_per_set;generalItem={exerciseId:e.id,equipment:e.equipment_required[0]??'none',sets:1,target:{metricType:'duration',durationSeconds:seconds},prescription:{pattern:e.primary_pattern,block:'warmup',rir:[goal.rir.min,goal.rir.max],restSeconds:0,perSide:e.time.per_side}};}
  }
  if(applicable&&movements.length>=dynamicRule.exercises[0]&&movements.length<=dynamicRule.exercises[1])for(const item of movements){const current=rampSeconds+generalSeconds+dynamicSeconds();if(current>=safety.warmup_min_minutes*60||dynamicWork()>=dynamicRule.seconds[1])break;const factor=item.prescription.perSide?side:1;item.target.durationSeconds+=Math.max(0,Math.min(Math.floor((dynamicRule.seconds[1]-dynamicWork())/factor),Math.ceil((safety.warmup_min_minutes*60-current)/factor)));}
  // Short recipes may omit general warmup, but cannot omit the real safety floor.
  // Reconstruct the smallest whole-second fill from raw source facts, not the
  // producer's target or its warmup implementation.
  if(applicable&&rampSeconds+generalSeconds+dynamicSeconds()<safety.warmup_min_minutes*60){
   if(!generalItem){const e=pool.filter(e=>e.modality==='cardio'&&e.use.includes('warmup')&&!general.exclude_flags.some((flag:string)=>e.flags.includes(flag))&&e.difficulty<=r.get('select.difficulty.window').warmup_cooldown_max&&!used.some(i=>i.exerciseId===e.id||e.ladder.id&&r.byExercise.get(i.exerciseId)?.ladder.id===e.ladder.id)).sort((a,b)=>Number(a.use.includes('cooldown'))-Number(b.use.includes('cooldown'))||a.difficulty-b.difficulty||a.id.localeCompare(b.id,'en'))[0];
    if(!e||e.use.includes('cooldown'))return undefined;
    generalItem={exerciseId:e.id,equipment:e.equipment_required[0]??'none',sets:1,target:{metricType:'duration',durationSeconds:1},prescription:{pattern:e.primary_pattern,block:'warmup',rir:[goal.rir.min,goal.rir.max],restSeconds:0,perSide:e.time.per_side}};
   }
   const e=r.byExercise.get(generalItem.exerciseId)!,factor=e.time.per_side?side:1,dose=Math.max(1,Math.ceil((safety.warmup_min_minutes*60-rampSeconds-dynamicSeconds()-overhead.overhead_s_per_set)/factor));
   generalItem.target={metricType:'duration',durationSeconds:dose};generalSeconds=dose*factor+overhead.overhead_s_per_set;
  }
  const row=r.get('duration.block.warmup_cooldown').by_session_min.filter((row:{session:number})=>row.session<=tier).at(-1),conditioning:PlannedItem[]=quota&&aerobic?[{exerciseId:aerobic.id,equipment:aerobic.equipment_required[0]??'none',sets:1,target:{metricType:'duration',durationSeconds:Math.ceil(quota/(aerobic.time.per_side?side:1))},prescription:{pattern:aerobic.primary_pattern,block:'conditioning',rir:[goal.rir.min,goal.rir.max],restSeconds:0}}]:[];
  const cold=independentStartCooldown([...normalized,...movements,...conditioning,...(generalItem?[generalItem]:[])],p,60*Math.max(row.cooldown,applicable?safety.cooldown_min_minutes:0));if(cold===undefined)return undefined;
  const base=independentElapsedAllocation({templates:[{...t,items:normalized}]}).total,seconds=base+quota+dynamicSeconds()+generalSeconds+cold,next=Math.min(p.sessionMinutes,Math.max(tiers.minutes[0],Math.ceil(seconds/60)));
  if(next===target)return next;target=next;
 }
 return target;
}