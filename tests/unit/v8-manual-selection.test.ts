import { describe, expect, it } from 'vitest';
import { initialFilters, recentExerciseIds, toggleSelection } from '../../src/ui/pages/training/manual/selection';
import { EXERCISE_IDS } from '../../src/catalog/exercises';
import type { WorkoutRecord } from '../../src/domain/v8/contracts';

describe('manual workout selection', () => {
  it('backfills only explicitly provided places and equipment, including bilingual text', () => {
    expect(initialFilters('')).toEqual({ places: [], equipment: [] });
    expect(initialFilters('家里、户外，哑铃和瑜伽垫')).toEqual({ places: ['home', 'outdoor'], equipment: ['dumbbell','yoga-mat','none'] });
    expect(initialFilters('home dumbbell').equipment).toEqual(['dumbbell','none','yoga-mat']);
    expect(initialFilters('在家').equipment).toEqual(['none','yoga-mat']);
    expect(initialFilters('户外').equipment).toEqual([]);
    expect(initialFilters('gym pull-up-bar')).toEqual({ places: ['gym'], equipment: ['pull-up-bar'] });
    expect(initialFilters('home none').equipment).toEqual(['none','yoga-mat']);
  });
  it('supports removing a selection without mutating its source or changing the remaining order', () => {
    const selected = ['a','b'];
    expect(toggleSelection(selected,'c')).toEqual(['a','b','c']);
    expect(toggleSelection(selected,'a')).toEqual(['b']);
    expect(selected).toEqual(['a','b']);
  });
  it('uses only actual completed sets from finished workouts for recent exercises', () => {
    const workout = (status: WorkoutRecord['status'], date: string, ids: string[]) => ({ id: date, status, startedAt: date, sets: ids.map(exerciseId => ({ exerciseId })) } as WorkoutRecord);
    const records = [workout('complete','2026-10-01',[EXERCISE_IDS.walking,EXERCISE_IDS.plank]), workout('partial','2026-10-02',[EXERCISE_IDS.plank]), workout('in_progress','2026-10-03',[EXERCISE_IDS.gobletSquat]), workout('complete','2026-10-04',['deleted-exercise'])];
    expect(recentExerciseIds(records)).toEqual([EXERCISE_IDS.plank,EXERCISE_IDS.walking]);
    expect(records[0].startedAt).toBe('2026-10-01');
  });
});
