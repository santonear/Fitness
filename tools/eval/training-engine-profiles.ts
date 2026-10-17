import {painQuestionKeys} from '../../src/application/pain-events';
import fc from 'fast-check';
import type {EngineProfile} from '../../src/engine/contracts';
import {Rules} from '../../src/engine/data';
const cmrNegative=Object.fromEntries(new Rules().get('safety.screen.cmr_symptoms').symptoms.map((key:string)=>[key,false]));

export const TRAINING_ENGINE_SEED=20261015;
export const SAMPLE_SIZE=2000;
export const equipmentScenarios:EngineProfile['equipment'][]=[
 ['none'],['none','resistance-band','loop-band'],['none','dumbbell'],
 ['none','dumbbell','resistance-band','loop-band','flat-bench'],
 ['none','dumbbell','kettlebell','barbell','flat-bench','adjustable-bench','cable','lat-pulldown-machine','leg-curl','leg-extension','leg-press','squat-rack','pull-up-bar','chair','wall','anchor-point'],
];
export function baseProfile(overrides:Partial<EngineProfile>={}):EngineProfile {
 const profile:EngineProfile={goal:'health',level:'beginner',trainingAgeWeeks:12,daysPerWeek:3,sessionMinutes:30,equipment:['none'],place:'home',constraints:{noJump:false,quiet:false,space:'medium'},cautions:[],population:{kind:'general'},screening:{parqAllNo:true,parqAnswers:[false,false,false,false,false,false,false],knownCondition:false,knownCmrDisease:false,symptoms:false,cmrSymptoms:{...cmrNegative},activityStatus:'active',restingBp:'known_below_threshold',acuteIllness:false,completedAt:'2026-10-01T00:00:00.000Z',lastScreenedAt:'2026-10-01T00:00:00.000Z'},preferences:{excludedExerciseIds:[],cannotDo:[]},birthYearMonth:'1991-06',asOfDate:'2026-10-15',locale:'zh',...overrides};
 // This factory creates explicit healthy synthetic facts, never a migration default for real users.
 const areas=profile.cautions.filter(area=>area!=='other');
 if(areas.length&&!Object.hasOwn(overrides.screening??{},'redFlagReview')){const keys=painQuestionKeys(areas);profile.screening={...profile.screening,redFlagReview:{requiredAt:'2026-10-01T00:00:00.000Z',answeredAt:'2026-10-01T00:00:00.000Z',areas,questionKeys:keys,answers:Object.fromEntries(keys.map(key=>[key,false]))}};}
 return profile;
}
const inputs=fc.record({
 goal:fc.constantFrom<EngineProfile['goal']>('health','fat_loss','strength','muscle','mobility','start_moving'),
 level:fc.constantFrom<EngineProfile['level']>('beginner','intermediate'),trainingAgeWeeks:fc.integer({min:0,max:104}),
 daysPerWeek:fc.integer({min:1,max:6}),sessionMinutes:fc.integer({min:10,max:90}),equipmentIndex:fc.integer({min:0,max:4}),
 caution:fc.subarray<EngineProfile['cautions'][number]>(['knee','back','shoulder','wrist','other']),
 noJump:fc.boolean(),quiet:fc.boolean(),space:fc.constantFrom<EngineProfile['constraints']['space']>('mat','small','medium','large'),
 population:fc.integer({min:0,max:3}),week:fc.integer({min:0,max:52}),cleared:fc.boolean(),
 active:fc.boolean(),screenProblem:fc.integer({min:0,max:15}),positiveQuestion:fc.integer({min:0,max:6}),
 falls:fc.array(fc.boolean(),{minLength:4,maxLength:4}),balanceCautious:fc.boolean(),
 cannotDo:fc.subarray<EngineProfile['preferences']['cannotDo'][number]>(['walking_carry','jumping','floor_work','overhead','kneeling']),
});
export const profileArbitrary=inputs.map(input=>{
 const parqAnswers=Array<boolean>(7).fill(false);if(input.screenProblem===1)parqAnswers[input.positiveQuestion]=true;
 const population:EngineProfile['population']=input.population===0?{kind:'general'}:input.population===1?{kind:'older_adult',fallsAnswers:input.falls,balanceCautious:input.balanceCautious,walkingAid:false}:input.population===2?{kind:'pregnant',week:input.week,providerCleared:input.cleared,contraindicationsConfirmedNone:true,lastScreenedWeek:input.week}:{kind:'postpartum',weeksSinceBirth:input.week,delivery:input.week%3===0?'cesarean':input.week%3===1?'assisted_or_tear':'vaginal',cleared:input.cleared,readinessChecklistPassed:input.cleared,postnatalCheckDone:input.cleared};
 const profile=baseProfile({goal:input.goal,level:input.level,trainingAgeWeeks:input.trainingAgeWeeks,daysPerWeek:input.daysPerWeek,sessionMinutes:input.sessionMinutes,equipment:[...equipmentScenarios[input.equipmentIndex]],cautions:input.caution,constraints:{noJump:input.noJump,quiet:input.quiet,space:input.space},population,birthYearMonth:population.kind==='older_adult'?'1956-06':'1991-06',preferences:{excludedExerciseIds:[],cannotDo:input.cannotDo}});
 profile.screening={...profile.screening,parqAnswers,parqAllNo:parqAnswers.every(answer=>!answer),symptoms:input.screenProblem===2,knownCondition:input.screenProblem===3,knownCmrDisease:input.screenProblem===3,acuteIllness:input.screenProblem===4,activityStatus:input.active?'active':'inactive',restingBp:input.screenProblem===5?'unknown':'known_below_threshold'};
 return profile;
});
/** Exact population quotas; randomized ordering and attributes use one pinned seed. */
export function sampledProfiles(count=SAMPLE_SIZE):EngineProfile[]{
 const rows=fc.sample(profileArbitrary,{seed:TRAINING_ENGINE_SEED,numRuns:count});
 return rows.map((row,index)=>{
  const bucket=(index*37)%100,kind=bucket<70?'general':bucket<85?'older_adult':bucket<93?'pregnant':'postpartum';
  const population:EngineProfile['population']=kind==='general'?{kind}:kind==='older_adult'?{kind,fallsAnswers:[false,false,false,false],balanceCautious:index%3===0}:kind==='pregnant'?{kind,week:12+index%28,providerCleared:true,contraindicationsConfirmedNone:true,lastScreenedWeek:12+index%28}:{kind,weeksSinceBirth:6+index%47,delivery:index%3===0?'cesarean':'vaginal',cleared:index%5!==0,postnatalCheckDone:index%5!==0};
  return {...row,population,birthYearMonth:kind==='older_adult'?'1956-06':'1991-06',sessionMinutes:[20,30,30,30,45,45,20,40,10,60][index%10],equipment:[...equipmentScenarios[[0,0,0,0,2,2,2,1,3,4][index%10]]],cautions:row.cautions.filter(c=>c!=='other')};
 });
}
export const EXTREME_SIZE=200;
/** Kept outside weighted quality statistics, with independent pinned seed. */
export function extremeProfiles(count=EXTREME_SIZE):EngineProfile[]{
 return fc.sample(profileArbitrary,{seed:TRAINING_ENGINE_SEED+1,numRuns:count}).map((row,index)=>baseProfile({
  ...row,daysPerWeek:index%4===0?6:1,sessionMinutes:index%5===0?90:10,equipment:['none'],
  constraints:{noJump:true,quiet:true,space:index%2?'mat':'small'},cautions:index%3===0?['knee','back','shoulder','wrist']:['knee'],
  preferences:{excludedExerciseIds:[],cannotDo:index%2?['floor_work','walking_carry','overhead','kneeling']:['jumping']},
  population:index%4===0?{kind:'pregnant',week:36,providerCleared:true,contraindicationsConfirmedNone:true,lastScreenedWeek:36}:index%4===1?{kind:'postpartum',weeksSinceBirth:6,delivery:'cesarean',cleared:false}:index%4===2?{kind:'older_adult',balanceCautious:true,fallsAnswers:[false,true,false,false]}:{kind:'general'},
  birthYearMonth:index%4===2?'1956-06':'1991-06',screening:baseProfile().screening
 }));
}

export const goldenProfiles:{id:string;profile:EngineProfile;expectedBlocked?:boolean}[]=[
 {id:'home-dumbbell-knee-3x40',profile:baseProfile({equipment:['none','dumbbell'],cautions:['knee'],sessionMinutes:40})},
 {id:'quiet-bodyweight-2x20',profile:baseProfile({daysPerWeek:2,sessionMinutes:20,constraints:{noJump:true,quiet:true,space:'small'}})},
 {id:'pregnancy-week20-confirmed',profile:baseProfile({population:{kind:'pregnant',week:20,providerCleared:true,contraindicationsConfirmedNone:true,lastScreenedWeek:20}})},
 {id:'cesarean-week8-confirmed',profile:baseProfile({population:{kind:'postpartum',weeksSinceBirth:8,delivery:'cesarean',cleared:true,postnatalCheckDone:true}})},
 {id:'older70-cautious-balance',profile:baseProfile({birthYearMonth:'1956-06',population:{kind:'older_adult',fallsAnswers:[false,true,false,false],balanceCautious:true,walkingAid:false}})},
 {id:'gym-intermediate-muscle4x45',profile:baseProfile({goal:'muscle',level:'intermediate',daysPerWeek:4,sessionMinutes:45,equipment:[...equipmentScenarios[4]],place:'gym',trainingAgeWeeks:104})},
 {id:'bodyweight-health3x30',profile:baseProfile()},
 {id:'first-week-health2x20',profile:baseProfile({trainingAgeWeeks:0,daysPerWeek:2,sessionMinutes:20})},
 {id:'strength1x10',profile:baseProfile({goal:'strength',daysPerWeek:1,sessionMinutes:10})},
 {id:'mobility6x90',profile:baseProfile({goal:'mobility',level:'intermediate',daysPerWeek:6,sessionMinutes:90,equipment:[...equipmentScenarios[3]]})},
 {id:'bands-fat-loss3x45',profile:baseProfile({goal:'fat_loss',equipment:[...equipmentScenarios[1]],sessionMinutes:45})},
 {id:'start-moving2x10',profile:baseProfile({goal:'start_moving',daysPerWeek:2,sessionMinutes:10,trainingAgeWeeks:0})},
 {id:'all-cautions-no-floor',profile:baseProfile({cautions:['knee','back','shoulder','wrist','other'],preferences:{excludedExerciseIds:[],cannotDo:['floor_work']}})},
 {id:'under18-blocked',profile:baseProfile({birthYearMonth:'2009-06'}),expectedBlocked:true},
 {id:'symptoms-blocked',profile:baseProfile({screening:{...baseProfile().screening,symptoms:true}}),expectedBlocked:true},
 {id:'inactive-known-condition-blocked',profile:baseProfile({screening:{...baseProfile().screening,knownCondition:true,knownCmrDisease:true,activityStatus:'inactive'}}),expectedBlocked:true},
 {id:'pregnancy-provider-missing',profile:baseProfile({population:{kind:'pregnant',week:20,providerCleared:false,contraindicationsConfirmedNone:true,lastScreenedWeek:20}}),expectedBlocked:true},
 {id:'cesarean6-not-cleared',profile:baseProfile({population:{kind:'postpartum',weeksSinceBirth:6,delivery:'cesarean',cleared:false}})},
 {id:'pregnancy28-confirmed',profile:baseProfile({population:{kind:'pregnant',week:28,providerCleared:true,contraindicationsConfirmedNone:true,lastScreenedWeek:28}})},
 {id:'older70-unrestricted',profile:baseProfile({birthYearMonth:'1956-06',population:{kind:'older_adult',fallsAnswers:[false,false,false,false],balanceCautious:false}})},
];
