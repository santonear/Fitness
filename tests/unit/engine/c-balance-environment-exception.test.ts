import {expect,it} from 'vitest';
import {baseProfile} from '../../../tools/eval/training-engine-profiles';
import {DATA,Rules} from '../../../src/engine/data';
import {runGates} from '../../../src/engine/gates';
import {isHardEligible} from '../../../src/engine/candidates';
import {checkHard} from '../../../src/engine/hard-checks';
import {validatePlan} from '../../../src/engine';
import {proveEnvironmentCoverage,missingEnvironmentTypes,applicableEnginePlan} from '../../../src/engine/environment';
import {prescribe} from '../../../src/engine/dose';
import type {EnginePlan,EngineProfile,ValidationIssue} from '../../../src/engine/contracts';
const r=new Rules(),ruleId='older.template.balance_required',config=r.get(ruleId).environment_exception;
function profile(overrides:Partial<EngineProfile>={}):EngineProfile{return baseProfile({population:{kind:'older_adult',fallsAnswers:[false,true,false,false],balanceCautious:true},birthYearMonth:'1956-06',place:'outdoor',equipment:['none'],constraints:{space:'mat',quiet:true,noJump:true},...overrides});}
function planFor(p:EngineProfile,rules=r):EnginePlan{const g=runGates(p,rules),e=rules.data.exercises.find(e=>e.slug==='custom-quiet-march')!;return {weeklyTarget:3,sessionMinutes:30,meta:{engineVersion:'2.0.0-test',rulesVersion:rules.data.rulesVersion,seed:'environment-proof'},templates:['mon','wed','fri'].map((weekday,n)=>{const i=prescribe(e,p,rules,g.restrictions,'conditioning',1);i.target={metricType:'duration',durationSeconds:1800};return {id:'environment-'+n,name:'Real safe cardio',weekday:weekday as 'mon'|'wed'|'fri',targetMinutes:30,estimatedMinutes:30,estimatedSeconds:1800,items:[i]};}),gates:g.reasons,trace:[],notices:[]};}
function issuesFor(p:EngineProfile,rules=r){const plan=planFor(p,rules),gate=runGates(p,rules);return {plan,gate,issues:checkHard(plan,p,gate,rules)};}
it.each([{place:'outdoor' as const},{place:'home' as const,householdSupport:false}])('proves the complete environment-only vacuum for $place and returns the source warning, not a violation',overrides=>{
 const p=profile(overrides),before=structuredClone(p),{plan,gate,issues}=issuesFor(p),proof=proveEnvironmentCoverage(p,gate,r,ruleId)!;
 expect(proof).toMatchObject({ruleId,patterns:config.patterns,issueCodes:config.issue_codes,warningCode:config.warning_code,noticeKey:config.notice_key});expect(issues).toHaveLength(1);expect(issues[0]).toMatchObject({ruleId,code:config.warning_code,severity:'warning'});expect(issues.filter(i=>i.severity==='error')).toEqual([]);expect(validatePlan(plan,p)).toEqual(issues);expect(p).toEqual(before);
 expect(missingEnvironmentTypes(plan,p,gate,r,issues)).toEqual([{ruleId,patterns:config.patterns,issueCodes:['balance_days']}]);
 plan.quality={status:'environmentLimited',basis:'environment_constraint',score:0,perRule:[],issues,environmentConstraints:[{ruleId,patterns:config.patterns,issueCodes:['balance_days']}]};expect(applicableEnginePlan(plan,p)).toBe(true);plan.quality.status='ready';expect(applicableEnginePlan(plan,p)).toBe(false);
});
it.each([{place:'outdoor' as const,householdSupport:true},{place:'home' as const},{place:'home' as const,householdSupport:false,equipment:['none','chair'] as EngineProfile['equipment']}])('retains the three-day hard requirement whenever any complete-pool balance candidate is available',overrides=>{
 const p=profile(overrides),{gate,issues}=issuesFor(p);expect(r.data.exercises.some(e=>e.primary_pattern==='balance'&&isHardEligible(e,p,gate,{rules:r}))).toBe(true);expect(proveEnvironmentCoverage(p,gate,r,ruleId)).toBeUndefined();expect(issues.some(i=>i.code==='balance_days'&&i.severity==='error')).toBe(true);expect(issues.some(i=>i.code===config.warning_code)).toBe(false);
});
it('does not manufacture an environment exception for a health exclusion or blocked gate',()=>{
 const p=profile({painState:[{pattern:'balance',remainingSessions:1}]}),{gate,issues}=issuesFor(p);expect(gate.status).not.toBe('blocked');expect(proveEnvironmentCoverage(p,gate,r,ruleId)).toBeUndefined();expect(issues.some(i=>i.code==='balance_days'&&i.severity==='error')).toBe(true);
 const blocked=profile();blocked.screening.symptoms=true;const g=runGates(blocked,r);expect(g.status).toBe('blocked');expect(proveEnvironmentCoverage(blocked,g,r,ruleId)).toBeUndefined();
});
it('rejects a stored or incoming exception claim when the full current proof fails',()=>{
 const p=profile({householdSupport:true}),{plan,gate}=issuesFor(p),fake:ValidationIssue={ruleId,code:config.warning_code,severity:'warning',reason:'untrusted saved claim'};expect(missingEnvironmentTypes(plan,p,gate,r,[fake])).toEqual([]);plan.quality={status:'environmentLimited',basis:'environment_constraint',score:0,perRule:[],issues:[fake],environmentConstraints:[{ruleId,patterns:['balance'],issueCodes:['balance_days']}]};expect(applicableEnginePlan(plan,p)).toBe(false);
});
it('never suppresses a concurrent real hard error or treats an empty class as a safe environmental plan',()=>{
 const p=profile(),{plan,gate}=issuesFor(p);plan.templates[0].items[0].target={metricType:'duration',durationSeconds:99999};let issues=checkHard(plan,p,gate,r);expect(issues.some(i=>i.code===config.warning_code&&i.severity==='warning')).toBe(true);expect(issues.some(i=>i.code==='duration_tolerance'&&i.severity==='error')).toBe(true);expect(missingEnvironmentTypes(plan,p,gate,r,issues)).toEqual([]);plan.quality={status:'environmentLimited',basis:'environment_constraint',score:0,perRule:[],issues};expect(applicableEnginePlan(plan,p)).toBe(false);
 plan.templates[0].items=[];issues=checkHard(plan,p,gate,r);expect(issues.some(i=>i.code==='empty_session'&&i.severity==='error')).toBe(true);expect(missingEnvironmentTypes(plan,p,gate,r,issues)).toEqual([]);
});
it('takes the exception code from source and refuses any attempt to relax clinical or noise facts',()=>{
 const data=structuredClone(DATA),value=data.rules.find(rule=>rule.id===ruleId)!.value!,p=profile();value.environment_exception.warning_code='source_test.environment_exempt';let rules=new Rules(data),g=runGates(p,rules);expect(checkHard(planFor(p,rules),p,g,rules).some(i=>i.code==='source_test.environment_exempt'&&i.severity==='warning')).toBe(true);
 value.environment_exception.relax.population={kind:'general'};rules=new Rules(data);g=runGates(p,rules);expect(proveEnvironmentCoverage(p,g,rules,ruleId)).toBeUndefined();expect(checkHard(planFor(p,rules),p,g,rules).some(i=>i.code==='balance_days'&&i.severity==='error')).toBe(true);
 delete value.environment_exception.relax.population;value.environment_exception.relax.quiet=false;rules=new Rules(data);expect(proveEnvironmentCoverage(p,runGates(p,rules),rules,ruleId)).toBeUndefined();
});
it('does not waive the requirement merely because every balance identity was excluded by preference',()=>{
 const p=profile({preferences:{cannotDo:[],excludedExerciseIds:r.data.exercises.filter(e=>e.primary_pattern==='balance').map(e=>e.id)}}),{gate,issues}=issuesFor(p);expect(proveEnvironmentCoverage(p,gate,r,ruleId)).toBeUndefined();expect(issues.some(i=>i.code==='balance_days'&&i.severity==='error')).toBe(true);
});
it('rejects every nonblocked empty plan even when all catalogue actions were explicitly excluded',()=>{
 const p=profile({preferences:{cannotDo:[],excludedExerciseIds:r.data.exercises.map(e=>e.id)}}),plan=planFor(p),gate=runGates(p,r);plan.templates=[];plan.quality={status:'unavailable',basis:'no_safe_candidates',score:0,perRule:[],issues:[]};expect(gate.status).not.toBe('blocked');expect(checkHard(plan,p,gate,r)).toMatchObject([{code:'empty_plan',severity:'error'}]);expect(validatePlan(plan,p).some(i=>i.code==='empty_plan'&&i.severity==='error')).toBe(true);
 const blocked=profile();blocked.screening.symptoms=true;expect(runGates(blocked,r).status).toBe('blocked');expect(checkHard(plan,blocked,runGates(blocked,r),r)).toEqual([]);
});
it('does not claim a hard-days exemption below the source applicability boundary',()=>{
 const p=profile({daysPerWeek:r.get(ruleId).hard_when_days_available_min-1}),gate=runGates(p,r);expect(proveEnvironmentCoverage(p,gate,r,ruleId)).toBeUndefined();expect(checkHard(planFor(p),p,gate,r).some(i=>i.code==='balance_days'||i.code===config.warning_code)).toBe(false);
});
