/** Legacy independent unit-test reference only; never used by V2 generation or acceptance. */
import {Rules} from '../../../../src/engine/data';
import type {EnginePlan,EngineProfile,ValidationIssue} from '../../../../src/engine/contracts';
import type {SessionTemplate} from '../../../../src/domain/v8/contracts';
import {actualBlockSeconds,independentlyApplicableSessionTypes} from './training-engine-session-time';
import {independentTemplateTarget} from './training-engine-template-target';
import {independentlyPossibleIds,postpartumPhase} from '../../../../tools/eval/training-engine-quality';
import {independentStrengthRoles,independentActualStrengthRole} from './training-engine-strength-role';
import {independentElapsedAllocation} from './training-engine-goal-share';
const r=new Rules();

/** A finite optimistic full-default reconstruction can prove shortness; an unknown pool cannot. */
export function independentlyProvedShortCooldown(t:SessionTemplate,p:EngineProfile):boolean{
 const map=r.get('dose.muscle_groups').catalog_map,major=r.get('dose.muscle_groups').target_groups,required=new Set<string>();
 for(const i of t.items.filter(i=>['main','accessory'].includes(i.prescription?.block??''))){const e=r.byExercise.get(i.exerciseId),groups=[...e?.primaryMuscles??[],...e?.secondaryMuscles??[]].map(m=>map[m]).filter(g=>major.includes(g));for(const g of groups.length?groups:Object.keys(r.get('dose.volume.fractional').pattern_fallback_if_no_muscles[e?.primary_pattern??'']??{}))if(major.includes(g))required.add(g);}
 if(!required.size)return false;const possible=new Set(independentlyPossibleIds(p)),source=r.get('session.cooldown.stretch'),hold=r.get('dose.stretch').hold_s[p.population.kind==='older_adult'?'older_adult':'range'],costs=r.data.exercises.filter(e=>possible.has(e.id)&&e.use.includes('cooldown')&&e.mobility_type==='static'&&e.stretch_targets?.length&&e.difficulty<=r.get('select.difficulty.window').warmup_cooldown_max).flatMap(e=>{const min=Math.max(hold[0],e.stretch_hold_s?.[0]??hold[0]),max=Math.min(hold[1],e.stretch_hold_s?.[1]??hold[1]);if(min>max)return [];const seconds=Math.max(min,Math.min(max,source.dose.default.hold_s));return [{mask:e.stretch_targets!.reduce((mask,g)=>mask|1<<major.indexOf(g),0),cost:source.dose.default.sets*(seconds*(e.time.per_side?r.get('session.time.model').per_side_multiplier:1)+r.get('duration.set.overhead').mobility_overhead_s_per_set)}];});
 const needed=[...required].reduce((mask,g)=>mask|1<<major.indexOf(g),0),dp=Array<number>(1<<major.length).fill(Infinity);dp[0]=0;for(let mask=0;mask<dp.length;mask++)for(const c of costs)dp[mask|c.mask]=Math.min(dp[mask|c.mask],dp[mask]+c.cost);const cold=Math.min(...dp.filter((_,mask)=>(mask&needed)===needed));if(!Number.isFinite(cold))return false;
 const noncold=independentElapsedAllocation({templates:[{...t,items:t.items.filter(i=>i.prescription?.block!=='cooldown')}]}).total;
 return noncold+cold>independentTemplateTarget(t,p).minutes*60*r.get('duration.fit.tolerance').band[1];
}

/** Source tables are read directly; neither the core cap nor its budget proof is consulted. */
export function independentCooldownCap(t:SessionTemplate,p:EngineProfile):number{
 const durations=r.get('session.durations.allowed'),minutes=independentTemplateTarget(t,p).minutes,allowed=durations.minutes.filter((n:number)=>n<=minutes).at(-1)??durations.minutes[0],tier=p.level==='beginner'&&allowed===90?durations.min90_beginner_fallback:allowed;
 const row=r.get('duration.block.warmup_cooldown').by_session_min.filter((row:{session:number})=>row.session<=tier).at(-1),recipe=r.get(`session.template.min${tier}`),variant=recipe.variants?.mobility;
 const extended=p.goal==='mobility'?variant?.extend?.CD1?.minutes??(variant?.replace?.X1?.block==='cooldown'?variant.replace.X1.minutes:0):0;
 const safety=r.get('safety.session.warmup_cooldown'),applies=independentlyApplicableSessionTypes(t,p).some(type=>safety.applies_to_session_types.includes(type));
 return 60*Math.max(row.cooldown,extended,applies?safety.cooldown_min_minutes:0);
}
function priorityGroups(t:SessionTemplate,p:EngineProfile):string[][]{
 const map=r.get('dose.muscle_groups').catalog_map,major=r.get('dose.muscle_groups').target_groups,work=t.items.filter(i=>['main','accessory'].includes(i.prescription?.block??''));
 const legacy=work.filter(i=>i.prescription?.block==='main'&&!/^(main|acc|core)_\d+$/.test(i.prescription?.sourcePosition??'')).slice(0,3);
 const roles=p.goal==='strength'?independentStrengthRoles(t.items):undefined;
 return [1,2,3].map((position,index)=>{const items=work.filter(i=>i.prescription?.sourcePosition===`main_${position}`);if(legacy[index])items.push(legacy[index]);return [...new Set(items.filter(i=>!roles||roles.get(i)==='main'||i.prescription?.goalRole===undefined&&independentActualStrengthRole(i)==='main').flatMap(i=>{return (r.byExercise.get(i.exerciseId)?.primaryMuscles??[]).map(m=>map[m]).filter(g=>major.includes(g));}))];});
}
export function independentCooldownIssues(plan:EnginePlan,p:EngineProfile):ValidationIssue[]{
 if(postpartumPhase(p)===1)return [];
 const issues:ValidationIssue[]=[],possible=new Set(independentlyPossibleIds(p)),major=r.get('dose.muscle_groups').target_groups,hold=r.get('dose.stretch').hold_s[p.population.kind==='older_adult'?'older_adult':'range'],sets=r.get('dose.stretch').reps_per_muscle[0],side=r.get('session.time.model').per_side_multiplier,overhead=r.get('duration.set.overhead').mobility_overhead_s_per_set;
 for(const t of plan.templates){
  const cap=independentCooldownCap(t,p),actual=actualBlockSeconds(t,'cooldown'),add=(code:string,reason:string)=>issues.push({code,ruleId:'session.cooldown.stretch',severity:'error',templateId:t.id,reason});
  if(actual>cap)add('external_cooldown_cap',`actual_cooldown:${actual}>source_cap:${cap}`);
  const pool=r.data.exercises.filter(e=>possible.has(e.id)&&e.use.includes('cooldown')&&e.mobility_type==='static'&&e.stretch_targets?.length&&e.difficulty<=r.get('select.difficulty.window').warmup_cooldown_max),costs=pool.flatMap(e=>{const low=Math.max(hold[0],e.stretch_hold_s?.[0]??hold[0]),high=Math.min(hold[1],e.stretch_hold_s?.[1]??hold[1]);return low<=high?[{mask:e.stretch_targets!.reduce((mask,g)=>mask|(1<<major.indexOf(g)),0),seconds:sets*(low*(e.time.per_side?side:1)+overhead)}]:[];});
  const dp=Array<number>(1<<major.length).fill(Infinity);dp[0]=0;for(let mask=0;mask<dp.length;mask++)for(const c of costs)dp[mask|c.mask]=Math.min(dp[mask|c.mask],dp[mask]+c.seconds);
  const covered=new Set(t.items.filter(i=>{const e=r.byExercise.get(i.exerciseId);return i.prescription?.block==='cooldown'&&e?.mobility_type==='static'&&i.sets>=sets&&'durationSeconds'in i.target&&i.target.durationSeconds>=Math.max(hold[0],e.stretch_hold_s?.[0]??hold[0])&&i.target.durationSeconds<=Math.min(hold[1],e.stretch_hold_s?.[1]??hold[1]);}).flatMap(i=>r.byExercise.get(i.exerciseId)?.stretch_targets??[]));
  let prefix=0;for(const groups of priorityGroups(t,p))for(const group of groups){
   if(!costs.some(c=>c.mask&(1<<major.indexOf(group)))){if(p.population.kind==='pregnant'&&r.byId.get('session.cooldown.stretch')?.type==='default'){if(!plan.quality?.issues.some(i=>i.code==='cooldown_stretch_safety_unavailable'&&i.severity==='warning'&&i.templateId===t.id&&i.reason===`no_safe_default_stretch_candidate:${group}`))add('external_cooldown_warning',`unreported_safe_catalog_omission:${group}`);}else add('external_cooldown_priority',`no_verified_safe_priority_candidate:${group}`);continue;}
   prefix|=1<<major.indexOf(group);if(covered.has(group))continue;
   const optimistic=Math.min(...dp.filter((_,mask)=>(mask&prefix)===prefix));
   if(optimistic<=cap)add('external_cooldown_priority',`priority_fits_before_cardio_or_lower_priority:${group}`);
   else if(!plan.quality?.issues.some(i=>i.code==='cooldown_stretch_target'&&i.severity==='warning'&&i.templateId===t.id&&i.reason.includes(`${group}:`)))add('external_cooldown_warning',`unreported_source_budget_omission:${group}`);
  }
 }
 return issues;
}

/** Data warnings stay separate from the independent hard safety result; unknown is no proof of coverage. */
export function independentStretchPrimaryWarnings(plan:EnginePlan):ValidationIssue[]{
 const warnings:ValidationIssue[]=[];
 for(const t of plan.templates)for(const [itemIndex,item]of t.items.entries()){
  const e=r.byExercise.get(item.exerciseId),map=r.get('dose.muscle_groups').catalog_map;
  if(['main','accessory'].includes(item.prescription?.block??'')&&e&&['strength','isometric'].includes(e.modality)&&(!e.primaryMuscles?.length||e.primaryMuscles.some(m=>map[m]===undefined)))warnings.push({code:'external_stretch_primary_unknown',ruleId:'session.cooldown.stretch',severity:'warning',templateId:t.id,itemIndex,reason:'registered_primary_muscles_unavailable'});
 }
 return warnings;
}
