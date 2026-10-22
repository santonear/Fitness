import { describe, expect, it } from 'vitest';
import { assembleAssistantIntent, resolveAssistantExercise } from '../../src/backend/assistant/assemble';
import { selectAssistantCandidates } from '../../src/catalog/ai-catalog';
import type { AssistantRequest } from '../../src/assistant/contracts';
import { assistantMovement } from '../../src/catalog/ai-catalog';
import { exercises } from '../../src/catalog/exercises';
import { applicableAssistantCandidates } from '../../src/backend/assistant/applicable-candidates';
import { sameExerciseFamily } from '../../src/catalog/exercise-family';

const id = '11111111-1111-4111-8111-111111111111';
const base = {
  version: 'fitness-assistant-v2',
  requestId: id,
  conversationId: id,
  locale: 'zh',
  timeZone: 'Asia/Shanghai',
  adultConfirmed: true,
  messages: [{ role: 'user', content: '每周三次，每次30分钟' }],
} as const;
const common = {
  version: 'fitness-coach-v8',
  requestId: id,
  conversationId: id,
  restoreGeneration: 0,
  inputSnapshot: 'snapshot',
  sendConfirmation: 'confirmed',
  locale: 'zh',
  timeZone: 'Asia/Shanghai',
  adultConfirmed: true,
  messages: [],
} as const;
const onboard: AssistantRequest = {
  ...base,
  messages: [...base.messages],
  context: {
    ...common,
    messages: [],
    task: 'ONBOARD_PLAN',
    profile: {
      goalText: '规律训练',
      weeklyTarget: 3,
      sessionMinutes: 30,
      scheduleOriginalText: '原来每周三次',
      place: 'home',
      equipment: ['none'],
      adultConfirmed: true,
      cautions: [],
    },
  },
};
describe('minimal assistant intent assembly', () => {
  it('resolves candidate code and exact name but drops unknown names', () => {
    const candidates = selectAssistantCandidates(onboard),
      first = candidates[0];
    expect(resolveAssistantExercise(first.code, candidates)?.exercise.id).toBe(first.exercise.id);
    expect(resolveAssistantExercise(first.exercise.name.zh, candidates)?.exercise.id).toBe(first.exercise.id);
    expect(resolveAssistantExercise('totally unknown future movement', candidates)).toBeUndefined();
  });
  it('filters unsafe or unavailable movements from the model vocabulary', () => {
    const request = {
      ...onboard,
      messages: [{ role: 'user' as const, content: '不能跳，膝盖需要注意' }],
      context: {
        ...onboard.context!,
        task: 'ONBOARD_PLAN' as const,
        profile: {
          ...(onboard.context!.task === 'ONBOARD_PLAN' ? onboard.context!.profile : undefined),
          cautions: ['knee' as const],
          equipment: ['none', 'dumbbell', 'resistance-band'],
        },
      },
    } as AssistantRequest;
    const candidates = selectAssistantCandidates(request);
    expect(candidates.length).toBeLessThanOrEqual(60);
    expect(candidates.every(row => ['none', 'dumbbell', 'resistance-band'].includes(row.exercise.equipment))).toBe(
      true,
    );
    expect(candidates.every(row => !/jump|hop|burpee|squat|lunge|leg.press/i.test(row.exercise.name.en))).toBe(true);
  });
  it.each([
    {
      place: 'home' as const,
      equipment: ['none', 'dumbbell', 'resistance-band'],
      cautions: ['knee' as const],
      message: '不能跳',
    },
    {
      place: 'gym' as const,
      equipment: ['none', 'gym-machine', 'barbell', 'dumbbell'],
      cautions: [],
      message: '安排健身房训练',
    },
    { place: 'home' as const, equipment: ['none', 'yoga-mat'], cautions: [], message: '只有瑜伽垫' },
  ])('keeps balanced candidates for $place / $message', scenario => {
    const req = {
      ...onboard,
      messages: [{ role: 'user' as const, content: scenario.message }],
      context: {
        ...onboard.context!,
        task: 'ONBOARD_PLAN' as const,
        profile: {
          ...(onboard.context!.task === 'ONBOARD_PLAN' ? onboard.context!.profile : undefined),
          place: scenario.place,
          equipment: scenario.equipment,
          cautions: scenario.cautions,
        },
      },
    } as AssistantRequest;
    const selected = selectAssistantCandidates(req),
      counts = new Map<string, number>();
    for (const row of selected) counts.set(row.mode, (counts.get(row.mode) ?? 0) + 1);
    expect(selected.length).toBeLessThanOrEqual(60);
    for (const [mode, count] of counts) {
      // Do not fill a scarce mode with movements that violate a knee caution.
      const floor = mode === 'carry' ? 2 : mode === 'squat' && scenario.cautions.some(area => area === 'knee') ? 1 : 4;
      expect(count, mode).toBeGreaterThanOrEqual(floor);
    }
  });
  it('builds complete plan with server identity and keeps original words', () => {
    const result = assembleAssistantIntent({ kind: 'plan_new', params: { daysPerWeek: 3 } }, onboard);
    expect(result.attachment).toMatchObject({
      type: 'plan_proposal',
      requestId: id,
      mutationAllowed: false,
      proposal: { weeklyTarget: 3, scheduleOriginalText: '原来每周三次' },
    });
    if (result.attachment?.type !== 'plan_proposal') throw Error('missing proposal');
    for (const template of result.attachment.proposal.templates) {
      const modes = new Set(
        template.items.map(item => assistantMovement(exercises.find(e => e.id === item.exerciseId)!)),
      );
      expect(modes.has('push')).toBe(true);
      expect(
        [modes.has('push'), modes.has('pull'), modes.has('core'), modes.has('squat') || modes.has('hinge')].filter(
          Boolean,
        ).length,
      ).toBeGreaterThanOrEqual(3);
      expect(template.estimatedMinutes).toBeGreaterThanOrEqual(10);
    }
  });
  it('drops unknown picks without throwing away the valid plan', () => {
    const result = assembleAssistantIntent(
      { kind: 'plan_new', params: {}, picks: [{ slot: 'A:push', code: 'not-an-exercise' }] },
      onboard,
    );
    expect(result.attachment?.type).toBe('plan_proposal');
    expect(result.dropped).toContain('unknown_exercise');
  });
  it('refuses a 10-minute card when the template cannot safely fit the promised duration', () => {
    const plan = assembleAssistantIntent({ kind: 'plan_new', params: {} }, onboard).attachment;
    if (plan?.type !== 'plan_proposal') throw Error('missing');
    const context = {
      ...common,
      messages: [],
      task: 'ADJUST_TODAY' as const,
      target: { planId: id, versionId: id, revision: 0 },
      instruction: '今天10分钟',
      template: plan.proposal.templates[0],
    };
    expect(() => assembleAssistantIntent({ kind: 'today_adjust', minutes: 10 }, { ...onboard, context })).toThrow(
      'NO_APPLICABLE_CHANGE',
    );
  });
  it('replaces an existing movement even when a new caution removes it from candidates', () => {
    const plan = assembleAssistantIntent({ kind: 'plan_new', params: {} }, onboard).attachment;
    if (plan?.type !== 'plan_proposal') throw Error('missing plan');
    const original = plan.proposal.templates[0].items[0];
    const modified = {
      ...onboard,
      context: {
        ...common,
        messages: [],
        task: 'MODIFY_PLAN' as const,
        target: { planId: id, versionId: id, revision: 0 },
        instruction: '换动作',
        plan: plan.proposal,
      },
    } as AssistantRequest;
    const originalExercise = exercises.find(e => e.id === original.exerciseId)!;
    const safe = applicableAssistantCandidates(modified).find(
      row =>
        row.exercise.id !== original.exerciseId &&
        row.mode === assistantMovement(originalExercise) &&
        !plan.proposal.templates
          .flatMap(t => t.items)
          .some(
            item =>
              item.exerciseId !== original.exerciseId &&
              sameExerciseFamily(
                exercises.find(e => e.id === item.exerciseId)!,
                row.exercise,
              ),
          ),
    );
    if (!safe) throw Error('missing safe candidate');
    const result = assembleAssistantIntent(
      {
        kind: 'plan_modify',
        changes: [{ session: plan.proposal.templates[0].id, op: 'replace', from: original.exerciseId, to: safe.code }],
      },
      modified,
    );
    expect(result.attachment?.type).toBe('change_proposal');
    if (result.attachment?.type === 'change_proposal')
      expect(result.attachment.proposal.templates[0].items[0].exerciseId).toBe(safe.exercise.id);
  });
  it('recalculates plan duration after adding a safe push movement', () => {
    const initial = assembleAssistantIntent({ kind: 'plan_new', params: {} }, onboard).attachment;
    if (initial?.type !== 'plan_proposal') throw Error('missing plan');
    const request = {
      ...onboard,
      context: {
        ...common,
        messages: [],
        task: 'MODIFY_PLAN' as const,
        target: { planId: id, versionId: id, revision: 0 },
        instruction: '增加推类动作',
        plan: initial.proposal,
      },
    } as AssistantRequest;
    const existing = new Set(
      initial.proposal.templates.flatMap(template => template.items.map(item => item.exerciseId)),
    );
    const candidate = selectAssistantCandidates(request).find(
      row => row.mode === 'push' && !existing.has(row.exercise.id),
    );
    if (!candidate) throw Error('missing safe push candidate');
    const changed = assembleAssistantIntent(
      { kind: 'plan_modify', changes: [{ op: 'add', session: initial.proposal.templates[0].id, to: candidate.code }] },
      request,
    ).attachment;
    if (changed?.type !== 'change_proposal') throw Error('missing change');
    expect(changed.proposal.templates[0].items.length).toBe(initial.proposal.templates[0].items.length + 1);
    expect(changed.proposal.templates[0].estimatedMinutes).toBeGreaterThan(
      initial.proposal.templates[0].estimatedMinutes,
    );
    expect(changed.proposal.sessionMinutes).toBeGreaterThanOrEqual(initial.proposal.sessionMinutes);
  });
  it('rejects a plan change that cannot be applied rather than presenting an unchanged plan', () => {
    const plan = assembleAssistantIntent({ kind: 'plan_new', params: {} }, onboard).attachment;
    if (plan?.type !== 'plan_proposal') throw Error('missing plan');
    const modified = {
      ...onboard,
      context: {
        ...common,
        messages: [],
        task: 'MODIFY_PLAN' as const,
        target: { planId: id, versionId: id, revision: 0 },
        instruction: '换动作',
        plan: plan.proposal,
      },
    } as AssistantRequest;
    expect(() =>
      assembleAssistantIntent(
        { kind: 'plan_modify', changes: [{ op: 'replace', from: 'unknown', to: 'also unknown' }] },
        modified,
      ),
    ).toThrow('NO_APPLICABLE_CHANGE');
  });
  it('applies an upper-body 30-minute adjustment and removes lower movements', () => {
    const original = assembleAssistantIntent({ kind: 'plan_new', params: {} }, onboard).attachment;
    if (original?.type !== 'plan_proposal') throw Error('missing plan');
    const request: AssistantRequest = {
      ...onboard,
      messages: [{ role: 'user', content: '今天膝盖不太舒服，只练上半身，30分钟' }],
      context: {
        ...common,
        messages: [],
        task: 'ADJUST_TODAY',
        target: { planId: id, versionId: id, revision: 0 },
        instruction: 'today',
        template: original.proposal.templates[0],
      },
    };
    const result = assembleAssistantIntent({ kind: 'today_adjust', focus: 'upper', minutes: 30 }, request);
    if (result.attachment?.type !== 'today_adjustment') throw Error('missing adjustment');
    const adjusted = result.attachment.template;
    expect(
      adjusted.items.every(item =>
        ['push', 'pull', 'core'].includes(assistantMovement(exercises.find(row => row.id === item.exerciseId)!)),
      ),
    ).toBe(true);
    expect(adjusted.estimatedMinutes).toBeGreaterThanOrEqual(27);
    expect(adjusted.estimatedMinutes).toBeLessThanOrEqual(33);
    expect(JSON.stringify(adjusted.items)).not.toBe(JSON.stringify(original.proposal.templates[0].items));
    expect(result.attachment.summary).toContain('膝盖');
  });
  it('replaces a forbidden farmer carry with a non-squat non-walking movement and Chinese diff', () => {
    const original = assembleAssistantIntent({ kind: 'plan_new', params: {} }, onboard).attachment;
    if (original?.type !== 'plan_proposal') throw Error('missing plan');
    const carry = exercises.find(row => row.name.zh === '哑铃农夫行走');
    if (!carry) throw Error('missing carry');
    original.proposal.templates[0].items[0] = {
      exerciseId: carry.id,
      equipment: carry.equipment,
      sets: 2,
      target: { metricType: 'reps_load', reps: 8, loadGrams: 0 },
    };
    const request: AssistantRequest = {
      ...onboard,
      messages: [{ role: 'user', content: '以后别给我安排农夫行走了，帮我把计划里的换掉，膝盖以前受过伤' }],
      context: {
        ...common,
        messages: [],
        task: 'MODIFY_PLAN',
        target: { planId: id, versionId: id, revision: 0 },
        instruction: 'replace',
        plan: original.proposal,
      },
    };
    const result = assembleAssistantIntent(
      {
        kind: 'plan_modify',
        changes: [{ session: original.proposal.templates[0].id, op: 'replace', from: carry.id, to: '高脚杯深蹲' }],
      },
      request,
    );
    const attachment = result.attachment;
    if (attachment?.type !== 'change_proposal') throw Error('missing change');
    const proposal = attachment.proposal;
    const next = exercises.find(row => row.id === proposal.templates[0].items[0].exerciseId)!;
    expect(next.id).not.toBe(carry.id);
    expect(assistantMovement(next)).not.toBe('squat');
    expect(assistantMovement(next)).not.toBe('carry');
    expect(attachment.changes.join(' ')).toMatch(/将.*换成/);
    expect(proposal.reasons.join(' ')).not.toMatch(/Adjusted the plan/);
    const lengths = proposal.templates.map(template => template.estimatedMinutes).sort((a, b) => a - b);
    expect(proposal.sessionMinutes).toBe(original.proposal.sessionMinutes);
  });
  it.each([{ kind: 'none' as const }, { kind: 'plan_modify' as const, changes: [] }])(
    'honors an explicit existing exercise replacement when model returns $kind',
    intent => {
      const original = assembleAssistantIntent({ kind: 'plan_new', params: {} }, onboard).attachment;
      if (original?.type !== 'plan_proposal') throw Error('missing plan');
      const carry = exercises.find(row => row.name.zh === '哑铃农夫行走');
      if (!carry) throw Error('missing carry');
      original.proposal.templates[0].items[0] = {
        exerciseId: carry.id,
        equipment: carry.equipment,
        sets: 2,
        target: { metricType: 'reps_load', reps: 8, loadGrams: 0 },
      };
      const request: AssistantRequest = {
        ...onboard,
        messages: [{ role: 'user', content: '以后别安排农夫行走，把计划里的换掉' }],
        context: {
          ...common,
          messages: [],
          task: 'MODIFY_PLAN',
          target: { planId: id, versionId: id, revision: 0 },
          instruction: 'replace',
          plan: original.proposal,
        },
      };
      const attachment = assembleAssistantIntent(intent, request).attachment;
      if (attachment?.type !== 'change_proposal') throw Error('missing change');
      expect(attachment.proposal.templates[0].items[0].exerciseId).not.toBe(carry.id);
      expect(attachment.changes.join(' ')).toMatch(/将.*换成/);
    },
  );
});
