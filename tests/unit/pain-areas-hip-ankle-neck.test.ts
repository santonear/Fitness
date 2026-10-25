import { describe, expect, it } from 'vitest';
import { DATA, Rules, condition } from '../../src/engine/data';
import { engineCopy } from '../../src/coach/engine-copy';
import { knownRedFlagKeys, redFlagQuestionKeys, redFlagRoute } from '../../src/engine/gates/redflag-items';
import { painQuestionKeys } from '../../src/application/pain-events';
import { setFeedbackEventSchema } from '../../src/domain/schemas';
import { jointPainSchema } from '../../src/domain/training-checkin';

const rules = new Rules();
const joint = rules.get('redflag.joint_any').items as string[];

describe('hip, ankle and neck red flags (Bo 2026-10-25)', () => {
  it('keeps the original five areas asking exactly the original questions', () => {
    const back = rules.get('redflag.back'),
      shoulder = rules.get('redflag.shoulder');
    for (const area of ['knee', 'wrist', 'other'] as const) expect(painQuestionKeys([area])).toEqual(joint);
    expect(painQuestionKeys(['back'])).toEqual([...joint, ...back.emergency_items, ...back.urgent_items]);
    expect(painQuestionKeys(['shoulder'])).toEqual([
      ...joint,
      ...shoulder.cardiac_route_items,
      ...shoulder.prompt_medical_items,
    ]);
  });

  it('asks the general questions plus each new area’s own, and neck alone only two general ones', () => {
    expect(redFlagQuestionKeys(rules, ['hip'])).toEqual([
      ...joint,
      'numbness_groin_or_buttocks',
      'new_bladder_or_bowel_problem',
      'progressive_leg_weakness',
    ]);
    expect(redFlagQuestionKeys(rules, ['ankle'])).toEqual([...joint, 'calf_swollen_warm_red_or_tender']);
    const neck = redFlagQuestionKeys(rules, ['neck']);
    expect(neck.slice(0, 2)).toEqual([
      'unexplained_night_or_rest_pain',
      'numbness_tingling_or_weakness_spreading_into_limb',
    ]);
    expect(neck).toHaveLength(7);
    expect(redFlagQuestionKeys(rules, ['neck', 'knee'])).toHaveLength(joint.length + 5);
    for (const key of knownRedFlagKeys(rules)) expect(engineCopy(`redflag.copy.question_${key}`, 'en')).toBeTruthy();
  });

  it('routes positive answers by tier with the approved copy', () => {
    expect(redFlagRoute(rules, [])).toBeUndefined();
    expect(redFlagRoute(rules, ['calf_swollen_warm_red_or_tender'])).toEqual({
      ruleId: 'redflag.ankle',
      copyId: 'redflag.copy.prompt_medical_calf',
    });
    expect(redFlagRoute(rules, ['fever_with_stiff_neck_or_light_sensitivity'])?.copyId).toBe(
      'redflag.copy.emergency_neck',
    );
    expect(redFlagRoute(rules, ['neck_or_jaw_pain_with_chest_discomfort_or_breathlessness'])).toEqual({
      ruleId: 'redflag.neck',
      copyId: 'redflag.copy.cardiac',
    });
    expect(redFlagRoute(rules, ['numbness_groin_or_buttocks'])?.copyId).toBe('redflag.copy.emergency_back');
    expect(redFlagRoute(rules, ['shoulder_pain_with_chest_pain', 'back_pain_with_cancer_history'])).toEqual({
      ruleId: 'redflag.shoulder',
      copyId: 'redflag.copy.cardiac',
    });
    expect(redFlagRoute(rules, ['back_pain_with_cancer_history'])?.ruleId).toBe('redflag.back');
    expect(redFlagRoute(rules, ['visible_deformity'])).toEqual({
      ruleId: 'redflag.joint_any',
      copyId: 'redflag.copy.prompt_medical',
    });
    expect(engineCopy('redflag.copy.prompt_medical_calf', 'zh')).toContain('最好当天');
    expect(engineCopy('redflag.copy.emergency_neck', 'en')).toBe(
      "These need emergency care now. Please don't wait. Your plan is paused until you confirm you've been checked.",
    );
  });

  it('filters loading exercises for each new area at level 1', () => {
    const excluded = (area: string, test: (e: (typeof DATA.exercises)[number]) => boolean) => {
      const filter = rules.get(`caution.${area}.filter`).level_1.exclude_if;
      return DATA.exercises.filter(test).every(exercise => condition(filter, exercise, {}));
    };
    expect(excluded('hip', e => e.joint_load.hip >= 3)).toBe(true);
    expect(excluded('ankle', e => e.flags.includes('balance_demand') || e.flags.includes('unstable_surface'))).toBe(
      true,
    );
    expect(excluded('neck', e => e.flags.includes('overhead_load') || e.position.includes('inverted'))).toBe(true);
    const bridge = DATA.exercises.find(e => e.slug === 'glute-bridge')!;
    for (const area of ['hip', 'ankle', 'neck'])
      expect(condition(rules.get(`caution.${area}.filter`).level_1.exclude_if, bridge, {})).toBe(false);
  });

  it('stores the new areas and an optional side on pain records', () => {
    const event = {
      id: crypto.randomUUID(),
      itemIndex: 0,
      setIndex: 0,
      exerciseId: DATA.exercises[0].id,
      createdAt: '2026-10-25T01:00:00.000Z',
      effort: 'discomfort',
      painScore: 4,
      painArea: 'hip',
      painSide: 'left',
    };
    expect(setFeedbackEventSchema.parse(event)).toEqual(event);
    expect(setFeedbackEventSchema.safeParse({ ...event, painSide: 'middle' }).success).toBe(false);
    expect(jointPainSchema.parse({ painArea: 'neck', painScore: 2 })).toEqual({ painArea: 'neck', painScore: 2 });
  });
});
