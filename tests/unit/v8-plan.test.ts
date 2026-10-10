import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlanPage, itemTarget } from '../../src/ui/pages/plan/PlanPage';
import { VersionsPage } from '../../src/ui/pages/plan/VersionsPage';
import { currentPlan, otherPlan, previousPlan } from '../fixtures/v8-plan-data';

const callbacks = { onVersions() {}, onExercises() {}, onExercise() {}, onDiscuss() {} };
describe('plan version presentation', () => {
  it('shows actual metrics for all four metric types without guessing values', () => {
    const items = currentPlan.templates.flatMap(t => t.items);
    expect(items.map(item => itemTarget(item, 'zh'))).toEqual(['3 组 · 10 次 · 6 千克', '2 组 · 30 秒', '3 组 · 12 次', '1 组 · 300 秒 · 400 米']);
    expect(itemTarget({ ...items[3], target: { metricType: 'duration_distance', durationSeconds: 30 } }, 'en')).toBe('1 sets · 30 sec');
  });
  it('hides mutation entry for a different migrated plan and hides blank original schedule', () => {
    const html = renderToStaticMarkup(createElement(PlanPage, { ...callbacks, version: otherPlan, currentVersionId: currentPlan.id, language: 'en', exerciseName: id => id }));
    expect(html).toContain('Read only'); expect(html).not.toContain('Talk with Yaya'); expect(html).not.toContain('>   </p>');
    expect(html).toContain(otherPlan.goalText);
  });
  it('keeps separate plans visible, identifies current by id and sorts without changing input', () => {
    const versions = Object.freeze([otherPlan, previousPlan, currentPlan]);
    const html = renderToStaticMarkup(createElement(VersionsPage, { versions, currentVersionId: currentPlan.id, language: 'en', onBack() {}, onView() {} }));
    expect(html).toContain(otherPlan.goalText); expect(html.match(/Current/g)).toHaveLength(1);
    expect(html.indexOf('Oct 6')).toBeLessThan(html.indexOf('Sep 28')); expect(versions[0]).toBe(otherPlan);
  });
});
