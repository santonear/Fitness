import {replacementCandidateIds} from './engine-replacement-candidates';
import {createCautionSafety} from './caution-safety';
import {createPostpartumReferral,requestedPostpartumPhase,needsPostpartumReferralCheck} from './postpartum-referral';
import {createBirthReport} from './birth-report';
import {createPregnancySafety,assertPregnancyItems} from './pregnancy-safety';
import {createOlderSafety} from './older-safety';
import {createTrainingStop} from './training-stop';
import {createPostpartumSafety,assertPostpartumItems} from './postpartum-safety';
import {hasHouseholdSupport} from '../engine/equipment';
import {applicableEnginePlan} from '../engine/environment';
import {historyPainState,type PainFollowupRestriction} from './engine-profile';
import type {EngineCoachProfile} from './engine-profile';
import {pendingPainReviews,historyDangerReview} from './pain-events';
import {painExcludedItemIndexes} from './pain-restrictions';
import { createPlanLifecycle, PLAN_RETENTION_MS } from './plan-lifecycle';
import type { Repository } from '../persistence/repository';
import { DomainError } from '../domain/errors';
import { v8CoachProfileSchema, v8PlanVersionSchema, v8WorkoutSchema, setMetricsSchema } from '../domain/schemas';
import type { CoachProfile, Feedback, SetFact, SessionTemplate } from '../domain/v8/contracts';
import type { CoachResponse, CoachRequest } from '../coach/contracts';
import { adaptCoachResponse } from '../coach/response-adapter';
import { planProposalSchema } from '../coach/contracts';
import { exercises } from '../catalog/exercises';
import { estimatePlannedMinutes } from './rules/duration-estimate';
import { manualTrainingItems } from './rules/manual-items';
import { basicItems } from './rules/basic-items';
import basicZh from '../i18n/features/onboarding/basic.zh.json';
import basicEn from '../i18n/features/onboarding/basic.en.json';
import {createTrainingFeedback} from './training-feedback';
import {createTrainingCheckin} from './training-checkin';
import {toEngineProfile} from './engine-profile';
import {enginePlanProposal} from './engine-plan';
import {enginePlanSchema,type EnginePlan} from '../engine/contracts';
import {nextTargets,validatePlan} from '../engine';
import {isFeatureEnabled} from './feature-flags';
import {stableString,DATA,condition,type Exercise} from '../engine/data';
import {EnginePlanUnavailableError} from './engine-error';
import {createTrainingPain,activePainReplacement,latestSetFeedback,unresolvedReview} from './training-pain';

export type LocalCandidate = Extract<CoachResponse, { type: 'plan_proposal' }> & { expectedRevision: number; profile: CoachProfile; source?: 'local' | 'ai'; enginePlan?:EnginePlan };
export type ManualSelection = { adultConfirmed: boolean; template: SessionTemplate; expectedRevision: number; restoreGeneration: number };
const invalid = (message: string): never => { throw new DomainError('INVALID', message); };
/** Basic rules are local and conservative; no model call or inferred medical suitability. */
export function basicProposal(profile: CoachProfile, locale = 'zh') {
  v8CoachProfileSchema.parse(profile);
  if (!profile.adultConfirmed) return undefined;
  const copy = locale === 'en' ? basicEn : basicZh;
  const selection = [basicItems(profile, 0), basicItems(profile, 1)];
  const selectedTemplates = selection.filter((s,index,all) => {
    if(!s.items.length)return false;
    if(profile.weeklyTarget>=3)return true;
    const content=(items:typeof s.items)=>{const rows=items.map(item=>JSON.stringify(item));return JSON.stringify(items.length<4?rows.sort():rows);};
    return !all.slice(0,index).some(previous=>content(previous.items)===content(s.items));
  }).map(({ items }, index) => ({ id: `basic-${index}`, name: String.fromCharCode(65 + index), items, estimatedMinutes: estimatePlannedMinutes(items,profile.sessionMinutes<15?10:15) }));
  const missing = [...new Set(selection.flatMap(s => s.missing))].map(f => copy.families[f as keyof typeof copy.families]).join(' / ');
  const shorter = selectedTemplates.find(template => template.estimatedMinutes < profile.sessionMinutes);
  return { goalText: profile.goalText, weeklyTarget: profile.weeklyTarget, preferredDays: profile.preferredDays, sessionMinutes: profile.sessionMinutes, scheduleOriginalText: profile.scheduleOriginalText, templates: selectedTemplates,
    reasons: [locale === 'en' ? `Start with ${profile.weeklyTarget} sessions a week, up to 4 sets per exercise; use the estimated duration shown for each session.` : `每周安排 ${profile.weeklyTarget} 次，每个动作最多 4 组，以训练单显示的估算时长为准。`, [profile.cautions.length ? copy.adapted : copy.basicReason, shorter ? copy.shorter.replace('{minutes}', String(shorter.estimatedMinutes)) : ''].filter(Boolean).join(' '), !selectedTemplates.length ? copy.empty : missing ? copy.missing.replace('{types}', missing) : (locale === 'en' ? `Uses your stated equipment: ${profile.equipment.join(' / ')}. ${/瘦|减脂|减重|lose weight|fat loss|weight loss/i.test(profile.goalText) ? 'Combines strength work with walking where your selected cautions allow.' : 'Alternates basic strength movements across sessions.'}` : `使用你说明的器械：${profile.equipment.join(' / ')}。${/瘦|减脂|减重|lose weight|fat loss|weight loss/i.test(profile.goalText) ? '在已选注意部位允许的范围内，结合力量动作和步行。' : '两份训练单交替安排基础力量动作。'}`)] as [string, string, string] };
}
function localDate(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}
export function createV8Workflow(repo: Repository) {
  const db = repo.db;
  const postpartum=createPostpartumSafety(repo);
  const caution=createCautionSafety(repo);
  const pregnancy=createPregnancySafety(repo);
  const postpartumReferral=createPostpartumReferral(repo),birth=createBirthReport(repo);
  const assertHealthItems=async (items:Parameters<typeof assertPostpartumItems>[0],state?:{postpartumSafety?:Parameters<typeof assertPostpartumItems>[1];pregnancySafety?:Parameters<typeof assertPregnancyItems>[1];coachProfile?:CoachProfile;painFollowupRestrictions?:PainFollowupRestriction[]})=>{assertPostpartumItems(items,state?.postpartumSafety);assertPregnancyItems(items,state?.pregnancySafety,state?.coachProfile);if(state?.painFollowupRestrictions?.length){const patterns=new Set(historyPainState(await db.v8Workouts.toArray(),[],state.painFollowupRestrictions)?.filter(row=>row.remainingSessions>0).map(row=>row.pattern));if(items.some(item=>{const pattern=DATA.exercises.find(e=>e.id===item.exerciseId)?.primary_pattern;return pattern&&patterns.has(pattern);}))return invalid('PAIN_PATTERN_EXCLUDED');}};
  const cardiac=createTrainingStop(repo);
  const checkins=createTrainingCheckin(repo);
  const lifecycle = createPlanLifecycle(repo);
  function checkedEnginePlan(value:EnginePlan|undefined,proposal:LocalCandidate['proposal']){
    if(!value)return undefined;
    if(!isFeatureEnabled('trainingEngine'))throw new DomainError('CONFLICT','STALE_CANDIDATE');
    const parsed=enginePlanSchema.parse(value);
    if(['weeklyTarget','sessionMinutes','preferredDays','templates'].some(key=>stableString(parsed[key as keyof EnginePlan])!==stableString(proposal[key as keyof typeof proposal])))throw new DomainError('CONFLICT','STALE_CANDIDATE');
    return parsed;
  }
  async function mappedEngineProfile(profile:EngineCoachProfile){
    const local=await db.profiles.toCollection().first(),safety=await db.v8State.get('v8');
    return toEngineProfile(profile,{cautionLevels:safety?.cautionLevels,painFollowupRestrictions:safety?.painFollowupRestrictions,pregnancySafety:safety?.pregnancySafety,screeningEvidenceEvents:safety?.screeningEvidenceEvents,olderSafety:safety?.olderSafety,postpartumSafety:safety?.postpartumSafety,asOfDate:localDate(local?.timeZone??'Asia/Shanghai'),timeZone:local?.timeZone,locale:local?.locale,history:await db.v8Workouts.toArray(),notes:await db.aiMemoryNotes.toArray(),ageYears:local?.bodyDetails?.values.age,bodyWeightKg:local?.bodyDetails?.values.weightKg});
  }
  async function saveEngineSettings(profile:EngineCoachProfile,expectedRevision:number,requestedAt?:string){
    return repo.write(async()=>{
      const state=await db.v8State.get('v8');if(!state?.coachProfile)return invalid('PROFILE_REQUIRED');
      const {powerOneRm:unconsentedPower,postpartumRisk:unconsentedRisk,...withoutPower}=profile;const parsed=v8CoachProfileSchema.parse(profile.healthStorageConsent?profile:withoutPower),prior=state.coachProfile;
      if(stableString([...prior.cautions].sort())!==stableString([...parsed.cautions].sort()))return invalid('CAUTION_REVIEW_REQUIRED');
      if(prior.population?.kind==='pregnant'&&parsed.healthStorageConsent&&parsed.population?.kind!=='pregnant')return invalid('PREGNANCY_BIRTH_REPORT_REQUIRED');
      if(parsed.population?.kind==='postpartum'){
        const beforePhase=requestedPostpartumPhase(prior.population??{kind:'general'})??1,afterPhase=requestedPostpartumPhase(parsed.population)!,local=await db.profiles.toCollection().first(),timeZone=local?.timeZone??'Asia/Shanghai',input={asOfDate:localDate(timeZone),timeZone,requestedAt};
        if(afterPhase>beforePhase&&needsPostpartumReferralCheck(state.postpartumReferralChecks,'each_phase_transition',{...input,phase:afterPhase}))return invalid('POSTPARTUM_REFERRAL_CHECK_REQUIRED');
        if(parsed.population.readinessChecklistPassed&&!(prior.population?.kind==='postpartum'&&prior.population.readinessChecklistPassed)&&needsPostpartumReferralCheck(state.postpartumReferralChecks,'running_readiness_check',input))return invalid('POSTPARTUM_REFERRAL_CHECK_REQUIRED');
      }
      const environment=(p:EngineCoachProfile)=>[p.place,p.equipment,hasHouseholdSupport(p),p.constraints?.space??'small'];
      const changed=stableString(environment(prior))!==stableString(environment(parsed));
      const plan=state.currentPlanId?await db.v8Plans.get(state.currentPlanId):undefined,version=plan?await db.v8PlanVersions.get(plan.currentVersionId):undefined;
      let nextVersion;
      if(changed&&isFeatureEnabled('trainingEngine')&&plan&&!plan.readOnly&&!plan.deletedAt&&version?.enginePlan?.quality?.basis==='environment_constraint'){
        const mapped=await mappedEngineProfile(parsed);if(!mapped)return invalid('ENGINE_SCREENING_REQUIRED');
        const generated=enginePlanProposal(parsed,mapped);if(!generated.proposal)throw new EnginePlanUnavailableError(generated.plan);
        const {reasons:_,...content}=generated.proposal;
        nextVersion=v8PlanVersionSchema.parse({...content,id:crypto.randomUUID(),planId:plan.id,versionNumber:version.versionNumber+1,createdAt:new Date().toISOString(),origin:'manual',source:'local',basedOnVersionId:version.id,changeSummary:[],enginePlan:generated.plan});
        await db.v8PlanVersions.add(nextVersion);await db.v8Plans.put({...plan,currentVersionId:nextVersion.id});
      }
      const retained=nextVersion?(({nextWorkoutOverride:_,...rest})=>rest)(state):state;
      const symptomKeys=DATA.rules.find(row=>row.id==='safety.screen.cmr_symptoms')!.value!.symptoms as string[];
      const completeSymptoms=symptomKeys.every(key=>typeof parsed.screening?.cmrSymptoms?.[key]==='boolean');
      const newScreening=completeSymptoms&&parsed.healthStorageConsent&&parsed.screening?.completedAt&&parsed.screening.completedAt!==prior.screening?.completedAt&&typeof parsed.screening.symptoms==='boolean';
      if(!parsed.healthStorageConsent)retained.postpartumReferralChecks=undefined;
      if(Object.values(parsed.screening?.redFlagReview?.answers??{}).some(Boolean))retained.trainingPause=retained.trainingPause??{requiredAt:new Date().toISOString()};
      retained.screeningEvidenceEvents=parsed.healthStorageConsent?[...state.screeningEvidenceEvents??[],...(newScreening?[{answeredAt:new Date().toISOString(),symptoms:parsed.screening!.symptoms===true||symptomKeys.some(key=>parsed.screening!.cmrSymptoms?.[key]===true)}]:[])]:undefined;
      await db.v8State.put({...retained,coachProfile:parsed});if(!parsed.healthStorageConsent){await db.trainingCheckins.clear();for(const record of await db.v8Workouts.toArray())if(record.postpartumSymptoms){const {postpartumSymptoms:_,...facts}=record;await db.v8Workouts.put(facts);}if(state.postpartumSafety?.regression)await db.v8State.put({...retained,coachProfile:parsed,postpartumSafety:{...state.postpartumSafety,regression:{...state.postpartumSafety.regression,symptomFreeDates:[]}}});}
      return nextVersion;
    },expectedRevision);
  }
  async function snapshot() {
    return db.transaction('r', db.tables, async () => {
      const metadata = await repo.readMetadata(), state = await db.v8State.get('v8');
      const allPlans = await db.v8Plans.toArray();
      const plans = allPlans.filter(p=>!p.deletedAt), deletedPlans=allPlans.filter(p=>p.deletedAt&&Date.now()-Date.parse(p.deletedAt)<PLAN_RETENTION_MS);
      const plan = plans.find(p=>p.id===state?.currentPlanId);
      const historyVersions = await db.v8PlanVersions.toArray();
      const version = plan ? historyVersions.find(v=>v.id===plan.currentVersionId) : undefined;
      const workouts = await db.v8Workouts.toArray();
      const profile = await db.profiles.toCollection().first();
      const hasFutureLegacyDates = !!state?.legacyPlanIds.length && (await db.scheduledWorkouts.toArray()).some(row => !row.hiddenAt && row.status === 'pending' && !row.completedSessionId && row.scheduledDate >= localDate(profile?.timeZone ?? 'Asia/Shanghai'));
      return { metadata, state, plan, version, plans, deletedPlans, planReferences: await db.v8PlanReferences.toArray(), workouts, hasFutureLegacyDates, historyVersions, versions: historyVersions.filter(v=>plans.some(p=>p.id===v.planId)), activities: await db.v8Activities.toArray(), profile, active: workouts.find(row => row.status === 'in_progress') };
    });
  }
  async function propose(profile: CoachProfile, localeOverride?: 'zh' | 'en', options?:{trainingEngine?:boolean}): Promise<LocalCandidate> {
    const painHistory=await db.v8Workouts.toArray();
    const painState=await db.v8State.get('v8');
    if(painState?.cardiacPause)return invalid('CARDIAC_CLEARANCE_REQUIRED');
      if(painState?.olderSafety?.reviewRequiredAt)return invalid('FALL_PROFESSIONAL_REQUIRED');
    if(painState?.postpartumSafety?.urgentAt)return invalid('POSTPARTUM_PROFESSIONAL_REQUIRED');
    if(painState?.trainingPause||pendingPainReviews(painHistory).length||unresolvedReview(historyDangerReview(painHistory,painState?.coachProfile?.screening?.redFlagReview)))return invalid('PAIN_REVIEW_REQUIRED');
    const local = await db.profiles.toCollection().first(),locale=localeOverride??local?.locale;
    if(local?.bodyDetails?.values.age!==undefined&&local.bodyDetails.values.age<18)return invalid('ADULT_CONFIRMATION_REQUIRED');
    let enginePlan:EnginePlan|undefined;
    let proposal:LocalCandidate['proposal']|undefined=options?.trainingEngine?undefined:basicProposal(profile, locale);
    if(options?.trainingEngine){
      const history=await db.v8Workouts.toArray(),notes=await db.aiMemoryNotes.toArray();
      const mapped=toEngineProfile(profile,{cautionLevels:painState?.cautionLevels,painFollowupRestrictions:painState?.painFollowupRestrictions,pregnancySafety:painState?.pregnancySafety,screeningEvidenceEvents:painState?.screeningEvidenceEvents,olderSafety:painState?.olderSafety,postpartumSafety:painState?.postpartumSafety,asOfDate:localDate(local?.timeZone??'Asia/Shanghai'),timeZone:local?.timeZone,locale,history,notes,ageYears:local?.bodyDetails?.values.age,bodyWeightKg:local?.bodyDetails?.values.weightKg});
      if(!mapped)return invalid('ENGINE_SCREENING_REQUIRED');
      const result=enginePlanProposal(profile,mapped,history);enginePlan=result.plan;proposal=result.proposal;
      if(!proposal)throw new EnginePlanUnavailableError(result.plan);
    }
    if (!proposal) return invalid('BASIC_PLAN_UNAVAILABLE');
    await assertHealthItems(proposal.templates.flatMap(t=>t.items),painState);
    const metadata = await repo.readMetadata();
    return { type: 'plan_proposal', requestId: crypto.randomUUID(), mutationAllowed: false, restoreGeneration: metadata.restoreGeneration ?? 0,
      source: 'local', expectedRevision: metadata.dataRevision, profile: structuredClone(profile), proposal,...(enginePlan?{enginePlan}:{}) };
  }
  async function adopt(candidate: LocalCandidate) {
    const proposal = planProposalSchema.parse(candidate.proposal), profile = v8CoachProfileSchema.parse(candidate.profile);
    if (!profile.adultConfirmed) return invalid('ADULT_CONFIRMATION_REQUIRED');
    return repo.write(async () => {
      const meta = await repo.readMetadata();
      const acceptedEnginePlan=checkedEnginePlan(candidate.enginePlan,proposal);
      if(acceptedEnginePlan){const mapped=await mappedEngineProfile(profile);if(!mapped||!applicableEnginePlan(acceptedEnginePlan,mapped))return invalid('ENGINE_PLAN_UNAVAILABLE');}
      if ((meta.restoreGeneration ?? 0) !== candidate.restoreGeneration) throw new DomainError('CONFLICT', 'STALE_CANDIDATE');
      if (await db.v8Plans.get(candidate.requestId)) throw new DomainError('CONFLICT', 'ALREADY_SAVED');
      const state = await db.v8State.get('v8'); if (!state) return invalid('PROFILE_REQUIRED');
      if(state.cardiacPause)return invalid('CARDIAC_CLEARANCE_REQUIRED');
      if(state.olderSafety?.reviewRequiredAt)return invalid('FALL_PROFESSIONAL_REQUIRED');
      await assertHealthItems(proposal.templates.flatMap(t=>t.items),state);
      const id = crypto.randomUUID();
      const { reasons: _reasons, ...content } = proposal;
      const version = v8PlanVersionSchema.parse({ ...content, id, planId: candidate.requestId, versionNumber: 1, createdAt: new Date().toISOString(),
        origin: 'onboard', source: candidate.source ?? 'local', changeSummary: [],...(acceptedEnginePlan?{enginePlan:acceptedEnginePlan}:{}) });
      await db.v8Plans.toCollection().modify({ readOnly: true });
      await db.v8Plans.add({ id: candidate.requestId, currentVersionId: id, readOnly: false, name: proposal.goalText });
      await db.v8PlanVersions.add(version);
      const { nextWorkoutOverride: _previousOverride, ...retained } = state;
      await db.v8State.put({ ...retained, currentPlanId: candidate.requestId, coachProfile: profile });
      return version;
    }, candidate.expectedRevision);
  }
  async function nextTargetPreview(templateId?:string){
    const data=await snapshot(),version=data.version,profile=data.state?.coachProfile;
    const override=data.state?.nextWorkoutOverride;
    const selected=override&&override.planVersionId===version?.id&&override.templateId===templateId?override.template:version?.templates.find(item=>item.id===templateId);
    const unchanged={template:selected,blocked:false,suggestions:[] as ReturnType<typeof nextTargets>['suggestions'],notices:[] as EnginePlan['notices']};
    if(data.state?.olderSafety?.reviewRequiredAt||data.state?.cardiacPause)return{...unchanged,template:undefined,blocked:true};
    try{await assertHealthItems(selected?.items??[],data.state);}catch{return{...unchanged,template:undefined,blocked:true};}
    if(data.state?.trainingPause||pendingPainReviews(data.workouts).length||unresolvedReview(historyDangerReview(data.workouts,data.state?.coachProfile?.screening?.redFlagReview)))return{...unchanged,template:undefined,blocked:true};
    if(!isFeatureEnabled('trainingEngine')||!selected||!version?.enginePlan)return unchanged;
    if(!profile)return{...unchanged,template:undefined,blocked:true};
    const mapped=toEngineProfile(profile,{cautionLevels:data.state?.cautionLevels,painFollowupRestrictions:data.state?.painFollowupRestrictions,pregnancySafety:data.state?.pregnancySafety,screeningEvidenceEvents:data.state?.screeningEvidenceEvents,olderSafety:data.state?.olderSafety,postpartumSafety:data.state?.postpartumSafety,asOfDate:localDate(data.profile?.timeZone??'Asia/Shanghai'),timeZone:data.profile?.timeZone,locale:data.profile?.locale,history:data.workouts,notes:await db.aiMemoryNotes.toArray(),ageYears:data.profile?.bodyDetails?.values.age,bodyWeightKg:data.profile?.bodyDetails?.values.weightKg});
    if(!mapped)return{...unchanged,template:undefined,blocked:true};
    const checkinContext=await checkins.context(data.workouts);
    const result=nextTargets(checkinContext.history,version.enginePlan,mapped,{checkin:checkinContext.checkin,templateId});
    const previewIssues=validatePlan(result.value,mapped,{progression:{baseline:version.enginePlan,history:checkinContext.history,checkin:checkinContext.checkin,templateId}}),environmentCodes=new Set(result.value.quality?.basis==='environment_constraint'?result.value.quality.environmentConstraints?.flatMap(claim=>claim.issueCodes):[]);
    if(!applicableEnginePlan(result.value,mapped)||previewIssues.some(issue=>issue.severity==='error'&&!environmentCodes.has(issue.code)))return{...unchanged,template:undefined,blocked:true,notices:result.notices};
    if(override&&selected===override.template){
      // Do not validate baseline A and then start an unadjusted override B.
      if(result.suggestions.some(item=>item.ruleId==='deload.dose.prescription'||item.ruleId.startsWith('progression.return.')))return{...unchanged,template:undefined,blocked:true,notices:result.notices};
      await checkins.assertSafeItems(selected.items);
      return{...unchanged,notices:result.notices};
    }
    await checkins.assertSafeItems((result.value.templates.find(item=>item.id===templateId)??selected).items);
    return{template:result.value.templates.find(item=>item.id===templateId)??selected,blocked:false,suggestions:result.suggestions.filter(item=>item.templateId===templateId),notices:result.notices};
  }
  async function start(templateId?: string, manualExerciseId?: string, manualExerciseIds?: string[], manualSelection?: ManualSelection) {
    return repo.write(async () => {
      const metadata = await repo.readMetadata();
      if (manualSelection && (templateId || metadata.dataRevision !== manualSelection.expectedRevision || (metadata.restoreGeneration ?? 0) !== manualSelection.restoreGeneration)) throw new DomainError('CONFLICT', 'STALE_CANDIDATE');
      if (await db.v8Workouts.where('status').equals('in_progress').count() || await db.sessions.where('status').equals('in_progress').count()) throw new DomainError('CONFLICT', 'TRAINING_ALREADY_ACTIVE');
      if(pendingPainReviews(await db.v8Workouts.toArray()).length)return invalid('PAIN_REVIEW_REQUIRED');
      const state = await db.v8State.get('v8'), profile = await db.profiles.toCollection().first();
      if(state?.cardiacPause)return invalid('CARDIAC_CLEARANCE_REQUIRED');
      if(state?.olderSafety?.reviewRequiredAt)return invalid('FALL_PROFESSIONAL_REQUIRED');
      if(state?.trainingPause||unresolvedReview(historyDangerReview(await db.v8Workouts.toArray(),state?.coachProfile?.screening?.redFlagReview)))return invalid('PAIN_REVIEW_REQUIRED');
      const plan = state?.currentPlanId ? await db.v8Plans.get(state.currentPlanId) : undefined;
      const version = plan ? await db.v8PlanVersions.get(plan.currentVersionId) : undefined;
      const override = state?.nextWorkoutOverride;
      const preview=templateId?await nextTargetPreview(templateId):undefined;
      if(preview?.blocked)return invalid('ENGINE_SCREENING_REQUIRED');
      const template=preview?.template;
      if (templateId && (!template || plan?.readOnly || plan?.deletedAt)) return invalid('TEMPLATE_UNAVAILABLE');
      if (!profile) return invalid('PROFILE_REQUIRED');
      const manualTemplate = manualSelection ? v8PlanVersionSchema.shape.templates.element.parse(manualSelection.template) : undefined;
      if (manualTemplate && (manualSelection?.adultConfirmed !== true || state?.coachProfile?.adultConfirmed === false)) return invalid('ADULT_CONFIRMATION_REQUIRED');
      const manualIds = [...new Set(manualExerciseIds ?? (manualExerciseId ? [manualExerciseId] : []))];
      if (manualTemplate && (new Set(manualTemplate.items.map(item => item.exerciseId)).size !== manualIds.length || manualTemplate.items.some(item => !manualIds.includes(item.exerciseId) || exercises.find(e => e.id === item.exerciseId)?.metricType !== item.target.metricType))) return invalid('INVALID_MANUAL_SELECTION');
      if (!template && (!manualIds.length || manualIds.some(id => !exercises.some(item => item.id === id)))) return invalid('SELECT_EXERCISE');
      const items = template?.items ?? manualTemplate?.items ?? manualTrainingItems(manualIds);
      await assertHealthItems(items,state);
      await checkins.assertSafeItems(items);
      const record = v8WorkoutSchema.parse({ id: crypto.randomUUID(), ...(template ? { planVersionId: version!.id, templateId } : {}),
        startedAt: new Date().toISOString(), localDate: localDate(profile.timeZone), timeZone: profile.timeZone, status: 'in_progress', sets: [],
        ...(template || manualTemplate ? { templateSnapshot: template ?? manualTemplate } : {}), plannedSetCount: items.reduce((sum, item) => sum + item.sets, 0),
        plannedExercises: items.map((item, itemIndex) => ({ exerciseId: item.exerciseId, itemIndex, plannedSetCount: item.sets })) });
      await db.v8Workouts.add(record);
      await checkins.consume(record.id);
      if (override && override.planVersionId===version?.id && override.templateId===templateId && state) { const { nextWorkoutOverride: _used, ...rest } = state; await db.v8State.put(rest); }
      return record;
    });
  }
  async function recordSet(workoutId: string, itemIndex: number, setIndex: number, values: Omit<SetFact, 'exerciseId' | 'itemIndex' | 'setIndex' | 'completedAt'>) {
    return repo.write(async () => {
      const workout = await db.v8Workouts.get(workoutId);
      if (!workout || workout.status !== 'in_progress') throw new DomainError('SESSION_READ_ONLY', 'TRAINING_ENDED');
      const painHistory=await db.v8Workouts.toArray(),painState=await db.v8State.get('v8'),painProfile=painState?.coachProfile;
      if(painState?.cardiacPause)return invalid('CARDIAC_CLEARANCE_REQUIRED');
      if(painState?.olderSafety?.reviewRequiredAt)return invalid('FALL_PROFESSIONAL_REQUIRED');
    if(painState?.postpartumSafety?.urgentAt)return invalid('POSTPARTUM_PROFESSIONAL_REQUIRED');
      if(painState?.trainingPause)return invalid('PAIN_REVIEW_REQUIRED');
      {
        const processed=new Set(workout.painActions?.map(action=>action.eventId));
        const rule=DATA.rules.find(row=>row.id==='pain.rule')!.value!;
        const pending=latestSetFeedback(workout).some(event=>event.effort==='discomfort'&&!processed.has(event.id)&&rule.bands.some((band:{when:unknown;action:string})=>band.action!=='continue'&&condition(band.when,{} as Exercise,{pain:{current:event.painScore}})));
        const globalReview=historyDangerReview(painHistory,painProfile?.screening?.redFlagReview);
        if(pendingPainReviews(painHistory).length||unresolvedReview(globalReview)||workout.painReviewRequired||pending||workout.painActions?.some(action=>action.excludedItemIndexes?.includes(itemIndex)))return invalid('PAIN_REVIEW_REQUIRED');
      }
      if(painExcludedItemIndexes(workout,painHistory,painProfile?.painState,painState?.painFollowupRestrictions).includes(itemIndex))return invalid('PAIN_PATTERN_EXCLUDED');
      const item = workout.plannedExercises?.find(row => row.itemIndex === itemIndex);
      if (!item || !Number.isInteger(setIndex) || setIndex < 0 || setIndex >= item.plannedSetCount) return invalid('INVALID_SET');
      if (workout.sets.some(set => set.itemIndex === itemIndex && set.setIndex === setIndex)) throw new DomainError('CONFLICT', 'SET_ALREADY_RECORDED');
      const substitution = workout.substitutions?.filter(s => s.itemIndex === itemIndex).at(-1);
      const exerciseId = substitution?.toExerciseId ?? item.exerciseId;
      const painReplacement=activePainReplacement(workout,itemIndex);
      const actualExerciseId=painReplacement?.exerciseId??exerciseId;
      await assertHealthItems([{exerciseId:actualExerciseId}],painState);
      await checkins.assertSafeItems([{exerciseId:actualExerciseId}],workoutId);
      const planned=workout.templateSnapshot?.items[itemIndex],relativePower=planned?.exerciseId===actualExerciseId&&planned.prescription?.safetyCue&&planned.target.metricType==='reps';
      const metricType = relativePower?'reps':exercises.find(exercise => exercise.id === actualExerciseId)?.metricType;
      setMetricsSchema.parse({ metricType, ...values });
      const next = v8WorkoutSchema.parse({ ...workout, sets: [...workout.sets, { ...values, exerciseId:actualExerciseId, ...(substitution||painReplacement ? { substitutedFrom: item.exerciseId } : {}), itemIndex, setIndex, completedAt: new Date().toISOString() }] });
      await db.v8Workouts.put(next); return next;
    });
  }
  async function finish(id: string, feedback: Feedback, abandon = false, endedAt = new Date().toISOString()) {
    return repo.write(async () => {
      const record = await db.v8Workouts.get(id);
      if (!record || record.status !== 'in_progress') throw new DomainError('SESSION_READ_ONLY', 'TRAINING_ENDED');
      const allowed = new Set(record.sets.map(set => set.exerciseId));
      if (feedback.discomfortExerciseIds?.some(id => !allowed.has(id))) return invalid('INVALID_FEEDBACK_EXERCISE');
      const status = abandon ? 'abandoned' : record.sets.length === 0 ? 'not_started' : record.sets.length === record.plannedSetCount ? 'complete' : 'partial';
      if(!Number.isFinite(Date.parse(endedAt))||Date.parse(endedAt)>Date.now()||Date.parse(endedAt)<Date.parse(record.startedAt))return invalid('INVALID_END_TIME');
      const next = v8WorkoutSchema.parse({ ...record, status, endedAt, feedback });
      await db.v8Workouts.put(next); return next;
    });
  }
  async function replacementCandidates(){
    const state=await db.v8State.get('v8');
    return replacementCandidateIds(state?.coachProfile?await mappedEngineProfile(state.coachProfile):undefined,state?.coachProfile,isFeatureEnabled('trainingEngine'));
  }
  async function substitute(id: string, itemIndex: number, exerciseId: string, reason: 'discomfort' | 'other') {
    return repo.write(async () => {
      const record = await db.v8Workouts.get(id);
      if (!record || record.status !== 'in_progress') throw new DomainError('SESSION_READ_ONLY', 'TRAINING_ENDED');
      const item = record.plannedExercises?.find(p => p.itemIndex === itemIndex);
      if (!item || !exercises.some(e => e.id === exerciseId)) return invalid('INVALID_EXERCISE');
      const safetyState=await db.v8State.get('v8');if(safetyState?.cardiacPause)return invalid('CARDIAC_CLEARANCE_REQUIRED');
      if(safetyState?.olderSafety?.reviewRequiredAt)return invalid('FALL_PROFESSIONAL_REQUIRED');await assertHealthItems([{exerciseId}],safetyState);
      const previous = record.substitutions?.filter(s => s.itemIndex === itemIndex).at(-1)?.toExerciseId ?? item.exerciseId;
      if (previous === exerciseId) return;
      // Past sets and original target snapshots remain immutable; only future sets use the replacement.
      if(!(await replacementCandidates()).includes(exerciseId))return invalid('INVALID_EXERCISE');
      await db.v8Workouts.put(v8WorkoutSchema.parse({ ...record, substitutions: [...record.substitutions ?? [], { fromExerciseId: previous, toExerciseId: exerciseId, itemIndex, reason, createdAt: new Date().toISOString() }] }));
    });
  }
  /** Explicit acceptance only. A response alone never writes any training data. */
  async function applyCoachCandidate({ request, response: raw, expectedRevision,enginePlan }: { request: CoachRequest; response: CoachResponse; expectedRevision: number;enginePlan?:EnginePlan }) {
    if(request.trainingEngine&&(!isFeatureEnabled('trainingEngine')||(raw.type==='plan_proposal'||raw.type==='change_proposal')&&!enginePlan))throw new DomainError('CONFLICT','STALE_CANDIDATE');
    const response = adaptCoachResponse(request, raw);
    if (request.task === 'ONBOARD_PLAN' && response.type === 'plan_proposal') {
      const state=await db.v8State.get('v8');
      return adopt({ ...response, source: 'ai', expectedRevision,enginePlan, profile: { ...state?.coachProfile,...request.profile, weeklyTarget:response.proposal.weeklyTarget,preferredDays:response.proposal.preferredDays,sessionMinutes:response.proposal.sessionMinutes,confirmedAt: new Date().toISOString() } });
    }
    if (!('target' in response) || !('target' in request)) return invalid('NO_PLAN_CANDIDATE');
    return repo.write(async () => {
      if(request.trainingEngine&&!isFeatureEnabled('trainingEngine'))throw new DomainError('CONFLICT','STALE_CANDIDATE');
      const meta = await repo.readMetadata(), state = await db.v8State.get('v8');
      if(state?.cardiacPause)return invalid('CARDIAC_CLEARANCE_REQUIRED');
      if(state?.olderSafety?.reviewRequiredAt)return invalid('FALL_PROFESSIONAL_REQUIRED');
      if(state?.postpartumSafety?.urgentAt)return invalid('POSTPARTUM_PROFESSIONAL_REQUIRED');
      const plan = await db.v8Plans.get(request.target.planId);
      if (request.restoreGeneration !== (meta.restoreGeneration ?? 0) || request.target.revision !== expectedRevision ||
          !state || !plan || plan.deletedAt || plan.readOnly || state.currentPlanId !== plan.id || plan.currentVersionId !== request.target.versionId) throw new DomainError('CONFLICT', 'STALE_CANDIDATE');
      const version = await db.v8PlanVersions.get(plan.currentVersionId);
      if (!version) return invalid('PLAN_UNAVAILABLE');
      if (response.type === 'today_adjustment' && request.task === 'ADJUST_TODAY') {
        await assertHealthItems(response.template.items,state);
        if (!version.templates.some(t => t.id === request.template.id)) return invalid('TEMPLATE_UNAVAILABLE');
        if (request.workoutId) {
          const workout = await db.v8Workouts.get(request.workoutId);
          if (!workout || workout.status !== 'in_progress' || workout.planVersionId !== version.id || workout.templateId !== request.template.id) throw new DomainError('CONFLICT', 'TRAINING_CHANGED');
          const before = workout.templateSnapshot ?? version.templates.find(t => t.id === workout.templateId)!;
          // Do not reinterpret any completed set or substitution as a different planned movement.
          const locked = new Set([...workout.sets.map(s => s.itemIndex), ...(workout.substitutions ?? []).map(s => s.itemIndex)]);
          for (const index of locked) if (JSON.stringify(before.items[index]) !== JSON.stringify(response.template.items[index])) throw new DomainError('CONFLICT', 'COMPLETED_ITEM_READ_ONLY');
          await db.v8Workouts.put(v8WorkoutSchema.parse({ ...workout, templateSnapshot: response.template,
            plannedSetCount: response.template.items.reduce((sum, item) => sum + item.sets, 0),
            plannedExercises: response.template.items.map((item, itemIndex) => ({ exerciseId: item.exerciseId, itemIndex, plannedSetCount: item.sets })) }));
        } else {
          if (await db.v8Workouts.where('status').equals('in_progress').count()) throw new DomainError('CONFLICT', 'TRAINING_CHANGED');
          await db.v8State.put({ ...state, nextWorkoutOverride: { planVersionId: version.id, templateId: request.template.id, template: response.template, requestId: request.requestId } });
        }
        return response.template;
      }
      const proposal = response.type === 'change_proposal' ? response.proposal : response.type === 'review_summary' ? response.suggestion?.proposal : undefined;
      if (!proposal) return invalid('NO_PLAN_CANDIDATE');
      if(request.trainingEngine&&!enginePlan)throw new DomainError('CONFLICT','STALE_CANDIDATE');
      const acceptedEnginePlan=checkedEnginePlan(enginePlan,proposal);
      if(acceptedEnginePlan){const mapped=state.coachProfile?await mappedEngineProfile({...state.coachProfile,weeklyTarget:proposal.weeklyTarget,sessionMinutes:proposal.sessionMinutes,preferredDays:proposal.preferredDays}):undefined;if(!mapped||!applicableEnginePlan(acceptedEnginePlan,mapped))return invalid('ENGINE_PLAN_UNAVAILABLE');}
      const { reasons: _reasons, ...content } = proposal;
      const next = v8PlanVersionSchema.parse({ ...content, scheduleOriginalText: version.scheduleOriginalText, id: crypto.randomUUID(), planId: plan.id, versionNumber: version.versionNumber + 1,
        createdAt: new Date().toISOString(), source: 'ai', origin: response.type === 'review_summary' ? 'review_suggestion' : 'coach_change',
        basedOnVersionId: version.id,...(acceptedEnginePlan?{enginePlan:acceptedEnginePlan}:{}), changeSummary: response.type === 'change_proposal' ? response.changes : [response.type === 'review_summary' ? response.suggestion!.summary : ''] });
      await db.v8PlanVersions.add(next); await db.v8Plans.put({ ...plan, currentVersionId: next.id });
      const { nextWorkoutOverride: _stale, ...rest } = state; await db.v8State.put(rest);
      return next;
    }, expectedRevision);
  }
  async function undoAppliedCoachVersion({planId,appliedVersionId,priorVersionId,expectedRevision}:{planId:string;appliedVersionId:string;priorVersionId:string;expectedRevision:number}){
    return repo.write(async()=>{
      const plan=await db.v8Plans.get(planId),applied=await db.v8PlanVersions.get(appliedVersionId),prior=await db.v8PlanVersions.get(priorVersionId);
      if(!plan||!applied||!prior||plan.deletedAt||plan.currentVersionId!==appliedVersionId||applied.planId!==planId||prior.planId!==planId||applied.basedOnVersionId!==priorVersionId||Date.now()-Date.parse(applied.createdAt)>10_000)throw new DomainError('CONFLICT','UNDO_WINDOW_EXPIRED');
      await db.v8Plans.put({...plan,currentVersionId:priorVersionId});
      return prior;
    },expectedRevision);
  }
  const pain=createTrainingPain(repo);
  return {reviewCaution:caution.review,reportCautionMorning:caution.reportMorning,reconcileCaution:caution.reconcile,reportPostpartumReferral:postpartumReferral.report,reportBirth:birth.report,reportPregnancyStop:pregnancy.reportStop,reportPregnancySupine:pregnancy.reportSupine,confirmPregnancyProviderContacted:pregnancy.confirmProviderContacted,reportOlderFall:createOlderSafety(repo).report,answerOlderFall:createOlderSafety(repo).answer,confirmOlderFallProfessionalSeen:createOlderSafety(repo).confirmProfessionalSeen,reportCardiacSymptoms:cardiac.report,confirmCardiacClearance:cardiac.confirmClearance,reportPostpartumSymptoms:postpartum.report,confirmPostpartumProfessionalSeen:postpartum.confirmProfessionalSeen, ...lifecycle, replacementCandidates, snapshot, propose, adopt, saveEngineSettings, start, recordSet, finish, substitute, nextTargetPreview,saveTrainingCheckin:checkins.save,pendingTrainingCheckin:checkins.pending, painFeedbackPreview:pain.preview,applyPainFeedback:pain.apply,completePastPainReview:pain.completePastReview,confirmPainProfessionalSeen:pain.confirmProfessionalSeen,appendSetFeedback:createTrainingFeedback(repo).append, applyCoachCandidate, undoAppliedCoachVersion };
}
