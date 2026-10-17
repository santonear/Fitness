import {describe,it,expect} from 'vitest';
import {Rules,type Exercise} from '../../../src/engine/data';
import type {EngineProfile,GateOutcome} from '../../../src/engine/contracts';
import {checkHard,hardRuleAssessments} from '../../../src/engine/hard-checks';
import {fixtureProfile,planFixture} from './fixtures';
const source=new Rules(),walking=source.data.exercises.find(e=>e.slug==='walking')!;
interface Scenario {id:string;exercise?:Partial<Exercise>;profile?:Partial<EngineProfile>;user?:Record<string,unknown>;gate?:Partial<GateOutcome['restrictions']>;sets?:number;reps?:number;rir?:[number,number];rpe?:[number,number];duplicate?:boolean;seconds?:number;name?:string}
const older:EngineProfile['population']={kind:'older_adult'},pregnant:EngineProfile['population']={kind:'pregnant',week:20,providerCleared:true,contraindicationsConfirmedNone:true,lastScreenedWeek:20},postpartum:EngineProfile['population']={kind:'postpartum',weeksSinceBirth:6,delivery:'cesarean',cleared:false};
const scenarios:Scenario[]=[
 {id:'safety.clearance.restricted_mode',exercise:{flags:['valsalva_prone']},user:{clearance_state:'required'}},
 {id:'safety.hypertension.limits',exercise:{flags:['valsalva_prone']},user:{hypertension:'unknown'}},
 {id:'safety.unlock.vigorous',rpe:[8,8],gate:{maxIntensity:6}},
 {id:'goal.strength.beginner_rep_gate',profile:{goal:'strength',trainingAgeWeeks:0},reps:6},
 {id:'dose.sets_session.cap',exercise:{modality:'strength',primary_pattern:'squat',primaryMuscles:['quadriceps']},sets:30,reps:12},
 {id:'dose.reps.bounds',reps:31},
 {id:'variety.no_repeat',duplicate:true},
 {id:'ladder.gate.barbell',exercise:{flags:['heavy_axial_load']}},
 {id:'progression.new.week_caps',profile:{trainingAgeWeeks:0},exercise:{difficulty:3}},
 {id:'progression.new.exclusions',profile:{trainingAgeWeeks:0},exercise:{flags:['jumping']}},
 ...(['knee','back','shoulder','wrist'] as const).map(joint=>({id:`caution.${joint}.filter`,profile:{cautions:[joint]},exercise:{joint_load:{[joint]:3}}})),
 {id:'older.exclude.base',profile:{population:older},gate:{population:'older_adult'},exercise:{flags:['jumping']}},
 {id:'older.exclude.balance_cautious',profile:{population:{...older,balanceCautious:true}},gate:{population:'older_adult'},user:{balance_cautious:true},exercise:{flags:['unstable_surface']}},
 {id:'older.floor.transitions',profile:{population:{...older,balanceCautious:true}},gate:{population:'older_adult'},user:{balance_cautious:true},exercise:{position:['supine'],space:'mat'}},
 {id:'older.bone',profile:{population:{...older,boneFlag:true}},gate:{population:'older_adult'},exercise:{flags:['loaded_spinal_flexion']}},
 {id:'older.strength.dose',profile:{population:older},gate:{population:'older_adult'},sets:4,reps:12},
 {id:'older.hypertension',profile:{population:older},gate:{population:'older_adult'},user:{hypertension:'unknown'},exercise:{flags:['valsalva_prone']}},
 ...(['supine','prone'] as const).map(pos=>({id:`pregnancy.exclude.${pos}`,profile:{population:pregnant},gate:{population:'pregnant' as const},user:{gestation_week:20},exercise:{position:[pos]}})),
 {id:'pregnancy.exclude.impact',profile:{population:pregnant},gate:{population:'pregnant'},exercise:{flags:['jumping']}},
 {id:'pregnancy.exclude.fall_risk',profile:{population:pregnant},gate:{population:'pregnant'},exercise:{flags:['high_fall_risk']}},
 {id:'pregnancy.exclude.valsalva',profile:{population:pregnant},gate:{population:'pregnant'},exercise:{flags:['valsalva_prone']}},
 {id:'pregnancy.exclude.abdominal_flexion',profile:{population:pregnant},gate:{population:'pregnant'},user:{gestation_week:20},exercise:{primary_pattern:'trunk_flexion'}},
 {id:'pregnancy.intensity',profile:{population:pregnant},gate:{population:'pregnant'},rir:[2,2],reps:12},
 {id:'postpartum.gate.caesarean',profile:{population:postpartum},gate:{population:'postpartum',phase:1},exercise:{slug:'non-walking-test'}},
 {id:'postpartum.exclude.pre_phase3',profile:{population:postpartum},gate:{population:'postpartum',phase:2},user:{postpartum_phase:2},exercise:{flags:['jumping']}},
 {id:'postpartum.running.readiness',profile:{population:postpartum},gate:{population:'postpartum',phase:3},exercise:{flags:['running']}},
 {id:'postpartum.doming',profile:{population:postpartum},gate:{population:'postpartum',phase:2},user:{abdominal_doming_reported:true},exercise:{primary_pattern:'trunk_flexion'}},
 {id:'postpartum.symptom_regression',profile:{population:postpartum},gate:{population:'postpartum',phase:2},user:{session_symptoms:['leakage']},exercise:{impact:1}},
 {id:'dose.power',exercise:{primary_pattern:'throw_upper',modality:'power'},reps:12},
 {id:'duration.fit.bounds',seconds:1},
 {id:'fatloss.spot_reduction.ban',name:'spot_fat_loss'},
];
function inspect(s:Scenario,negative:boolean){const plan=planFixture(),p={...fixtureProfile,...s.profile},exercise={...walking,impact:0,...(negative?s.exercise:{})},r=new Rules({...source.data,exercises:[exercise]}),g:GateOutcome={status:'ok',reasons:[],notices:[],trace:[],restrictions:{blocked:false,gates:[],notices:[],trace:[],user:{hypertension:'controlled',...s.user},maxRpe:10,maxIntensity:10,rirMin:0,phase:0,population:'general',eligibility:new Map(),allowedBundles:[],excludeFlags:[],excludePositions:[],...s.gate}};const item=plan.templates[0].items[0];item.exerciseId=exercise.id;if(negative){if(s.sets)item.sets=s.sets;if(s.reps){item.target={metricType:'reps',reps:s.reps};item.prescription!.block='main';}if(s.rir)item.prescription!.rir=s.rir;if(s.rpe)item.prescription!.targetRpe=s.rpe;if(s.seconds)item.target={metricType:'duration',durationSeconds:s.seconds};if(s.duplicate)plan.templates[0].items.push(structuredClone(item));if(s.name)plan.templates[0].name=s.name;}return checkHard(plan,p,g,r);}
describe('D hard source branch matrix: one positive and negative each',()=>{
 for(const scenario of scenarios)it(scenario.id,()=>{expect(inspect(scenario,true).some(issue=>issue.ruleId===scenario.id)).toBe(true);expect(inspect(scenario,false).some(issue=>issue.ruleId===scenario.id)).toBe(false);});
 it('separates original93 hard plus two deferred from the new hard gate, retaining total active94',()=>{const rows=hardRuleAssessments(source),active=source.data.rules.filter(rule=>rule.severity==='hard').map(rule=>rule.id),originalActive=active.filter(id=>id!=='caution.progression_gate'),deferred=['pregnancy.hiit','caution.progression'];expect(rows).toHaveLength(94);expect(originalActive).toHaveLength(93);expect(new Set(rows.map(x=>x.ruleId)).size).toBe(94);expect(rows.map(row=>row.ruleId).sort()).toEqual(active.sort());for(const id of deferred){expect(source.byId.get(id)).toMatchObject({severity:'mechanic',deferred:true});expect(rows.some(row=>row.ruleId===id)).toBe(false);}expect(new Set([...originalActive,...deferred]).size).toBe(95);expect(source.byId.get('caution.progression_gate')).toMatchObject({type:'limit',severity:'hard',value:{hold_load_until:{user:'pain.consecutive_sessions_lte_3',gte:2},progression_order:['volume','load'],ladder_step_up_requires:{user:'pain.consecutive_sessions_lte_3',gte:2}}});expect(source.get('caution.progression_gate')).not.toHaveProperty('rom_restore_step');expect(rows.some(row=>row.status==='history-validated')).toBe(true);expect(rows.some(row=>row.status==='runtime-validated')).toBe(true);});
 it('does not classify the new limit as an active hard when its severity is not hard',()=>{const variant=new Rules({...source.data,rules:source.data.rules.map(rule=>rule.id==='caution.progression_gate'?{...rule,severity:'mechanic'}:rule)});expect(hardRuleAssessments(variant).some(row=>row.ruleId==='caution.progression_gate')).toBe(false);});
});
it('does not treat a newly added rule or a different source version as reviewed coverage',()=>{
 const added=new Rules({...source.data,rules:[...source.data.rules,{id:'test.unreviewed_hard',chapter:0,type:'limit',severity:'hard',value:{}}]});expect(hardRuleAssessments(added).find(row=>row.ruleId==='test.unreviewed_hard')?.status).toBe('unreviewed');
 const changed=new Rules({...source.data,rulesVersion:'unreviewed-source-version'});expect(hardRuleAssessments(changed).every(row=>row.status==='unreviewed')).toBe(true);
});
