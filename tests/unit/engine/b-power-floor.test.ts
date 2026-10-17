import {it,expect} from 'vitest';
import {Rules,condition} from '../../../src/engine/data';
import {createContext} from '../../../src/engine/pipeline';
import {isHardEligible} from '../../../src/engine/candidates';
import {prescribe,assignDose} from '../../../src/engine/dose';
import {fixtureProfile,sessionFixture} from './fixtures';
const rules=new Rules(),power=rules.get('dose.power'),exercises=rules.data.exercises.filter(e=>e.modality==='power'||power.patterns.includes(e.primary_pattern));
it('prescribes source power sets, repetitions, total reps, RIR and rest for every catalog power action across blocks',()=>{
 const profile={...fixtureProfile,level:'intermediate' as const,trainingAgeWeeks:30},ctx=createContext(profile);
 for(const e of exercises)for(const block of ['main','accessory','conditioning','warmup','cooldown'] as const){const item=prescribe(e,profile,rules,ctx.gate.restrictions,block);
  expect(item.sets).toBeGreaterThanOrEqual(power.sets[0]);expect(item.sets).toBeLessThanOrEqual(power.sets[1]);expect('reps'in item.target).toBe(true);
  if('reps'in item.target){expect(item.target.reps).toBeGreaterThanOrEqual(power.reps[0]);expect(item.target.reps).toBeLessThanOrEqual(power.reps[1]);expect(item.target.reps*item.sets).toBeLessThanOrEqual(power.total_reps_per_exercise_max);}
  expect(item.prescription?.rir[0]).toBeGreaterThanOrEqual(power.rir[0]);expect(item.prescription?.rir[1]).toBeLessThanOrEqual(power.rir[1]);
  const range=rules.get('dose.rest.table')[power.rest_ref.split('.').at(-1)].bounds;expect(item.prescription?.restSeconds).toBeGreaterThanOrEqual(range[0]);expect(item.prescription?.restSeconds).toBeLessThanOrEqual(range[1]);
 }
});
it('excludes power for all beginner ages, including after the introductory four weeks',()=>{
 for(const age of [0,3,12,52]){const profile={...fixtureProfile,trainingAgeWeeks:age},ctx=createContext(profile);for(const e of exercises)expect(isHardEligible(e,profile,ctx.gate,ctx)).toBe(false);}
});
it('groups all floor actions consecutively for older adults while retaining all actions and doses',()=>{
 const profile={...fixtureProfile,population:{kind:'older_adult' as const,fallsAnswers:[false,false,false,false]},birthYearMonth:'1956-06'},ctx=createContext(profile),source=rules.get('older.floor.transitions');
 const floor=rules.data.exercises.filter(e=>e.modality==='mobility'&&condition(source.floor_based_if,e,{})).slice(0,2),standing=rules.data.exercises.find(e=>e.slug==='walking')!;
 expect(floor).toHaveLength(2);const draft={...sessionFixture(),items:[prescribe(floor[0],profile,rules,ctx.gate.restrictions,'mobility'),prescribe(standing,profile,rules,ctx.gate.restrictions,'mobility'),prescribe(floor[1],profile,rules,ctx.gate.restrictions,'mobility')]};
 const output=assignDose(draft,profile,ctx.gate,rules,ctx),isFloor=(id:string)=>condition(source.floor_based_if,rules.byExercise.get(id)!,{});
 let descents=0,previous=false;for(const item of output.items){const floor=isFloor(item.exerciseId);if(floor&&!previous)descents++;previous=floor;}
 expect(descents).toBeLessThanOrEqual(source.other_older_users.max_floor_descents_per_session);expect(output.items.map(i=>i.exerciseId).sort()).toEqual(draft.items.map(i=>i.exerciseId).sort());
 expect(draft.items.map(i=>i.exerciseId)).toEqual([floor[0].id,standing.id,floor[1].id]);
 const general=createContext(fixtureProfile),unchanged=assignDose(draft,fixtureProfile,general.gate,rules,general);expect(unchanged.items.map(i=>i.exerciseId)).toEqual(draft.items.map(i=>i.exerciseId));
});

it('prioritizes introductory hard RIR bounds over a higher goal target and retains population source bounds',()=>{
 const lift=rules.data.exercises.find(e=>e.modality==='strength'&&e.metricType==='reps'&&e.difficulty<=2)!;
 for(const goal of ['health','fat_loss','strength','muscle','mobility','start_moving'] as const){const profile={...fixtureProfile,goal,trainingAgeWeeks:2},ctx=createContext(profile),item=prescribe(lift,profile,rules,ctx.gate.restrictions,'main'),intro=rules.get('progression.new.week_caps').week_3_4;
  expect(item.prescription!.rir[0]).toBeGreaterThanOrEqual(intro.rir[0]);expect(item.prescription!.rir[1]).toBeLessThanOrEqual(intro.rir[1]);if(item.prescription?.tempo)expect(item.prescription.tempo.eccentricSeconds).toBeLessThanOrEqual(rules.get('progression.new.week_caps').eccentric_s_max);
 }
 const walking=rules.data.exercises.find(e=>e.slug==='walking')!,pregnant={...fixtureProfile,population:{kind:'pregnant' as const,week:20,providerCleared:true,contraindicationsConfirmedNone:true,lastScreenedWeek:20}},pregnantCtx=createContext(pregnant);
 expect(prescribe(walking,pregnant,rules,pregnantCtx.gate.restrictions,'conditioning').prescription!.targetRpe![1]).toBeLessThanOrEqual(rules.get('pregnancy.intensity').rpe_0_10.max);
 const postpartum={...fixtureProfile,population:{kind:'postpartum' as const,weeksSinceBirth:8,delivery:'vaginal' as const,cleared:true,postnatalCheckDone:true}},postpartumCtx=createContext(postpartum);
 expect(postpartumCtx.gate.restrictions.phase).toBe(2);expect(prescribe(lift,postpartum,rules,postpartumCtx.gate.restrictions,'main').prescription!.rir[0]).toBeGreaterThanOrEqual(rules.get('postpartum.phase2').strength_limits.rir_min);
});

it('never moves floor cooldown ahead of standing work or floor main ahead of warmup',()=>{
 const profile={...fixtureProfile,population:{kind:'older_adult' as const,fallsAnswers:[false,false,false,false]},birthYearMonth:'1956-06'},ctx=createContext(profile),source=rules.get('older.floor.transitions'),floor=rules.data.exercises.filter(e=>e.modality==='mobility'&&condition(source.floor_based_if,e,{})).slice(0,2),standing=rules.data.exercises.find(e=>e.slug==='walking')!;
 const blocks=['warmup','main','cooldown'] as const,draft={...sessionFixture(),items:[prescribe(floor[0],profile,rules,ctx.gate.restrictions,'warmup'),prescribe(standing,profile,rules,ctx.gate.restrictions,'main'),prescribe(floor[1],profile,rules,ctx.gate.restrictions,'cooldown')]};
 const result=assignDose(draft,profile,ctx.gate,rules,ctx);expect(result.items.map(i=>i.prescription?.block)).toEqual([...blocks]);
 let descents=0,previous=false;for(const item of result.items){const e=rules.byExercise.get(item.exerciseId)!,isFloor=e.requires_floor_transition??condition(source.floor_based_if,e,{});if(isFloor&&!previous)descents++;previous=isFloor;}expect(descents).toBeLessThanOrEqual(source.other_older_users.max_floor_descents_per_session);
 const limitedRules=new Rules({...rules.data,exercises:[...floor,standing]}),limitedCtx=createContext(profile,0,limitedRules),limited=assignDose(draft,profile,limitedCtx.gate,limitedRules,limitedCtx);
 expect(limited.items.map(i=>i.prescription?.block)).toEqual([...blocks]);expect(limited.items.map(i=>i.exerciseId)).toEqual(draft.items.map(i=>i.exerciseId));expect(limitedCtx.trace.some(t=>t.reason.includes('unresolved floor descents'))).toBe(true);
 const floorMain={...draft,items:[prescribe(standing,profile,rules,ctx.gate.restrictions,'warmup'),prescribe(floor[0],profile,rules,ctx.gate.restrictions,'main'),prescribe(floor[1],profile,rules,ctx.gate.restrictions,'cooldown')]};
 expect(assignDose(floorMain,profile,ctx.gate,rules,ctx).items.map(i=>i.prescription?.block)).toEqual([...blocks]);
});
