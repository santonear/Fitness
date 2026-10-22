import { profileService } from '../../../src/application/profile';
import { repository } from '../../../src/persistence/repository';
import { createV8Workflow } from '../../../src/application/v8-workflow';
import { Rules } from '../../../src/engine/data';
import { localProfile } from '../../../src/application/rules/local-profile';
import { toEngineProfile } from '../../../src/application/engine-profile';
import { runGates } from '../../../src/engine/gates';
import { checkHard } from '../../../src/engine/hard-checks';

/** Explicit synthetic answers, with real propose/adopt/settings services. Never real-user migration defaults. */
export async function seedAcogPregnancy(legacy = false) {
  await profileService.initialize('zh');
  const workflow = createV8Workflow(repository),
    rules = new Rules(),
    at = new Date().toISOString();
  const profile = {
    ...localProfile({
      goalText: '规律训练',
      scheduleOriginalText: '每周3次，每次30分钟',
      placeEquipmentText: '在家，徒手',
      adultConfirmed: true,
      cautions: [],
    }),
    population: {
      kind: 'pregnant' as const,
      week: 20,
      providerCleared: true,
      prenatalCareConfirmed: true,
      contraindicationsConfirmedNone: true,
      lastScreenedWeek: 20,
    },
    birthYearMonth: '1996-01',
    healthStorageConsent: { acceptedAt: at },
    screening: {
      parqAllNo: true,
      parqAnswers: Array(7).fill(false),
      knownCondition: false,
      knownCmrDisease: false,
      symptoms: false,
      cmrSymptoms: Object.fromEntries(
        rules.get('safety.screen.cmr_symptoms').symptoms.map((key: string) => [key, false]),
      ),
      completedAt: at,
      lastScreenedAt: at,
      activityStatus: legacy ? ('active' as const) : ('inactive' as const),
      restingBp: 'known_below_threshold' as const,
      acuteIllness: false,
    },
  };
  const candidate = await workflow.propose(profile, 'zh', {
    trainingEngine: true,
  });
  const version = await workflow.adopt(candidate);
  if (!legacy) return { version, stored: (await workflow.snapshot()).state?.coachProfile };
  const { prenatalCareConfirmed: _, ...population } = profile.population;
  const unknown = {
      ...profile,
      population,
      screening: profile.screening,
    },
    metadata = await repository.readMetadata();
  await workflow.saveEngineSettings(unknown, metadata.dataRevision);
  let blocked = false;
  try {
    await workflow.propose(unknown, 'zh', { trainingEngine: true });
  } catch (error) {
    blocked = error instanceof Error && error.message === 'ENGINE_PLAN_UNAVAILABLE';
  }
  const preview = await workflow.nextTargetPreview(version.templates[0].id);
  const mapped = toEngineProfile(unknown, {
    asOfDate: at.slice(0, 10),
    timeZone: 'Asia/Shanghai',
  })!;
  const gate = runGates(mapped, rules, { allowLegacyPrenatalCare: true });
  return {
    version,
    blocked,
    preview,
    diagnostic: {
      gates: gate.reasons,
      issues: checkHard(version.enginePlan!, mapped, gate, rules),
    },
    stored: (await workflow.snapshot()).state?.coachProfile,
  };
}
