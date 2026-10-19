import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { assistantRequestSchema, sanitizeAssistantRequest, type AssistantRequest } from '../../src/assistant/contracts';
import { assistantPrompt, NUTRITION_TOPIC_RULE } from '../../src/backend/assistant/prompts';
import { v3PromptSections } from '../../src/backend/assistant/prompts/index';
import { runAssistantModel, type AssistantProvider } from '../../src/backend/assistant/model';
import { bodyWeightObservationSchema } from '../../src/domain/schemas';
import type { BodyWeightObservation } from '../../src/domain/models';
import type { WorkoutRecord } from '../../src/domain/v8/contracts';
import { bodyFatTrend, estimatedOneRepMaxKg, monthSummary, previousMonth, sessionsByMonth, strengthTrends, weightTrend } from '../../src/application/my-changes';
import { dietModules, registerDietModule, resetDietModules } from '../../src/application/nutrition-module';
import { checkCoachLanguage } from '../../src/application/rules/coach-language';
import { changesCopy } from '../../src/i18n/features/me/changes';
import { nutritionAdviceCopy } from '../../src/i18n/features/nutrition/advice';
import { meCopy } from '../../src/i18n/features/settings/me';

const id = '11111111-1111-4111-8111-111111111111';
const nutrition = (content = '练完吃什么比较好'): AssistantRequest => ({ version: 'fitness-assistant-v2', requestId: id, conversationId: id, locale: 'zh', timeZone: 'Asia/Shanghai', adultConfirmed: true, topic: 'nutrition', consent: { body: false, history: false }, messages: [{ role: 'user', content }] });

describe('营养建议 conversation (topic nutrition)', () => {
  it('is accepted without training context and refuses any training context or workout facts', () => {
    expect(() => sanitizeAssistantRequest(nutrition())).not.toThrow();
    expect(assistantRequestSchema.safeParse({ ...nutrition(), currentWorkout: { completedSets: [], remainingSets: 0 } }).success).toBe(false);
    expect(assistantRequestSchema.safeParse({ ...nutrition(), engineCandidateIds: [] }).success).toBe(false);
    expect(assistantRequestSchema.safeParse({ ...nutrition(), topic: 'diet' }).success).toBe(false);
  });
  it('adds the nutrition section only for that topic; existing prompts are unchanged', async () => {
    const source = await readFile(new URL('../../src/backend/assistant/prompts/v3.0.0/topics/nutrition.md', import.meta.url), 'utf8');
    expect(v3PromptSections['topics/nutrition']).toBe(source);
    const scoped = assistantPrompt(nutrition(), 'text', 'assistant-v3.1.0')[0].content;
    expect(scoped).toContain(source.trim().slice(0, 30));
    expect(scoped).toMatch(/不给每日热量目标/);
    const { topic: _topic, ...plain } = nutrition();
    expect(assistantPrompt(plain as AssistantRequest, 'text', 'assistant-v3.1.0')[0].content).not.toContain('营养建议');
    expect(assistantPrompt(nutrition(), 'text', 'assistant-v2.1.0')[0].content).toContain(NUTRITION_TOPIC_RULE);
    expect(assistantPrompt(plain as AssistantRequest, 'text', 'assistant-v2.1.0')[0].content).not.toContain(NUTRITION_TOPIC_RULE);
    expect(checkCoachLanguage(NUTRITION_TOPIC_RULE)).toEqual([]);
  });
  it('never returns cards, even when the model asks for one or the user asks how to do an exercise', async () => {
    let attachmentCalls = 0;
    const provider: AssistantProvider = { async *streamText() { yield { delta: '训练后吃点含蛋白质和主食的东西就好。<<ATTACHMENT:plan>>', usage: { inputTokens: 1, outputTokens: 1 } }; }, async generateAttachment() { attachmentCalls++; return { content: { kind: 'none' } }; } };
    const events = [];
    for await (const event of runAssistantModel(nutrition('深蹲怎么做，练完吃什么'), { provider, promptVersion: 'assistant-v3.1.0' })) events.push(event);
    expect(events.filter(event => event.type === 'attachment' || event.type === 'attachment_pending')).toEqual([]);
    expect(events.at(-1)).toMatchObject({ type: 'done', success: true });
    expect(attachmentCalls).toBe(0);
  });
  it('the module seam starts empty and registers a module once', () => {
    resetDietModules();
    expect(dietModules()).toEqual([]);
    const module = { id: 'meals', entries: () => [{ id: 'm', title: { zh: '吃什么', en: 'Meals' }, route: '/nutrition' }] };
    registerDietModule(module); registerDietModule(module);
    expect(dietModules()).toHaveLength(1);
    resetDietModules();
  });
});

const row = (localDate: string, kg: number, extra: Partial<BodyWeightObservation> = {}): BodyWeightObservation => ({ id: crypto.randomUUID(), revision: 0, createdAt: `${localDate}T01:00:00.000Z`, updatedAt: `${localDate}T01:00:00.000Z`, localDate, timeZone: 'Asia/Shanghai', weightGrams: kg * 1000, ...extra });
const workout = (localDate: string, status: WorkoutRecord['status'], sets: WorkoutRecord['sets'] = [], minutes = 40): WorkoutRecord => ({ id: crypto.randomUUID(), startedAt: `${localDate}T01:00:00.000Z`, endedAt: new Date(Date.parse(`${localDate}T01:00:00.000Z`) + minutes * 60000).toISOString(), localDate, timeZone: 'Asia/Shanghai', status, sets, plannedSetCount: 6 });
const set = (exerciseId: string, loadKg: number, reps: number) => ({ exerciseId, itemIndex: 0, setIndex: 0, reps, loadGrams: loadKg * 1000, completedAt: '2026-10-01T01:10:00.000Z' });

describe('我的变化 trends', () => {
  it('body fat is an optional measurement; old rows still parse', () => {
    expect(() => bodyWeightObservationSchema.parse(row('2026-10-01', 60))).not.toThrow();
    expect(() => bodyWeightObservationSchema.parse(row('2026-10-01', 60, { bodyFatPercent: 24.5 }))).not.toThrow();
    expect(() => bodyWeightObservationSchema.parse(row('2026-10-01', 60, { bodyFatPercent: 90 }))).toThrow();
  });
  it('weight and body fat: one value per day (latest), sorted, change from first to last', () => {
    const rows = [row('2026-10-05', 61.2), row('2026-09-01', 63, { bodyFatPercent: 28 }), row('2026-10-05', 60.8, { updatedAt: '2026-10-05T09:00:00.000Z', bodyFatPercent: 26.5 })];
    expect(weightTrend(rows)).toMatchObject({ points: [{ date: '2026-09-01', value: 63 }, { date: '2026-10-05', value: 60.8 }], change: -2.2 });
    expect(bodyFatTrend(rows)).toMatchObject({ change: -1.5 });
    expect(weightTrend([row('2026-10-05', 61)]).change).toBeUndefined();
    expect(weightTrend([]).last).toBeUndefined();
  });
  it('strength: estimated 1RM only from 1–12 rep loaded sets of finished workouts, main lifts by set count', () => {
    expect(estimatedOneRepMaxKg(20000, 10)).toBe(26.7);
    expect(estimatedOneRepMaxKg(20000, 1)).toBe(20);
    expect(estimatedOneRepMaxKg(20000, 15)).toBeUndefined();
    expect(estimatedOneRepMaxKg(0, 8)).toBeUndefined();
    const trends = strengthTrends([
      workout('2026-09-10', 'complete', [set('squat', 20, 10), set('squat', 22, 8), set('row', 10, 10)]),
      workout('2026-10-10', 'partial', [set('squat', 25, 8)]),
      workout('2026-10-11', 'abandoned', [set('squat', 80, 5)]),
    ]);
    expect(trends.map(trend => trend.exerciseId)).toEqual(['squat', 'row']);
    expect(trends[0]).toMatchObject({ sets: 3, first: { date: '2026-09-10', value: 27.9 }, last: { date: '2026-10-10', value: 31.7 }, change: 3.8 });
  });
  it('monthly summary compares this month and last month; sessions per month fill empty months with 0', () => {
    const workouts = [workout('2026-10-02', 'complete', [set('a', 10, 8), set('a', 10, 8)], 45), workout('2026-10-09', 'partial', [], 20), workout('2026-09-20', 'complete', [], 50), workout('2026-10-03', 'not_started')];
    expect(monthSummary(workouts, [row('2026-10-01', 62), row('2026-10-20', 61)], '2026-10')).toEqual({ month: '2026-10', sessions: 2, complete: 1, minutes: 65, sets: 2, weightChange: -1 });
    expect(monthSummary(workouts, [], previousMonth('2026-10'))).toMatchObject({ sessions: 1, minutes: 50, weightChange: undefined });
    expect(previousMonth('2026-01')).toBe('2025-12');
    expect(sessionsByMonth(workouts, '2026-10', 3)).toEqual([{ date: '2026-08', value: 0 }, { date: '2026-09', value: 1 }, { date: '2026-10', value: 2 }]);
  });
});

describe('copy', () => {
  const strings = (value: unknown): string[] => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
  it.each([['changes', changesCopy], ['nutrition', nutritionAdviceCopy], ['me', meCopy]] as const)('%s follows coach language rules and has both languages', (_, copy) => {
    for (const text of strings(copy)) expect(checkCoachLanguage(text)).toEqual([]);
    expect(Object.keys(copy.en)).toEqual(Object.keys(copy.zh));
  });
});
