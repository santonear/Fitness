import { expect, it } from 'vitest';
import { parseBodyText } from '../../src/application/rules/local-profile';
import { binarySex, bodyComplete } from '../../src/domain/body-profile';
import { bodyWeightInputSchema, bodyWeightObservationSchema } from '../../src/domain/schemas';
import { migrateBodyProfile } from '../../src/persistence/body-profile-migration';
import { emptyGuidedState } from '../../src/domain/guided-contracts';
const now = '2026-10-12T00:00:00Z';
it.each(['男，34岁，167，70公斤', 'male, 34 years, 167 cm, 70 kg', '男，34，167，70'])(
  'parses explicit everyday body details: %s',
  text => expect(parseBodyText(text)).toEqual({ biologicalSex: '男性', age: 34, heightCm: 167, weightKg: 70 }),
);
it('does not infer missing facts or clamp invalid values', () => {
  expect(parseBodyText('我想增肌')).toEqual({});
  expect(parseBodyText('女，99岁，260厘米，0公斤')).toEqual({ biologicalSex: '女性' });
  expect(parseBodyText('腰围80厘米')).toEqual({ waistCm: 80 });
  expect(bodyComplete(parseBodyText('男，34岁'))).toBe(false);
});
it('accepts privacy choice and exact inclusive boundaries', () => {
  expect(bodyComplete(parseBodyText('不愿透露，12岁，100厘米，30公斤'))).toBe(true);
  expect(bodyComplete(parseBodyText('女，70岁，230厘米，300公斤，腰围200厘米'))).toBe(true);
});
it('parses colloquial age, height, jin weight and waist without inventing fields', () => {
  expect(parseBodyText('34')).toEqual({ age: 34 });
  expect(parseBodyText('一米七五')).toEqual({ heightCm: 175 });
  expect(parseBodyText('1米75')).toEqual({ heightCm: 175 });
  expect(parseBodyText('164斤')).toEqual({ weightKg: 82 });
  expect(parseBodyText('腰围92')).toEqual({ waistCm: 92 });
  expect(parseBodyText('男，34岁，一米七五，164斤，腰围92')).toEqual({
    biologicalSex: '男性',
    age: 34,
    heightCm: 175,
    weightKg: 82,
    waistCm: 92,
  });
});
it('projects legacy answers only once, leaves sources intact and requires confirmation', () => {
  const profile = {
    id: crypto.randomUUID(),
    revision: 0,
    createdAt: now,
    updatedAt: now,
    locale: 'zh' as const,
    timeZone: 'Asia/Shanghai',
    units: 'metric' as const,
    trainingPreferences: { updatedAt: now, heightCm: 170, weightGrams: 70000 },
  };
  const guided = {
    ...emptyGuidedState(),
    onboarding: {
      id: crypto.randomUUID(),
      step: 0,
      completed: false,
      updatedAt: now,
      answers: {
        age: { status: 'answered' as const, value: 34 },
        biologicalSex: { status: 'answered' as const, value: '男性' },
      },
    },
  };
  const original = JSON.stringify({ profile, guided }),
    result = migrateBodyProfile(profile, guided, now);
  expect(result.bodyDetails?.values).toEqual({ age: 34, biologicalSex: '男性', heightCm: 170, weightKg: 70 });
  expect(result.bodyDetails?.confirmedAt).toBeUndefined();
  expect(JSON.stringify({ profile, guided })).toBe(original);
  expect(migrateBodyProfile(result, guided, now)).toEqual(result);
  const deleted = {
    ...result,
    bodyDetails: { values: {}, source: 'entered' as const, updatedAt: now, confirmedAt: now },
  };
  expect(migrateBodyProfile(deleted, guided, now)).toEqual(deleted);
});
it('maps the profile sex to male/female only when it was given', () => {
  expect(binarySex('男性')).toBe('male');
  expect(binarySex('女性')).toBe('female');
  expect(binarySex('不愿透露')).toBeUndefined();
  expect(binarySex(undefined)).toBeUndefined();
});
it('limits new weight entries to 20-300 kg while stored rows stay readable', () => {
  const row = {
    id: '5b2a8b9e-1d6f-4c3e-9a1b-2c3d4e5f6a7b',
    createdAt: now,
    updatedAt: now,
    revision: 0,
    localDate: '2026-10-12',
    timeZone: 'Asia/Shanghai',
    weightGrams: 20_000,
  };
  expect(bodyWeightInputSchema.safeParse(row).success).toBe(true);
  expect(bodyWeightInputSchema.safeParse({ ...row, weightGrams: 300_000 }).success).toBe(true);
  for (const weightGrams of [19_999, 300_001, Number.NaN])
    expect(bodyWeightInputSchema.safeParse({ ...row, weightGrams }).success).toBe(false);
  expect(bodyWeightObservationSchema.safeParse({ ...row, weightGrams: 15_000 }).success).toBe(true);
});
