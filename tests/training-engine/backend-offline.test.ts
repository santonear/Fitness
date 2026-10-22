import { afterEach, describe, expect, it, vi } from 'vitest';
import { assembleEngineIntent } from '../../src/backend/assistant/engine-assemble';
import { engineAction } from '../../src/application/engine-plan';
import { generatePlan, validatePlan } from '../../src/engine';
import { assistantAttachmentSchema, type AssistantRequest } from '../../src/assistant/contracts';
import { baseProfile, equipmentScenarios } from '../../tools/eval/training-engine-profiles';
import type { EngineProfile } from '../../src/engine/contracts';
import uiCounterexample from '../unit/engine/fixtures/v1-ui-duration.json';
const id = '11111111-1111-4111-8111-111111111111';
function onboard(profile: EngineProfile): AssistantRequest {
  return {
    version: 'fitness-assistant-v2',
    requestId: id,
    conversationId: id,
    locale: 'zh',
    timeZone: 'Asia/Shanghai',
    adultConfirmed: true,
    messages: [{ role: 'user', content: '请生成计划' }],
    context: {
      version: 'fitness-coach-v8',
      requestId: id,
      conversationId: id,
      restoreGeneration: 0,
      inputSnapshot: 'synthetic-offline-fixture',
      sendConfirmation: 'local',
      locale: 'zh',
      timeZone: 'Asia/Shanghai',
      adultConfirmed: true,
      messages: [],
      trainingEngine: true,
      engineProfile: profile,
      task: 'ONBOARD_PLAN',
      profile: {
        goalText: '规律训练',
        weeklyTarget: profile.daysPerWeek,
        sessionMinutes: profile.sessionMinutes,
        scheduleOriginalText: '每周三次，每次30分钟',
        place: 'home',
        equipment: profile.equipment,
        adultConfirmed: true,
        cautions: profile.cautions,
      },
    },
  };
}
afterEach(() => vi.restoreAllMocks());
describe('offline backend assembly through the same engine', () => {
  it('offers a valid candidate for an explicit fully screened counterpart of the frozen onboarding input', () => {
    const original = uiCounterexample.profile as EngineProfile,
      profile = baseProfile({
        ...structuredClone(original),
        screening: { ...original.screening, cmrSymptoms: baseProfile().screening.cmrSymptoms },
      }),
      result = assembleEngineIntent({ kind: 'plan_new', params: {} }, onboard(profile));
    expect(result.attachment, JSON.stringify(validatePlan(generatePlan(profile), profile))).not.toBeNull();
    expect(assistantAttachmentSchema.safeParse(result.attachment).success).toBe(true);
  });
  it('blocks incomplete PAR-Q without an attachment or any network/model call', () => {
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected outbound request'));
    const profile = baseProfile();
    delete profile.screening.completedAt;
    delete profile.screening.lastScreenedAt;
    expect(assembleEngineIntent({ kind: 'plan_new', params: {} }, onboard(profile)).attachment).toBeNull();
    expect(network).not.toHaveBeenCalled();
  });
  it('blocks symptomatic screening before assembly', () => {
    const profile = baseProfile();
    profile.screening.symptoms = true;
    expect(assembleEngineIntent({ kind: 'plan_new', params: {} }, onboard(profile)).attachment).toBeNull();
  });
  it('emits a schema-valid local plan candidate with preserved engine prescriptions', () => {
    const profile = baseProfile({ equipment: [...equipmentScenarios[3]] }),
      result = assembleEngineIntent({ kind: 'plan_new', params: {} }, onboard(profile));
    expect(result.attachment, JSON.stringify(validatePlan(generatePlan(profile), profile))).not.toBeNull();
    expect(assistantAttachmentSchema.safeParse(result.attachment).success).toBe(true);
    if (result.attachment?.type === 'plan_proposal')
      expect(
        result.attachment.proposal.templates
          .flatMap(template => template.items)
          .every(item => Boolean(item.prescription)),
      ).toBe(true);
  });
  it('does not create an empty modification card when the engine reports no actual changes', () => {
    const profile = baseProfile(),
      request = onboard(profile),
      generated = generatePlan(profile);
    const context = {
      ...request.context!,
      task: 'MODIFY_PLAN' as const,
      target: { planId: id, versionId: id, revision: 0 },
      instruction: '保持原样',
      plan: {
        goalText: '规律训练',
        scheduleOriginalText: '每周三次',
        weeklyTarget: generated.weeklyTarget,
        sessionMinutes: generated.sessionMinutes,
        templates: generated.templates,
        reasons: ['本地', '本地', '本地'] as [string, string, string],
      },
    };
    const result = engineAction(context, profile, { kind: 'modify', changes: [] });
    expect(result.noop).toBe(true);
    expect(result.response).toBeUndefined();
    expect(assembleEngineIntent({ kind: 'plan_modify', changes: [] }, { ...request, context }).attachment).toBeNull();
  });
});

it('keeps the original frozen CMR-unknown onboarding blocked without outbound calls', () => {
  const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected outbound request'));
  const original = structuredClone(uiCounterexample.profile) as EngineProfile;
  expect(original.screening.cmrSymptoms).toBeUndefined();
  expect(assembleEngineIntent({ kind: 'plan_new', params: {} }, onboard(original)).attachment).toBeNull();
  expect(network).not.toHaveBeenCalled();
});
