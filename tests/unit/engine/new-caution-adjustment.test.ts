import { expect, it } from 'vitest';
import fixture from '../../fixtures/training-engine/new-caution-adjustment.json';
import { adjustToday, generatePlan, validatePlan } from '../../../src/engine';
import { engineProfileSchema } from '../../../src/engine/contracts';
import { Rules } from '../../../src/engine/data';

const profile = engineProfileSchema.parse(fixture.profile);
const rules = new Rules();

it('rechecks existing exercises after a newly screened caution before filling an adjustment', () => {
  const plan = generatePlan(profile);
  const template = plan.templates[0];
  expect(template.items.some(item => rules.byExercise.get(item.exerciseId)?.slug === 'knee-push-ups')).toBe(true);
  const result = adjustToday(template, profile, { painArea: 'knee', lockedItemIndexes: [] });
  expect(result.noop).toBe(false);
  expect(result.value.items.some(item => rules.byExercise.get(item.exerciseId)?.slug === 'knee-push-ups')).toBe(false);
  expect(validatePlan({ ...plan, templates: [result.value] }, { ...profile, cautions: ['knee'] }).filter(issue => issue.severity === 'error')).toEqual([]);
});

it('does not remove a completed locked exercise to make a new caution adjustment pass', () => {
  const template = generatePlan(profile).templates[0];
  const locked = template.items.findIndex(item => rules.byExercise.get(item.exerciseId)?.slug === 'knee-push-ups');
  expect(locked).toBeGreaterThanOrEqual(0);
  const result = adjustToday(template, profile, { painArea: 'knee', lockedItemIndexes: [locked] });
  expect(result.noop).toBe(true);
  expect(result.value).toEqual(template);
});

it('still rejects a new pain adjustment without explicit red-flag answers', () => {
  const template = generatePlan(profile).templates[0];
  const unanswered = { ...profile, screening: { ...profile.screening, redFlagReview: undefined } };
  const result = adjustToday(template, unanswered, { painArea: 'knee', lockedItemIndexes: [] });
  expect(result.noop).toBe(true);
  expect(result.value).toEqual(template);
});
