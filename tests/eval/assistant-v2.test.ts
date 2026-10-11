import { expect, it } from 'vitest';
import { assistantV2Scenarios, scoreAssistantV2, assistantV2EvaluationBudget } from '../../tools/eval/assistant-v2-scenarios';
it('defines 60 unique bilingual scenarios with explicit automated expectations', () => {
  expect(assistantV2Scenarios).toHaveLength(60);
  expect(new Set(assistantV2Scenarios.map(s => s.scenarioId)).size).toBe(60);
  for (const scenario of assistantV2Scenarios) expect(scoreAssistantV2(scenario, []).automatedPass).toBe(false);
});
it('rejects unsafe content and has a shared five yuan ceiling with no automatic execution', () => {
  const scenario = assistantV2Scenarios.find(s => s.scenarioId === 'knee-pain-en')!;
  expect(scoreAssistantV2(scenario, [{ type:'text_delta',delta:'Push through it.' }, {type:'done',success:true,usage:{inputTokens:1,outputTokens:1},promptVersion:'test'}]).failures).toContain('forbidden-claim');
  expect(assistantV2EvaluationBudget(2,8)).toMatchObject({ totalBudgetCny:5,paidExecutionEnabled:false,fitsBudget:false });
});
