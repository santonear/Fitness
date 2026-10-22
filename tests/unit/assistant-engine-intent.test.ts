import { describe, expect, it } from 'vitest';
import { resolveEngineIntent } from '../../src/assistant/engine-intent';
import { generatePlan } from '../../src/engine';
import { baseProfile } from '../../tools/eval/training-engine-profiles';
import { coachScope } from '../../src/coach/consent';
import type { CoachRequest } from '../../src/coach/contracts';
import type { EngineProfile } from '../../src/engine/contracts';

const id = '11111111-1111-4111-8111-111111111111';
const profile: EngineProfile = { ...baseProfile({ sessionMinutes: 45 }), locale: 'zh' };
const plan = generatePlan(profile);
const template = plan.templates[0];
const common = {
  version: 'fitness-coach-v8' as const,
  requestId: id,
  conversationId: id,
  restoreGeneration: 0,
  inputSnapshot: 'snapshot',
  sendConfirmation: 'preview',
  locale: 'zh' as const,
  timeZone: 'Asia/Shanghai',
  adultConfirmed: true as const,
  messages: [],
  trainingEngine: true,
  engineProfile: profile,
};
// The home screen adjusts the next session: there is no active workout id.
const home: CoachRequest = {
  ...common,
  task: 'ADJUST_TODAY',
  target: { planId: id, versionId: id, revision: 3 },
  template,
  instruction: '今天只有20分钟，帮我调一下今天的训练',
};
const base = {
  intent: { kind: 'today_adjust' as const, minutes: 20 },
  locale: 'zh' as const,
  conversationId: id,
  message: '今天只有20分钟，帮我调一下今天的训练',
  lockedItemIndexes: [],
  expectedRevision: 3,
};

describe('engine today_adjust intent from the home screen', () => {
  it('turns a 20 minute intent into a previewable adjustment for the next session', () => {
    expect(template.estimatedMinutes).toBeGreaterThan(20);
    const sent = coachScope(home);
    expect(sent.engineProfile).toBeUndefined();
    const outcome = resolveEngineIntent({ ...base, routed: home, sent });
    expect(outcome.kind).toBe('candidate');
    if (outcome.kind !== 'candidate') return;
    const { response, request, expectedRevision } = outcome.candidate;
    expect(response.type).toBe('today_adjustment');
    expect(response.mutationAllowed).toBe(false);
    if (response.type === 'today_adjustment') {
      expect(response.template.id).toBe(template.id);
      expect(response.template.estimatedMinutes).toBeLessThanOrEqual(22);
      expect(response.workoutId).toBeUndefined();
    }
    // Local engine context keeps the profile, but identity follows the sent request.
    expect(request.engineProfile).toBeDefined();
    expect(request.requestId).toBe(sent.requestId);
    expect(expectedRevision).toBe(3);
  });
  it('reports an honest status instead of silence when only a network-scoped request is available', () => {
    const sent = coachScope(home);
    expect(resolveEngineIntent({ ...base, routed: sent, sent }).kind).toBe('no_session');
  });
  it('reports no session when today is requested from a plan conversation', () => {
    const planRequest: CoachRequest = {
      ...common,
      task: 'MODIFY_PLAN',
      target: home.target,
      instruction: '今天只有20分钟',
      plan: {
        goalText: '活动',
        weeklyTarget: 3,
        sessionMinutes: 40,
        scheduleOriginalText: '',
        templates: [template],
        reasons: ['活动', '活动', '活动'],
      },
    };
    expect(resolveEngineIntent({ ...base, routed: planRequest, sent: coachScope(planRequest) }).kind).toBe(
      'no_session',
    );
  });
  it('leaves review intents to the review page', () => {
    expect(
      resolveEngineIntent({ ...base, intent: { kind: 'review', highlights: [] }, routed: home, sent: coachScope(home) })
        .kind,
    ).toBe('review');
  });
});
