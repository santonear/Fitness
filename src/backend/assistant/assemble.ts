import { assembleEngineIntent } from './engine-assemble';
import { estimatedDurationLabel } from '../../i18n/features/plan/labels';
import { diffTemplates } from '../../assistant/template-diff';
import { sameExerciseFamily } from '../../catalog/exercise-family';
import { sessionDuration } from '../../application/rules/session-duration';
import { assistantIntentSchema, type AssistantAttachment, type AssistantRequest } from '../../assistant/contracts';
import { basicProposal } from '../../application/v8-workflow';
import { assistantMovement } from '../../catalog/ai-catalog';
import { applicableAssistantCandidates, lowerBodyAddition } from './applicable-candidates';
import { exercises } from '../../catalog/exercises';
import { coachResponseSchema } from '../../coach/contracts';
import { cautionSchema } from '../../engine/contracts';
import {
  resolveAssistantExercise,
  newItem,
  replacementItem,
  coverPatterns,
  recalculate,
  fitDuration,
  syncTemplateName,
  templateDiff,
  findExistingItem,
  explicitExistingReplacements,
  namedPlanScope,
  applyChanges,
  daysLocked,
} from './assemble/changes';
export { resolveAssistantExercise } from './assemble/changes';

/** The model may describe changes; identity, metrics and durations come only from code. */
export function assembleAssistantIntent(
  raw: unknown,
  request: AssistantRequest,
): { attachment: AssistantAttachment | null; dropped: string[]; repaired: boolean } {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const value = parsed && typeof parsed === 'object' && 'intent' in parsed ? parsed.intent : parsed;
  let intent = assistantIntentSchema.parse(value);
  if (request.context?.trainingEngine) return assembleEngineIntent(intent, request);
  const context = request.context,
    candidates = applicableAssistantCandidates(request),
    dropped: string[] = [];
  if (!request.adultConfirmed || !context) return { attachment: null, dropped, repaired: false };
  const explicitReplacements = explicitExistingReplacements(request);
  if ((intent.kind === 'none' || intent.kind === 'clarify') && !explicitReplacements.length)
    return { attachment: null, dropped, repaired: false };
  if (explicitReplacements.length && (intent.kind === 'none' || intent.kind === 'clarify'))
    intent = { kind: 'plan_modify', changes: explicitReplacements };
  const identity = {
    requestId: context.requestId,
    restoreGeneration: context.restoreGeneration,
    mutationAllowed: false as const,
  };
  if (intent.kind === 'plan_new' && context.task === 'ONBOARD_PLAN') {
    // Calendar-picked days are fixed: the model's day count or weekdays never replace them unless the user asked.
    const p = daysLocked(request)
        ? { ...intent.params, daysPerWeek: undefined, preferredDays: undefined }
        : intent.params,
      profile = {
        ...context.profile,
        weeklyTarget: p.daysPerWeek ?? context.profile.weeklyTarget,
        sessionMinutes:
          sessionDuration(request.messages.at(-1)?.content ?? '') ??
          p.minutesPerSession ??
          context.profile.sessionMinutes,
        place: context.profile.place,
        equipment: context.profile.equipment,
        preferredDays:
          (p.preferredDays?.filter(day =>
            ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(day),
          ) as typeof context.profile.preferredDays) ?? context.profile.preferredDays,
        cautions: [
          ...new Set([
            ...context.profile.cautions,
            ...(p.cautionAreas ?? []).filter(area => (cautionSchema.options as readonly string[]).includes(area)),
          ]),
        ] as typeof context.profile.cautions,
      };
    const proposal = basicProposal({ ...profile, confirmedAt: new Date().toISOString() }, request.locale);
    if (!proposal || !proposal.templates.length) throw Error('NO_SAFE_PLAN');
    for (const template of proposal.templates) {
      const used = new Set<string>();
      template.items = template.items.flatMap(item => {
        const original = exercises.find(exercise => exercise.id === item.exerciseId);
        const candidate =
          candidates.find(row => row.exercise.id === item.exerciseId) ??
          candidates.find(row => original && row.mode === assistantMovement(original) && !used.has(row.exercise.id));
        if (!candidate) {
          dropped.push('outside_client_catalog');
          return [];
        }
        used.add(candidate.exercise.id);
        if (candidate.exercise.id === item.exerciseId) return [item];
        dropped.push('outside_client_catalog_substituted');
        return [{ ...newItem(candidate), sets: item.sets }];
      });
      coverPatterns(template, candidates);
      if (!template.items.length) throw Error('NO_SAFE_PLAN');
    }
    for (const pick of intent.picks ?? []) {
      const candidate = resolveAssistantExercise(pick.code, candidates);
      if (!candidate) {
        dropped.push('unknown_exercise');
        continue;
      }
      const [slot, mode] = pick.slot.split(':');
      const template = proposal.templates.find(row => row.id === slot || row.name === slot);
      if (!template) {
        dropped.push('unknown_slot');
        continue;
      }
      const index = template.items.findIndex(item => {
        const exercise = exercises.find(row => row.id === item.exerciseId);
        return exercise && assistantMovement(exercise) === mode;
      });
      if (index < 0) {
        dropped.push('unknown_pattern');
        continue;
      }
      template.items[index] = newItem(candidate);
    }
    for (const template of proposal.templates) {
      coverPatterns(template, candidates);
      if (/瘦|减脂|体脂|fat_loss|fat loss|weight loss/i.test(profile.goalText) || p.goal === 'fat_loss') {
        const cardio = candidates.find(
          row => row.mode === 'cardio' && !/run|jump|hop|climber|lunge/i.test(row.exercise.name.en),
        );
        if (
          cardio &&
          !template.items.some(item => candidates.find(row => row.exercise.id === item.exerciseId)?.mode === 'cardio')
        )
          template.items.push(newItem(cardio));
      }
      fitDuration(template, profile.sessionMinutes, candidates);
    }
    return {
      attachment: coachResponseSchema.parse({ ...identity, type: 'plan_proposal', proposal }),
      dropped,
      repaired: dropped.length > 0,
    };
  }
  if (intent.kind === 'plan_modify' && context.task === 'MODIFY_PLAN') {
    const scope = namedPlanScope(request),
      scoped = scope.templates.size > 0 || scope.items.size > 0;
    const changesToApply = intent.changes
      .filter(
        change =>
          change.op === 'add' ||
          !scope.items.size ||
          context.plan.templates.some(template => findExistingItem(template, change.from) >= 0),
      )
      .map(change => ({ ...change }));
    if (explicitReplacements.some(change => change.to)) {
      for (let index = changesToApply.length - 1; index >= 0; index--)
        if (
          changesToApply[index].op === 'replace' &&
          !explicitReplacements.some(change =>
            context.plan.templates.some(
              template =>
                template.id === change.session &&
                findExistingItem(template, change.from) === findExistingItem(template, changesToApply[index].from),
            ),
          )
        )
          changesToApply.splice(index, 1);
    }
    if (scope.templates.size)
      for (const change of changesToApply) if (!change.session) change.session = [...scope.templates][0];
    const additions = changesToApply.filter(change => change.op === 'add');
    const additionName = context.instruction.match(/(?:加|增加|add)\s*(?:一个|one\s+)?\s*(.+?)(?:[。；;]|$)/i)?.[1];
    const explicitlyAdded = resolveAssistantExercise(additionName, candidates);
    if (explicitlyAdded) for (const change of additions) change.to = explicitlyAdded.code;
    const singleAddition = !/(?:[2-9二两三四五六七八九])\s*(?:个|项|动作)|\b[2-9]\s+(?:exercises|movements)/i.test(
      request.messages.at(-1)?.content ?? '',
    );
    if (singleAddition && additions.length) {
      const destination = scope.templates.size
        ? [...scope.templates][0]
        : [...context.plan.templates].sort((a, b) => a.estimatedMinutes - b.estimatedMinutes)[0].id;
      let retained = false;
      for (let i = changesToApply.length - 1; i >= 0; i--)
        if (changesToApply[i].op === 'add') {
          if (retained) changesToApply.splice(i, 1);
          else {
            changesToApply[i].session = destination;
            retained = true;
          }
        }
    }
    if (/加.*(?:练腿|腿部|下肢)|add.*(?:leg|lower.body)/i.test(request.messages.at(-1)?.content ?? '')) {
      const safe = lowerBodyAddition(request);
      for (const change of changesToApply)
        if (change.op === 'add') {
          const choice = resolveAssistantExercise(change.to, candidates);
          if (
            !choice ||
            context.plan.templates.some(template =>
              template.items.some(item =>
                sameExerciseFamily(
                  exercises.find(e => e.id === item.exerciseId)!,
                  choice.exercise,
                ),
              ),
            )
          )
            change.to = safe?.code;
        }
    }
    for (const inferred of explicitReplacements) {
      const existing = changesToApply.find(
        change =>
          change.op === 'replace' &&
          (!change.session || change.session === inferred.session) &&
          context.plan.templates.some(
            template =>
              template.id === inferred.session &&
              findExistingItem(template, change.from) === findExistingItem(template, inferred.from),
          ),
      );
      if (existing && inferred.to) existing.to = inferred.to;
      else if (!existing) changesToApply.push(inferred);
    }
    const proposal = structuredClone(context.plan);
    const explicitMinutes = sessionDuration(context.instruction);
    if (intent.params && daysLocked(request))
      intent = { ...intent, params: { ...intent.params, daysPerWeek: undefined, preferredDays: undefined } };
    if (intent.params?.daysPerWeek) proposal.weeklyTarget = intent.params.daysPerWeek;
    if (
      intent.params?.daysPerWeek &&
      proposal.preferredDays &&
      proposal.preferredDays.length !== proposal.weeklyTarget
    ) {
      const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
      proposal.preferredDays = [...new Set([...proposal.preferredDays, ...order])].slice(0, proposal.weeklyTarget);
    }
    if (intent.params?.preferredDays)
      proposal.preferredDays = intent.params.preferredDays.filter(day =>
        ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(day),
      ) as typeof proposal.preferredDays;
    if (explicitMinutes) proposal.sessionMinutes = Math.max(15, explicitMinutes);
    for (const template of proposal.templates) {
      if (scope.templates.size && !scope.templates.has(template.id)) continue;
      const filtered = changesToApply.filter(
        change => !scope.templates.size || !change.session || scope.templates.has(change.session),
      );
      applyChanges(
        template,
        filtered,
        candidates,
        new Set(),
        dropped,
        context.plan.templates.flatMap(t => t.items),
        /(?:换成|替换为|换为|replace.+with|swap.+for)/i.test(context.instruction),
      );
      if (explicitMinutes) fitDuration(template, proposal.sessionMinutes, candidates);
      else recalculate(template);
      syncTemplateName(template, request.locale);
    }
    proposal.scheduleOriginalText = context.plan.scheduleOriginalText;
    if (
      explicitReplacements.length &&
      !context.plan.templates.some((before, index) =>
        before.items.some(
          (item, itemIndex) => item.exerciseId !== proposal.templates[index]?.items[itemIndex]?.exerciseId,
        ),
      )
    )
      throw Error('NO_APPLICABLE_CHANGE');
    const changes = [
      ...new Set(
        context.plan.templates.flatMap((before, index) =>
          proposal.templates[index] ? templateDiff(before, proposal.templates[index], request.locale) : [],
        ),
      ),
    ];
    if (context.plan.weeklyTarget !== proposal.weeklyTarget)
      changes.push(
        request.locale === 'zh' ? `每周${proposal.weeklyTarget}次` : `${proposal.weeklyTarget} times per week`,
      );
    if (JSON.stringify(context.plan.preferredDays ?? []) !== JSON.stringify(proposal.preferredDays ?? []))
      changes.push(request.locale === 'zh' ? '调整训练日' : 'Changed training days');
    if (!changes.length) throw Error('NO_APPLICABLE_CHANGE');
    changes.push(
      request.locale === 'zh'
        ? `预计${estimatedDurationLabel(proposal.templates, request.locale)}`
        : `About ${estimatedDurationLabel(proposal.templates, request.locale)}`,
    );
    const reason =
      request.locale === 'zh'
        ? '按已确认的场地、器械和注意部位筛选动作。'
        : 'Exercises respect the confirmed place, equipment and cautions.';
    proposal.reasons = [
      changes[0],
      changes[1] ?? reason,
      request.locale === 'zh'
        ? `每次预计约${estimatedDurationLabel(proposal.templates, request.locale)}。`
        : `About ${estimatedDurationLabel(proposal.templates, request.locale)} per workout.`,
    ];
    return {
      attachment: coachResponseSchema.parse({
        ...identity,
        type: 'change_proposal',
        target: context.target,
        proposal,
        changes,
      }),
      dropped,
      repaired: dropped.length > 0,
    };
  }
  if (intent.kind === 'today_adjust' && context.task === 'ADJUST_TODAY') {
    const template = structuredClone(context.template),
      locked = new Set(request.currentWorkout?.completedSets.map(set => set.itemIndex) ?? []);
    applyChanges(template, intent.changes ?? [], candidates, locked, dropped);
    const latest = request.messages.at(-1)?.content ?? '';
    if (/膝盖.{0,8}(?:疼|痛|不适|受伤|舒服|伤)|knee\s*(?:pain|injury|discomfort)/i.test(latest)) {
      for (let index = 0; index < template.items.length; index++) {
        const exercise = exercises.find(row => row.id === template.items[index].exerciseId);
        if (!locked.has(index) && exercise && /squat|lunge|leg.press|jump|hop|burpee/i.test(exercise.name.en)) {
          const replacement = candidates.find(
            row => row.mode === 'hinge' && !template.items.some(item => item.exerciseId === row.exercise.id),
          );
          if (replacement) template.items[index] = replacementItem(template.items[index], replacement);
        }
      }
    }
    const focus = intent.focus ?? (/只练上半身|只练上肢|upper.body only/i.test(latest) ? 'upper' : undefined);
    if (focus && focus !== 'full') {
      const accepts = (mode: string) =>
        focus === 'upper'
          ? ['push', 'pull', 'core'].includes(mode)
          : focus === 'lower'
            ? ['squat', 'hinge', 'lower', 'core'].includes(mode)
            : focus === 'core'
              ? mode === 'core'
              : mode === 'mobility';
      const lastCompleted = locked.size ? Math.max(...locked) : -1;
      template.items = template.items.filter(
        (item, index) =>
          index <= lastCompleted || accepts(assistantMovement(exercises.find(row => row.id === item.exerciseId)!)),
      );
      if (!template.items.length) {
        const safe = candidates.find(row => accepts(row.mode));
        if (safe) template.items.push(newItem(safe));
      }
      for (const mode of focus === 'upper' ? ['push', 'pull', 'core'] : focus === 'lower' ? ['squat', 'hinge'] : []) {
        if (
          !template.items.some(item => assistantMovement(exercises.find(row => row.id === item.exerciseId)!) === mode)
        ) {
          const safe = candidates.find(
            row => row.mode === mode && !template.items.some(item => item.exerciseId === row.exercise.id),
          );
          if (safe) template.items.push(newItem(safe));
        }
      }
    }
    const spokenMinutes = sessionDuration(latest);
    const desired =
      spokenMinutes ?? (intent.changes?.some(change => change.op === 'replace') ? undefined : intent.minutes);
    if (desired) fitDuration(template, desired, candidates, locked);
    else recalculate(template, 10);
    if (desired && Math.abs(template.estimatedMinutes - desired) > desired * 0.1) throw Error('NO_APPLICABLE_CHANGE');
    syncTemplateName(template, request.locale);
    const changes = templateDiff(context.template, template, request.locale);
    if (!changes.length) throw Error('NO_APPLICABLE_CHANGE');
    const cautions =
      /膝盖.{0,8}(?:疼|痛|不适|受伤|舒服|伤)|knee\s*(?:pain|injury|discomfort)/i.test(
        request.messages.at(-1)?.content ?? '',
      ) &&
      template.items.every(item => {
        const exercise = exercises.find(row => row.id === item.exerciseId);
        return !!exercise && !/squat|lunge|leg.press|jump|hop|burpee/i.test(exercise.name.en);
      });
    const summary =
      (request.locale === 'zh'
        ? `调整${diffTemplates([context.template], [template]).changes.length}项 · 预计${template.estimatedMinutes}分钟`
        : `${diffTemplates([context.template], [template]).changes.length} changes · about ${template.estimatedMinutes} minutes`) +
      (cautions
        ? request.locale === 'zh'
          ? ' · 已避开加重膝盖负担的动作'
          : ' · Avoids high knee-load movements'
        : '');
    return {
      attachment: coachResponseSchema.parse({
        ...identity,
        type: 'today_adjustment',
        target: context.target,
        workoutId: context.workoutId,
        template,
        summary,
      }),
      dropped,
      repaired: dropped.length > 0,
    };
  }
  if (intent.kind === 'review' && context.task === 'PERIOD_REVIEW') {
    const f = context.facts,
      opening =
        request.locale === 'zh'
          ? `这段时间完成 ${f.complete} 次，部分完成 ${f.partial} 次。`
          : `${f.complete} complete and ${f.partial} partial sessions in this period.`;
    return {
      attachment: coachResponseSchema.parse({
        ...identity,
        type: 'review_summary',
        target: context.target,
        opening,
        encouragement:
          request.locale === 'zh' ? '这些记录可以帮助你调整下一步。' : 'These records can guide the next step.',
        gap: request.locale === 'zh' ? '按已有记录看即可。' : 'Only recorded activity is counted.',
        dataBoundary: [],
      }),
      dropped,
      repaired: false,
    };
  }
  return { attachment: null, dropped, repaired: false };
}
