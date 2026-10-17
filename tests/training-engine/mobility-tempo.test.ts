import {scorePlan} from '../../src/engine/score';
import {sourceWarmupRamps} from '../../src/engine/source-warmup';
import {readFileSync} from 'node:fs';
import {describe,expect,it,vi} from 'vitest';
import {SourceWarmupSteps} from '../../src/ui/pages/training/SourceWarmupSteps';
const mainline=vi.hoisted(()=>({value:{} as any}));
vi.mock('../../src/ui/mainline/context',()=>({useMainline:()=>mainline.value}));
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Rules,DATA} from '../../src/engine/data';
import {prescribe} from '../../src/engine/dose';
import {safety} from '../../src/engine/gates/strength-scoring';
import {validatePlan,generatePlan} from '../../src/engine';
import {prescriptionSchema,type EnginePlan} from '../../src/engine/contracts';
import {estimateSeconds as estimatedSeconds} from '../../src/engine/fit';
import {baseProfile} from '../../tools/eval/training-engine-profiles';
import {actualSetSeconds} from '../unit/engine/reference/training-engine-session-time';

import {independentWarmupAudit} from '../unit/engine/reference/training-engine-session-time';
import {independentMobilityTempoIssues} from '../unit/engine/reference/training-engine-tempo';
import {sessionTemplateSchema} from '../../src/coach/contracts';
import {validateBackupEnvelope} from '../../src/application/backup';
import {prepareV8Migration} from '../../src/persistence/v8-migration';
import {BACKUP_VERSION,DATABASE_VERSION} from '../../src/domain/storage-version';
import {PrescriptionDetails} from '../../src/ui/pages/training/PrescriptionDetails';
const r=new Rules(),p=baseProfile({goal:'mobility',trainingAgeWeeks:52}),s=safety(p,r);
const exercise=r.data.exercises.find(e=>e.modality==='strength'&&e.metricType==='reps'&&e.time.s_per_rep<4)!;
function fixture():EnginePlan{const item=prescribe(exercise,p,r,s,'accessory',2);return {weeklyTarget:2,sessionMinutes:30,templates:[{id:'cadence',name:'Cadence',estimatedMinutes:30,items:[item]}],meta:{engineVersion:'test',rulesVersion:r.data.rulesVersion,seed:'cadence'},trace:[],notices:[],gates:[]};}
describe('approved fixed mobility strength cadence',()=>{
 it('uses fixed source phases and max(4,catalog), independent of target duration',()=>{
  expect(r.get('goal.params.mobility')).toMatchObject({eccentric_s:3,concentric_s:1,pause_s:0,rep_duration_min_s:4});
  for(const sessionMinutes of [10,30,90])expect(prescribe(exercise,{...p,sessionMinutes},r,s,'accessory',2).prescription).toMatchObject({secondsPerRep:4,tempo:{eccentricSeconds:3,concentricSeconds:1,pauseSeconds:0}});
  const slower={...exercise,time:{...exercise.time,s_per_rep:6}};expect(prescribe(slower,p,r,s).prescription?.secondsPerRep).toBe(6);
 });
 it('does not impose cadence on other goals, blocks or timed modalities',()=>{
  expect(prescribe(exercise,{...p,goal:'health'},r,s).prescription?.tempo).toBeUndefined();
  for(const block of ['warmup','conditioning','cooldown','balance','mobility'] as const)expect(prescribe(exercise,p,r,s,block).prescription?.tempo).toBeUndefined();
  for(const modality of ['cardio','isometric','mobility']){const e=r.data.exercises.find(e=>e.modality===modality)!;expect(prescribe(e,p,r,s).prescription?.tempo).toBeUndefined();}
 });
 it('counts actual repetitions, sides and overhead, and rejects caller-invented cadence',()=>{
  const plan=fixture(),item=plan.templates[0].items[0],side=item.prescription!.perSide?r.get('session.time.model').per_side_multiplier:1;
  if(!('reps'in item.target))throw Error('fixture must be rep strength');
  expect(actualSetSeconds(item)).toBe(item.target.reps*4*side+r.get('duration.set.overhead').overhead_s_per_set);
  const sourceScore=scorePlan(plan,p,r).perRule.find(row=>row.id==='goal.params.mobility')!.satisfaction,t=plan.templates[0],before=estimatedSeconds(t,r);item.prescription!.secondsPerRep=5;expect(estimatedSeconds(t,r)-before).toBe(item.sets*item.target.reps*side);
  expect(scorePlan(plan,p,r).perRule.find(row=>row.id==='goal.params.mobility')!.satisfaction).toBe(sourceScore);expect(independentMobilityTempoIssues(plan,p)).toHaveLength(1);
  item.prescription!.secondsPerRep=4;delete item.prescription!.tempo;expect(independentMobilityTempoIssues(plan,p)).toHaveLength(1);expect(scorePlan(plan,p,r).perRule.find(row=>row.id==='goal.params.mobility')!.satisfaction).toBeLessThan(sourceScore);
  expect(DATA.exercises.find(e=>e.id===exercise.id)?.time.s_per_rep).toBe(exercise.time.s_per_rep);
 });
 it('retains optional phases through coach and local backup contracts, with old prescriptions readable',async()=>{
  const plan=fixture(),template=plan.templates[0],rx=template.items[0].prescription!;
  expect(sessionTemplateSchema.parse(template).items[0].prescription?.tempo).toEqual(rx.tempo);
  const {tempo:_tempo,...legacy}=rx;expect(prescriptionSchema.parse(legacy).tempo).toBeUndefined();
  const source=validateBackupEnvelope(JSON.parse(readFileSync(new URL('../fixtures/legacy-backups/v71-coach-plan.json',import.meta.url),'utf8'))),v8=await prepareV8Migration(source.data,'2026-10-15T01:00:00.000Z');v8.planReferences=[];v8.planVersions[0].enginePlan=plan;v8.planVersions[0].templates=[template];
  const restored=validateBackupEnvelope(JSON.parse(JSON.stringify({...source,schemaVersion:BACKUP_VERSION,data:{...source.data,exerciseFavorites:[],nutritionRecords:[],activityImportReceipts:[],metadata:{...source.data.metadata,schemaVersion:DATABASE_VERSION},v8}})));
  expect(restored.data.v8?.planVersions[0].templates[0].items[0].prescription?.tempo).toEqual(rx.tempo);expect(restored.data.v8?.planVersions[0].enginePlan).toEqual(plan);
 });
 it('shows the approved phase parameters and source cadence on training UI',()=>{
  const html=renderToStaticMarkup(createElement(PrescriptionDetails,{prescription:fixture().templates[0].items[0].prescription,locale:'zh'}));expect(html).toContain('离心 / 向心 / 停顿');expect(html).toContain('≈3 / ≈1 / 0');
 });
 it('produces source cadence for real generated mobility items without claiming overall quality',()=>{
  mainline.value={locale:'zh',data:{state:{coachProfile:{...p,weeklyTarget:p.daysPerWeek,goalText:'Mobility',scheduleOriginalText:'',adultConfirmed:true,confirmedAt:'2025-10-01T00:00:00.000Z',healthStorageConsent:{acceptedAt:'2026-10-01T00:00:00.000Z'}}},profile:{timeZone:'Asia/Shanghai'},workouts:[]}};const plan=generatePlan(p);expect(plan.templates.length).toBeGreaterThan(0);expect(plan.templates.flatMap(t=>t.items).some(i=>i.prescription?.tempo)).toBe(true);expect(independentMobilityTempoIssues(plan,p)).toEqual([]);let ramps=0;for(const t of plan.templates){const source=sourceWarmupRamps(t,p,r);ramps+=source.length;for(const entry of source){const i=t.items[entry.itemIndex],e=r.byExercise.get(i.exerciseId)!,protocol=r.get('session.warmup.ramp_sets'),timing=r.get('duration.ramp.sets'),side=i.prescription?.perSide||e.time.per_side?r.get('session.time.model').per_side_multiplier:1;const expected=entry.kind==='bodyweight_main'&&'reps'in i.target?protocol.bodyweight_main.sets*(Math.ceil(i.target.reps*protocol.bodyweight_main.target_rep_fraction)*Math.max(r.get('goal.params.mobility').rep_duration_min_s,e.time.s_per_rep??r.get('duration.rep.seconds').default_if_unknown)*side+r.get('duration.set.overhead').overhead_s_per_set):timing[entry.kind].ramp_s;expect(entry.seconds).toBe(expected);const explicit=t.items.filter(w=>w.prescription?.block==='warmup').some(w=>{const warm=r.byExercise.get(w.exerciseId)!;return entry.kind==='bodyweight_main'&&(warm.ladder.id===e.ladder.id&&warm.ladder.id!==null&&warm.ladder.step===e.ladder.step-1||w.exerciseId===i.exerciseId&&'reps'in w.target&&'reps'in i.target&&w.target.reps===Math.ceil(i.target.reps*protocol.bodyweight_main.target_rep_fraction)&&w.sets===protocol.bodyweight_main.sets);});if(explicit)expect(i.prescription?.warmupSeconds??0).toBe(0);else if(i.prescription?.warmupSeconds!==undefined){expect(i.prescription.warmupSeconds).toBe(expected);const without=structuredClone(t);delete without.items[entry.itemIndex].prescription!.warmupSeconds;expect(estimatedSeconds(t,r)-estimatedSeconds(without,r)).toBe(expected);}else {const before=estimatedSeconds(t,r),unplanned=structuredClone(t);unplanned.items[entry.itemIndex].prescription!.warmupSeconds=expected;expect(estimatedSeconds(unplanned,r)-before).toBe(expected);expect(i.prescription?.warmupSeconds).toBeUndefined();expect(renderToStaticMarkup(createElement(SourceWarmupSteps,{template:t,itemIndex:entry.itemIndex}))).toBe('');}}expect(independentWarmupAudit(t,p).issues).toEqual([]);}expect(ramps).toBeGreaterThan(0);expect(validatePlan(plan,p).filter(i=>i.code==='mobility_tempo_source')).toEqual([]);
 });
});
