import type { PlanVersion } from '../../src/domain/v8/contracts';
export const currentPlan: PlanVersion = {
  id: 'current-v2', planId: 'current', versionNumber: 2, goalText: '更有力量，日常活动更轻松', weeklyTarget: 3,
  sessionMinutes: 30, scheduleOriginalText: '每次半小时左右', createdAt: '2026-10-06T10:00:00Z', origin: 'coach_change',
  changeSummary: ['训练时长调整为 30 分钟'], basedOnVersionId: 'current-v1',
  templates: [{ id: 'A', name: '全身 A', estimatedMinutes: 30, items: [
    { exerciseId: 'squat', equipment: 'dumbbell', sets: 3, target: { metricType: 'reps_load', reps: 10, loadGrams: 6000 } },
    { exerciseId: 'plank', equipment: 'none', sets: 2, target: { metricType: 'duration', durationSeconds: 30 } },
  ] }, { id: 'B', name: '全身 B', estimatedMinutes: 25, items: [
    { exerciseId: 'bridge', equipment: 'none', sets: 3, target: { metricType: 'reps', reps: 12 } },
    { exerciseId: 'walk', equipment: 'none', sets: 1, target: { metricType: 'duration_distance', durationSeconds: 300, distanceMeters: 400 } },
  ] }],
};
export const previousPlan: PlanVersion = { ...currentPlan, id: 'current-v1', versionNumber: 1, origin: 'onboard', createdAt: '2026-09-28T10:00:00Z', changeSummary: ['首版：全身 A、全身 B 两份训练单，每周 3 次'] };
export const otherPlan: PlanVersion = { ...currentPlan, id: 'other-v1', planId: 'other', versionNumber: 1, origin: 'migrated', goalText: '以前的散步计划', scheduleOriginalText: '   ', createdAt: '2026-09-20T10:00:00Z', changeSummary: ['保留原计划内容'] };
