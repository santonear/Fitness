import {adaptCoachResponse} from '../../../src/coach/response-adapter';
import {expect,it} from 'vitest';
import {assembleEngineIntent} from '../../../src/backend/assistant/engine-assemble';
import {baseProfile} from '../../../tools/eval/training-engine-profiles';
import {generatePlan} from '../../../src/engine';
import {Rules} from '../../../src/engine/data';
import {prescribe} from '../../../src/engine/dose';
import {runGates} from '../../../src/engine/gates';
import type {AssistantRequest} from '../../../src/assistant/contracts';

it('does not let model-suggested core replacements override an upper-only request',()=>{
  const rules=new Rules(),profile=baseProfile({level:'intermediate',trainingAgeWeeks:52,daysPerWeek:3,sessionMinutes:30,equipment:['none','dumbbell','flat-bench']});
  const original=generatePlan(profile).templates[0];
  const press=rules.data.exercises.find(e=>e.primary_pattern==='push_vertical'&&e.equipment_required.includes('dumbbell')&&e.difficulty<=3)!;
  const core=rules.data.exercises.find(e=>e.primary_pattern==='anti_extension')!;
  const template=structuredClone(original);
  const index=template.items.findIndex(item=>rules.byExercise.get(item.exerciseId)!.primary_pattern==='push_horizontal');
  expect(index).toBeGreaterThanOrEqual(0);
  template.items[index]=prescribe(press,profile,rules,runGates(profile,rules).restrictions,'main',2);
  const id='11111111-1111-4111-8111-111111111111';
  const request:AssistantRequest={version:'fitness-assistant-v2',requestId:id,conversationId:id,locale:'zh',timeZone:'Asia/Shanghai',adultConfirmed:true,messages:[{role:'user',content:'只练上半身'}],context:{version:'fitness-coach-v8',requestId:id,conversationId:id,restoreGeneration:0,inputSnapshot:'synthetic focus regression',sendConfirmation:'preview',locale:'zh',timeZone:'Asia/Shanghai',adultConfirmed:true,messages:[],task:'ADJUST_TODAY',target:{planId:id,versionId:id,revision:0},trainingEngine:true,engineProfile:profile,template,instruction:'只练上半身'}};
  const result=assembleEngineIntent({kind:'today_adjust',focus:'upper',changes:[{op:'replace',from:press.id,to:core.id}]},request);
  expect(result.attachment?.type).toBe('today_adjustment');
  if(result.attachment?.type!=='today_adjustment')throw Error('Expected applicable upper-only proposal');
  expect(()=>adaptCoachResponse(request.context!,result.attachment)).not.toThrow();
  expect(result.attachment.template.items.some(item=>item.exerciseId===press.id)).toBe(true);
  const upper=['push_horizontal','push_vertical','pull_horizontal','pull_vertical','isolation_upper'];
  expect(result.attachment.template.items.every(item=>upper.includes(rules.byExercise.get(item.exerciseId)!.primary_pattern))).toBe(true);
});
