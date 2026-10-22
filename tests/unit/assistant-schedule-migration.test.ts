import { it, expect } from 'vitest';
import {
  recoverAssistantSchedule,
  recoverLegacyPlanSchedules,
} from '../../src/persistence/assistant-schedule-migration';
import type { PlanVersion } from '../../src/domain/v8/contracts';
import type { AssistantConversation } from '../../src/persistence/assistant-conversations';
const plan = (versionNumber: number, scheduleOriginalText: string): PlanVersion => ({
  id: String(versionNumber),
  planId: 'plan',
  versionNumber,
  goalText: '健身',
  weeklyTarget: 3,
  sessionMinutes: 40,
  scheduleOriginalText,
  templates: [],
  createdAt: '2026-10-12T00:00:00.000Z',
  origin: 'coach_change',
  changeSummary: [],
});
it('restores only an exact assistant user-message collision and preserves the overwritten text', () => {
  const words = '改成周一三五，把阿诺德推举换掉';
  const versions = [plan(1, '每周两次，每次40分钟'), plan(2, words), plan(3, '保持当前安排')];
  const conversations: AssistantConversation[] = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      title: '修改计划',
      updatedAt: '2026-10-12T00:00:00.000Z',
      messages: [{ role: 'user', content: words }],
    },
  ];
  const fixed = recoverAssistantSchedule(versions, conversations, '2026-10-12T01:00:00.000Z');
  expect(fixed).toEqual([
    {
      ...versions[1],
      scheduleOriginalText: versions[0].scheduleOriginalText,
      scheduleRecovery: { raw: words, recoveredAt: '2026-10-12T01:00:00.000Z' },
    },
  ]);
  expect(
    recoverAssistantSchedule([versions[0], fixed[0], versions[2]], conversations, '2026-10-12T02:00:00.000Z'),
  ).toEqual([]);
  expect(recoverAssistantSchedule(versions, [], '2026-10-12T01:00:00.000Z')).toEqual([]);
});
it('skips every contaminated predecessor and recovers each affected version from the last clean answer', () => {
  const first = '以后不要农夫行走',
    second = '帮我换一个动作';
  const versions = [plan(1, '每周三次，每次40分钟'), plan(2, first), plan(3, second), plan(4, first)];
  const conversations: AssistantConversation[] = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      title: '修改计划',
      updatedAt: '2026-10-12T00:00:00.000Z',
      messages: [
        { role: 'user', content: first },
        { role: 'user', content: second },
      ],
    },
  ];
  const result = recoverAssistantSchedule(versions, conversations, '2026-10-12T01:00:00.000Z');
  expect(result.map(row => row.scheduleOriginalText)).toEqual([
    '每周三次，每次40分钟',
    '每周三次，每次40分钟',
    '每周三次，每次40分钟',
  ]);
  expect(result.map(row => row.scheduleRecovery?.raw)).toEqual([first, second, first]);
  expect(
    recoverLegacyPlanSchedules(
      [{ id: 'plan', currentVersionId: '4', scheduleOriginalText: second }],
      versions,
      conversations,
      '2026-10-12T01:00:00.000Z',
    )[0],
  ).toMatchObject({ scheduleOriginalText: '每周三次，每次40分钟', scheduleRecovery: { raw: second } });
});
it('uses unknown rather than copying a chat message when every version is contaminated', () => {
  const words = '膝盖不舒服，只练上半身，30分钟';
  const versions = [plan(1, words), plan(2, words)];
  const conversations: AssistantConversation[] = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      title: '调整',
      updatedAt: '2026-10-12T00:00:00.000Z',
      messages: [{ role: 'user', content: words }],
    },
  ];
  expect(
    recoverAssistantSchedule(versions, conversations, '2026-10-12T01:00:00.000Z').map(row => row.scheduleOriginalText),
  ).toEqual(['', '']);
  expect(
    recoverLegacyPlanSchedules(
      [{ id: 'plan', currentVersionId: '2', scheduleOriginalText: words }],
      versions,
      conversations,
      '2026-10-12T01:00:00.000Z',
    )[0].scheduleOriginalText,
  ).toBe('');
});
it('repairs a version previously recovered from another polluted version while keeping the first archived raw value', () => {
  const first = '以后不要农夫行走',
    second = '帮我换一个动作';
  const versions = [
    plan(1, first),
    { ...plan(2, first), scheduleRecovery: { raw: second, recoveredAt: '2026-10-12T00:30:00.000Z' } },
  ];
  const conversations: AssistantConversation[] = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      title: '修改计划',
      updatedAt: '2026-10-12T00:00:00.000Z',
      messages: [
        { role: 'user', content: first },
        { role: 'user', content: second },
      ],
    },
  ];
  const result = recoverAssistantSchedule(versions, conversations, '2026-10-12T01:00:00.000Z');
  expect(result.map(row => row.scheduleOriginalText)).toEqual(['', '']);
  expect(result[1].scheduleRecovery?.raw).toBe(second);
});
