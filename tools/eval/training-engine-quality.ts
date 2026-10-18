
import type {EnginePlan,EngineProfile,ValidationIssue} from '../../src/engine/contracts';
import {equipmentItemSchema} from '../../src/engine/contracts';
import {Rules} from '../../src/engine/data';
export function matches(condition:unknown,exercise:unknown,user:Record<string,unknown>):boolean {
 if(!condition||typeof condition!=='object')return false;
 const c=condition as Record<string,any>,read=(object:unknown,path:string)=>path.split('.').reduce<unknown>((value,key)=>value&&typeof value==='object'?(value as Record<string,unknown>)[key]:undefined,object);
 if(c.any)return c.any.some((item:unknown)=>matches(item,exercise,user));if(c.all)return c.all.every((item:unknown)=>matches(item,exercise,user));if(c.not)return !matches(c.not,exercise,user);
 for(const [predicate,field] of [['flag','flags'],['position','position'],['use','use']])if(c[predicate]){const actual=read(exercise,field);return Array.isArray(actual)&&(Array.isArray(c[predicate])?c[predicate]:[c[predicate]]).some((item:unknown)=>actual.includes(item));}
 const value=c.field?read(exercise,c.field):c.user?read(user,c.user):undefined;
 if('eq'in c||'is'in c)return value===('eq'in c?c.eq:c.is);if('ne'in c)return value!==c.ne;
 if(c.in)return c.in.includes(value);if(c.not_in)return !c.not_in.includes(value);if('contains'in c)return Array.isArray(value)&&value.includes(c.contains);if(c.contains_any)return Array.isArray(value)&&c.contains_any.some((item:unknown)=>value.includes(item));
 if(typeof value!=='number')return false;return 'gte'in c?value>=c.gte:'gt'in c?value>c.gt:'lte'in c?value<=c.lte:'lt'in c?value<c.lt:false;
}

export function independentEquipment(profile:EngineProfile):Set<string>{
 const available=new Set<string>(profile.equipment);if(profile.householdSupport??profile.place!=='outdoor')for(const id of ['wall','chair','counter'])available.add(id);return available;
}
export function independentlyCurrentClearance(profile:EngineProfile,r:Rules):boolean {
 const clearance=profile.screening.clearance;if(!clearance||!profile.asOfDate)return false;
 const day=(value:string|undefined)=>{if(!value)return undefined;if(/^\d{4}-\d{2}-\d{2}$/.test(value))return Number.isFinite(Date.parse(value))?value:undefined;try{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:profile.timeZone??'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));const get=(type:string)=>parts.find(p=>p.type===type)?.value;return `${get('year')}-${get('month')}-${get('day')}`;}catch{return undefined;}};
 const clearDay=day(clearance.date),screenDay=day(profile.screening.completedAt??profile.screening.lastScreenedAt);if(!clearDay||!screenDay||clearDay<screenDay||clearDay>profile.asOfDate)return false;
 const [y,m,d]=clearDay.split('-').map(Number),expiry=new Date(Date.UTC(y,m-1+r.get('safety.clearance.confirm').valid_months_max,1)),last=new Date(Date.UTC(expiry.getUTCFullYear(),expiry.getUTCMonth()+1,0)).getUTCDate();expiry.setUTCDate(Math.min(d,last));
 return profile.asOfDate<expiry.toISOString().slice(0,10);
}
const rules=new Rules(),spaces=['mat','small','medium','large'];
export function postpartumPhase(profile:EngineProfile){
 const pop=profile.population;if(pop.kind!=='postpartum')return 0;
 if(!pop.cleared)return 1;
 const limits=rules.get('postpartum.phase.boundaries'),buffer=pop.delivery==='cesarean'||pop.delivery==='assisted_or_tear'||pop.perinealTrauma?limits.buffer_weeks_if.default:0;
 return pop.weeksSinceBirth>=limits.base_weeks.phase3_from+buffer?3:pop.weeksSinceBirth>=limits.base_weeks.phase2[0]+buffer?2:1;
}
/** Independent over-approximation: zero here proves there are no safe candidates.
 * Ambiguous health restrictions are deliberately retained, so they cannot manufacture a zero. */
export function independentlyPossibleIds(profile:EngineProfile,sourceRules:Rules=rules):string[]{
 const rules=sourceRules;
 const available=independentEquipment(profile),cannot=profile.preferences.cannotDo,phase=postpartumPhase(profile);
 const user={population:profile.population.kind,activity_status:profile.screening.activityStatus??'inactive',clearance_state:!independentlyCurrentClearance(profile,rules)&&(profile.screening.knownCondition||profile.screening.knownCmrDisease||profile.screening.parqAnswers?.some(Boolean)||profile.screening.restingBp!=='known_below_threshold')?'required':'none_needed',hypertension:profile.screening.restingBp==='known_below_threshold'?'controlled':'unknown',equipment:[...available].map(value=>value==='dumbbell'?'dumbbells':value==='pushup-handles'?'pushup_handles':value),gestation_week:profile.population.kind==='pregnant'?profile.population.week:undefined,postpartum_phase:phase,delivery:profile.population.kind==='postpartum'?(profile.population.delivery==='cesarean'?'caesarean':profile.population.delivery==='assisted_or_tear'?'assisted':'vaginal'):undefined,postnatal_cleared:profile.population.kind==='postpartum'&&profile.population.cleared};
 const possible=rules.data.exercises.filter(exercise=>{
  if(profile.preferences.excludedExerciseIds.includes(exercise.id)||exercise.excluded_cautions?.some(caution=>profile.cautions.includes(caution as EngineProfile['cautions'][number])))return false;
  const equipmentOk=exercise.equipment_required.every(required=>['none','yoga-mat-optional'].includes(required)||available.has(required as EngineProfile['equipment'][number])||(exercise.equipment_alternatives[required]??[]).some(alternative=>available.has(alternative as EngineProfile['equipment'][number])));
  if(!equipmentOk||spaces.indexOf(exercise.space)>spaces.indexOf(profile.constraints.space)||profile.constraints.quiet&&exercise.noise>0)return false;
  if((profile.constraints.noJump||cannot.includes('jumping'))&&(exercise.flags.some(flag=>['jumping','running'].includes(flag))||exercise.modality==='plyometric'||exercise.primary_pattern==='jump_land'))return false;
  if(cannot.includes('walking_carry')&&exercise.primary_pattern==='carry'||cannot.includes('overhead')&&exercise.flags.includes('overhead_load')||cannot.includes('kneeling')&&exercise.position.some(value=>['kneeling','quadruped'].includes(value)))return false;
  const floor=exercise.requires_floor_transition??(matches(rules.get('older.floor.transitions').floor_based_if,exercise,{})||exercise.position.includes('quadruped')||exercise.position.includes('plank')&&!exercise.position.some(value=>['standing','seated'].includes(value)));
  if(cannot.includes('floor_work')&&floor||exercise.difficulty>=5||exercise.use.includes('skill')||profile.painState?.some(state=>state.pattern===exercise.primary_pattern&&state.remainingSessions>0))return false;
  for(const caution of profile.cautions){if(caution==='other')continue;const level=profile.painState?.some(state=>(state.score??0)>5)?2:1;if(matches(rules.get(`caution.${caution}.filter`)[`level_${level}`].exclude_if,exercise,user))return false;}
  if(exercise.flags.some(flag=>rules.get('ladder.gate.barbell').gated_flags.includes(flag)))return false;
  if(exercise.stretch_hold_s){const hold=rules.get('dose.stretch').hold_s,range=profile.population.kind==='older_adult'?hold.older_adult:hold.range;if(Math.max(range[0],exercise.stretch_hold_s[0])>Math.min(range[1],exercise.stretch_hold_s[1]))return false;}
  if(user.clearance_state==='required'){const restricted=rules.get('safety.clearance.restricted_mode');if(restricted.exclude_modality.includes(exercise.modality)||restricted.exclude_flags.some((flag:string)=>exercise.flags.includes(flag)))return false;}
  if(user.hypertension!=='controlled'&&rules.get('safety.hypertension.limits').exclude_flags.some((flag:string)=>exercise.flags.includes(flag)))return false;
  const review=profile.screening.redFlagReview;if(review?.answers&&Object.values(review.answers).some(Boolean))for(const joint of review.areas){if(joint==='other')continue;if(matches(rules.get(`caution.${joint}.filter`)[`level_${rules.get('redflag.after_clearance').resume_caution_level}`].exclude_if,exercise,user))return false;}
  if(profile.level==='beginner'&&profile.trainingAgeWeeks<4){const caps=rules.get('progression.new.week_caps'),week=Math.floor(profile.trainingAgeWeeks)+1,cap=week===1?caps.week_1:week===2?caps.week_2:caps.week_3_4,excluded=rules.get('progression.new.exclusions');if(exercise.difficulty>cap.difficulty_max||excluded.exclude_modality.includes(exercise.modality)||excluded.exclude_flags.some((flag:string)=>exercise.flags.includes(flag))||excluded.exclude_use.some((use:string)=>exercise.use.includes(use)))return false;}
  // Independent older-adult restrictions; inspect the full source catalogue, never a slot shortlist.
  if(profile.population.kind==='older_adult'){
   const pop=profile.population,cautious=!!(pop.balanceCautious||pop.walkingAid||pop.fallsAnswers?.some(Boolean));
   const olderUser={...user,balance_cautious:cautious,walking_aid:!!pop.walkingAid,exercise:{supported_variant_available:exercise.supported_variant_available===true}};
   if(matches(rules.get('older.exclude.base').exclude_if,exercise,olderUser)||matches(rules.get('older.exclude.base').default_low_impact.exclude_if,exercise,olderUser))return false;
   if(cautious&&(matches(rules.get('older.exclude.balance_cautious').exclude_if,exercise,olderUser)||exercise.requires_floor_transition||matches(rules.get('older.floor.transitions').floor_based_if,exercise,olderUser)))return false;
   if(pop.boneFlag&&matches(rules.get('older.bone').until_clearance_exclude_if,exercise,olderUser))return false;
  }
  if(profile.population.kind==='pregnant')for(const rule of rules.data.rules.filter(rule=>rule.id.startsWith('pregnancy.exclude.'))){const value=rule.value!;if((!value.when||matches(value.when,exercise,user))&&matches(value.exclude_if,exercise,user))return false;}
  if(profile.population.kind==='postpartum'&&!profile.population.readinessChecklistPassed&&matches(rules.get('postpartum.running.readiness').on_pass_unlock_if,exercise,user))return false;
  if(phase===1){const pop=profile.population,rule=pop.kind==='postpartum'&&pop.delivery==='cesarean'&&!pop.cleared?'postpartum.gate.caesarean':'postpartum.phase1';if(!matches(rules.get(rule).allow_only_if,exercise,user))return false;}
  return true;
 });
 // This source-scoped fallback is a deterministic catalogue fact, not an extra health inference.
 // Compute primary availability from the same independent hard over-approximation, never slot use.
 const scopes=rules.data.rules.filter(rule=>rule.value?.candidate_fallback);
 return possible.filter(exercise=>scopes.every(rule=>{const value=rule.value!,fallback=value.candidate_fallback;if(fallback.exercise_id!==exercise.id)return true;if(!value.when||!matches(value.when,exercise,user))return false;return !possible.some(primary=>primary.id!==exercise.id&&matches(fallback.primary_if,primary,user));})).map(exercise=>exercise.id);
}

/** Relax equipment and space only; keep health, exclusions, noise and jump restrictions identical. */
export function environmentallyRecoverableIds(profile:EngineProfile):string[]{
 const relaxed:EngineProfile={...profile,equipment:[...equipmentItemSchema.options],householdSupport:true,constraints:{...profile.constraints,space:'large'}};
 return independentlyPossibleIds(relaxed);
}

/** Independent source-scoped environment proof; no generated status or stored claim is an input. */
export function independentBalanceEnvironmentConstraint(profile:EngineProfile,sourceRules:Rules=rules):{ruleId:string;patterns:string[];issueCodes:string[]}|undefined {
 const rule=sourceRules.byId.get('older.template.balance_required'),value=rule?.value,exception=value?.environment_exception;
 if(!rule||!exception||profile.population.kind!=='older_adult'||profile.daysPerWeek<value!.hard_when_days_available_min)return undefined;
 if(!matches(exception.when,{}, {place:profile.place,household_support:profile.householdSupport}))return undefined;
 const progression=sourceRules.get('older.balance.progression'),pop=profile.population,cautious=!!(pop.balanceCautious||pop.walkingAid||pop.fallsAnswers?.some(Boolean)),cap=Math.min(profile.olderSafety?.balanceStage??progression.stages[0].stage,cautious?progression.max_stage_if_balance_cautious:progression.stages.at(-1).stage);
 const stageMatches=(exercise:Rules['data']['exercises'][number])=>!!exercise.balance&&progression.stages.some((stage:any)=>stage.stage<=cap&&stage.base.split('_or_').includes(exercise.balance!.base)&&(stage.mode==='dynamic_allowed'||stage.mode===exercise.balance!.mode)&&stage.hand_support===exercise.balance!.hand_support);
 const pool=(p:EngineProfile)=>{const possible=new Set(independentlyPossibleIds(p,sourceRules));return sourceRules.data.exercises.filter(e=>exception.patterns.includes(e.primary_pattern)&&possible.has(e.id)&&stageMatches(e));};
 if(pool(profile).length)return undefined;
 const relaxation=exception.relax;if(relaxation.equipment!=='all_catalogue'||!spaces.includes(relaxation.space)||typeof relaxation.householdSupport!=='boolean')return undefined;
 const relaxed:EngineProfile={...profile,equipment:[...new Set(sourceRules.data.exercises.flatMap(e=>e.equipment_required))] as EngineProfile['equipment'],householdSupport:relaxation.householdSupport,constraints:{...profile.constraints,space:relaxation.space}};
 if(!pool(relaxed).length)return undefined;
 return {ruleId:rule.id,patterns:[...exception.patterns],issueCodes:[...exception.issue_codes]};
}
