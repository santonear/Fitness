import { describe, expect, it } from 'vitest';
import { coachRequestSchema, coachResponseSchema, planProposalSchema, reviewFactsSchema } from '../../src/coach/contracts';
import { v8Routes } from '../../src/ui/routes.contract';
import { v8Namespaces } from '../../src/i18n/namespaces.contract';
import type { WorkoutRecord, MapSchedule } from '../../src/domain/v8/contracts';
import type { ThemeSlots } from '../../src/themes/contract';
import type { PlanProposal, ReviewFacts } from '../../src/application/review/contracts';
import type { z } from 'zod';

// Compile-time checks: C's proposal can cross D's wire boundary without a second model.
type WireProposal = z.infer<typeof planProposalSchema>;
const toWire: (value: PlanProposal) => WireProposal = value => value;
const toApplication: (value: WireProposal) => PlanProposal = value => value;
const reviewToWire: (value: ReviewFacts) => z.infer<typeof reviewFactsSchema> = value => ({ ...value, improvements: [...value.improvements] });

const identity = { requestId: '11111111-1111-4111-8111-111111111111', restoreGeneration: 0, mutationAllowed: false };
describe('V8 wave 0 contracts', () => {
  it('accepts empty or multiple boundary statements, never a legacy scalar', () => {
    const response = { ...identity, type: 'review_summary', target: { planId: identity.requestId, versionId: identity.requestId, revision: 0 }, opening: 'a', encouragement: 'b', gap: 'c' };
    for (const dataBoundary of [[], ['饮食信息未知'], ['饮食信息未知', '体重未记录']]) {
      expect(coachResponseSchema.safeParse({ ...response, dataBoundary }).success).toBe(true);
    }
    for (const dataBoundary of ['旧字符串', [null], ['']]) {
      expect(coachResponseSchema.safeParse({ ...response, dataBoundary }).success).toBe(false);
    }
  });
  it('requires all six incomplete timing cells with separate nonnegative counts', () => {
    const bands = { morning: { partial: 1, notStarted: 0 }, daytime: { partial: 0, notStarted: 2 }, evening: { partial: 0, notStarted: 0 } };
    const schema = reviewFactsSchema.shape.incompleteTiming;
    expect(schema.safeParse({ weekday: bands, weekend: bands }).success).toBe(true);
    expect(schema.safeParse({ weekday: bands }).success).toBe(false);
    expect(schema.safeParse({ weekday: { ...bands, morning: { partial: -1, notStarted: 0 } }, weekend: bands }).success).toBe(false);
    expect(typeof reviewToWire).toBe('function');
  });
  it('never accepts write authority or legacy date payloads', () => {
    expect(coachResponseSchema.safeParse({ ...identity, type: 'refused', reason: 'unavailable' }).success).toBe(true);
    expect(coachResponseSchema.safeParse({ ...identity, type: 'refused', reason: 'unavailable', mutationAllowed: true }).success).toBe(false);
    expect(coachResponseSchema.safeParse({ ...identity, type: 'date_plan_candidate' }).success).toBe(false);
  });
  it('requires adult confirmation and bounded dialogue', () => {
    const request = { version: 'fitness-coach-v8', requestId: identity.requestId, conversationId: identity.requestId, restoreGeneration: 0, inputSnapshot: 'scope', sendConfirmation: 'confirmation', locale: 'zh', timeZone: 'Asia/Shanghai', adultConfirmed: true, messages: [], task: 'ONBOARD_PLAN', profile: { goalText: 'habit', weeklyTarget: 2, sessionMinutes: 20, scheduleOriginalText: '20分钟', place: 'home', equipment: [], adultConfirmed: true, cautions: [] } };
    expect(coachRequestSchema.safeParse(request).success).toBe(true);
    expect(coachRequestSchema.safeParse({ ...request, adultConfirmed: false }).success).toBe(false);
    expect(coachRequestSchema.safeParse({ ...request, messages: Array(9).fill({ role: 'user', content: 'x' }) }).success).toBe(false);
    expect(coachRequestSchema.safeParse({ ...request, messages: [{ role: 'user', content: 'x'.repeat(1601) }] }).success).toBe(false);
    expect(coachRequestSchema.parse(request)).not.toHaveProperty('history');
    expect(coachRequestSchema.parse(request)).not.toHaveProperty('body');
  });
  it('keeps 15/20-minute plans distinct from onboarding allowed values', () => {
    expect(planProposalSchema.shape.sessionMinutes.safeParse(15).success).toBe(true);
    expect(planProposalSchema.shape.sessionMinutes.safeParse(20).success).toBe(true);
    expect(planProposalSchema.shape.sessionMinutes.safeParse(121).success).toBe(false);
    const status: WorkoutRecord['status'] = 'not_started';
    expect(status).toBe('not_started');
    const stub: MapSchedule = originalText => ({ originalText, minutes: { status: 'skipped' }, startTime: { status: 'skipped' } });
    expect(stub('20分钟').startTime.status).toBe('skipped');
  });
  it('defines nine slots and unique routes with owned namespaces', () => {
    expect(typeof toWire).toBe('function');
    expect(typeof toApplication).toBe('function');
    const slots: (keyof ThemeSlots)[] = ['BrandMark', 'WeekProgress', 'StartHero', 'Suggestions', 'AiLine', 'SetValue', 'RestClock', 'FeatureCard', 'NavIcon'];
    expect(slots).toHaveLength(9);
    expect(new Set(v8Routes.map(r => r.path)).size).toBe(v8Routes.length);
    for (const route of v8Routes) expect(v8Namespaces).toContain(route.namespace);
  });
  it.todo('B: migration preserves old facts, rolls back failures, and is idempotent');
  it.todo('C: not_started is excluded from training counts and progression');
  it.todo('C: map duration ranges to their smallest legal value; preserve original words');
  it.todo('C: base plan uses 15/20-minute original request without coercing to 30');
  it.todo('D: reject stale restore generation, mismatched identity and task');
});
