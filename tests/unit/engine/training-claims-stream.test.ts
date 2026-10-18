import {expect,it} from 'vitest';
import {runAssistantModel,type AssistantProvider} from '../../../src/backend/assistant/model';
import type {AssistantRequest} from '../../../src/assistant/contracts';
const id='11111111-1111-4111-8111-111111111111',request:AssistantRequest={version:'fitness-assistant-v2',requestId:id,conversationId:id,locale:'zh',timeZone:'Asia/Shanghai',adultConfirmed:true,messages:[{role:'user',content:'只聊天，不要计划。'}]};
it('keeps safe streaming but does not release a prohibited claim split across individual chunks',async()=>{
 const prefix='我们可以先聊一聊动作安排。'.repeat(20),claim='你的腰痛就是椎间盘突出。';let calls=0;
 const provider:AssistantProvider={async *streamText(){calls++;for(const delta of prefix+claim+'<<ATTACHMENT:none>>')yield {delta};},async generateAttachment(){throw Error('No attachment call permitted');}};
 const events=[];for await(const e of runAssistantModel(request,{provider}))events.push(e);
 const text=events.flatMap(e=>e.type==='text_delta'?[e.delta]:[]).join('');expect(text).toContain('我们可以');expect(text).not.toContain('椎间盘突出');expect(events.some(e=>e.type==='error')).toBe(true);expect(calls).toBeLessThanOrEqual(2);
});
it('allows a safe explanation denying treatment and spot reduction without a retry',async()=>{
 let calls=0;const text='运动不能治疗妊娠糖尿病，也不能局部减脂。请专业人士评估。';
 const provider:AssistantProvider={async *streamText(){calls++;yield {delta:text+'<<ATTACHMENT:none>>'};},async generateAttachment(){throw Error('No attachment call permitted');}};
 const events=[];for await(const e of runAssistantModel(request,{provider}))events.push(e);
 expect(events.filter(e=>e.type==='text_delta').map(e=>e.delta).join('')).toBe(text);expect(events.some(e=>e.type==='error')).toBe(false);expect(calls).toBe(1);
});
it.each([
 '孕期盆底肌练习：收缩5秒，再放松5秒，每天做3组。',
 '产后盆底肌练习：收缩5秒、放松5秒，每天3组。',
])('does not release numerical pelvic-floor instructions split into single-character chunks: %s',async claim=>{const prefix='我们可以先谈谈你的安排。'.repeat(20);const provider:AssistantProvider={async *streamText(){for(const delta of prefix+claim+'<<ATTACHMENT:none>>')yield {delta};},async generateAttachment(){throw Error('No attachment call permitted');}};const events=[];for await(const event of runAssistantModel(request,{provider}))events.push(event);const emitted=events.flatMap(event=>event.type==='text_delta'?[event.delta]:[]).join('');expect(emitted).toContain('我们可以');expect(emitted).not.toContain('收缩');expect(events.some(event=>event.type==='error')).toBe(true);});
