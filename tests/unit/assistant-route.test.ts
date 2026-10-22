import { describe, expect, it } from 'vitest';
import { assistantPlanIntentDuringWorkout } from '../../src/coach/request-builder';

describe('assistant request routing during a workout', () => {
  it.each([
    ['以后别安排农夫行走，把计划里的换掉', true],
    ['今天膝盖不舒服，以后计划里也不要农夫行走', true],
    ['每周改成三次', true],
    ['Replace this in my plan', true],
    ['今天只练上半身，30分钟', false],
    ['这次换个动作', false],
    ['今天不想按计划练，只练20分钟', false],
    ['Today I do not want to follow the plan, just 20 minutes', false],
    ['只改今天这次训练，不改整体计划', false],
  ])('%s routes to plan: %s', (message, plan) => {
    expect(assistantPlanIntentDuringWorkout(message)).toBe(plan);
  });
});
