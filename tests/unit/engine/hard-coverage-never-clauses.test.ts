import { expect, it } from 'vitest';
import { prohibitedTrainingClaims } from '../../../src/application/rules/training-claims';
// One concrete representative per expressible source clause; plan-before-gate is separately covered by real gate tests.
export const sourceClauseClaims = [
  ['caution.never', 'name_a_diagnosis', '你的腰痛就是椎间盘突出。'],
  ['caution.never', 'label_session_as_rehab_or_treatment', '这节课是腰痛康复训练。'],
  ['caution.never', 'prescribe_condition_protocol', '膝关节炎专用运动方案：每天做三组深蹲。'],
  ['caution.never', 'advise_complete_rest_for_back', '腰痛应该完全卧床。'],
  ['caution.never', 'encourage_training_through_red_flags', '出现危险信号也继续练。'],
  ['caution.never', 'interpret_cause_of_symptoms', '你的膝痛是因为软骨磨损。'],
  ['older.never', 'call_program_fall_prevention_treatment', '这是防跌倒治疗。'],
  ['older.never', 'assess_or_score_fall_risk', '你属于高跌倒风险。'],
  ['older.never', 'tell_osteoporosis_or_fracture_users_which_loads_are_safe', '骨折恢复期使用10公斤负重是安全的。'],
  ['older.never', 'encourage_training_through_warning_symptoms', '出现警示症状也继续训练。'],
  ['older.never', 'teach_post_fall_recovery_techniques', '跌倒后这样站起。'],
  ['pregnancy.never', 'judge_whether_a_complication_is_compatible_with_exercise', '先兆子痫也可以安全运动。'],
  ['pregnancy.never', 'interpret_symptoms', '孕期出血只是正常反应。'],
  ['pregnancy.never', 'suggest_exercise_to_induce_labour', '运动可以催产。'],
  ['pregnancy.never', 'suggest_exercise_to_treat_gestational_diabetes', '运动可以治疗妊娠糖尿病。'],
  ['pregnancy.never', 'encourage_continuing_after_stop_signal', '出血后继续运动。'],
  ['pregnancy.never', 'use_wording_implying_app_gives_medical_clearance', '应用已给予医学放行。'],
  ['postpartum.never', 'diagnose_or_measure_diastasis_or_prolapse', '你有盆腔器官脱垂。'],
  ['postpartum.never', 'prescribe_pelvic_floor_rehabilitation_protocol', '这是盆底康复处方。'],
  ['postpartum.never', 'promise_to_close_the_gap', '练习可以让腹直肌间隙闭合。'],
  ['postpartum.never', 'label_core_work_as_diastasis_treatment', '这是治疗腹直肌分离的核心训练。'],
  ['postpartum.never', 'encourage_pushing_through_leakage_heaviness_pain_or_bleeding', '漏尿时也继续练。'],
  ['postpartum.never', 'judge_whether_self_check_results_are_normal', '自查结果完全正常。'],
  ['fatloss.spot_reduction.ban', 'spot_fat_loss', '仰卧起坐可以局部减脂。'],
  ['fatloss.spot_reduction.ban', 'burn_belly_fat', 'Crunches burn belly fat.'],
  ['fatloss.spot_reduction.ban', 'slim_specific_body_part', '这个动作能定向瘦大腿。'],
] as const;
it.each(sourceClauseClaims)('blocks representative clause %s / %s', (id, _clause, text) =>
  expect(prohibitedTrainingClaims(text)).toContain(id),
);
const safeCounterparts = [
  '不作诊断，请专业人士评估。',
  '这节课不是康复或治疗。',
  '病症专用方案请向专业人士咨询。',
  '腰痛请先咨询专业人士。',
  '出现危险信号先停止训练。',
  '膝痛原因请专业人士评估。',
  '这不是防跌倒治疗。',
  '跌倒风险请专业人士评估。',
  '骨折后的负重请咨询医生。',
  '出现警示症状先停止训练。',
  '跌倒后请寻求帮助。',
  '先兆子痫能否运动请向医生确认。',
  '孕期出血请及时就医。',
  '不能通过运动催产。',
  '运动不能治疗妊娠糖尿病。',
  '出血后先停止运动。',
  '应用不授予医学许可。',
  '盆腔不适请专业人士评估。',
  '不提供盆底康复处方。',
  '不承诺闭合腹直肌间隙。',
  '核心训练不是腹直肌分离治疗。',
  '漏尿时先停止训练。',
  '自查结果请专业人士评估。',
  '不能局部减脂。',
  'Crunches cannot burn belly fat.',
  '不能靠动作定向瘦大腿。',
];
it.each(sourceClauseClaims.map((entry, index) => [entry[0], entry[1], safeCounterparts[index]] as const))(
  'allows the safe counterpart for source clause %s / %s',
  (_id, _clause, text) => expect(prohibitedTrainingClaims(text)).toEqual([]),
);

it('retains one named representative and safe counterpart for every content-expressible source clause', async () => {
  const { Rules } = await import('../../../src/engine/data'),
    r = new Rules(),
    ids = ['caution.never', 'older.never', 'pregnancy.never', 'postpartum.never', 'fatloss.spot_reduction.ban'];
  const authored = ids.flatMap(id =>
    ((id === 'fatloss.spot_reduction.ban' ? r.get(id).banned_claims : r.get(id).never) as string[])
      .filter(clause => clause !== 'generate_plan_before_gate_completed')
      .map(clause => id + ':' + clause),
  );
  expect(sourceClauseClaims.map(([id, clause]) => id + ':' + clause).sort()).toEqual(authored.sort());
  expect(safeCounterparts).toHaveLength(sourceClauseClaims.length);
  expect(safeCounterparts.every(text => !!text)).toBe(true);
});
