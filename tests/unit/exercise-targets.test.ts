import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExerciseTargets } from '../../src/ui/components/ExerciseTargets';
import { ExerciseEditor } from '../../src/ui/components/ExerciseEditor';
import type { ExerciseSnapshot, SetMetrics } from '../../src/domain/models';
import { exercises } from '../../src/catalog/exercises';
function snapshot(targetSets: SetMetrics[], notes?: string): ExerciseSnapshot {
 const { steps: _steps, cautions: _cautions, ...entry } = exercises[0];
 return { ...entry, exerciseInstanceId: crypto.randomUUID(), exerciseId: entry.id as ExerciseSnapshot['exerciseId'], order: 0, targetSets, notes };
}
const render = (exercise: ExerciseSnapshot, locale: 'en' | 'zh' = 'en', original?: ExerciseSnapshot) => renderToStaticMarkup(createElement(ExerciseTargets, {exercise, locale, original}));
describe('read-only snapshot targets', () => {
 it('keeps nonuniform groups, metric units and zero/missing distinct without mutating', () => {
  const exercise = snapshot([{metricType:'reps_load',reps:8,loadGrams:1250},{metricType:'reps_load',reps:12,loadGrams:0},{metricType:'reps',reps:7},{metricType:'duration',durationSeconds:90},{metricType:'duration_distance',durationSeconds:90,distanceMeters:1500},{metricType:'duration_distance',durationSeconds:60},{metricType:'duration_distance',durationSeconds:30,distanceMeters:0}]);
  const before = structuredClone(exercise), html = render(exercise);
  for(const text of ['8 reps · 1.25 kg','12 reps · 0 kg','7 reps','90 s · 1.5 km','60 s · Distance not set','30 s · 0 km','7 sets','Saved snapshot for this workout']) expect(html).toContain(text);
  expect(html.indexOf('8 reps')).toBeLessThan(html.indexOf('12 reps')); expect(exercise).toEqual(before);
 });
 it('shows empty targets explicitly and preserves original notes as escaped multiline text', () => {
  const original = snapshot([{metricType:'reps',reps:9}], '中文\n<script>bad()</script>');
  const replaced = {...snapshot([]), exerciseInstanceId: original.exerciseInstanceId, originalExerciseId: original.exerciseId};
  const html = render(replaced, 'en', original);
  expect(html).toContain('No targets set for this exercise'); expect(html).toContain('not regenerated for the replacement');
  expect(html).toContain('Original exercise plan notes'); expect(html).toContain('中文\n&lt;script&gt;bad()&lt;/script&gt;'); expect(html).not.toContain('<script>');
  expect(render(replaced, 'en', {...original,exerciseInstanceId:crypto.randomUUID()})).not.toContain('Original exercise plan notes');
 });
 it('labels retained targets as original reference and localizes labels without translating notes', () => {
  const exercise = {...snapshot([{metricType:'reps',reps:9}], 'English\n原文'),originalExerciseId:exercises[1].id as ExerciseSnapshot['exerciseId']};
  const html = render(exercise,'zh'); expect(html).toContain('原动作参考目标'); expect(html).toContain('9 次'); expect(html).toContain('English\n原文');
 });
 it('does not label unchanged saved form as an unsaved draft', () => {
  const exercise = snapshot([]);
  const html = renderToStaticMarkup(createElement(ExerciseEditor,{sessionId:crypto.randomUUID(),exercise,locale:'en',busy:false,sets:[{id:crypto.randomUUID(),sessionId:crypto.randomUUID(),exerciseInstanceId:exercise.exerciseInstanceId,order:0,metricType:'reps_load',reps:5,loadGrams:0,completed:true,notes:'saved',revision:0,createdAt:'2026-10-05T00:00:00Z',updatedAt:'2026-10-05T00:00:00Z'}],onRecordAttempt:()=>{},onSave:async()=>{},onAdjust:async()=>{}}));
  expect(html.match(/Current set inputs are not saved/g)).toHaveLength(1);
 });
});
