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
describe('round 3 card presentation',()=>{
 it.each([{session:'A',rows:1},{session:undefined,rows:2}])('replacement rows=$rows, duplicate prose is merged',({session,rows})=>{
  const input=request(session?'把 A 里的蚌式开合换掉':'把蚌式开合换掉');const to=lowerBodyAddition(input)!;
  const card=assembleAssistantIntent({kind:'plan_modify',changes:[{op:'replace',from:clamshell,to:to.code,...(session?{session}:{})}]},input).attachment;
  expect(card?.type).toBe('change_proposal');
  if(card?.type==='change_proposal'&&input.context){
   if(session&&input.context.task==='MODIFY_PLAN')expect(card.proposal.templates[1]).toEqual(input.context.plan.templates[1]);
   expect(card.changes.filter(text=>text.includes('换成'))).toHaveLength(1);
   const html=renderToStaticMarkup(createElement(AssistantAttachment,{candidate:{request:input.context,response:card,expectedRevision:0},locale:'zh'}));
   expect(html.match(/data-change="replaced"/g)).toHaveLength(rows);
   expect(html).toContain(`调整 ${rows} 项`);
  }
 });
 it('counts one removed movement as one change in both summary and card',()=>{
  const base=request('今天只练上半身');if(base.context?.task!=='MODIFY_PLAN')throw Error('fixture');
  const template=base.context.plan.templates[0];
  const context={...base.context,task:'ADJUST_TODAY' as const,template};
  const input={...base,context};
  const card=assembleAssistantIntent({kind:'today_adjust',focus:'upper'},input).attachment;
  expect(card?.type==='today_adjustment'&&card.summary).toMatch(/^调整1项/);
  if(card?.type==='today_adjustment')expect(renderToStaticMarkup(createElement(AssistantAttachment,{candidate:{request:context,response:card,expectedRevision:0},locale:'zh'}))).toContain('调整 1 项');
 });
});
