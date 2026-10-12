import {describe,it,expect} from 'vitest';
import {basicProposal} from '../../src/application/v8-workflow';
import {assembleAssistantIntent} from '../../src/backend/assistant/assemble';
import {runAssistantModel,type AssistantProvider} from '../../src/backend/assistant/model';
import {adaptCoachResponse,coachV8Exercises} from '../../src/coach/response-adapter';
import {exercises} from '../../src/catalog/exercises';
import type {AssistantRequest} from '../../src/assistant/contracts';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AssistantAttachment} from '../../src/ui/components/AssistantAttachment';
import {applicableAssistantCandidates,lowerBodyAddition} from '../../src/backend/assistant/applicable-candidates';
import {assistantMovement} from '../../src/catalog/ai-catalog';

const id='11111111-1111-4111-8111-111111111111';
function request(message:string,bodyweightOnly=false):AssistantRequest{
 const plan=basicProposal({goalText:'增强体能',weeklyTarget:3,sessionMinutes:45,scheduleOriginalText:'周一三五每次45分钟',place:'home',equipment:['none','dumbbell'],adultConfirmed:true,cautions:['knee'],confirmedAt:'2026-10-12T00:00:00Z'},'zh')!;
 const names=bodyweightOnly?[['蚌式开合','靠墙俯卧撑','自阻力划船','死虫式'],['靠墙俯卧撑','自阻力划船','平板支撑','蚌式开合']]:[['蚌式开合','靠墙俯卧撑','俯身哑铃划船','死虫式'],['哑铃地板推举','自阻力划船','平板支撑','蚌式开合']];
 plan.templates=names.map((list,index)=>({id:index?'B':'A',name:index?'B':'A',estimatedMinutes:45,items:list.map(name=>{
  const exercise=exercises.find(e=>e.name.zh===name)!;if(!exercise)throw Error(`fixture exercise missing: ${name}`);
  const target=exercise.metricType==='duration'?{metricType:'duration' as const,durationSeconds:30}:exercise.metricType==='reps_load'?{metricType:'reps_load' as const,reps:8,loadGrams:0}:{metricType:'reps' as const,reps:8};
  return {exerciseId:exercise.id,equipment:exercise.equipment,sets:3,target};
 })}));
 return {version:'fitness-assistant-v2',requestId:id,conversationId:id,locale:'zh',timeZone:'Asia/Shanghai',adultConfirmed:true,messages:[{role:'user',content:message}],preferences:[{kind:'caution_area',value:'knee'}],context:{version:'fitness-coach-v8',requestId:id,conversationId:id,restoreGeneration:0,inputSnapshot:'snapshot',sendConfirmation:'confirmed',locale:'zh',timeZone:'Asia/Shanghai',adultConfirmed:true,messages:[],task:'MODIFY_PLAN',target:{planId:id,versionId:id,revision:0},instruction:message,plan}};
}
const clamshell=exercises.find(e=>e.name.zh==='蚌式开合')!.id;

import {catalogMetadata} from '../../src/catalog/registry';
import {sameExerciseFamily} from '../../src/catalog/exercise-family';
import {diffTemplates} from '../../src/assistant/template-diff';
describe('round4 additions',()=>{
 it.each(['给我加一个练腿的动作','在 B 里加一个练腿的动作'])('adds one unique family to the shortest or named session: %s',message=>{
  const input=request(message);if(input.context?.task!=='MODIFY_PLAN')throw Error('fixture');const plan=input.context.plan;plan.templates[0].estimatedMinutes=30;plan.templates[1].estimatedMinutes=20;
  const existing=exercises.find(e=>e.name.zh==='哑铃支架式硬拉')!,twin=exercises.find(e=>e.name.zh==='双哑铃支架式硬拉')!;expect(sameExerciseFamily(existing,twin)).toBe(true);
  plan.templates[0].items.push({exerciseId:existing.id,equipment:existing.equipment,sets:2,target:{metricType:'reps_load',reps:8,loadGrams:0}});
  const card=assembleAssistantIntent({kind:'plan_modify',changes:[{op:'add',session:'A',to:twin.id},{op:'add',session:'B',to:twin.id}]},input).attachment;
  if(card?.type!=='change_proposal')throw Error('card');const diff=diffTemplates(plan.templates,card.proposal.templates);
  expect(diff.changes).toHaveLength(1);expect(diff.changes[0].kind).toBe('added');expect(diff.changes[0].templateIndex).toBe(1);
  const added=exercises.find(e=>e.id===diff.changes[0].item.exerciseId)!;
  for(const item of plan.templates.flatMap(t=>t.items))expect(sameExerciseFamily(added,exercises.find(e=>e.id===item.exerciseId)!)).toBe(false);
  expect(added.name.en).not.toMatch(/squat|lunge|leg.press|walk|jump|hop|burpee/i);expect(()=>adaptCoachResponse(input.context!,card)).not.toThrow();
 });
});
