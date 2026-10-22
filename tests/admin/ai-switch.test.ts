import { expect, it } from 'vitest';
import { aiSwitchLabel, aiSwitchState } from '../../src/ui/admin/shared/ai-switch';
import { aiSwitchState as serverAiSwitchState } from '../../src/backend/admin/users/handler';
import { statusCards } from '../../src/ui/admin/finance/StatusOverview';

const flags = (aiAssistantV2: boolean) => ({ FITNESS_FEATURE_FLAGS: JSON.stringify({ aiAssistantV2 }) });
it('server projection is on only when service, assistant flag and model are all available', async () => {
  expect(await serverAiSwitchState({ aiEnabled: true }, { ...flags(true), CONTROL_MODE: 'external' })).toEqual({
    aiFlag: true,
    aiModelConnected: true,
    aiEffective: true,
  });
  expect(
    (await serverAiSwitchState({ aiEnabled: true }, { ...flags(false), CONTROL_MODE: 'external' })).aiEffective,
  ).toBe(false);
  expect(
    (await serverAiSwitchState({ aiEnabled: false }, { ...flags(true), CONTROL_MODE: 'external' })).aiEffective,
  ).toBe(false);
  expect(
    (await serverAiSwitchState({ aiEnabled: true }, { ...flags(true), CONTROL_MODE: 'control-only' })).aiEffective,
  ).toBe(false);
});
it('todo overview and settings read the same label for the same status', () => {
  for (const status of [
    { aiEnabled: true, aiFlag: true, aiModelConnected: true, aiEffective: true },
    { aiEnabled: true, aiFlag: false, aiModelConnected: true, aiEffective: false },
    { aiEnabled: false, aiFlag: true, aiModelConnected: true, aiEffective: false },
  ]) {
    const state = aiSwitchState(status),
      settingsLabel = aiSwitchLabel(state, true);
    expect(statusCards({ ai: state }, 'zh')[0].value).toBe(settingsLabel);
  }
  expect(
    aiSwitchLabel(aiSwitchState({ aiEnabled: true, aiFlag: false, aiModelConnected: true, aiEffective: false }), true),
  ).toBe('关闭（对话开关已关闭）');
  expect(
    aiSwitchLabel(aiSwitchState({ aiEnabled: true, aiFlag: true, aiModelConnected: true, aiEffective: true }), false),
  ).toBe('On');
});
it('older responses fall back to the service state without inventing an on state', () => {
  expect(aiSwitchState({ aiEnabled: false }).effective).toBe(false);
  expect(aiSwitchState({ aiEnabled: true }).effective).toBe(true);
  expect(aiSwitchLabel(undefined, true)).toBe('状态不可用');
});
