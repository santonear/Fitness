import {beforeAll,expect,it} from 'vitest';
import {validatePlan,generatePlan} from '../../src/engine';
import {improve} from '../../src/engine/improve';
import {createContext} from '../../src/engine/pipeline';
import {scorePlan,marginal} from '../../src/engine/score';
import {Rules} from '../../src/engine/data';
import type {EnginePlan} from '../../src/engine/contracts';
import frozen from '../fixtures/training-engine/mobility6x90-682989c.json';
import {goldenProfiles} from '../../tools/eval/training-engine-profiles';
import {independentElapsedAllocation} from '../unit/engine/reference/training-engine-goal-share';
import {independentSessionTimeIssues} from '../unit/engine/reference/training-engine-session-time';
import {mobilityFrozenSource} from './mobility-frozen-source';
const r=new Rules(),p=goldenProfiles.find(f=>f.id==='mobility6x90')!.profile,source=mobilityFrozenSource(),ignored=['duration_tolerance','goal_time_share','goal_time_share_joint'];
// Fixture generation and the independent improvement assertions are separate phases.
// Keep the existing test timeout and every purity/quality/safety assertion unchanged.
let generated:EnginePlan;
beforeAll(()=>{generated=generatePlan(p);});
function volumes(plan:EnginePlan){const out:Record<string,number>={},f=r.get('dose.volume.fractional'),map=r.get('dose.muscle_groups').catalog_map;for(const i of plan.templates.flatMap(t=>t.items)){const e=r.byExercise.get(i.exerciseId)!;if(f.excluded_modalities.includes(e.modality)||f.excluded_patterns.includes(e.primary_pattern)||['warmup','cooldown','mobility','balance'].includes(i.prescription?.block??''))continue;const credit:Record<string,number>={};for(const [muscles,n]of [[e.primaryMuscles??[],f.per_set_credit.primaryMuscles],[e.secondaryMuscles??[],f.per_set_credit.secondaryMuscles]] as [string[],number][])for(const m of muscles)if(map[m])credit[map[m]]=Math.max(credit[map[m]]??0,n);if(!Object.keys(credit).length)Object.assign(credit,f.pattern_fallback_if_no_muscles[e.primary_pattern]??{});const rir=i.prescription?.rir[0]??r.get('dose.rir.targets').beginner[0],effort=rir<=3?f.set_effort_multiplier.rir_0_to_3:rir===4?f.set_effort_multiplier.rir_4:f.set_effort_multiplier.rir_5_plus;for(const [g,n]of Object.entries(credit))out[g]=(out[g]??0)+n*i.sets*effort;}return out;}
function loss(plan:EnginePlan){const a=independentElapsedAllocation(plan),shares=r.get('goal.params.mobility').time_share,band=r.get('duration.fit.tolerance').band;return Object.entries(shares).reduce((sum,[k,range])=>{const q=range as number[],n=a[k as 'resistance'|'aerobic'|'mobility'];return sum+Math.max(0,q[0]*a.total-n,n-q[1]*a.total);},0)+plan.templates.reduce((sum,t)=>{const n=independentElapsedAllocation({templates:[t]}).total,target=(t.targetMinutes??p.sessionMinutes)*60;return sum+Math.max(0,target*band[0]-n,n-target*band[1]);},0);}
function addOne(slug:string){const plan=structuredClone(source),t=plan.templates.find(t=>t.items.some(i=>r.byExercise.get(i.exerciseId)?.slug===slug))!,i=t.items.find(i=>r.byExercise.get(i.exerciseId)?.slug===slug)!;i.sets++;t.estimatedSeconds=independentElapsedAllocation({templates:[t]}).total;t.estimatedMinutes=Math.ceil(t.estimatedSeconds/60);return plan;}
function newHard(plan:EnginePlan){const old=new Set(validatePlan(source,p).filter(i=>i.severity==='error'&&!ignored.includes(i.code)).map(i=>JSON.stringify(i)));return validatePlan(plan,p).filter(i=>i.severity==='error'&&!ignored.includes(i.code)&&!old.has(JSON.stringify(i)));}
it('retains the original 530-second warmup target deficit and actual zero-load hard counterexample',()=>{
 const original=structuredClone(frozen) as EnginePlan;
 expect(original.templates.slice(0,2).every(template=>template.items.some(item=>item.prescription?.block==='warmup'&&'durationSeconds'in item.target&&item.target.durationSeconds===530))).toBe(true);
 expect(r.byId.get('session.warmup.general')?.severity).toBe('target');expect(scorePlan(original,p,r).perRule.find(row=>row.id==='session.warmup.general')!.satisfaction).toBeLessThan(scorePlan(source,p,r).perRule.find(row=>row.id==='session.warmup.general')!.satisfaction);expect(validatePlan(original,p).some(issue=>issue.code==='missing_load')).toBe(true);
 expect(independentSessionTimeIssues(original,p).filter(issue=>issue.code==='external_general_warmup_range').length===2).toBe(true);
});
it('measures the actual Nordic 2-to-3 increment and weekly dose facts independently of its invalid legacy load metadata',()=>{
 const trial=addOne('reverse-nordic-curl'),before=independentElapsedAllocation(source),after=independentElapsedAllocation(trial),sets=r.get('dose.sets_exercise'),goal=r.get('goal.params.mobility'),matrix=r.get('dose.sets_week.goal_matrix').mobility[p.level],level=r.get(`dose.sets_week.${p.level}`),min=Math.min(matrix.max,Math.max(level.floor,goal.sets_per_muscle_week.min)),max=Math.min(matrix.max,level.ceiling),v=volumes(trial);
 expect(after.total-before.total).toBe(205);expect(after.resistance-before.resistance).toBe(205);expect(loss(trial)).toBeLessThan(loss(source));expect(newHard(trial)).toEqual([]);
 const nordic=trial.templates[0].items.find(i=>r.byExercise.get(i.exerciseId)?.slug==='reverse-nordic-curl')!;expect(nordic.sets).toBe(3);expect(nordic.sets).toBeLessThanOrEqual(sets.max[p.level]);expect('reps'in nordic.target&&nordic.target.reps>=goal.reps.min&&nordic.target.reps<=goal.reps.max).toBe(true);
 for(const g of r.get('dose.muscle_groups').target_groups){expect(v[g]??0).toBeGreaterThanOrEqual(min);expect(v[g]??0).toBeLessThanOrEqual(max);}for(const g of r.get('dose.muscle_groups').cap_only_groups)expect(v[g]??0).toBeLessThanOrEqual(max);
});
it('considers legal local changes through the pure V2 result without forcing a historical 205-second repair',()=>{
 const plan=structuredClone(generated),before=structuredClone(plan),ctx=createContext(p,0,r),next=improve(plan,ctx,{score:scorePlan,marginal},3);
 expect(plan).toEqual(before);expect(scorePlan(next,p,r).quality).toBeGreaterThanOrEqual(scorePlan(plan,p,r).quality);expect(validatePlan(next,p).filter(i=>i.severity==='error')).toEqual([]);expect(ctx.trace.filter(t=>t.step==='improve').length).toBeLessThanOrEqual(3);
 // No assertion requires duration/share failure to remain: a fully ready repair is welcome.
});
it('scores weekly target excess and rejects an actual exercise hard cap despite better time/share loss',()=>{
 const squat=addOne('dumbbell-front-squat');expect(loss(squat)).toBeLessThan(loss(source));expect(volumes(squat).glutes).toBeGreaterThan(r.get('goal.params.mobility').sets_per_muscle_week.max);expect(r.byId.get('dose.sets_week.goal_matrix')?.severity).toBe('target');expect(scorePlan(squat,p,r).perRule.find(row=>row.id==='dose.sets_week.goal_matrix')!.satisfaction).toBeLessThan(scorePlan(source,p,r).perRule.find(row=>row.id==='dose.sets_week.goal_matrix')!.satisfaction);expect(newHard(squat).some(i=>i.code==='weekly_volume_cap')).toBe(false);
 const bench=addOne('db-bench-press');expect(newHard(bench).some(i=>i.code==='exercise_set_cap')).toBe(true);
});

