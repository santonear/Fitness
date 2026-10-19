import { describe, expect, it } from 'vitest';
import { buildCoachRequest, type CoachRequestInput } from '../../src/coach/request-builder';
import { coachRequestSchema, type CoachRequest } from '../../src/coach/contracts';
import { assistantRequestSchema, sanitizeAssistantRequest, type AssistantRequest } from '../../src/assistant/contracts';
import { assembleAssistantIntent } from '../../src/backend/assistant/assemble';
import { assistantPrompt } from '../../src/backend/assistant/prompts';
import { explicitScheduleChange, keepPickedScheduleIntent, pickedDaysReplaced, scheduleAfterProposal } from '../../src/application/picked-schedule';
import { localProfile } from '../../src/application/rules/local-profile';
import { monthCalendar, monthCounts } from '../../src/application/plan-calendar';
import { EXERCISE_IDS } from '../../src/catalog/exercises';

const id = '11111111-1111-4111-8111-111111111111', vid = '22222222-2222-4222-8222-222222222222';
const dates = ['2026-10-23', '2026-10-25', '2026-10-28', '2026-10-30'];
const template = { id: 'A', name: 'A', estimatedMinutes: 20, items: [{ exerciseId: EXERCISE_IDS.bodyweightSquat, equipment: 'none', sets: 2, target: { metricType: 'reps' as const, reps: 8 } }] };
function snapshot(version: Record<string, unknown> = {}) {
  return { metadata: { dataRevision: 4, restoreGeneration: 0 }, profile: { locale: 'zh', timeZone: 'Asia/Shanghai' },
    state: { coachProfile: { goalText: '习惯', weeklyTarget: 2, sessionMinutes: 20, scheduleOriginalText: '每次20分钟', place: 'home', equipment: [], adultConfirmed: true, cautions: [], confirmedAt: '2026-10-10T00:00:00Z' } },
    plan: { id }, version: { id: vid, planId: id, goalText: '习惯', weeklyTarget: 3, sessionMinutes: 20, scheduleOriginalText: '每周3次，每次20分钟，共4天', templates: [template], ...version },
    versions: [], workouts: [], activities: [] } as unknown as CoachRequestInput['data'];
}
const datedProfile = localProfile({ goalText: '规律训练', scheduleOriginalText: '每周3次，每次30分钟，共4天', placeEquipmentText: '在家', adultConfirmed: true, cautions: [], trainingDates: dates });
const onboard = (message: string, schedule = true): AssistantRequest => {
  const context = buildCoachRequest({ task: 'ONBOARD_PLAN', data: snapshot(), profile: datedProfile, ...(schedule ? { schedule: { trainingDates: dates, startTime: '19:30' } } : {}) })!;
  return assistantRequestSchema.parse({ version: 'fitness-assistant-v2', requestId: context.requestId, conversationId: context.conversationId, locale: 'zh', timeZone: 'Asia/Shanghai', adultConfirmed: true, messages: [{ role: 'user', content: message }], context });
};

describe('calendar-picked days in AI requests', () => {
  it('ONBOARD_PLAN carries the picked dates and start time, and a dated profile has no weekday pattern', () => {
    const request = onboard('请根据我的目标和可用时间，拟一份训练计划。').context!;
    expect(request.schedule).toEqual({ trainingDates: dates, startTime: '19:30' });
    if (request.task !== 'ONBOARD_PLAN') throw Error('task');
    expect(request.profile.preferredDays).toBeUndefined();
    expect(request.profile.weeklyTarget).toBe(3);
  });
  it('MODIFY_PLAN reads the dates from the current version; weekly plans send none', () => {
    const dated = buildCoachRequest({ task: 'MODIFY_PLAN', data: snapshot({ trainingDates: dates, startTime: '07:00' }) });
    expect(dated?.schedule).toEqual({ trainingDates: dates, startTime: '07:00' });
    expect(buildCoachRequest({ task: 'MODIFY_PLAN', data: snapshot() })).not.toHaveProperty('schedule');
  });
  it('the strict wire schema rejects malformed schedules', () => {
    const request = onboard('hi').context!;
    expect(() => coachRequestSchema.parse({ ...request, schedule: { trainingDates: ['10/23'] } })).toThrow();
    expect(() => coachRequestSchema.parse({ ...request, schedule: { trainingDates: dates, startTime: '25:00' } })).toThrow();
    expect(() => coachRequestSchema.parse({ ...request, schedule: { trainingDates: dates, extra: 1 } })).toThrow();
  });
  it('the prompt states the dates as a hard constraint and the snapshot keeps them', () => {
    const request = sanitizeAssistantRequest(onboard('按我的时间表来'));
    const [system, user] = assistantPrompt(request, 'text');
    expect(system.content).toContain('Fixed training dates');
    expect(system.content).toContain(dates.join(', '));
    expect(system.content).toContain('19:30');
    expect(system.content).toMatch(/Do not ask which days to train or rest/);
    expect(JSON.parse(user.content).context.schedule.trainingDates).toEqual(dates);
    const weekly = sanitizeAssistantRequest(onboard('hi', false));
    expect(assistantPrompt(weekly, 'text')[0].content).not.toContain('Fixed training dates');
  });
});

describe('server assembly keeps picked dates', () => {
  it('ignores a model-chosen weekday pattern and day count when the user did not ask', () => {
    const request = sanitizeAssistantRequest(onboard('按我的时间表来'));
    const result = assembleAssistantIntent({ kind: 'plan_new', params: { daysPerWeek: 5, preferredDays: ['mon', 'tue', 'wed', 'thu', 'fri'] } }, request);
    if (result.attachment?.type !== 'plan_proposal') throw Error('proposal');
    expect(result.attachment.proposal.weeklyTarget).toBe(3);
    expect(result.attachment.proposal.preferredDays ?? []).toEqual([]);
  });
  it('lets an explicit weekday request through', () => {
    const request = sanitizeAssistantRequest(onboard('改成周一三五训练'));
    const result = assembleAssistantIntent({ kind: 'plan_new', params: { preferredDays: ['mon', 'wed', 'fri'] } }, request);
    if (result.attachment?.type !== 'plan_proposal') throw Error('proposal');
    expect(result.attachment.proposal.preferredDays).toEqual(['mon', 'wed', 'fri']);
  });
  it('MODIFY_PLAN does not change days from model params when dates are picked', () => {
    const context = buildCoachRequest({ task: 'MODIFY_PLAN', data: snapshot({ trainingDates: dates }), instruction: '每次改成30分钟' })!;
    const request = sanitizeAssistantRequest({ version: 'fitness-assistant-v2', requestId: context.requestId, conversationId: context.conversationId, locale: 'zh', timeZone: 'Asia/Shanghai', adultConfirmed: true, messages: [{ role: 'user', content: '每次改成30分钟' }], context });
    const result = assembleAssistantIntent({ kind: 'plan_modify', changes: [], params: { daysPerWeek: 5, preferredDays: ['mon', 'tue'] } }, request);
    if (result.attachment?.type !== 'change_proposal') throw Error('proposal');
    expect(result.attachment.proposal.weeklyTarget).toBe(3);
    expect(result.attachment.proposal.preferredDays ?? []).toEqual([]);
  });
});

describe('applying a proposal keeps picked dates', () => {
  const request = (content: string) => ({ ...onboard(content).context!, messages: [{ role: 'user' as const, content }] }) as CoachRequest;
  const schedule = { startDate: dates[0], trainingDates: dates, startTime: '19:30' };
  it('recognises "keep my schedule" messages and explicit day changes', () => {
    expect(keepPickedScheduleIntent('按我的时间表来')).toBe(true);
    expect(explicitScheduleChange('按我的时间表来')).toBe(false);
    expect(explicitScheduleChange('就按我选的日子')).toBe(false);
    expect(explicitScheduleChange('换个动作')).toBe(false);
    expect(explicitScheduleChange('改成周一三五')).toBe(true);
    expect(explicitScheduleChange('每周4次')).toBe(true);
    expect(explicitScheduleChange('Follow my schedule')).toBe(false);
  });
  it('keeps dates, start date and time when the user did not ask to change days', () => {
    expect(scheduleAfterProposal(schedule, request('按我的时间表来'), { weeklyTarget: 3 }, { weeklyTarget: 3 })).toEqual(schedule);
    // Even a differing proposal never drops the dates without an explicit request.
    expect(scheduleAfterProposal(schedule, request('换个动作'), { weeklyTarget: 3 }, { weeklyTarget: 5, preferredDays: ['mon'] })).toEqual(schedule);
  });
  it('drops only the picked dates when the user explicitly changed days', () => {
    const asked = request('改成周一三五训练');
    expect(pickedDaysReplaced(asked, { weeklyTarget: 3 }, { weeklyTarget: 3, preferredDays: ['mon', 'wed', 'fri'] })).toBe(true);
    expect(scheduleAfterProposal(schedule, asked, { weeklyTarget: 3 }, { weeklyTarget: 3, preferredDays: ['mon', 'wed', 'fri'] })).toEqual({ startDate: dates[0], startTime: '19:30' });
    // Asked, but nothing actually changed: dates stay.
    expect(scheduleAfterProposal(schedule, asked, { weeklyTarget: 3 }, { weeklyTarget: 3 })).toEqual(schedule);
  });
});

describe('plan month calendar shows occupied days', () => {
  it('marks exactly the picked dates as planned', () => {
    const days = monthCalendar({ plan: { weeklyTarget: 3, templates: [template], trainingDates: dates }, workouts: [], month: '2026-10', today: '2026-10-19', startDate: dates[0] });
    expect(days.filter(day => day.state === 'planned').map(day => day.date)).toEqual(dates);
  });
  it('a weekly plan without picked dates or weekdays still projects its sessions from the start date', () => {
    const days = monthCalendar({ plan: { weeklyTarget: 3, templates: [template] }, workouts: [], month: '2026-10', today: '2026-10-19', startDate: '2026-10-19' });
    expect(monthCounts(days).planned).toBeGreaterThan(0);
    expect(days.filter(day => day.date < '2026-10-19').every(day => day.state === 'rest')).toBe(true);
  });
});
