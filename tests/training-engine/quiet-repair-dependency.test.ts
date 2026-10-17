import {verifyObservedGoalShares} from './v2-quality-observation';
import {scorePlan} from '../../src/engine/score';
import {expect,it} from 'vitest';
import {generatePlan,validatePlan,modifyPlan} from '../../src/engine';
import {Rules} from '../../src/engine/data';
import {estimateSeconds} from '../../src/engine/fit';
import {prescribe} from '../../src/engine/dose';
import {safety} from '../../src/engine/gates/strength-scoring';
import {independentSessionTimeIssues} from '../unit/engine/reference/training-engine-session-time';
import {goldenProfiles} from '../../tools/eval/training-engine-profiles';
import {independentElapsedAllocation,independentDurationIssues} from '../unit/engine/reference/training-engine-goal-share';
const r=new Rules();
it('measures actual first-week chest frequency as a target while preserving hard dose and time constraints',()=>{
 const p=goldenProfiles.find(f=>f.id==='first-week-health2x20')!.profile,plan=generatePlan(p),hard=validatePlan(plan,p).filter(i=>i.severity==='error'),map=r.get('dose.muscle_groups').catalog_map;
 const chestDays=plan.templates.filter(t=>t.items.some(i=>['main','accessory'].includes(i.prescription?.block??'')&&(r.byExercise.get(i.exerciseId)?.primaryMuscles??[]).some(m=>map[m]==='chest')));
 expect(chestDays.length).toBeGreaterThan(0);const frequency=scorePlan(plan,p,r).perRule.find(row=>row.id==='week.frequency.per_muscle')!;expect(frequency).toBeDefined();if(chestDays.length<r.get('week.frequency.per_muscle').default_exposures_per_week)expect(frequency.satisfaction).toBeLessThan(1);const absent=structuredClone(plan);for(const t of absent.templates)t.items=t.items.filter(i=>!['main','accessory'].includes(i.prescription?.block??'')||!(r.byExercise.get(i.exerciseId)?.primaryMuscles??[]).some(m=>map[m]==='chest'));expect(scorePlan(absent,p,r).perRule.find(row=>row.id==='week.frequency.per_muscle')!.satisfaction).toBeLessThan(frequency.satisfaction);expect(hard.some(i=>i.code==='weekly_muscle_exposure_gap')).toBe(false);expect(hard).toEqual([]);verifyObservedGoalShares(plan,p,r);
 expect(plan.templates.flatMap(t=>t.items.filter(i=>['main','accessory'].includes(i.prescription?.block??''))).every(i=>Number.isInteger(i.sets)&&i.sets>0)).toBe(true);
 expect(plan.templates.every(t=>t.items.filter(i=>['main','accessory'].includes(i.prescription?.block??'')).length<=r.get('progression.new.week_caps').week_1.exercises_per_session[1])).toBe(true);
 expect(independentElapsedAllocation(plan).total).toBeGreaterThan(0);expect(independentDurationIssues(plan,p)).toEqual([]);
});
it('keeps the quiet input within actual duration and reports share targets without a V1 limited status',()=>{
 const p=goldenProfiles.find(f=>f.id==='quiet-bodyweight-2x20')!.profile,plan=generatePlan(p),hard=validatePlan(plan,p).filter(i=>i.severity==='error');
 const work=plan.templates.flatMap(t=>t.items).filter(i=>['main','accessory'].includes(i.prescription?.block??''));expect(work.length).toBeGreaterThan(0);expect(work.every(i=>i.sets>=r.get('duration.fit.bounds').sets_per_exercise_min.other&&i.sets<=r.get('duration.fit.bounds').sets_per_exercise_max[p.level])).toBe(true);if(work.some(i=>i.sets<r.get('goal.floor.all').sets_per_exercise_min))expect(scorePlan(plan,p,r).perRule.find(row=>row.id==='dose.sets_exercise')!.satisfaction).toBeLessThan(1);
 expect(independentElapsedAllocation(plan).total).toBeGreaterThan(0);verifyObservedGoalShares(plan,p,r);expect(independentDurationIssues(plan,p)).toEqual([]);expect(independentSessionTimeIssues(plan,p)).toEqual([]);
 expect(hard).toEqual([]);expect(plan.quality?.issues.filter(i=>i.severity==='error')).toEqual([]);expect(plan.quality?.score).toBe(scorePlan(plan,p,r).quality);expect(plan.gates.some(g=>g.status==='blocked')).toBe(false);
});
it('rejects actual overtime even when every increased working repetition remains within the source range',()=>{
 const p=goldenProfiles.find(f=>f.id==='quiet-bodyweight-2x20')!.profile,original=generatePlan(p),plan=structuredClone(original),t=plan.templates[0],range=r.get('goal.params.health').reps;let increased=0;
 for(const item of t.items)if(['main','accessory'].includes(item.prescription?.block??'')&&'reps'in item.target){if(item.target.reps<range.max)increased++;item.target.reps=range.max;}
 expect(increased).toBeGreaterThan(0);const high=(t.targetMinutes??p.sessionMinutes)*60*r.get('duration.fit.bounds').duration_band[1],cardio=prescribe(r.data.exercises.find(e=>e.slug==='custom-quiet-march')!,p,r,safety(p,r),'conditioning',1);cardio.target={metricType:'duration',durationSeconds:Math.max(1,Math.ceil(high-estimateSeconds(t,r)+1))};const index=t.items.findIndex(i=>i.prescription?.block==='cooldown');t.items.splice(index<0?t.items.length:index,0,cardio);t.estimatedSeconds=independentElapsedAllocation({templates:[t]}).total;t.estimatedMinutes=Math.ceil(t.estimatedSeconds/60);
 expect(t.estimatedSeconds).toBeGreaterThan(high);expect(estimateSeconds(t,r)).toBe(t.estimatedSeconds);expect(independentDurationIssues(plan,p).some(i=>i.code==='duration_tolerance'&&i.templateId===t.id)).toBe(true);
 const hard=validatePlan(plan,p).filter(i=>i.severity==='error');expect(hard.some(i=>i.code==='duration_tolerance'&&i.templateId===t.id)).toBe(true);expect(hard.filter(i=>!['duration_tolerance','goal_time_share','goal_time_share_joint'].includes(i.code))).toEqual([]);
 const reassessed=modifyPlan(plan,p,[]).value;expect(reassessed.quality?.status).toBe('unavailable');expect(reassessed.quality?.issues.some(i=>i.code==='duration_tolerance')).toBe(true);expect(validatePlan(original,p).some(i=>i.code==='duration_tolerance')).toBe(false);
});
