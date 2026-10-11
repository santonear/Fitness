import { expect, it } from 'vitest';
import { assistantV2Scenarios, scoreAssistantV2, assistantV2EvaluationBudget } from '../../tools/eval/assistant-v2-scenarios';
import type { AssistantEvent } from '../../src/assistant/contracts';
import { EXERCISE_IDS } from '../../src/catalog/exercises';
const done: AssistantEvent = {type:'done',success:true,usage:{inputTokens:1,outputTokens:1},promptVersion:'synthetic-scorer-test'};
it('defines 60 unique bilingual scenarios with explicit automated expectations', () => {
  expect(assistantV2Scenarios).toHaveLength(60);
  expect(new Set(assistantV2Scenarios.map(s => s.scenarioId)).size).toBe(60);
  for (const scenario of assistantV2Scenarios) expect(scoreAssistantV2(scenario, []).automatedPass).toBe(false);
});
// These exercise the scorer with controlled outputs, not the model's quality.
it.each(assistantV2Scenarios)('scorer enforces language, terminal success and attachment expectations: $scenarioId', scenario => {
  const delta: AssistantEvent = {type:'text_delta',delta:scenario.locale === 'zh' ? '可以先停止不舒服的动作，按你的最新想法聊聊。' : 'You can stop uncomfortable movements and we can discuss your latest preference.'};
  expect(scoreAssistantV2(scenario,[delta,done]).automatedPass).toBe(!scenario.expectedAttachmentType);
  if(scenario.expectedAttachmentType) expect(scoreAssistantV2(scenario,[delta,done]).failures).toContain('required-attachment-missing');
  const opposite: AssistantEvent = {type:'text_delta',delta:scenario.locale === 'zh' ? 'We can stop.' : '可以停止。'};
  expect(scoreAssistantV2(scenario,[opposite,done]).failures).toContain('wrong-language');
  expect(scoreAssistantV2(scenario,[delta,{type:'error',code:'GENERATION_FAILED'},done]).failures).toContain('generation-failed');
  if(scenario.attachment === 'forbidden') {
    expect(scoreAssistantV2(scenario,[delta,{type:'attachment',attachment:{type:'exercise_info',exerciseId:EXERCISE_IDS.bodyweightSquat,summary:'test',mutationAllowed:false}},done]).failures).toContain('unexpected-attachment');
  }
});
it('rejects unsafe content and has a shared five yuan ceiling with no automatic execution', () => {
  const scenario = assistantV2Scenarios.find(s => s.scenarioId === 'knee-pain-en')!;
  expect(scoreAssistantV2(scenario, [{ type:'text_delta',delta:'Push through it.' }, {type:'done',success:true,usage:{inputTokens:1,outputTokens:1},promptVersion:'test'}]).failures).toContain('forbidden-claim');
  expect(assistantV2EvaluationBudget(2,8)).toMatchObject({ totalBudgetCny:5,paidExecutionEnabled:false,fitsBudget:false });
});
