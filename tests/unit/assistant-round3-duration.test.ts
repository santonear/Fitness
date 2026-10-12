import {estimatedDurationLabel} from '../../src/i18n/features/plan/labels';
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
describe('round 3 requested duration',()=>{
 it('does not change the requested session length when only adding an exercise',()=>{
  const input=request('给我加一个练腿的动作');
  const card=assembleAssistantIntent({kind:'plan_modify',params:{minutesPerSession:20},changes:[{op:'add',to:'徒手早安式'}]},input).attachment;
  expect(card?.type==='change_proposal'&&card.proposal.sessionMinutes).toBe(45);
  if(card?.type==='change_proposal'&&input.context){
   const html=renderToStaticMarkup(createElement(AssistantAttachment,{candidate:{request:input.context,response:card,expectedRevision:0},locale:'zh'}));
   expect(html).toContain('45 分钟/次');expect(html).toContain(`预计 ${estimatedDurationLabel(card.proposal.templates,'zh')}`);
   expect(card.changes.filter(text=>text.includes('预计'))).toEqual([`预计${estimatedDurationLabel(card.proposal.templates,'zh')}`]);
  }
 });
});
