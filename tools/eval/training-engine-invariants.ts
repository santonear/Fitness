import { independentCardioDurationIssues } from '../../src/engine/validation/cardio-duration';
import { independentPregnancyIssues } from '../../tests/support/engine/independent-pregnancy';
import { independentlyPossibleIds } from './training-engine-quality';
import {
  enginePlanSchema,
  type EnginePlan,
  type EngineProfile,
  type ValidationIssue,
} from '../../src/engine/contracts';
import { independentEquipment, independentBalanceEnvironmentConstraint } from './training-engine-quality';
import { Rules } from '../../src/engine/data';
import data from '../../src/engine/generated/exercise-index.json';
interface Facts {
  id: string;
  slug: string;
  equipment_required: string[];
  equipment_alternatives: Record<string, string[]>;
  position: string[];
  flags: string[];
  difficulty: number;
  noise: number;
  space: string;
  use: string[];
  requires_floor_transition?: boolean;
}
const sourceRules = new Rules();
const facts = new Map((data.exercises as unknown as Facts[]).map(row => [row.id, row]));
/** Independent external checks: these do not call the engine's eligibility or validator helpers. */
export function externalIssues(
  plan: EnginePlan,
  profile: EngineProfile,
  rules: Rules = sourceRules,
): ValidationIssue[] {
  const issues: ValidationIssue[] = independentPregnancyIssues(plan, profile, rules);
  const add = (code: string, ruleId: string, reason: string, templateId?: string, itemIndex?: number) =>
    issues.push({
      code,
      ruleId,
      severity: 'error',
      reason,
      templateId,
      itemIndex,
    });
  const parsed = enginePlanSchema.safeParse(plan);
  if (!parsed.success)
    for (const issue of parsed.error.issues)
      add('contract_shape', 'meta.manual.version', issue.path.join('.') + ': ' + issue.message);
  const blocked = plan.gates.some(gate => gate.status === 'blocked');
  if (blocked && plan.templates.length)
    add('blocked_has_templates', 'safety.screen.parq', 'blocked output contains actionable templates');
  const available = independentEquipment(profile),
    spaces = ['mat', 'small', 'medium', 'large'];
  for (const template of plan.templates)
    for (const [itemIndex, item] of template.items.entries()) {
      const exercise = facts.get(item.exerciseId);
      if (!exercise) {
        add('unknown_exercise', 'select.pipeline', item.exerciseId, template.id, itemIndex);
        continue;
      }
      for (const required of exercise.equipment_required)
        if (
          required !== 'none' &&
          required !== 'yoga-mat-optional' &&
          !available.has(required) &&
          !(exercise.equipment_alternatives[required] ?? []).some(value => available.has(value))
        )
          add('equipment_mismatch', 'select.pipeline', `${exercise.slug} requires ${required}`, template.id, itemIndex);
      if (profile.constraints.quiet && exercise.noise > 0)
        add('noise_violation', 'select.pipeline', exercise.slug, template.id, itemIndex);
      if (profile.constraints.noJump && exercise.flags.some(flag => ['jumping', 'running'].includes(flag)))
        add('jump_violation', 'select.pipeline', exercise.slug, template.id, itemIndex);
      if (spaces.indexOf(exercise.space) > spaces.indexOf(profile.constraints.space))
        add('space_violation', 'select.pipeline', exercise.slug, template.id, itemIndex);
      if (profile.preferences.excludedExerciseIds.includes(exercise.id))
        add('excluded_preference', 'select.pipeline', exercise.slug, template.id, itemIndex);
      const groundPosition = exercise.position.some(position =>
        ['supine', 'prone', 'plank', 'quadruped', 'kneeling', 'side_lying'].includes(position),
      );
      const standingOrSeated = exercise.position.some(position => ['standing', 'seated'].includes(position));
      const ground =
        exercise.requires_floor_transition ??
        (exercise.position.includes('quadruped') ||
          (groundPosition &&
            !standingOrSeated &&
            (exercise.space === 'mat' ||
              (exercise.position.includes('plank') &&
                exercise.equipment_required.every(required => ['none', 'yoga-mat-optional'].includes(required))))));
      if (profile.preferences.cannotDo.includes('floor_work') && ground)
        add('floor_work_violation', 'select.pipeline', exercise.slug, template.id, itemIndex);
      if (exercise.difficulty === 5 || exercise.use.includes('skill'))
        add('advanced_skill_violation', 'select.difficulty.window', exercise.slug, template.id, itemIndex);
      if (
        profile.population.kind === 'pregnant' &&
        profile.population.week >= 13 &&
        exercise.position.some(position => ['supine', 'prone'].includes(position))
      )
        add('pregnancy_position_violation', 'pregnancy.exclude.supine', exercise.slug, template.id, itemIndex);
    }
  const balanceRule = rules.byId.get('older.template.balance_required'),
    exception = balanceRule?.value?.environment_exception;
  const marked =
    exception &&
    (plan.quality?.issues?.some(issue => issue.ruleId === balanceRule!.id && issue.code === exception.warning_code) ||
      plan.quality?.environmentConstraints?.some(claim => claim.ruleId === balanceRule!.id));
  if (marked && !independentBalanceEnvironmentConstraint(profile, rules))
    add('unverified_environment_exception', balanceRule!.id, 'current source-scoped environment proof failed');
  issues.push(...independentCardioDurationIssues(plan, profile, rules, independentlyPossibleIds(profile, rules)));
  return issues;
}
