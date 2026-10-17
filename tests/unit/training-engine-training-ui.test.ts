import {PendingPainReview} from '../../src/ui/components/PendingPainReview';
import {PainProfessionalConfirmation} from '../../src/ui/components/PainProfessionalConfirmation';
import {EngineResultNotice} from '../../src/ui/components/EngineResultNotice';
import {EngineProfileEditor} from '../../src/ui/pages/settings/EngineProfileEditor';
import {EngineProfilePage} from '../../src/ui/pages/settings/EngineProfilePage';
import {EnginePreferencesEditor} from '../../src/ui/pages/settings/EnginePreferencesEditor';
import {EngineLocalActions} from '../../src/ui/components/EngineLocalActions';
import {AssistantAttachment} from '../../src/ui/components/AssistantAttachment';
import type {CoachApplication} from '../../src/ui/components/CoachPanel';
import {PreTrainingCheckin,TrainingCheckinFields} from '../../src/ui/pages/training/PreTrainingCheckin';
import {JointPainCheckinFields} from '../../src/ui/pages/training/JointPainCheckinFields';
import {painQuestionKeys} from '../../src/application/pain-events';
import type {CoachRequest} from '../../src/coach/contracts';
import {PainFeedbackPanel} from '../../src/ui/pages/training/PainFeedbackPanel';
import {engineCopy} from '../../src/coach/engine-copy';
import type {EnginePlan} from '../../src/engine/contracts';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it,vi} from 'vitest';
import {NextPage} from '../../src/ui/pages/training/NextPage';
import {SetFeedback} from '../../src/ui/pages/training/SetFeedback';
import {PrescriptionDetails} from '../../src/ui/pages/training/PrescriptionDetails';
import {targetChanges,TargetChanges} from '../../src/ui/pages/training/TargetChanges';
import {EXERCISE_IDS} from '../../src/catalog/exercise-ids';
import type {EnginePrescription} from '../../src/engine/contracts';
import type {PlannedItem,SetFact} from '../../src/domain/v8/contracts';
const previewFixture=vi.hoisted(()=>({data:undefined as unknown,featureEnabled:true}));
vi.mock('../../src/ui/useFeature',()=>({useFeature:()=>previewFixture.featureEnabled}));
vi.mock('../../src/ui/components/CoachVisual',()=>({CoachVisual:()=>null}));
vi.mock('../../src/ui/mainline/context',()=>({workflow:{nextTargetPreview:vi.fn()},format:(value:string)=>value,useMainline:()=>({data:previewFixture.data,locale:'zh',t:{next:'下一次',settings:'设置',details:'训练单'},slots:{FeatureCard:({children}:{children:unknown})=>createElement('div',null,children as never),StartHero:({disabled}:{disabled:boolean})=>createElement('button',{disabled,'data-testid':'engine-start'},'Start')},name:()=> '动作',start:vi.fn(),navigate:vi.fn(),run:vi.fn(),openCoach:vi.fn(),sendHomeCoach:vi.fn(),restartPlanning:vi.fn()})}));
const fact:SetFact={exerciseId:EXERCISE_IDS.bodyweightSquat,itemIndex:2,setIndex:0,reps:8,completedAt:'2026-10-15T00:00:00Z'};
const prescription:EnginePrescription={pattern:'squat',block:'main',rir:[3,4],restSeconds:75,secondsPerRep:4,loadBand:'light',loadDescription:{zh:'轻负荷',en:'Light load'}};
describe('training engine feedback and prescription UI',()=>{
 it('shows actual mixed template durations without relabeling the original session goal',()=>{
  const templates=[{id:'A',name:'A',estimatedMinutes:63,targetMinutes:63,items:[{exerciseId:fact.exerciseId,equipment:'none',sets:2,target:{metricType:'reps',reps:8}}]},{id:'B',name:'B',estimatedMinutes:15,targetMinutes:15,items:[{exerciseId:fact.exerciseId,equipment:'none',sets:2,target:{metricType:'reps',reps:8}}]}];
  const candidate={request:{task:'MODIFY_PLAN',trainingEngine:true,plan:{weeklyTarget:3,sessionMinutes:63,templates}},response:{type:'change_proposal',changes:[],proposal:{goalText:'活动度',weeklyTarget:3,sessionMinutes:63,templates}}} as unknown as CoachApplication;
  const before=JSON.stringify(candidate),html=renderToStaticMarkup(createElement(AssistantAttachment,{candidate,locale:'zh'}));
  expect(html).toContain('15 分钟 – 63 分钟');expect(html).not.toContain('63 分钟/次');expect(JSON.stringify(candidate)).toBe(before);
  expect(renderToStaticMarkup(createElement(AssistantAttachment,{candidate,locale:'en'}))).toContain('15 min – 63 min');
 });
 it('collects pre-training pain explicitly and asks only source questions for the selected area',()=>{
  const props={locale:'zh' as const,disabled:false,onChange:()=>{}};
  const empty=renderToStaticMarkup(createElement(JointPainCheckinFields,{...props,value:{}}));
  expect(empty).toContain('value=""');expect(empty).not.toContain('aria-pressed="true"');
  const knee=renderToStaticMarkup(createElement(JointPainCheckinFields,{...props,value:{painArea:'knee'}}));
  for(const key of painQuestionKeys(['knee']))expect(knee).toContain(engineCopy(`redflag.copy.question_${key}`,'zh'));
  expect(knee).not.toContain(engineCopy('redflag.copy.question_back_pain_with_cancer_history','zh'));
  const back=renderToStaticMarkup(createElement(JointPainCheckinFields,{...props,value:{painArea:'back'}}));
  for(const key of painQuestionKeys(['back']))expect(back).toContain(engineCopy(`redflag.copy.question_${key}`,'zh'));
  expect(back).not.toContain('aria-pressed="true"');
 });
 it('keeps all optional pre-training and source pain follow-up answers unknown',()=>{
  const html=renderToStaticMarkup(createElement(TrainingCheckinFields,{answers:{},locale:'zh',disabled:false,onChange:()=>{}}));
  for(let index=0;index<4;index++)expect(html).toContain(engineCopy(`deload.copy.checkin.${index}`,'zh').replaceAll('&','&amp;'));
  expect(html.match(/value="" selected=""/g)).toHaveLength(5);
  expect(html).toContain('value=""');expect(html).not.toContain('value="false" selected');
  const pain=renderToStaticMarkup(createElement(TrainingCheckinFields,{answers:{newOrWorseJointPain:true},locale:'zh',disabled:false,onChange:()=>{}}));
  expect(pain).toContain(engineCopy('pain.copy.stop_exercise','zh'));
 });
 it('does not collect pre-training health answers without consent or when the engine is off',()=>{
  previewFixture.data={state:{coachProfile:{}}};previewFixture.featureEnabled=true;
  expect(renderToStaticMarkup(createElement(PreTrainingCheckin))).toBe('');
  previewFixture.data={state:{coachProfile:{healthStorageConsent:{acceptedAt:'2026-10-15'}}}};previewFixture.featureEnabled=false;
  expect(renderToStaticMarkup(createElement(PreTrainingCheckin))).toBe('');
  previewFixture.data=undefined;previewFixture.featureEnabled=true;
 });
 it('offers only context-applicable local onboarding and plan modification controls',()=>{
  const props={locale:'zh' as const,busy:false,onAction:()=>{},onGuide:()=>{},onGenerate:()=>{}};
  const onboard=renderToStaticMarkup(createElement(EngineLocalActions,{...props,request:{task:'ONBOARD_PLAN'} as CoachRequest}));
  expect(onboard).toContain('button');expect(onboard).not.toContain('只练上肢');
  const modify=renderToStaticMarkup(createElement(EngineLocalActions,{...props,request:{task:'MODIFY_PLAN',plan:{templates:[{id:'A',name:'A',items:[{exerciseId:EXERCISE_IDS.bodyweightSquat}]}]}} as unknown as CoachRequest}));
  expect(modify).toContain('缩短到所选时长');expect(modify).toContain('换掉所选动作');expect(modify).toContain('动作怎么做');expect(modify).not.toContain('某部位不舒服');expect(modify).not.toContain('只练上肢');
 });
 it('exposes registered cannot-do preferences and selected excluded exercises without health consent',()=>{
  const html=renderToStaticMarkup(createElement(EnginePreferencesEditor,{value:{preferences:{cannotDo:['kneeling'],excludedExerciseIds:[EXERCISE_IDS.bodyweightSquat],liked:['walking']}},locale:'zh',onChange:()=>{}}));
  expect(html).toContain(engineCopy('preferences.copy.avoid_kneeling','zh'));
  expect(html).toContain(engineCopy('preferences.copy.avoid_floor_work','zh'));
  expect(html).toContain(engineCopy('preferences.copy.avoid_overhead','zh'));
  expect(html).toContain('以后不安排');expect(html.match(/checked=""/g)).toHaveLength(2);
 });
 it('starts with no selected feedback, score or RIR and never opens a dialog',()=>{
  const html=renderToStaticMarkup(createElement(SetFeedback,{fact,events:[],locale:'zh',busy:false,onAppend:()=>{}}));
  expect(html).toContain('太轻');expect(html).toContain('刚好');expect(html).toContain('太难');expect(html).toContain('不舒服');
  expect(html).not.toContain('aria-pressed="true"');expect(html).not.toContain('疼痛评分');expect(html).not.toContain('role="dialog"');
  expect(html).toContain('value=""');
 });
 it('renders an explicit previous effort without mutating its completed set',()=>{
  const before=structuredClone(fact),events=[{id:'event',itemIndex:2,setIndex:0,exerciseId:fact.exerciseId,createdAt:fact.completedAt,effort:'too_light' as const}];
  const html=renderToStaticMarkup(createElement(SetFeedback,{fact,events,locale:'en',busy:false,onAppend:()=>{}}));
  expect(html).toMatch(/aria-pressed="true"[^>]*>Too light/);expect(fact).toEqual(before);expect(events).toHaveLength(1);
 });
 it('shows relative load, prescription rest, tempo and RIR without inventing kilogram values',()=>{
  const html=renderToStaticMarkup(createElement(PrescriptionDetails,{prescription,locale:'zh'}));
  expect(html).toContain('轻负荷');expect(html).toContain('75');expect(html).toContain('每次用时');expect(html).toContain('4');expect(html).toContain('3–4');expect(html).not.toContain('0 公斤');
  expect(renderToStaticMarkup(createElement(PrescriptionDetails,{locale:'zh'}))).toBe('');
 });
 it('keeps the start control disabled until the matching engine preview has arrived',()=>{
  previewFixture.data={version:{id:'version',enginePlan:{},templates:[{id:'A',name:'A',estimatedMinutes:30,items:[{exerciseId:fact.exerciseId,equipment:'none',sets:2,target:{metricType:'reps',reps:8}}]}]},workouts:[],metadata:{dataRevision:1},profile:{locale:'zh'}};
  const html=renderToStaticMarkup(createElement(NextPage));
  expect(html).toMatch(/<button disabled="" data-testid="engine-start">Start<\/button>/);
 });
 it('reports actual target deltas in localized metric units and filters another template',()=>{
  const before:PlannedItem={exerciseId:fact.exerciseId,equipment:'dumbbell',sets:2,target:{metricType:'reps_load',reps:8,loadGrams:6000}},after:PlannedItem={...before,target:{metricType:'reps_load',reps:9,loadGrams:8000}};
  expect(targetChanges(before,after,'zh')).toBe('+1 次 · +2 公斤');
  const html=renderToStaticMarkup(createElement(TargetChanges,{suggestions:[{templateId:'A',itemIndex:0,before,after,ruleId:'rule',summary:{zh:'',en:''}}],templateId:'B',locale:'zh',name:()=>''}));
  expect(html).toBe('');expect(before.target).toMatchObject({reps:8,loadGrams:6000});
 });
});

describe('approved health and constrained-result UI',()=>{
 it('uses corrected source PARQ questions and local storage consent verbatim',()=>{
  const html=renderToStaticMarkup(createElement(EngineProfileEditor,{value:{healthStorageConsent:{acceptedAt:'2026-10-15T00:00:00Z'}},onChange:()=>{},locale:'zh'}));
  expect(html).toContain(engineCopy('safety.copy.local_health_consent','zh'));
  expect(html).toContain('休息时、日常活动时或运动时是否胸痛');
  expect(html).toContain(engineCopy('safety.copy.parq_3','zh'));expect(engineCopy('safety.copy.parq_3','zh')).toContain('失去意识');
  for(let index=1;index<=7;index++)expect(html).toContain(engineCopy(`safety.copy.parq_${index}`,'zh'));
 });
 it('shows every quality issue without raw codes or actionable controls',()=>{
  const plan:EnginePlan={quality:{status:'limited',issues:[{code:'weekly_volume_floor',ruleId:'dose.sets_week.goal_matrix',severity:'error',reason:'chest:2<4'},{code:'weekly_pattern_gap',ruleId:'week.coverage.patterns',severity:'error',reason:'hinge'}]},templates:[],weeklyTarget:2,sessionMinutes:30,meta:{engineVersion:'test',rulesVersion:'test',seed:'test'},trace:[],notices:[],gates:[]};
  const html=renderToStaticMarkup(createElement(EngineResultNotice,{plan,locale:'zh'}));
  expect(html).toContain(engineCopy('engine.copy.limited','zh'));expect(html).toContain('胸部 2 &lt; 4');expect(html).toContain('髋铰链');expect(html.match(/<li>/g)).toHaveLength(2);
  expect(html).not.toContain('weekly_volume_floor');expect(html).not.toContain('dose.sets_week');expect(html).not.toContain('<button');
 });
 it('keeps every red flag unknown and confirmation disabled until explicitly answered',()=>{
  const html=renderToStaticMarkup(createElement(PainFeedbackPanel,{preview:{action:'exclude',notices:[engineCopy('pain.copy.drop_pattern','zh')],redFlagsRequired:true,repeatJointReferral:false,blocked:false,applied:false,questions:[{key:'pain_after_fall_or_impact',copyKey:'redflag.copy.question_pain_after_fall_or_impact'}]},locale:'zh',busy:false,name:()=>'',confirmLabel:'确认',onApply:()=>{}}));
  expect(html).toContain(engineCopy('redflag.copy.question_pain_after_fall_or_impact','zh'));expect(html).toContain('本次和下次');expect(html).not.toContain('aria-pressed="true"');expect(html).toMatch(/<button disabled=""[^>]*>确认/);expect(html).not.toContain('role="dialog"');
 });
});

it('requires a separate unchecked professional confirmation only for complete positive review',()=>{
 const review={requiredAt:'2026-10-15T00:00:00Z',answeredAt:'2026-10-15T00:01:00Z',questionKeys:['pain_after_fall_or_impact'],areas:['knee' as const],answers:{pain_after_fall_or_impact:true}};
 const render=(value:typeof review)=>renderToStaticMarkup(createElement(PainProfessionalConfirmation,{review:value,locale:'zh',busy:false,confirmLabel:'确定',onConfirm:()=>{}}));
 const html=render(review);expect(html).toContain(engineCopy('redflag.copy.confirm_professional_seen','zh'));expect(html).not.toContain('checked=""');expect(html).toMatch(/<button disabled=""[^>]*>确定/);
 expect(render({...review,answers:{pain_after_fall_or_impact:false}})).toBe('');
 expect(render({...review,answers:{} as typeof review.answers})).toBe('');
});

it('allows explicit confirmation for an independent pause but never bypasses incomplete historical review',()=>{
 const props={pauseRequiredAt:'2026-10-15T00:00:00Z',locale:'zh' as const,busy:false,confirmLabel:'确定',onConfirm:()=>{}};
 const html=renderToStaticMarkup(createElement(PainProfessionalConfirmation,props));
 expect(html).toContain(engineCopy('redflag.copy.confirm_professional_seen','zh'));expect(html).not.toContain('checked=""');expect(html).toMatch(/<button disabled=""[^>]*>确定/);
 expect(renderToStaticMarkup(createElement(PainProfessionalConfirmation,{...props,review:{requiredAt:props.pauseRequiredAt,questionKeys:['pain_after_fall_or_impact'],areas:['knee'],answers:{}}}))).toBe('');
});

it('keeps an independent pre-training pause visible and start disabled with the engine off',()=>{
 previewFixture.featureEnabled=false;
 previewFixture.data={state:{trainingPause:{requiredAt:'2026-10-15T00:00:00Z'}},version:{id:'version',templates:[{id:'A',name:'A',estimatedMinutes:30,items:[{exerciseId:fact.exerciseId,equipment:'none',sets:2,target:{metricType:'reps',reps:8}}]}]},workouts:[],metadata:{dataRevision:1},profile:{locale:'zh'}};
 const html=renderToStaticMarkup(createElement(NextPage));expect(html).toMatch(/<button disabled="" data-testid="engine-start">Start<\/button>/);expect(html).toContain(engineCopy('redflag.copy.paused_banner','zh'));expect(html).not.toContain(engineCopy('redflag.copy.confirm_professional_seen','zh'));
 previewFixture.data=undefined;previewFixture.featureEnabled=true;
});

it('requires a new saved screening after an independent pause and clears only the settings draft',()=>{
 const state={trainingPause:{requiredAt:'2026-10-15T01:00:00Z'},coachProfile:{healthStorageConsent:{acceptedAt:'2026-10-15T00:00:00Z'},screening:{completedAt:'2026-10-15T00:00:00Z',parqAnswers:Array(7).fill(false),parqAllNo:true}}};
 previewFixture.data={state,workouts:[],metadata:{dataRevision:1},profile:{locale:'zh'}};const before=JSON.stringify(previewFixture.data);
 const settings=renderToStaticMarkup(createElement(EngineProfilePage));expect(settings).not.toContain('value="false" selected=""');expect(settings).not.toContain(engineCopy('redflag.copy.confirm_professional_seen','zh'));expect(JSON.stringify(previewFixture.data)).toBe(before);
 const old=renderToStaticMarkup(createElement(NextPage));expect(old).not.toContain(engineCopy('redflag.copy.confirm_professional_seen','zh'));
 previewFixture.data={state:{...state,coachProfile:{...state.coachProfile,screening:{...state.coachProfile.screening,completedAt:'2026-10-15T02:00:00Z'}}},workouts:[],metadata:{dataRevision:2},profile:{locale:'zh'}};
 const fresh=renderToStaticMarkup(createElement(NextPage));expect(fresh).toContain(engineCopy('redflag.copy.confirm_professional_seen','zh'));
 previewFixture.data=undefined;
});

it('keeps an ended pending review visible and start blocked after feature revocation',()=>{
 previewFixture.featureEnabled=false;
 previewFixture.data={version:{id:'version',templates:[{id:'A',name:'A',estimatedMinutes:30,items:[{exerciseId:fact.exerciseId,equipment:'none',sets:2,target:{metricType:'reps',reps:8}}]}]},workouts:[{id:'old',status:'partial',sets:[fact],startedAt:fact.completedAt,setFeedbackEvents:[{id:'pending',exerciseId:fact.exerciseId,itemIndex:fact.itemIndex,setIndex:fact.setIndex,createdAt:fact.completedAt,effort:'discomfort',painScore:6,painArea:'knee'}]}],metadata:{dataRevision:1},profile:{locale:'zh'}};
 const html=renderToStaticMarkup(createElement(NextPage));expect(html).toMatch(/<button disabled="" data-testid="engine-start">Start<\/button>/);
 expect(renderToStaticMarkup(createElement(PendingPainReview))).toContain(engineCopy('safety.copy.local_health_consent','zh'));
 previewFixture.featureEnabled=true;
});

it('shows four source fall questions for explicit older population or supplied older age without guessing answers',()=>{
 const consent={acceptedAt:'2026-10-15T00:00:00Z'};
 for(const value of [{healthStorageConsent:consent,population:{kind:'older_adult' as const}},{healthStorageConsent:consent,population:{kind:'general' as const}}]){
  const html=renderToStaticMarkup(createElement(EngineProfileEditor,{value,ageYears:70,onChange:()=>{},locale:'zh'}));
  for(const key of ['fell_in_past_12_months','afraid_of_falling','frequent_dizziness','uses_walking_aid'])expect(html).toContain(engineCopy('older.screen.copy.'+key,'zh'));
  expect(html).not.toContain('<option value="false" selected=""');
 }
});
