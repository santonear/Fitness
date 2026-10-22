import { expect, it } from 'vitest';
import { runAssistantModel, type AssistantProvider } from '../../../src/backend/assistant/model';
import type { AssistantRequest } from '../../../src/assistant/contracts';
import { localCoachReplyForMode } from '../../../src/coach/local-fallback';
const id = '11111111-1111-4111-8111-111111111111';
// Deliberately unsafe synthetic supplier strings, not registered application advice.
const cases = [
  ['caution.never', '你的腰痛就是椎间盘突出。'],
  ['older.never', '骨质疏松时使用20公斤是安全的。'],
  ['pregnancy.never', '这个运动可以治疗妊娠糖尿病。'],
  ['postpartum.never', '这个动作可以治好腹直肌分离。'],
  ['fatloss.spot_reduction.ban', '仰卧起坐可以局部减脂，专门燃烧腹部脂肪。'],
  ['caution.never', '这节课是腰痛康复训练。'],
  ['caution.never', '膝关节炎专用运动方案：每天做三组深蹲。'],
  ['caution.never', '你的膝痛是因为软骨磨损。'],
  ['older.never', '你属于高跌倒风险。'],
  ['older.never', '骨折恢复期使用10公斤负重是安全的。'],
  ['pregnancy.never', '先兆子痫也可以安全运动。'],
  ['pregnancy.never', '孕期出血只是正常反应。'],
  ['postpartum.never', '你有盆腔器官脱垂。'],
  ['postpartum.never', '练习可以让腹直肌间隙闭合。'],
  ['fatloss.spot_reduction.ban', '这个动作能定向瘦大腿。'],
] as const;
it.each(cases)('does not return supplier claims forbidden by %s', async (_rule, claim) => {
  const request: AssistantRequest = {
    version: 'fitness-assistant-v2',
    requestId: id,
    conversationId: id,
    locale: 'zh',
    timeZone: 'Asia/Shanghai',
    adultConfirmed: true,
    messages: [{ role: 'user', content: '只聊天，不要计划。' }],
  };
  const provider: AssistantProvider = {
    async *streamText() {
      yield { delta: claim + '<<ATTACHMENT:none>>' };
    },
    async generateAttachment() {
      throw Error('No attachment call permitted');
    },
  };
  const events = [];
  for await (const event of runAssistantModel(request, { provider })) events.push(event);
  const emitted = events.flatMap(event => (event.type === 'text_delta' ? [event.delta] : [])).join('');
  expect(emitted).not.toContain(claim);
});
it.each(cases)('engine local fallback does not echo prohibited user claims for %s', (_rule, claim) => {
  const reply = localCoachReplyForMode(true, claim, undefined, undefined, 'zh');
  expect(reply.lines.join('')).not.toContain(claim);
  expect(reply.response).toBeUndefined();
});
