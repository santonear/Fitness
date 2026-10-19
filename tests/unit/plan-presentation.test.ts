import { describe, expect, it } from 'vitest';
import { genericSessionName, planReasons, sessionKind, sessionNames, weekSchedule } from '../../src/application/plan-presentation';
import { effortWords } from '../../src/i18n/features/plan/view';
import type { PlannedItem, SessionTemplate } from '../../src/domain/v8/contracts';

const item = (pattern: string, block = 'main'): PlannedItem => ({ exerciseId: `x-${pattern}`, equipment: 'none', sets: 3, target: { metricType: 'reps', reps: 10 },
  prescription: { pattern, block, rir: [2, 3], restSeconds: 60 } as unknown as PlannedItem['prescription'] });
const template = (id: string, patterns: string[], name = '训练', minutes = 30): SessionTemplate => ({ id, name, estimatedMinutes: minutes, items: [item('cardio_cyclic', 'warmup'), ...patterns.map(p => item(p)), item('mobility', 'cooldown')] });

describe('plan presentation (read only)', () => {
  it('names sessions from their content and letters repeated kinds', () => {
    const templates = [template('a', ['squat', 'push_horizontal', 'pull_horizontal']), template('b', ['lunge', 'hinge']), template('c', ['hinge', 'pull_vertical']), template('d', ['cardio_cyclic', 'cardio_cyclic'])];
    expect(templates.map(t => sessionKind(t))).toEqual(['full', 'lower', 'full', 'cardio']);
    const names = sessionNames(templates, 'zh');
    expect([...names.values()]).toEqual(['全身 A', '下肢', '全身 B', '有氧']);
    expect([...sessionNames(templates, 'en').values()]).toEqual(['Full body A', 'Lower body', 'Full body B', 'Cardio']);
  });
  it('keeps a real stored name verbatim and replaces only placeholders', () => {
    expect(genericSessionName('训练')).toBe(true); expect(genericSessionName('30 分钟')).toBe(true); expect(genericSessionName('Training')).toBe(true);
    expect(sessionNames([template('a', ['squat'], '我的腿日')], 'en').get('a')).toBe('我的腿日');
  });
  it('labels engine weekdays as a suggestion unless the user chose days', () => {
    const plan = { weeklyTarget: 3, templates: [template('a', ['squat']), template('b', ['push_horizontal'])] };
    expect(weekSchedule(plan)).toEqual({ chosen: false, sessions: [{ day: 'mon', templateId: 'a' }, { day: 'wed', templateId: 'b' }, { day: 'fri', templateId: 'a' }] });
    expect(weekSchedule({ ...plan, preferredDays: ['tue', 'sat'] }).chosen).toBe(true);
    const fixed = { weeklyTarget: 2, templates: [{ ...template('a', ['squat']), weekday: 'mon' as const }, { ...template('b', ['squat']), weekday: 'thu' as const }] };
    expect(weekSchedule(fixed)).toEqual({ chosen: false, sessions: [{ day: 'mon', templateId: 'a' }, { day: 'thu', templateId: 'b' }] });
  });
  it('never leaves “why” empty and only states facts the plan contains', () => {
    const reasons = planReasons({ weeklyTarget: 3, templates: [template('a', ['squat', 'push_horizontal'], '训练', 30), template('b', ['cardio_cyclic', 'cardio_cyclic'], '训练', 35)] }, 'zh');
    expect(reasons).toEqual(['练一天歇一天，肌肉有时间恢复。', '力量和有氧搭配着练。', '每次约 30–35 分钟，含热身和拉伸。']);
    expect(planReasons({ weeklyTarget: 1, templates: [{ id: 'x', name: '训练', estimatedMinutes: 20, items: [] }] }, 'en')).toEqual(['About 20 minutes each time.']);
  });
  it('shows reps in reserve as plain words', () => {
    expect(effortWords([2, 3], 'zh')).toBe('还能再做 2–3 次'); expect(effortWords([4, 5], 'en')).toBe('You could easily do several more'); expect(effortWords(undefined, 'zh')).toBeUndefined();
  });
});
