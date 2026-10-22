import { describe, expect, it } from 'vitest';
import { targetText } from '../../src/ui/components/ExerciseTargets';

describe('assistant target units', () => {
  it('uses complete Chinese units and hides missing or indoor distance', () => {
    expect(targetText({ metricType: 'duration', durationSeconds: 40 }, 'zh')).toBe('40 秒');
    expect(targetText({ metricType: 'reps_load', reps: 8, loadGrams: 2500 }, 'zh')).toBe('8 次 · 2.5 公斤');
    expect(targetText({ metricType: 'reps_load', reps: 8, loadGrams: 0 }, 'zh')).toContain('选择你的重量');
    expect(targetText({ metricType: 'duration_distance', durationSeconds: 300 }, 'zh')).toBe('约 5 分钟');
    expect(targetText({ metricType: 'duration_distance', durationSeconds: 300, distanceMeters: 400 }, 'zh', true)).toBe(
      '约 5 分钟',
    );
  });
});
