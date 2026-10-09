import { describe, expect, it } from 'vitest';
import { coachRequestSchema, coachResponseSchema, planProposalSchema } from '../../src/coach/contracts';
import { EXERCISE_IDS } from '../../src/catalog/exercises';

const id = '11111111-1111-4111-8111-111111111111';
const target = { planId: id, versionId: id, revision: 1 };
const template = { id: 'A', name: 'A', estimatedMinutes: 35, items: [{ exerciseId: EXERCISE_IDS.bodyweightSquat, equipment: 'none', sets: 3, target: { metricType: 'reps', reps: 10 } }] };
const proposal = { goalText: '训练', weeklyTarget: 3, sessionMinutes: 35, scheduleOriginalText: '', templates: [template], reasons: ['a', 'b', 'c'] };
const common = { version: 'fitness-coach-v8', requestId: id, conversationId: id, restoreGeneration: 0, inputSnapshot: 'scope', sendConfirmation: 'yes', locale: 'zh', timeZone: 'Asia/Shanghai', adultConfirmed: true, messages: [] };
const identity = { requestId: id, restoreGeneration: 0, mutationAllowed: false };

describe('V8.0.5 migration wire compatibility', () => {
  it('allows empty original words in both plan responses and MODIFY_PLAN input', () => {
    expect(coachResponseSchema.safeParse({ ...identity, type: 'plan_proposal', proposal }).success).toBe(true);
    expect(coachResponseSchema.safeParse({ ...identity, type: 'change_proposal', target, proposal, changes: ['调整'] }).success).toBe(true);
    expect(coachRequestSchema.safeParse({ ...common, task: 'MODIFY_PLAN', target, plan: proposal, instruction: '调整' }).success).toBe(true);
  });
  it('still requires original words for ONBOARD_PLAN profile', () => {
    const profile = { goalText: '训练', weeklyTarget: 3, sessionMinutes: 35, scheduleOriginalText: '', place: 'home', equipment: [], adultConfirmed: true, cautions: [] };
    expect(coachRequestSchema.safeParse({ ...common, task: 'ONBOARD_PLAN', profile }).success).toBe(false);
    expect(coachRequestSchema.safeParse({ ...common, task: 'ONBOARD_PLAN', profile: { ...profile, scheduleOriginalText: '每次35分钟' } }).success).toBe(true);
  });
  it('continues to reject fractional or out-of-range plan and template durations', () => {
    for (const minutes of [14, 32.5, 121, NaN, Infinity]) {
      expect(planProposalSchema.safeParse({ ...proposal, sessionMinutes: minutes }).success).toBe(false);
      expect(planProposalSchema.safeParse({ ...proposal, templates: [{ ...template, estimatedMinutes: minutes }] }).success).toBe(false);
    }
    for (const minutes of [15, 35, 120]) expect(planProposalSchema.safeParse({ ...proposal, sessionMinutes: minutes }).success).toBe(true);
  });
});
