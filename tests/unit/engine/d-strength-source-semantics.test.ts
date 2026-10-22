import { expect, it } from 'vitest';
import { effectiveGoalRole, strengthRoles } from '../../../src/engine/dose';
import { Rules } from '../../../src/engine/data';
import { checkHard } from '../../../src/engine/hard-checks';
import { runGates } from '../../../src/engine/gates';
import { fixtureProfile, planFixture } from './fixtures';
const rules = new Rules(),
  profile = { ...fixtureProfile, goal: 'strength' as const };
function item(position: string) {
  const i = planFixture().templates[0].items[0],
    e = rules.data.exercises.find(
      e => e.modality === 'strength' && e.metricType === 'reps' && e.equipment_required.every(k => k === 'none'),
    )!;
  i.exerciseId = e.id;
  i.target = { metricType: 'reps', reps: 10 };
  i.prescription = { ...i.prescription!, pattern: e.primary_pattern, block: 'accessory', sourcePosition: position };
  return i;
}
it.each(['main_1', 'day-deadbeef-fba-main_1'])('recognizes a real authored main position: %s', position => {
  const i = item(position);
  expect(effectiveGoalRole(i, profile, rules)).toBe('main');
  expect(strengthRoles([i], profile, rules).get(i)).toBe('main');
});
it.each(['arbitrary-main_1', 'day-nothex00-fba-main_1', 'day-deadbeef-fba-extra-main_1'])(
  'does not promote an arbitrary suffix into source authority: %s',
  position => {
    const i = item(position);
    expect(effectiveGoalRole(i, profile, rules)).toBe('accessory');
    expect(strengthRoles([i], profile, rules).get(i)).toBe('accessory');
  },
);
it('preserves the new-user low-repetition hard gate through a source-container demotion', () => {
  const p = { ...profile, trainingAgeWeeks: 2 },
    plan = planFixture(),
    i = item('day-deadbeef-fba-main_1');
  i.target = {
    metricType: 'reps',
    reps: rules.get('goal.strength.beginner_rep_gate').main_lift_reps_before_gate.min - 1,
  };
  plan.templates[0].items = [i];
  expect(checkHard(plan, p, runGates(p, rules), rules).some(issue => issue.code === 'beginner_strength_reps')).toBe(
    true,
  );
  i.prescription!.block = 'main';
  i.prescription!.goalRole = 'accessory';
  expect(checkHard(plan, p, runGates(p, rules), rules).some(issue => issue.code === 'beginner_strength_reps')).toBe(
    false,
  );
});
it('uses the actual strength role for the hard direct-set cap, independently of the source container', () => {
  const p = { ...profile, level: 'intermediate' as const },
    plan = planFixture(),
    i = item('day-deadbeef-fba-main_1');
  i.sets = rules.get('dose.sets_session.cap').strength_main_lift_direct_sets_max + 1;
  plan.templates[0].items = [i];
  expect(checkHard(plan, p, runGates(p, rules), rules).some(issue => issue.code === 'strength_main_sets')).toBe(true);
  i.prescription!.goalRole = 'accessory';
  i.prescription!.block = 'main';
  expect(checkHard(plan, p, runGates(p, rules), rules).some(issue => issue.code === 'strength_main_sets')).toBe(false);
});
