/** Legacy independent unit-test reference only; never used by V2 generation or acceptance. */
import {Rules} from '../../../../src/engine/data';
import type {EnginePlan,EngineProfile,ValidationIssue} from '../../../../src/engine/contracts';
import type {PlannedItem} from '../../../../src/domain/v8/contracts';
const r=new Rules();
const positions=new Set<string>(r.data.rules.filter(rule=>rule.id.startsWith('week.day.')).flatMap(rule=>(rule.value?.slots??[]).map((slot:{pos:string})=>slot.pos)));
export function independentStrengthRoles(items:PlannedItem[]):Map<PlannedItem,'main'|'accessory'>{
 const work=items.filter(i=>['main','accessory'].includes(i.prescription?.block??'')||positions.has(i.prescription?.sourcePosition??'')),limit=r.get('goal.params.strength').main_lifts_per_session,requested=work.some(i=>i.prescription?.goalRole!==undefined)?work.filter(i=>i.prescription?.goalRole==='main').length:limit.max,count=Math.max(limit.min,Math.min(limit.max,requested));
 const authored=work.filter(i=>positions.has(i.prescription?.sourcePosition??'')&&/^main_\d+$/.test(i.prescription?.sourcePosition??'')).sort((a,b)=>Number(a.prescription!.sourcePosition!.slice(5))-Number(b.prescription!.sourcePosition!.slice(5))),legacy=work.filter(i=>i.prescription?.block==='main'&&!positions.has(i.prescription.sourcePosition??'')),prefix=new Set([...authored,...legacy].slice(0,count));
 return new Map(work.map(i=>[i,prefix.has(i)?'main':'accessory']));
}
export function independentActualStrengthRole(i:PlannedItem):string|undefined{return i.prescription?.goalRole??(positions.has(i.prescription?.sourcePosition??'')?/^main_\d+$/.test(i.prescription!.sourcePosition!)?'main':'accessory':i.prescription?.block);}
/** Roles are replayed from source positions, and labels do not exempt actual source dose. */
export function independentStrengthIssues(plan:EnginePlan,p:EngineProfile):ValidationIssue[]{
 if(p.goal!=='strength')return [];const goal=r.get('goal.params.strength'),issues:ValidationIssue[]=[];
 for(const t of plan.templates){const roles=independentStrengthRoles(t.items),add=(reason:string,itemIndex?:number)=>issues.push({code:'external_strength_role',ruleId:'goal.params.strength',severity:'error',reason,templateId:t.id,itemIndex}),main=[...roles.keys()].filter(i=>independentActualStrengthRole(i)==='main').length;if(roles.size&&(main<goal.main_lifts_per_session.min||main>goal.main_lifts_per_session.max))add('actual_main_count_outside_source');
  for(const [i,role]of roles){const n=t.items.indexOf(i);if(independentActualStrengthRole(i)!==role)add('source_prefix_role_mismatch',n);if(role==='main'&&i.sets>goal.main_lift.sets_per_session[1])add('actual_main_sets_above_source',n);
   const e=r.byExercise.get(i.exerciseId),dose=i.prescription;
   if(p.population.kind==='general'&&!(p.level==='beginner'&&Math.floor(p.trainingAgeWeeks)+1<=4)&&p.sessionMinutes>10&&p.daysPerWeek>=r.get('goal.floor.all').applies_when.days_available_min){const base=r.get('dose.sets_exercise').min,reduction=p.cautions.includes('shoulder')&&e&&['push_horizontal','push_vertical'].includes(e.primary_pattern)?r.get('caution.shoulder.filter').level_1.modify[0]:undefined,minimum=reduction?Math.max(reduction.sets_min,base+reduction.sets_delta):base;if(i.sets<minimum)add('actual_work_sets_below_source_minimum',n);}
   if(dose){const rir=r.get('goal.rir.level_override'),minimum=Math.max(goal[role==='main'?'main_lift':'accessory'].rir[0],rir[p.level].rir_min,e?.flags.includes('heavy_axial_load')?rir.heavy_compound_rir_min:0);if(dose.rir[0]<minimum||dose.rir[1]<dose.rir[0])add('actual_role_rir_below_source_or_inverted',n);if(dose.structure==='straight'&&e&&e.modality!=='isometric'){const rest=r.get('dose.rest.table'),bounds=rest[e.nsca_class==='isolation'?'isolation':'other_compound'].bounds,low=role==='main'&&p.level==='intermediate'?Math.max(bounds[0],rest.intermediate_strength_main.min):bounds[0];if(dose.restSeconds<low||dose.restSeconds>bounds[1])add('actual_role_rest_outside_source',n);}}
   if('reps'in i.target){let range=role==='main'?goal.main_lift.reps:goal.accessory.reps;if(role==='main'&&p.level==='beginner'&&p.trainingAgeWeeks<r.get('goal.strength.beginner_rep_gate').weeks_trained_before_low_reps){const gate=r.get('goal.strength.beginner_rep_gate').main_lift_reps_before_gate;range=[gate.min,gate.max];}if(p.population.kind==='older_adult'){const dose=r.get('older.strength.dose'),older=p.trainingAgeWeeks<r.get('older.strength.progression').intro_phase_weeks.default?dose.reps_phase_intro:dose.reps_phase_strength;range=[older.min,older.max];}if(p.screening.restingBp!=='known_below_threshold')range=range.map((x:number)=>Math.max(x,r.get('safety.hypertension.limits').min_reps_per_set));const absolute=r.get('dose.reps.bounds');range=[Math.max(absolute.min[p.level],range[0]),Math.min(absolute.absolute_max,Math.max(absolute.min[p.level],range[1]))];if(i.target.reps<range[0]||i.target.reps>range[1])add('actual_reps_outside_source_role',n);}
  }
 }
 return issues;
}
