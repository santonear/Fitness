import { readBodyReferral, writeBodyReferral } from '../../../assistant/body-change-session';
import { detectBodyChange, type BodyChange } from '../../../assistant/body-change';
import { isFeatureEnabled } from '../../../application/feature-flags';
import { resolveEngineIntent } from '../../../assistant/engine-intent';
import { enginePreferences } from '../../../application/engine-profile';
import { getEligibleExercises } from '../../../engine';
import { currentWorkoutContext } from '../../../assistant/client-context';
import { inferAssistantLocale, applyAssistantPreferences } from '../../../assistant/contracts';
import { nutritionForCoach } from '../../../application/nutrition';
import { repository } from '../../../persistence/repository';
import { type AssistantConversation } from '../../../persistence/assistant-conversations';
import { assistantPreferences } from '../../../persistence/assistant-preferences';
import { sendAssistant, AssistantError } from '../../../assistant/client';
import { approveCoachScope, coachScope } from '../../../coach/consent';
import { localCoachReplyForMode } from '../../../coach/local-fallback';
import type { AssistantState } from './useAssistantState';

/** Builds this render's `send` (one message to the assistant, with local fallback), closing over `s`. */
export function assistantSend(s: AssistantState) {
  const {
    props,
    request,
    expectedRevision,
    beforeSend,
    onResponse,
    locale,
    t,
    chat,
    setChat,
    text,
    setText,
    setBusy,
    body,
    history,
    setError,
    setPending,
    setCandidate,
    setSaved,
    setRemembered,
    setWorkoutContext,
    setLocalReply,
    setBodyChange,
    nutritionEnabled,
    diet,
    dietWithdrawn,
    bodyFields,
    setLocalNotices,
    health,
    setGuide,
    setOnlyToday,
    setRetryMessage,
    setIntentStatus,
    setPrivacy,
    controller,
    lock,
    sequence,
    persist,
  } = s;
  async function send(message = text, source = request, revision = expectedRevision) {
    if (source?.trainingEngine && !isFeatureEnabled('trainingEngine')) {
      setCandidate(undefined);
      setError(t.disabled);
      return;
    }
    if (lock.current || !message.trim()) return;
    lock.current = true;
    setBusy(true);
    setPending(false);
    setLocalNotices([]);
    setLocalReply(false);
    setError('');
    setRetryMessage('');
    setIntentStatus('');
    setCandidate(undefined);
    setGuide(undefined);
    setSaved(false);
    setRemembered(undefined);
    setOnlyToday(false);
    setText('');
    const preflight = sequence.current;
    const localState = await repository.db.v8State.get('v8').catch(() => undefined);
    if (sequence.current !== preflight || !lock.current) return;
    const detected = detectBodyChange(message, localState?.coachProfile?.population?.kind);
    if (detected) {
      const previous = readBodyReferral(chat.id);
      const row = { kind: detected, dismissed: previous?.dismissed ?? new Set<BodyChange>() };
      writeBodyReferral(chat.id, row);
      if (!row.dismissed.has(detected)) setBodyChange(detected);
    }
    const replyLocale = inferAssistantLocale(message, locale);
    const routed = source ? (props.resolveRequest?.(message, source) ?? source) : undefined;
    const routedRevision = routed && 'target' in routed ? routed.target.revision : revision;
    setOnlyToday(
      source?.task === 'ADJUST_TODAY' &&
        routed?.task === 'MODIFY_PLAN' &&
        /(?:今天|这次|今日|\btoday\b|\bthis workout\b)/i.test(message),
    );
    const serial = ++sequence.current,
      abort = new AbortController();
    controller.current = abort;
    const next: AssistantConversation = {
      ...chat,
      consent: { body, history, ...(bodyFields ? { bodyFields } : {}) },
      title: chat.title || message.trim().slice(0, 80),
      updatedAt: new Date().toISOString(),
      messages: [
        ...chat.messages,
        { role: 'user', content: message.trim() },
        { role: 'assistant', content: '' },
      ] as AssistantConversation['messages'],
    };
    setChat({ ...next });
    let responseText = '';
    try {
      const nutrition =
        diet && nutritionEnabled ? nutritionForCoach(await repository.db.nutritionRecords.toArray(), true) : undefined;
      const scoped = routed
        ? coachScope(
            {
              ...routed,
              ...(nutrition ? { nutrition } : {}),
              ...(bodyFields && routed.body
                ? { body: Object.fromEntries(Object.entries(routed.body).filter(([key]) => bodyFields.includes(key))) }
                : {}),
              locale: replyLocale,
              requestId: crypto.randomUUID(),
              conversationId: chat.id,
              messages: [{ role: 'user', content: message.trim().slice(0, 1600) }],
              ...('instruction' in routed ? { instruction: message.trim() } : {}),
            },
            body,
            history,
            diet && nutritionEnabled,
            health,
          )
        : undefined;
      const preferences = await assistantPreferences.forRequest();
      if (routed?.engineProfile)
        routed.engineProfile.preferences = enginePreferences(
          { preferences: routed.engineProfile.preferences },
          preferences,
        );
      const context = scoped
        ? await approveCoachScope(
            applyAssistantPreferences(
              {
                ...scoped,
                candidateContext: {
                  equipment:
                    scoped.candidateContext?.equipment ??
                    (scoped.task === 'ONBOARD_PLAN' ? scoped.profile.equipment : []),
                  cautions:
                    scoped.candidateContext?.cautions ??
                    (scoped.task === 'ONBOARD_PLAN' ? scoped.profile.cautions : []),
                  preferences,
                },
              },
              next.messages.slice(0, -1).slice(-20),
            ),
          )
        : undefined;
      if (context) await beforeSend?.(context);
      const currentWorkout = await currentWorkoutContext(context, repository.db);
      setWorkoutContext(currentWorkout);
      const localWorkout =
        context?.task === 'ADJUST_TODAY' && context.workoutId
          ? await repository.db.v8Workouts.get(context.workoutId)
          : undefined;
      const localLockedIndexes = [
        ...new Set([
          ...(currentWorkout?.completedSets.map(set => set.itemIndex) ?? []),
          ...(localWorkout?.substitutions?.map(row => row.itemIndex) ?? []),
        ]),
      ];
      const engineCandidateIds = routed?.engineProfile
        ? getEligibleExercises(routed.engineProfile)
            .map(item => item.exerciseId)
            .slice(0, 60)
        : undefined;
      if (props.localOnly) {
        setLocalReply(true);
        const profile = (await repository.db.v8State.get('v8'))?.coachProfile;
        const reply = localCoachReplyForMode(
          isFeatureEnabled('trainingEngine') || !!context?.trainingEngine,
          message,
          context,
          profile,
          replyLocale,
        );
        responseText = reply.lines.join('\n');
        setGuide(reply.guideExerciseId);
        if (context && reply.response)
          setCandidate({ request: context, response: reply.response, expectedRevision: routedRevision });
      } else {
        try {
          localStorage.setItem('fitness-assistant-privacy', 'seen');
        } catch {
          /* Explanation stays visible when storage is unavailable. */
        }
        setPrivacy(false);
        let streamIssue: 'model' | 'attachment' | 'no_change' | undefined;
        await sendAssistant(
          {
            version: 'fitness-assistant-v2',
            requestId: context?.requestId ?? crypto.randomUUID(),
            conversationId: chat.id,
            locale: replyLocale,
            timeZone: source?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
            adultConfirmed: source?.adultConfirmed ?? false,
            context,
            currentWorkout,
            engineCandidateIds,
            consent: { body, history, health, nutrition: diet && nutritionEnabled },
            preferences,
            messages: next.messages
              .slice(0, -1)
              .slice(dietWithdrawn ? -1 : -20)
              .map(m => ({ ...m, content: m.content.slice(0, 4000) })),
          },
          abort.signal,
          event => {
            if (serial !== sequence.current) return;
            if (context?.trainingEngine && !isFeatureEnabled('trainingEngine')) {
              abort.abort();
              setCandidate(undefined);
              setPending(false);
              return;
            }
            if (event.type === 'text_delta') {
              responseText += event.delta;
              next.messages[next.messages.length - 1] = { role: 'assistant', content: responseText };
              setChat({ ...next, messages: [...next.messages] });
            }
            if (event.type === 'attachment_pending') setPending(true);
            if (event.type === 'engine_intent') {
              setPending(false);
              if (!isFeatureEnabled('trainingEngine')) {
                setError(t.disabled);
                return;
              }
              const outcome = resolveEngineIntent({
                intent: event.intent,
                routed,
                sent: context,
                locale: replyLocale,
                conversationId: chat.id,
                message,
                engineCandidateIds,
                lockedItemIndexes: localLockedIndexes,
                expectedRevision: routedRevision,
              });
              if (outcome.kind === 'review') return;
              setLocalNotices(outcome.notices);
              if (outcome.kind === 'candidate') {
                setCandidate(outcome.candidate);
                onResponse?.(outcome.candidate);
              } else if (outcome.kind === 'no_session') setIntentStatus(t.noSession);
              else setRetryMessage(message);
            }

            if (event.type === 'attachment') {
              setPending(false);
              if (event.attachment.type === 'exercise_info') {
                const asksReplacement = /(换|替|疼|痛|replace|swap|hurt|pain)/i.test(message);
                const currentIds =
                  context?.task === 'ADJUST_TODAY'
                    ? context.template.items.map(item => item.exerciseId)
                    : context?.task === 'MODIFY_PLAN'
                      ? context.plan.templates.flatMap(template => template.items.map(item => item.exerciseId))
                      : [];
                if (asksReplacement && currentIds.includes(event.attachment.exerciseId)) streamIssue = 'attachment';
                else setGuide(event.attachment.exerciseId);
              } else if (context) {
                if (
                  event.attachment.requestId !== context.requestId ||
                  event.attachment.restoreGeneration !== context.restoreGeneration
                )
                  throw new Error('STALE_INPUT');
                const value = { request: context, response: event.attachment, expectedRevision: routedRevision };
                setCandidate(value);
                onResponse?.(value);
              }
            }
            if (event.type === 'done' && (!event.success || event.result === 'no_change')) {
              setCandidate(undefined);
              streamIssue = event.result === 'no_change' ? 'no_change' : 'model';
            }
            if (event.type === 'attachment_failed') {
              setPending(false);
              streamIssue = event.code === 'NO_CHANGE' ? 'no_change' : 'attachment';
            }
          },
        );
        if (streamIssue === 'no_change') {
          setCandidate(undefined);
          setRetryMessage(message);
        } else if (streamIssue) {
          const profile = (await repository.db.v8State.get('v8').catch(() => undefined))?.coachProfile;
          const locked = [...new Set(currentWorkout?.completedSets.map(set => set.itemIndex) ?? [])];
          const local = localCoachReplyForMode(
            isFeatureEnabled('trainingEngine') || !!context?.trainingEngine,
            message,
            context,
            profile,
            replyLocale,
            locked,
          );
          setLocalReply(true);
          responseText = local.lines.join('\n');
          setGuide(local.guideExerciseId);
          if (context && local.response)
            setCandidate({ request: context, response: local.response, expectedRevision: routedRevision });
          setError(
            streamIssue === 'attachment'
              ? replyLocale === 'zh'
                ? '这次没能整理成可应用的方案。已给出本地建议，可再说一次。'
                : 'The suggestion could not be prepared. A local suggestion is ready; you can try again.'
              : replyLocale === 'zh'
                ? '模型暂时没给出可用结果。已给出本地建议。'
                : 'The model could not provide a usable result. A local suggestion is ready.',
          );
        }
      }
    } catch (reason) {
      if (!abort.signal.aborted && serial === sequence.current) {
        const code = reason instanceof Error ? reason.message : '';
        setError(
          code === 'DAILY_MESSAGE_LIMIT'
            ? t.limit +
                (reason instanceof AssistantError && reason.resetAt
                  ? new Date(reason.resetAt).toLocaleString(locale)
                  : '—')
            : code === 'QUALIFICATION_REQUIRED'
              ? t.invalid
              : code === 'AI_DISABLED'
                ? t.disabled
                : ['MODEL_UNAVAILABLE', 'GENERATION_FAILED', 'SERVICE_UNAVAILABLE', 'USAGE_UNAVAILABLE'].includes(code)
                  ? t.model
                  : code === 'CONCURRENT_REQUEST'
                    ? t.concurrent
                    : code === 'NETWORK_ERROR' || reason instanceof TypeError
                      ? t.network
                      : t.model,
        );
        const profile = (await repository.db.v8State.get('v8').catch(() => undefined))?.coachProfile;
        const current = await currentWorkoutContext(routed, repository.db).catch(() => undefined);
        const locked = [...new Set(current?.completedSets.map(set => set.itemIndex) ?? [])];
        const local = localCoachReplyForMode(
          isFeatureEnabled('trainingEngine') || !!routed?.trainingEngine,
          message,
          routed,
          profile,
          replyLocale,
          locked,
        );
        setLocalReply(true);
        responseText = local.lines.join('\n');
        setGuide(local.guideExerciseId);
        if (routed && local.response)
          setCandidate({ request: routed, response: local.response, expectedRevision: routedRevision });
      }
    } finally {
      if (serial === sequence.current) {
        next.messages[next.messages.length - 1] = { role: 'assistant', content: responseText.slice(0, 16000) };
        if (!responseText) next.messages.pop();
        setChat({ ...next, messages: [...next.messages] });
        setBusy(false);
        setPending(false);
        lock.current = false;
        await persist(next);
      }
    }
  }
  return send;
}
