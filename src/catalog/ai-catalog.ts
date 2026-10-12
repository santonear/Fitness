import { exercises } from './exercises';
import { catalogMetadata } from './registry';
import { equipmentLabel } from './taxonomy';
import type { AssistantRequest } from '../assistant/contracts';
import type { GuidedDialogueRequest } from '../domain/guided-ai-contracts';

// Bounded prompt vocabulary, not a suitability recommendation. Every registered
// movement is eligible by name/alias; the provider still evaluates restrictions.
export function selectAiExercises(goal: string, conditions: unknown = {}, refinement = '') {
  const text = `${goal} ${JSON.stringify(conditions)} ${refinement}`.toLowerCase();
  const terms = text.match(/[a-z0-9]+|[\u4e00-\u9fff]+/g) ?? [];
  const ranked = exercises.map((exercise, index) => {
    const metadata = catalogMetadata.get(exercise.id);
    const aliases = [exercise.name.zh, exercise.name.en, ...(metadata?.aliases ?? [])].map(value => value.toLowerCase());
    const words = aliases.join(' ');
    const exact = aliases.some(alias => alias.length > 2 && text.includes(alias));
    const equipment = text.includes(exercise.equipment) || text.includes(equipmentLabel(exercise.equipment, 'zh'));
    return { exercise, index, score: (exact ? 100 : 0) + (equipment ? 10 : 0) + terms.filter(term => term.length > 2 && words.includes(term)).length };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
  // Original four remain available for existing plans and deterministic adapters.
  const selected = new Map(exercises.slice(0, 4).map(row => [row.id, row]));
  for (const { exercise, score } of ranked) {
    if (score < 100 || selected.size >= 64) break;
    selected.set(exercise.id, exercise);
  }
  // Break equal-score ties across body areas, not alphabetically across the
  // entire catalog (which would otherwise overfill a general plan with abs).
  const groups = new Map<string, typeof exercises>();
  for (const { exercise } of ranked) {
    if (selected.has(exercise.id)) continue;
    const key = catalogMetadata.get(exercise.id)?.bodyPart ?? exercise.category;
    const group = groups.get(key) ?? []; group.push(exercise); groups.set(key, group);
  }
  while (selected.size < 64 && [...groups.values()].some(group => group.length)) {
    for (const group of groups.values()) {
      const exercise = group.shift();
      if (exercise) selected.set(exercise.id, exercise);
      if (selected.size >= 64) break;
    }
  }
  return [...selected.values()];
}
export function guidedAiExercises(request: GuidedDialogueRequest) {
  return selectAiExercises(`${request.scope.goal} ${request.confirmedSummary}`, request.scope.conditions, request.refinement);
}

export type AssistantMovement = 'push'|'pull'|'squat'|'hinge'|'core'|'carry'|'cardio'|'mobility';
const jumpPattern = /jump|hop|burpee|跳|跃/i;
const deepKneePattern = /squat|lunge|leg.press|deep.knee|深蹲|弓步|腿举/i;
/** Deterministic labels for the small model vocabulary, not a medical assessment. */
export function assistantMovement(exercise: typeof exercises[number]): AssistantMovement {
  const meta=catalogMetadata.get(exercise.id), name=`${exercise.name.en} ${meta?.slug ?? ''}`.toLowerCase();
  if(/carry|farmer/.test(name))return 'carry';
  if(/walk|run|cycle|bike|elliptical|cardio|步行|跑步/.test(name))return 'cardio';
  if(/stretch|mobility|yoga|拉伸|瑜伽/.test(name))return 'mobility';
  if(['upper-legs','lower-legs'].includes(meta?.bodyPart??''))return /calf.raise|提踵/.test(name)?'hinge':/squat|lunge|step.up|leg.press/.test(name)?'squat':'hinge';
  if(meta?.bodyPart==='core'||/plank|crunch|dead.bug/.test(name))return 'core';
  if(/bridge|deadlift|hip.thrust|hinge|good.morning/.test(name))return 'hinge';
  if(/squat|lunge|step.up|leg.press/.test(name))return 'squat';
  if(/row|pull|chin.up|lat.pulldown/.test(name)||meta?.bodyPart==='back')return 'pull';
  if(/press|push|dip|fly|raise/.test(name)||['chest','shoulders'].includes(meta?.bodyPart??''))return 'push';
  if(meta?.bodyPart==='core'||/plank|crunch|dead.bug/.test(name))return 'core';
  return meta?.bodyPart==='upper-legs'?'hinge':'mobility';
}
export function selectAssistantCandidates(request: AssistantRequest) {
  const context=request.context, profile=context?.task==='ONBOARD_PLAN'?context.profile:undefined;
  const equipment=profile?.equipment??(context?.task==='MODIFY_PLAN'?context.plan.templates.flatMap(template=>template.items.map(item=>item.equipment)):
    context?.task==='ADJUST_TODAY'?context.template.items.map(item=>item.equipment):[]);
  const allowed=new Set(['none',...equipment]);
  const words=request.messages.at(-1)?.content??'';
  const cautions=new Set([...profile?.cautions??[],...(request.preferences??[]).filter(pref=>pref.kind==='caution_area').flatMap(pref=>Array.isArray(pref.value)?pref.value:[pref.value])]);
  if(/膝盖.{0,8}(?:疼|痛|不适|受伤|舒服|伤)|knee\s*(?:pain|injury|discomfort)/i.test(words))cautions.add('knee');
  const avoidJump=/不能跳|不要跳|不跳|no jumping|avoid jumping/i.test(words)||(request.preferences??[]).some(pref=>pref.kind==='cannot_do'&&/jump|跳/i.test(String(pref.value)));
  const disliked=new Set((request.preferences??[]).filter(pref=>pref.kind==='dislike_exercise').flatMap(pref=>Array.isArray(pref.value)?pref.value:[pref.value]).map(normal=>normal.toLowerCase()));
  const avoidWalkingCarry=(request.preferences??[]).some(pref=>pref.kind==='cannot_do'&&/walking_carry|负重行走/i.test(String(pref.value)))||/以后.*(?:别|不要|不再).*农夫行走|avoid.*farmer.*carry/i.test(words);
  const pool=exercises.filter(exercise=>{
    if(context&& !allowed.has(exercise.equipment))return false;
    const name=`${exercise.name.en} ${catalogMetadata.get(exercise.id)?.slug??''}`;
    if(disliked.has(exercise.id)||disliked.has(exercise.name.en.toLowerCase())||disliked.has(exercise.name.zh.toLowerCase()))return false;
    if(avoidWalkingCarry&&assistantMovement(exercise)==='carry')return false;
    if(avoidJump&&jumpPattern.test(name))return false;
    if(cautions.has('knee')&&deepKneePattern.test(name))return false;
    if(cautions.has('wrist')&&/push.up|plank|dip/.test(name))return false;
    if(cautions.has('shoulder')&&/overhead|shoulder.press|pull.up/.test(name))return false;
    return true;
  });
  const groups=new Map<AssistantMovement,typeof pool>();
  for(const exercise of pool){const mode=assistantMovement(exercise),list=groups.get(mode)??[];list.push(exercise);groups.set(mode,list);}
  const selected:typeof pool=[];
  // Round robin keeps common movement patterns available within a bounded prompt.
  while(selected.length<60&&[...groups.values()].some(list=>list.length))for(const list of groups.values()){
    const exercise=list.shift();if(exercise)selected.push(exercise);if(selected.length===60)break;
  }
  return selected.map((exercise,index)=>({code:`E${String(index+1).padStart(2,'0')}`,exercise,mode:assistantMovement(exercise),label:`E${String(index+1).padStart(2,'0')} ${exercise.name.zh} · ${assistantMovement(exercise)} · ${equipmentLabel(exercise.equipment,'zh')} · ${exercise.metricType}`}));
}
