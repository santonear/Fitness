/** Legacy independent unit-test reference only; never used by V2 generation or acceptance. */
import type {EnginePlan,EngineProfile,ValidationIssue} from '../../../../src/engine/contracts';
import type {PlannedItem} from '../../../../src/domain/v8/contracts';
import {Rules} from '../../../../src/engine/data';
import {actualSetSeconds,independentlyGroupedSeconds} from './training-engine-session-time';
import {postpartumPhase} from '../../../../tools/eval/training-engine-quality';
import {independentTemplateTarget} from './training-engine-template-target';
const rules=new Rules();
type Category='resistance'|'aerobic'|'mobility'|'other';
export interface IndependentAllocation {resistance:number;aerobic:number;mobility:number;other:number;unallocated:number;total:number}
function category(item:PlannedItem):Category{
 const e=rules.byExercise.get(item.exerciseId);if(!e)return 'other';
 if(e.primary_pattern==='balance')return 'other';
 return e.modality==='cardio'?'aerobic':e.modality==='mobility'?'mobility':['strength','isometric'].includes(e.modality)?'resistance':'other';
}
/** Independent source arithmetic. Display metadata and core duration/classification helpers are not consulted. */
export function independentElapsedAllocation(plan:Pick<EnginePlan,'templates'>):IndependentAllocation{
 const out:IndependentAllocation={resistance:0,aerobic:0,mobility:0,other:0,unallocated:0,total:0};
 for(const template of plan.templates){
  const seen=new Set<string>();
  for(const item of template.items){
   const e=rules.byExercise.get(item.exerciseId);if(!e)continue;
   if(['warmup','cooldown','mobility'].includes(item.prescription?.block??'')){out[category(item)]+=actualSetSeconds(item)*item.sets;continue;}
   const group=item.prescription?.structure&&item.prescription.structure!=='straight'?item.prescription.groupId:undefined;if(group&&seen.has(group))continue;if(group)seen.add(group);
   const members=group?template.items.filter(member=>member.prescription?.groupId===group):[item],structure=item.prescription?.structure??'straight';
   if(members.length>1&&structure!=='straight'){
    const grouped=independentlyGroupedSeconds(members,structure),kinds=new Set(members.map(category));let exclusive=0;
    for(const member of members){const work=actualSetSeconds(member)*member.sets+(rules.byExercise.get(member.exerciseId)?.time.setup_s??0),ramp=member.prescription?.warmupSeconds??0;out[category(member)]+=work;out.resistance+=ramp;exclusive+=work+ramp;}
    out[kinds.size===1?category(item):'unallocated']+=grouped-exclusive;
   }else if(e.modality==='cardio'&&'durationSeconds'in item.target){
    // Source duration.block.cardio continuous formula is prescribed duration, not MVPA credit.
    out.aerobic+=item.target.durationSeconds*item.sets*(item.prescription?.perSide||e.time.per_side?rules.get('session.time.model').per_side_multiplier:1);
   }else{
    const rest=item.prescription?.restSeconds??rules.get('duration.rest.straight').rest_s[e.nsca_class==='isolation'?'isolation':'compound'];
    out[category(item)]+=e.time.setup_s+rules.get('duration.transition.setup').buffer_s+item.sets*actualSetSeconds(item)+(item.sets-1)*rest;
    out.resistance+=item.prescription?.warmupSeconds??0;
   }
  }
 }
 out.total=out.resistance+out.aerobic+out.mobility+out.other+out.unallocated;return out;
}
export function independentGoalShareIssues(plan:EnginePlan,profile:EngineProfile):ValidationIssue[]{
 if(postpartumPhase(profile)===1)return [];
 const allocation=independentElapsedAllocation(plan);if(!allocation.total)return [];
 const shares=rules.get(`goal.params.${profile.goal}`).time_share,issues:ValidationIssue[]=[];let needed=0;
 for(const key of ['resistance','aerobic','mobility'] as const){
  const range=shares[key];if(!range)continue;
  const lower=allocation[key]/allocation.total,upper=(allocation[key]+allocation.unallocated)/allocation.total;
  needed+=Math.max(0,range[0]*allocation.total-allocation[key]);
  if(upper+Number.EPSILON<range[0]||lower-Number.EPSILON>range[1])issues.push({code:'external_goal_time_share',ruleId:`goal.params.${profile.goal}`,severity:'error',reason:`${key}:actual_seconds:${allocation[key]};total:${allocation.total};unallocated:${allocation.unallocated};bounds:${lower},${upper};required:${range[0]},${range[1]}`});
 }
 if(needed>allocation.unallocated+Number.EPSILON*Math.max(1,allocation.total))issues.push({code:'external_goal_time_share_joint',ruleId:`goal.params.${profile.goal}`,severity:'error',reason:`minimum_deficit:${needed}>unallocated:${allocation.unallocated}`});
 return issues;
}
/** Independently remeasure every disclosed deviation; a quality label alone proves nothing. */
export function independentlyReportedShortHealthShares(plan:EnginePlan,p:EngineProfile):boolean{
 if(p.goal!=='health'||p.daysPerWeek!==2||p.sessionMinutes!==20||plan.weeklyTarget!==2||plan.sessionMinutes!==20||plan.templates.length!==2||rules.byId.get('goal.params.health')?.type!=='default'||plan.quality?.status!=='limited'||plan.quality.basis!=='source_constraint')return false;
 const a=independentElapsedAllocation(plan),shares=rules.get('goal.params.health').time_share,expected:ValidationIssue[]=[];let needed=0;if(!a.total)return false;
 for(const key of ['resistance','aerobic','mobility'] as const){const range=shares[key];if(!range)continue;const low=a[key]/a.total,high=(a[key]+a.unallocated)/a.total;needed+=Math.max(0,range[0]*a.total-a[key]);
  if(high+Number.EPSILON<range[0]||low-Number.EPSILON>range[1])expected.push({code:'goal_time_share',ruleId:'goal.params.health',severity:'warning',reason:`${key}:elapsed_seconds:${a[key]};weekly_total_seconds:${a.total};unallocated_seconds:${a.unallocated};share_bounds:${low},${high};required:${range[0]},${range[1]}`});
 }
 if(needed>a.unallocated+Number.EPSILON*Math.max(1,a.total))expected.push({code:'goal_time_share_joint',ruleId:'goal.params.health',severity:'warning',reason:`minimum_share_deficit_seconds:${needed}>unallocated_seconds:${a.unallocated};weekly_total_seconds:${a.total}`});
 const actual=plan.quality.issues.filter(i=>['goal_time_share','goal_time_share_joint'].includes(i.code)),key=(i:ValidationIssue)=>JSON.stringify([i.code,i.ruleId,i.severity,i.reason,i.templateId??null,i.itemIndex??null]);
 return expected.length>0&&JSON.stringify(expected.map(key).sort())===JSON.stringify(actual.map(key).sort());
}
/** Same authored tolerance, independently measured actual work; target metadata is source-checked first. */
export function independentDurationIssues(plan:EnginePlan,p:EngineProfile):ValidationIssue[]{
 if(postpartumPhase(p)===1)return [];
 const [low,high]=rules.get('duration.fit.tolerance').band;
 return plan.templates.flatMap(t=>{const target=independentTemplateTarget(t,p).minutes*60,actual=independentElapsedAllocation({templates:[t]}).total;return actual<target*low||actual>target*high?[{code:'duration_tolerance',ruleId:'duration.fit.tolerance',reason:'estimated_duration_outside_tolerance',severity:'error' as const,templateId:t.id}]:[];});
}
