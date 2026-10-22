import { expect, it } from 'vitest';
import { prohibitedTrainingClaims } from '../../../src/application/rules/training-claims';
const unsafe = [
  ['caution.never', '你的腰痛就是椎间盘突出。'],
  ['caution.never', 'You have a herniated disc.'],
  ['caution.never', '这是你的康复处方。'],
  ['caution.never', '腰痛应该完全卧床。'],
  ['caution.never', '出现危险信号也继续练。'],
  ['older.never', '这是防跌倒治疗。'],
  ['older.never', 'Your fall risk score is 8.'],
  ['older.never', '骨质疏松使用20公斤很安全。'],
  ['older.never', '跌倒后这样站起。'],
  ['pregnancy.never', '运动可以治疗妊娠糖尿病。'],
  ['pregnancy.never', 'Exercise to induce labour.'],
  ['pregnancy.never', '出血后继续运动。'],
  ['pregnancy.never', 'The app grants medical clearance.'],
  ['postpartum.never', '这个动作能治好腹直肌分离。'],
  ['postpartum.never', 'This will cure diastasis recti.'],
  ['postpartum.never', '腹直肌分离间距为3厘米。'],
  ['postpartum.never', '盆底康复处方。'],
  ['postpartum.never', '漏尿时也继续练。'],
  ['postpartum.never', 'Your self-check results are normal.'],
  ['fatloss.spot_reduction.ban', '仰卧起坐可以局部减脂。'],
  ['fatloss.spot_reduction.ban', 'Crunches burn belly fat.'],
] as const;
it.each(unsafe)('rejects an affirmative source-forbidden claim: %s / %s', (id, text) =>
  expect(prohibitedTrainingClaims(text)).toContain(id),
);
it.each([
  '运动不能治疗妊娠糖尿病。',
  '不能局部减脂。',
  'We cannot cure diastasis recti.',
  'We do not provide a rehabilitation protocol.',
  '请专业人士评估。',
  '不舒服就停下。',
])('preserves negation and referral: %s', text => expect(prohibitedTrainingClaims(text)).toEqual([]));
const pelvicUnsafe = [
  ['pregnancy.pelvic_floor', '孕期盆底肌练习：收缩5秒，再放松5秒，每天做3组。'],
  ['postpartum.pelvic_floor', '产后盆底肌练习：收缩5秒、放松5秒，每天3组。'],
  ['pregnancy.pelvic_floor', '孕期请收缩盆底肌5秒。'],
  ['postpartum.pelvic_floor', '产后盆底肌：每天做三组，每组八次。'],
  ['pregnancy.pelvic_floor', 'During pregnancy, pelvic floor exercises: hold for 5 seconds, then relax.'],
  ['postpartum.pelvic_floor', 'Postpartum Kegels: do 3 sets of 8 repetitions.'],
  ['pregnancy.pelvic_floor', 'For pregnancy, contract your pelvic floor for 5 seconds.'],
  ['postpartum.pelvic_floor', '盆底肌先收紧五秒，再放松五秒。'],
] as const;
it.each(pelvicUnsafe)('rejects actionable numerical pelvic-floor teaching under %s: %s', (id, text) =>
  expect(prohibitedTrainingClaims(text)).toContain(id),
);
it.each([
  '今天别忘了做盆底肌练习。如果还不确定怎么做，可以请产检医生、助产士或盆底物理治疗师教你。',
  '今天记得做盆底肌练习。如果不确定动作对不对，或者有漏尿，请找助产士或盆底物理治疗师帮忙。',
  "Remember your pelvic floor exercises today. If you're not sure how to do them, ask your doctor, midwife or a pelvic health physiotherapist to show you.",
  '产后第3周，关于盆底肌练习请咨询专业人士。',
  'The pelvic floor appointment lasts 30 minutes. Ask your physiotherapist for guidance.',
  '盆底肌问题持续3周，请联系专业人士。',
  '不提供盆底肌收缩5秒的练习方案，请专业人士指导。',
  'We do not provide pelvic floor hold-for-5-seconds instructions. Ask your clinician.',
  '深蹲做3组，每组8次。',
])('preserves neutral, referral and explicitly withheld pelvic instruction: %s', text =>
  expect(prohibitedTrainingClaims(text)).toEqual([]),
);
it.each([
  '孕期提肛5秒，再放松。',
  '产后盆底肌练习3组。',
  'Kegels: 3 sets of 8 repetitions.',
  'Do 3 sets of pelvic floor contractions.',
])('rejects explicit named-exercise numerical prescriptions: %s', text =>
  expect(prohibitedTrainingClaims(text)).toContain('postpartum.pelvic_floor'),
);
it.each([
  'See a pelvic floor doctor for 5 minutes.',
  'Your pelvic floor assessment with a doctor lasts 30 minutes.',
  '盆底肌评估预约为30分钟，请咨询专业人士。',
])('does not mistake appointment duration or doctor for an exercise instruction: %s', text =>
  expect(prohibitedTrainingClaims(text)).toEqual([]),
);
