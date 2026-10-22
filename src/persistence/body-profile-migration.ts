import { bodyValuesSchema, type BodyDetails, type BodyValues } from '../domain/body-profile';
import type { LocalProfile } from '../domain/models';
import type { GuidedState } from '../domain/guided-contracts';
/** The only legacy body reader. Projection adds no measurement and never overwrites source facts. */
export function migrateBodyProfile(profile: LocalProfile, guided: GuidedState | undefined, now: string): LocalProfile {
  if (profile.bodyDetails) return profile;
  const values: BodyValues = {};
  const answers = guided?.onboarding?.answers ?? {};
  for (const key of ['biologicalSex', 'age', 'heightCm', 'weightKg', 'waistCm'] as const) {
    const answer = answers[key];
    if (answer?.status === 'answered') {
      const parsed = bodyValuesSchema.safeParse({ [key]: answer.value });
      if (parsed.success) Object.assign(values, parsed.data);
    }
  }
  for (const [key, value] of [
    ['heightCm', profile.trainingPreferences?.heightCm],
    [
      'weightKg',
      profile.trainingPreferences?.weightGrams === undefined
        ? undefined
        : profile.trainingPreferences.weightGrams / 1000,
    ],
  ] as const) {
    if (value !== undefined) {
      const parsed = bodyValuesSchema.safeParse({ [key]: value });
      if (parsed.success) Object.assign(values, parsed.data);
    }
  }
  if (!Object.keys(values).length) return profile;
  const bodyDetails: BodyDetails = { values, source: 'migrated', updatedAt: now };
  return { ...profile, bodyDetails };
}
