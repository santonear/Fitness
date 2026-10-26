import { EngineResultNotice } from '../components/EngineResultNotice';
import { EnginePlanUnavailableError } from '../../application/engine-error';
import type { EnginePlan } from '../../engine/contracts';
import { useState, useRef, useEffect } from 'react';
import { useAccessStatus } from '../useAccessStatus';
import { accessReason } from '../../application/ai-access';
import { aiActivationCopy } from '../../i18n/features/coach/activation';
import { sendAssistant } from '../../assistant/client';
import { buildCoachRequest } from '../../coach/request-builder';
import { approveCoachScope } from '../../coach/consent';
import type { LocalCandidate } from '../../application/v8-workflow';
import { bodyProfileService } from '../../application/body-profile';
import { assistantPreferences, type AssistantPreference } from '../../persistence/assistant-preferences';
import { useFeature } from '../useFeature';
import { useLocation, Navigate } from 'react-router-dom';
import { useMainline, workflow } from './context';
import { localProfile } from '../../application/rules/local-profile';
import { exercises } from '../../catalog/exercises';
import { Button } from '../components/common';
import { normalizeTrainingDates } from '../../application/training-dates';
import { pickedSchedule } from '../../application/picked-schedule';
import { localDateIn } from '../../application/plan-presentation';
import { OnboardingPage } from '../pages/onboarding/OnboardingPage';
import { PlanDraftPage } from '../pages/onboarding/PlanDraftPage';
import { WelcomePage } from '../pages/onboarding/WelcomePage';
import { planModeCopy } from '../../i18n/features/onboarding/plan-mode';
import { path } from '../routes.contract';
import { DEFAULT_TIME_ZONE } from '../../domain/local-date';

export function OnboardingRoute() {
  const location = useLocation();
  const engineEnabled = useFeature('trainingEngine' as Parameters<typeof useFeature>[0]);
  const c = useMainline(),
    bodyEnabled = useFeature('bodyProfile'),
    assistant = useFeature('aiAssistantV2'),
    access = useAccessStatus(assistant);
  const [reply, setReply] = useState(''),
    [notice, setNotice] = useState('');
  const [engineResult, setEngineResult] = useState<EnginePlan>();
  const abort = useRef<AbortController>(null); // Once the questions have started (开始 tapped or any answer seen), clearing the goal (自己写一句) must not fall back to the welcome screen (Bo 2026-10-19).
  const [started, setStarted] = useState(false);
  const answeredSomething = c.step > 0 || !!c.answers.goalText.trim();
  useEffect(() => {
    if (answeredSomething) setStarted(true);
  }, [answeredSomething]);
  useEffect(() => () => abort.current?.abort(), []);
  const timeZone = c.data?.profile?.timeZone ?? DEFAULT_TIME_ZONE,
    today = localDateIn(timeZone);
  const eligible =
      assistant &&
      access.status?.qualification === 'active' &&
      access.status.sessionValid &&
      access.status.aiEnabled === true,
    useAi = eligible && c.answers.planMode !== 'local';
  if (!started && c.step === 0 && !c.answers.goalText.trim() && !c.data?.version)
    return (
      <WelcomePage
        locale={c.locale}
        onStart={() => setStarted(true)}
        onRestore={() => c.navigate('/settings#backup')}
      />
    );
  return (
    <>
      <OnboardingPage
        onExit={() => setStarted(false)}
        today={today}
        onHome={() => {
          abort.current?.abort();
          c.resetOnboarding();
          c.navigate('/');
        }}
        initialSafetyScreen={(location.state as { safetyScreen?: string } | null)?.safetyScreen}
        engineEnabled={engineEnabled}
        bodyEnabled={bodyEnabled}
        locale={c.locale}
        answers={c.answers}
        step={c.step}
        slots={c.slots}
        aiAvailable={assistant}
        mode={useAi ? 'ai' : 'basic'}
        busy={c.busy}
        error={c.error}
        onChange={a => {
          setEngineResult(undefined);
          c.setAnswers(a.body?.age !== undefined && a.body.age < 18 ? { ...a, adultConfirmed: false } : a);
          c.setCandidate(undefined);
        }}
        onStep={step => {
          if (bodyEnabled && c.step === 1 && step === 2)
            void c.run(async () => {
              await bodyProfileService.save(c.answers.body ?? {}, c.data!.metadata.dataRevision);
              c.setStep(step);
            });
          else c.setStep(step);
        }}
        onManual={() => c.navigate('/manual')}
        onGenerate={() =>
          void c.run(async () => {
            // Chosen days are cleaned again at generation time (a restored draft may hold days already past).
            const days = normalizeTrainingDates(c.answers.trainingDates ?? [], today).dates,
              schedule = {
                ...(days.length ? { trainingDates: days, startDate: days[0] } : {}),
                ...(days.length && c.answers.startTime ? { startTime: c.answers.startTime } : {}),
              };
            const profile = localProfile({ ...c.answers, trainingDates: days });
            setReply('');
            setNotice('');
            setEngineResult(undefined);
            let candidate: LocalCandidate | undefined;
            if (useAi && !engineEnabled && c.data) {
              const raw = buildCoachRequest({
                task: 'ONBOARD_PLAN',
                data: c.data,
                profile,
                schedule: pickedSchedule(schedule),
              });
              if (raw) {
                const context = await approveCoachScope(raw),
                  controller = new AbortController();
                abort.current = controller;
                try {
                  await sendAssistant(
                    {
                      version: 'fitness-assistant-v2',
                      requestId: context.requestId,
                      conversationId: context.conversationId,
                      locale: c.locale,
                      timeZone: context.timeZone,
                      adultConfirmed: context.adultConfirmed,
                      context,
                      consent: { body: false, history: false },
                      messages: [
                        {
                          role: 'user',
                          content:
                            c.locale === 'zh'
                              ? '请根据我的目标和可用时间，拟一份训练计划。'
                              : 'Please draft a training plan for my goals and available time.',
                        },
                      ],
                    },
                    controller.signal,
                    event => {
                      if (event.type === 'text_delta') setReply(value => value + event.delta);
                      if (
                        event.type === 'attachment' &&
                        event.attachment.type === 'plan_proposal' &&
                        event.attachment.requestId === context.requestId &&
                        event.attachment.restoreGeneration === context.restoreGeneration
                      )
                        candidate = {
                          ...event.attachment,
                          profile,
                          expectedRevision: c.data!.metadata.dataRevision,
                          source: 'ai',
                          ...schedule,
                        };
                    },
                  );
                } catch {
                  if (controller.signal.aborted) return;
                  setNotice(
                    c.locale === 'zh'
                      ? 'AI 暂时无法生成，已提供基础方案。'
                      : 'AI is unavailable. A basic plan is ready.',
                  );
                }
              }
            }
            try {
              const proposed = candidate ?? {
                ...(await workflow.propose(profile, c.locale, { trainingEngine: engineEnabled })),
                ...schedule,
              };
              c.setCandidate(proposed);
              c.navigate(path('draft'), { state: { building: true } });
              // Engine plans stay local and safety-checked; with AI chosen, the chat opens with a ready-to-send request (nothing is sent until the user taps 发送).
              if (engineEnabled && eligible && c.answers.planMode === 'ai')
                c.openCoachWithDraft(
                  planModeCopy[c.locale].engineDraft,
                  'ONBOARD_PLAN',
                  proposed.profile,
                  undefined,
                  pickedSchedule(schedule),
                );
            } catch (error) {
              if (error instanceof EnginePlanUnavailableError) {
                setEngineResult(error.plan);
                return;
              }
              throw error;
            }
          })
        }
      />
      {engineResult && <EngineResultNotice plan={engineResult} locale={c.locale} />}
      {reply && <p role="status">{reply}</p>}
      {notice && <p role="status">{notice}</p>}
      {c.busy && eligible && (
        <Button onClick={() => abort.current?.abort()}>{c.locale === 'zh' ? '停止' : 'Stop'}</Button>
      )}
    </>
  );
}
export function DraftRoute() {
  const c = useMainline(),
    bodyEnabled = useFeature('bodyProfile'),
    assistant = useFeature('aiAssistantV2'),
    location = useLocation();
  const access = useAccessStatus(assistant),
    aiOff = assistant && !!access.status && accessReason(access.status) === 'invalid';
  if (!c.candidate) return <Navigate to={c.draftDiscarded ? '/' : path('onboarding')} replace />;
  return (
    <PlanDraftPage
      locale={c.locale}
      timeZone={c.data?.profile?.timeZone}
      candidate={c.candidate}
      onStartDate={date => c.setCandidate({ ...c.candidate!, startDate: date })}
      onEditDays={() => {
        c.setCandidate(undefined);
        c.setStep(bodyEnabled ? 2 : 1);
        c.navigate(path('onboarding'));
      }}
      onHome={() => {
        c.resetOnboarding();
        c.navigate('/');
      }}
      building={(location.state as { building?: boolean } | null)?.building === true}
      basic={c.candidate.source !== 'ai'}
      onEditCautions={
        c.candidate.profile.cautions.length
          ? () => {
              c.setStep(bodyEnabled ? 4 : 3);
              c.navigate(path('onboarding'), { state: { safetyScreen: 'cautions' } });
            }
          : undefined
      }
      slots={c.slots}
      busy={c.busy}
      error={c.error}
      exerciseText={id => ({
        name: c.name(id),
        instructions: exercises.find(e => e.id === id)?.steps[c.locale].join(' ') ?? '',
      })}
      onDiscard={() => {
        c.setDraftDiscarded(true);
        c.setCandidate(undefined);
        c.navigate('/');
      }}
      aiOffer={aiOff ? { text: aiActivationCopy[c.locale].draft, onClick: () => c.setActivationOpen(true) } : undefined}
      onDiscuss={() => c.openCoach('ONBOARD_PLAN', undefined, c.candidate!.profile, pickedSchedule(c.candidate!))}
      onConfirm={confirmed =>
        void c.run(async () => {
          const chosen = (confirmed as { startDate?: string }).startDate;
          const candidate = {
            ...c.candidate!,
            ...(chosen && !c.candidate!.trainingDates?.length ? { startDate: chosen } : {}),
          };
          await workflow.adopt(candidate);
          const items: AssistantPreference[] = [
            ...(candidate.proposal.preferredDays?.length
              ? [{ kind: 'preferred_days' as const, value: candidate.proposal.preferredDays }]
              : []),
            ...candidate.profile.cautions.map(value => ({ kind: 'caution_area' as const, value })),
            ...(candidate.profile.equipment.length
              ? [{ kind: 'equipment' as const, value: candidate.profile.equipment }]
              : []),
          ];
          try {
            await assistantPreferences.save(items, c.locale);
          } catch {
            /* Plan confirmation is already complete; preferences can be edited in Settings. */
          }
          c.navigate('/letter', { state: { applied: true } });
        })
      }
    />
  );
}
