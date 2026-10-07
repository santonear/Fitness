import { useEffect, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { guidedService } from '../../application/guided';
import { database } from '../../persistence/db';
import { profileService } from '../../application/profile';
import { repository } from '../../persistence/repository';
import { captureGuidedHistory } from '../../application/guided-history';
import { emptyGuidedState, type GuidedState, type ProgramCandidate } from '../../domain/guided-contracts';
import { exercises } from '../../catalog/exercises';
import { ProgramDashboard } from '../components/guided';
import { DateCalendar } from '../components/DateCalendar';
import { dateInZone } from '../../application/progress';
import { guidedInputSnapshot, confirmGuidedSending, createGuidedDialogueMockClient, guidedCandidateMatchesReview } from '../../ai/guided-dialogue';
import type { GuidedDialogueRequest, GuidedSendingScope } from '../../domain/guided-ai-contracts';
import { executeGuidedTopicDecision, GUIDED_TOPIC_POLICY_VERSION, type GuidedTopicDecision } from '../../backend/guided-topic-policy';
import { sendGuidedDialogue } from '../../ai/guided-transport';
import { createFetchAiClient } from '../../ai/client';
import { statusFeedback as aiStatusMessage } from '../../ai/status-feedback';
import { guidedServiceLimits } from '../../backend/guided-provider';
import { GuidedHome } from './GuidedHome';
import { ScheduleConfirmation, type ScheduleSlot } from '../components/guided/ScheduleConfirmation';
import { formatGuidedTargets } from '../components/guided/ProgramDashboard';
import { nextPlanningWindow } from '../../ai/guided-planning';

// This switch is a local integration fixture, never a production model implementation.
const demo = import.meta.env.DEV && import.meta.env.VITE_GUIDED_DEMO === '1';
const fixtureLimits = { maxDays: 7, maxRangeDays: 31, maxExercisesPerDay: 4, maxSetsPerExercise: 4, maxInputBytes: 32768, maxOutputBytes: 65536 };
export function GuidedDialoguePage() {
  const { i18n } = useTranslation(); const locale: 'zh' | 'en' = i18n.resolvedLanguage === 'zh' ? 'zh' : 'en'; const zh = locale === 'zh';
  const [state, setState] = useState<GuidedState>(emptyGuidedState); const [draft, setDraft] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const control = useRef(createFetchAiClient());
  const [invite, setInvite] = useState('');
  const [qualification, setQualification] = useState<Awaited<ReturnType<typeof control.current.status>>>();
  const [checkingQualification, setCheckingQualification] = useState(!demo);
  const [accountingPending, setAccountingPending] = useState(false);
  const [sending, setSending] = useState(false);
  const [localReady, setLocalReady] = useState(false);
  const inFlight = useRef<{ requestId: string; abort: AbortController; cancelled: boolean } | undefined>(undefined);
  const actionLock = useRef(false);
  const inputEpoch = useRef(0);
  const directAttempt = useRef<{ request: GuidedDialogueRequest; dependencies: string; epoch: number; planContext: string } | undefined>(undefined);
  const currentGeneration = useRef(0);
  const thread = useRef<HTMLElement>(null);
  const [planningAnchor] = useState(Date.now);
  const [rangeDays, setRangeDays] = useState(7);
  const [usualTime, setUsualTime] = useState('19:00');
  const [sessionMinutes, setSessionMinutes] = useState(30);
  const [confirmedSlots, setConfirmedSlots] = useState<ScheduleSlot[]>([]);
  const [readyToSchedule, setReadyToSchedule] = useState(false);
  const [savedCandidate, setSavedCandidate] = useState<ProgramCandidate>();
  const [planning, setPlanning] = useState(false);
  const [adopted, setAdopted] = useState(false);
  const [dates, setDates] = useState<string[]>([]); const [summary, setSummary] = useState(''); const [understandingConfirmed, setUnderstandingConfirmed] = useState(false);
  const [sendScope, setSendScope] = useState<GuidedDialogueRequest>(); const [includeBody, setIncludeBody] = useState(false);
  const [includeHistory, setIncludeHistory] = useState(false); const [localCandidate, setLocalCandidate] = useState<ProgramCandidate>();
  const [historyTo, setHistoryTo] = useState(() => dateInZone(Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone));
  const [historyFrom, setHistoryFrom] = useState(() => dateInZone(Date.now() - 27 * 86_400_000, Intl.DateTimeFormat().resolvedOptions().timeZone));
  const [question, setQuestion] = useState(''); const [responseText, setResponseText] = useState('');
  const [clarificationAnswer, setClarificationAnswer] = useState('');
  const [previewDependencies, setPreviewDependencies] = useState('');
  const [pendingArchive, setPendingArchive] = useState<{ userMessage: GuidedState['messages'][number]; message: GuidedState['messages'][number]; candidate?: ProgramCandidate }>();
  const [mockTopicKind, setMockTopicKind] = useState<GuidedTopicDecision['kind']>('related');
  const [zone, setZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone); const [generation, setGeneration] = useState(0);
  const [conversationId] = useState(() => crypto.randomUUID()); const [startDate, setStartDate] = useState(''); const [endDate, setEndDate] = useState('');
  const latestCandidate = state.candidates.at(-1);
  const candidate = localCandidate ?? savedCandidate ?? (latestCandidate && !state.programs.some(program => program.candidateId === latestCandidate.id) ? latestCandidate : undefined);
  const candidateMatchesReview = Boolean(candidate && guidedCandidateMatchesReview(candidate, { goal: summary, startDate, endDate, timeZone: zone, dates }));
  useEffect(() => {
    setLocalReady(false);
    let live = true; let stop = () => {};
    void profileService.initialize(locale).then(() => { if (!live) return; const subscription = liveQuery(async () => ({ state: await guidedService.read(), profile: await profileService.getProfile(), metadata: await database.metadata.toCollection().first() })).subscribe({ next: result => { setState(result.state); if (result.profile) setZone(result.profile.timeZone); setGeneration(result.metadata?.restoreGeneration ?? 0); setLocalReady(true); }, error: reason => { setLocalReady(false); setError(String(reason)); } }); stop = () => subscription.unsubscribe(); }).catch(reason => { if (live) setError(String(reason)); });
    return () => { live = false; stop(); };
  }, [locale]);
  currentGeneration.current = generation;
  useEffect(() => { if (thread.current) thread.current.scrollTop = thread.current.scrollHeight; }, [state.messages.length]);
  useEffect(() => () => { inputEpoch.current++; directAttempt.current = undefined; if (inFlight.current) { inFlight.current.cancelled = true; inFlight.current.abort.abort(); } }, []);
  async function refreshQualification() {
    setCheckingQualification(true); setQualification(undefined);
    try { const status = await control.current.status(); setQualification(status); setAccountingPending(Boolean(status.pending)); return status; }
    finally { setCheckingQualification(false); }
  }
  async function run(operation: () => Promise<unknown>) { if (actionLock.current) return; actionLock.current = true; setBusy(true); setError(''); try { await operation(); } catch (reason) { const code = reason instanceof Error ? reason.message : String(reason); setError(!demo && /^[A-Z_]+$/.test(code) ? aiStatusMessage(code, locale) : code); } finally { actionLock.current = false; setBusy(false); } }
  useEffect(() => {
    if (demo || !localReady || !state.onboarding?.completed) return;
    const refresh = () => { if (document.visibilityState === 'visible') void run(refreshQualification); };
    refresh(); window.addEventListener('focus', refresh); window.addEventListener('online', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [localReady, state.onboarding?.completed]);
  function invalidate() { inputEpoch.current++; directAttempt.current = undefined; setUnderstandingConfirmed(false); setSendScope(undefined); }
  useEffect(() => { invalidate(); }, [locale]);
  async function saveMockArchive(result: NonNullable<typeof pendingArchive>) {
    let current = await guidedService.read();
    if (!current.messages.some(message => message.id === result.userMessage.id)) {
      await guidedService.appendMessage(result.userMessage, current.revision);
      current = await guidedService.read();
    }
    if (result.candidate && !current.candidates.some(item => item.id === result.candidate!.id)) {
      await guidedService.retainCandidate(result.candidate, current.revision);
      current = await guidedService.read();
    }
    if (!current.messages.some(message => message.id === result.message.id)) await guidedService.appendMessage(result.message, current.revision);
    setPendingArchive(undefined);
  }
  function mockMessage(request: GuidedDialogueRequest, content: string, candidateId?: string): GuidedState['messages'][number] {
    return { id: crypto.randomUUID(), conversationId: request.conversationId, role: 'assistant',
      content: `${demo ? (zh ? '[本地合成 mock，无模型调用]\n' : '[local synthetic mock; no model call]\n') : ''}${content}`,
      createdAt: new Date().toISOString(), requestId: request.requestId, ...(candidateId ? { candidateId } : {}) };
  }
  function mockUserMessage(request: GuidedDialogueRequest): GuidedState['messages'][number] {
    const content = [request.scope.goal,
      request.purpose !== 'understand' && request.confirmedSummary !== request.scope.goal ? request.confirmedSummary : '',
      typeof request.scope.conditions.dialogueAnswer === 'string' ? request.scope.conditions.dialogueAnswer : '',
      request.refinement ?? '',
    ].filter(Boolean).join('\n');
    return { id: crypto.randomUUID(), conversationId: request.conversationId, role: 'user', content,
      createdAt: new Date().toISOString(), requestId: request.requestId };
  }
  async function gateSyntheticResponse(request: GuidedDialogueRequest, fixture: () => unknown) {
    const identity = { policyVersion: GUIDED_TOPIC_POLICY_VERSION, requestId: request.requestId, inputSnapshot: request.inputSnapshot };
    const decision = mockTopicKind === 'related'
      ? { ...identity, kind: 'related', topics: ['general_fitness'], scope: 'fitness_only' }
      : { ...identity, kind: mockTopicKind, message: mockTopicKind === 'safety_limit'
        ? (zh ? '我不能提供诊断、处方或治疗方案。可以讨论当前健身目标相关的一般训练、饮食、睡眠和恢复。' : 'I cannot diagnose, prescribe or provide treatment. We can discuss general fitness, nutrition, sleep and recovery for your goal.')
        : mockTopicKind === 'clarification_needed'
          ? (zh ? '这次请求的健身部分还不明确。请说明它与当前健身目标有什么关系。' : 'The fitness part of this request is unclear. How does it relate to your current fitness goal?')
          : (zh ? '这里专注于你的健身目标，不能处理无关娱乐、编程或投资请求。可以继续聊当前目标相关的训练、饮食、睡眠和恢复。' : 'This dialogue focuses on your fitness goal and cannot handle unrelated entertainment, programming or investment requests. We can continue with relevant training, nutrition, sleep and recovery.') };
    return executeGuidedTopicDecision(request, decision, { authorizeGeneration: async () => true, generate: async () => fixture() });
  }
  async function archiveRefusal(request: GuidedDialogueRequest, message: string) {
    setResponseText(message); setSendScope(undefined);
    const result = { userMessage: mockUserMessage(request), message: mockMessage(request, message) };
    setPendingArchive(result); await saveMockArchive(result);
  }
  async function historySnapshot() {
    return captureGuidedHistory(repository, historyFrom, historyTo, fixtureLimits.maxInputBytes);
  }
  async function prepareSending(purpose: GuidedDialogueRequest['purpose'] = 'program', direct = false) {
    const epoch = inputEpoch.current;
    if (!localReady) throw new Error(zh ? '本地资料尚未读取完成，请稍后再试。' : 'Local information is still loading. Please wait.');
    if (pendingArchive) throw new Error(zh ? '请先重试存档已有响应，再继续对话。' : 'archive the retained response before continuing.');
    const confirmedWindow = nextPlanningWindow(planningAnchor, zone, rangeDays);
    const schedule = !demo && purpose === 'program' ? { startDate: confirmedWindow.startDate, endDate: confirmedWindow.endDate, dates: confirmedSlots.map(slot => slot.date), schedule: confirmedSlots } : purpose === 'refine' && candidate ? { startDate: candidate.startDate, endDate: candidate.endDate, dates: candidate.days.map(day => day.date), ...(candidate.days.every(day => day.startTime && day.durationMinutes) ? { schedule: candidate.days.map(day => ({ date: day.date, startTime: day.startTime!, durationMinutes: day.durationMinutes! })) } : {}) } : { startDate, endDate, dates };
    const goalAnswer = state.onboarding?.answers.goal; const goal = (purpose === 'refine' ? candidate?.goal : (purpose === 'understand' || purpose === 'clarify' ? draft.trim() || summary.trim() : summary.trim() || draft.trim()) || (goalAnswer?.status === 'answered' ? String(goalAnswer.value) : ''));
    if (!goal) throw new Error(zh ? '先填写目标或想法。' : 'enter a goal or thought first.');
    if ((purpose === 'program' || purpose === 'refine') && (!schedule.dates.length || !schedule.startDate || !schedule.endDate || !direct && !understandingConfirmed)) throw new Error(zh ? '请填写起止日期，并在日历中至少选择一个具体训练日期。' : 'Enter the phase range and select at least one training date in the calendar.');
    if (purpose === 'refine' && (!candidate || !draft.trim())) throw new Error(zh ? '填写候选调整想法。' : 'enter your requested revision.');
    const bodyKeys = ['age', 'biologicalSex', 'heightCm', 'weightKg', 'waistCm', 'bodyFatPercent'];
    const planning = purpose === 'program' || purpose === 'refine';
    const answers = state.onboarding?.answers ?? {};
    const conditions: GuidedSendingScope['conditions'] = demo ? {} : { sessionMinutes, usualStartTime: usualTime }; const body: NonNullable<GuidedSendingScope['body']> = {};
    for (const [key, answer] of Object.entries(answers)) {
      if (key === 'goal') continue;
      if (bodyKeys.includes(key)) { if (planning && includeBody) body[key] = answer; } else conditions[key] = answer;
    }
    if (!demo && (purpose === 'understand' || purpose === 'clarify')) {
      const current = await guidedService.read();
      const planRequests = new Set(current.messages.filter(message => message.candidateId).map(message => message.requestId));
      conditions.priorDialogue = current.messages.filter(message => message.requestId && !planRequests.has(message.requestId)).slice(-8).map(({ role, content }) => ({ role, content }));
      conditions.planningWindow = { ...nextPlanningWindow(planningAnchor, zone, rangeDays), timeZone: zone };
      conditions.sessionMinutes = sessionMinutes; conditions.usualStartTime = usualTime;
    }
    if (clarificationAnswer.trim()) conditions.dialogueAnswer = clarificationAnswer.trim();
    if (purpose === 'refine' && candidate) conditions.candidateReference = { name: candidate.name, days: candidate.days, explanation: candidate.explanation };
    const dependencies = await guidedService.captureDependencies();
    if (dependencies.onboardingSnapshot !== JSON.stringify(answers)) throw new Error(zh ? '引导条件已更新，请重新打开预览。' : 'onboarding changed; reopen the preview.');
    const input = { version: 'guided-dialogue-v1' as const, conversationId, restoreGeneration: generation, purpose, locale, scope: { goal, conditions, ...(planning && includeBody ? { body } : {}), ...(planning && includeHistory ? { history: await historySnapshot() } : {}) },
      ...((purpose === 'program' || purpose === 'refine') ? { ...schedule, dates: [...schedule.dates].sort() } : {}), timeZone: zone, confirmedSummary: (purpose === 'refine' ? candidate?.goal : summary) || goal,
      ...(purpose === 'refine' && candidate ? { refinement: draft.trim(), candidateId: candidate.id } : {}) };
    const request = { ...input, requestId: crypto.randomUUID(), inputSnapshot: guidedInputSnapshot(input) };
    confirmGuidedSending(request);
    if (epoch !== inputEpoch.current) throw new Error('STALE_INPUT');
    const prepared = { request, dependencies: JSON.stringify(dependencies), epoch, planContext: await guidedService.capturePlanContext() };
    if (!direct) { setPreviewDependencies(prepared.dependencies); setSendScope(request); }
    return prepared;
  }
  async function sendDirect(purpose: GuidedDialogueRequest['purpose']) {
    if (pendingArchive) throw new Error(zh ? '请先重试存档已有响应。' : 'Archive the retained response first.');
    if (!qualification?.aiEnabled || qualification.reconciliationRequired || checkingQualification) throw new Error('QUALIFICATION_REQUIRED');
    if (!demo && purpose === 'program' && !readyToSchedule) throw new Error('CONFIRMATION_REQUIRED');
    const retained = directAttempt.current;
    const attempt = retained && retained.request.purpose === purpose ? retained : await prepareSending(purpose, true);
    if (attempt.epoch !== inputEpoch.current) throw new Error('STALE_INPUT');
    directAttempt.current = attempt; setAdopted(false);
    try {
      setPlanning(attempt.request.purpose === 'program' || attempt.request.purpose === 'refine');
      const result = await sendReal(attempt.request, attempt.dependencies, attempt.planContext);
      if (result?.response.purpose === 'understand' && result.response.uncertainties.length === 0) {
        if (attempt.epoch !== inputEpoch.current) throw new Error('STALE_INPUT');
        setReadyToSchedule(true); setConfirmedSlots([]);
      }
      directAttempt.current = undefined;
      if (attempt.epoch === inputEpoch.current) { setDraft(''); setClarificationAnswer(''); }
    } finally { setPlanning(false); }
  }
  async function sendReal(preparedRequest = sendScope, preparedDependencies = previewDependencies, expectedPlanContext?: string) {
    if (!preparedRequest || pendingArchive) return;
    const request = preparedRequest;
    const dependencies = await guidedService.captureDependencies();
    if (JSON.stringify(dependencies) !== preparedDependencies || request.restoreGeneration !== currentGeneration.current ||
        (request.scope.history !== undefined && request.scope.history !== await historySnapshot())) throw new Error('STALE_INPUT');
    const active = { requestId: request.requestId, abort: new AbortController(), cancelled: false };
    inFlight.current = active; setSending(true);
    const epoch = inputEpoch.current;
    try {
      const result = await sendGuidedDialogue(request, confirmGuidedSending(request), active.abort.signal);
      setAccountingPending(result.accounting === 'pending');
      // Obtain current admission state. A successful response is not a fee settlement.
      let status: Awaited<ReturnType<typeof refreshQualification>> | undefined;
      try { status = await refreshQualification(); } catch { setQualification(undefined); }
      const metadata = await repository.readMetadata();
      if (active.cancelled || epoch !== inputEpoch.current || request.restoreGeneration !== (metadata.restoreGeneration ?? 0) ||
          JSON.stringify(await guidedService.captureDependencies()) !== preparedDependencies) throw new Error('STALE_INPUT');
      const response = result.response;
      setSendScope(undefined);
      if (response.purpose === 'refused') { directAttempt.current = undefined; await archiveRefusal(request, response.message); return { response, status }; }
      if (response.purpose === 'understand') { setSummary(response.summary); setResponseText(response.uncertainties.join('\n')); setUnderstandingConfirmed(false); }
      if (response.purpose === 'clarify') setQuestion(response.question);
      const nextCandidate = 'candidate' in response ? { ...response.candidate, ...dependencies } : undefined;
      if (nextCandidate) {
        if (request.schedule) setReadyToSchedule(false);
        setLocalCandidate(nextCandidate); setSummary(nextCandidate.goal); setStartDate(nextCandidate.startDate); setEndDate(nextCandidate.endDate);
        setDates(nextCandidate.days.map(day => day.date)); setUnderstandingConfirmed(true); directAttempt.current = undefined; setDraft('');
      }
      const content = response.purpose === 'understand' ? [response.summary, ...response.uncertainties].join('\n')
        : response.purpose === 'clarify' ? response.question : nextCandidate ? `${nextCandidate.name}\n${nextCandidate.explanation}` : '';
      const archive = { userMessage: mockUserMessage(request), message: mockMessage(request, content, nextCandidate?.id), ...(nextCandidate ? { candidate: nextCandidate } : {}) };
      setPendingArchive(archive); await saveMockArchive(archive);
      if (nextCandidate && request.schedule) {
        const current = await guidedService.read();
        await guidedService.applyCandidate(nextCandidate.id, current.revision, guidedServiceLimits.maxDays, expectedPlanContext);
        setSavedCandidate(nextCandidate); setLocalCandidate(undefined); setAdopted(true); setReadyToSchedule(false);
      }
      return { response, status };
    } catch (reason) {
      // Keep the attempted request identity; never silently invent a new paid request.
      if (reason instanceof Error && ['ACCOUNTING_PENDING', 'CONTROL_UNAVAILABLE', 'COST_BOUND_UNVERIFIED', 'RECONCILIATION_REQUIRED'].includes(reason.message)) {
        setAccountingPending(true); setQualification(undefined);
      }
      throw reason;
    } finally { if (inFlight.current === active) inFlight.current = undefined; setSending(false); }
  }
  async function cancelReal() {
    const active = inFlight.current; if (!active) return;
    active.cancelled = true; active.abort.abort(); setAccountingPending(true); setQualification(undefined);
    try { await control.current.cancel(active.requestId); } catch { /* Original request may already be submitted; accounting remains unknown. */ }
    setError(zh ? '已停止等待，费用仍需核算。本地训练不受影响。' : 'Stopped waiting; fees still require accounting. Local training remains available.');
  }
  async function sendFixture() {
    if (!demo) return sendReal();
    if (pendingArchive) throw new Error(zh ? '请先保存当前响应。' : 'save the retained response first.');
    if (!demo || !sendScope) throw new Error(zh ? '新的对话服务尚未启用。没有发送信息。' : 'the new dialogue service is disabled. nothing was sent.');
    const request = sendScope; const consent = confirmGuidedSending(request); const dependencies = await guidedService.captureDependencies();
    if (JSON.stringify(dependencies) !== previewDependencies || request.restoreGeneration !== generation || (request.scope.history !== undefined && request.scope.history !== await historySnapshot())) {
      setSendScope(undefined); throw new Error(zh ? '本地条件或历史已改变，请重新预览并确认。' : 'local conditions or history changed; preview and confirm again.');
    }
    if (request.purpose === 'understand' || request.purpose === 'clarify') {
      const identity = { version: request.version, requestId: request.requestId, conversationId: request.conversationId, inputSnapshot: request.inputSnapshot, restoreGeneration: request.restoreGeneration };
      const raw = await gateSyntheticResponse(request, () => request.purpose === 'understand'
        ? { ...identity, purpose: 'understand', summary: request.scope.goal, uncertainties: [zh ? '合成演示仅复述目标，尚未评估训练适用性。' : 'synthetic demo repeats the goal; suitability is unassessed.'] }
        : { ...identity, purpose: 'clarify', question: zh ? '对于这个目标，还有哪些时间或场地条件需要考虑？可跳过。' : 'what time or location constraints matter for this goal? you may skip.', field: 'conditions' });
      const response = await createGuidedDialogueMockClient(() => raw,
      { expectedDates: [], exerciseCatalog: exercises, limits: fixtureLimits, restoreGeneration: generation }).send(request, consent);
      if (response.purpose === 'refused') { await archiveRefusal(request, response.message); return; }
      if (response.purpose === 'understand') { setSummary(response.summary); setResponseText(response.uncertainties.join('\n')); setUnderstandingConfirmed(false); }
      if (response.purpose === 'clarify') setQuestion(response.question);
      const result = { userMessage: mockUserMessage(request), message: mockMessage(request, response.purpose === 'understand' ? `${response.summary}\n${response.uncertainties.join('\n')}` : response.purpose === 'clarify' ? response.question : 'Unexpected response') };
      setPendingArchive(result); setSendScope(undefined);
      await saveMockArchive(result); return;
    }
    const raw = await gateSyntheticResponse(request, () => {
    const bodyweight = exercises.find(item => item.metricType === 'reps' && item.equipment === 'none')!;
    const candidate: ProgramCandidate = { id: crypto.randomUUID(), name: zh ? '本地合成演示计划' : 'local synthetic demonstration', goal: request.scope.goal, startDate: request.startDate!, endDate: request.endDate!, timeZone: request.timeZone,
      days: request.dates!.map(date => ({ date, exercises: [{ exerciseId: bodyweight.id as ProgramCandidate['days'][number]['exercises'][number]['exerciseId'], order: 0, targetSets: [{ metricType: 'reps', reps: 8 }] }] })), explanation: (zh ? '固定合成样本，仅验证流程，不是模型建议或科学训练处方。' : 'fixed synthetic fixture for workflow validation, not model advice.') + (request.refinement ? `\n${zh ? '本次调整要求（仅记录，固定目标未改变）：' : 'revision request (recorded only; fixed targets unchanged): '}${request.refinement}` : ''), createdAt: new Date().toISOString(), restoreGeneration: generation, inputSnapshot: request.inputSnapshot, ...dependencies };
    return { version: request.version, requestId: request.requestId, conversationId: request.conversationId, inputSnapshot: request.inputSnapshot, restoreGeneration: request.restoreGeneration, purpose: request.purpose, candidate };
    });
    const response = await createGuidedDialogueMockClient(() => raw, { expectedDates: request.dates!, exerciseCatalog: exercises, limits: fixtureLimits, restoreGeneration: generation }).send(request, consent);
    if (response.purpose === 'refused') { await archiveRefusal(request, response.message); return; }
    if (!('candidate' in response)) throw new Error('Unexpected response');
    setLocalCandidate(response.candidate); setSendScope(undefined);
    const result = { userMessage: mockUserMessage(request), candidate: response.candidate, message: mockMessage(request, `${request.purpose}\n${response.candidate.name}\n${response.candidate.explanation}`, response.candidate.id) };
    setPendingArchive(result); await saveMockArchive(result);
  }
  if (!demo && !localReady) return <p role={error ? 'alert' : 'status'}>{error || (zh ? '正在读取本地资料…' : 'Loading local information…')}</p>;
  if (!demo && !state.onboarding?.completed) return <GuidedHome onboardingOnly />;
  return <div className="guided-page"><h1>{zh ? '一起制定计划' : 'plan together'}</h1>
    <p role="status">{demo ? (zh ? '本地合成演示，无网络或模型调用；示例限制为7个日期、31天范围，不代表生产支持。' : 'local synthetic demo; no network or model call. fixture limits are not production promises.') : (zh ? 'AI 由 Fitness 后台提供。发送前请核对本次范围；资料与训练仍保存在本机。' : 'AI is provided by the Fitness backend. Review each sending scope; profile and training stay on this device.')}</p>
    {!demo && <section className="guided-section"><h2>{zh ? 'AI 试用资格' : 'AI trial access'}</h2>
      <Link to="/trial">{zh ? '申请邀请码 / 延长试用资格' : 'Apply for an invitation / extend your trial'}</Link>
      <label>{zh ? '邀请码' : 'Invitation code'}<input value={invite} onChange={event => setInvite(event.target.value)} autoComplete="off" /></label>
      <button disabled={busy || !invite.trim()} onClick={() => void run(async () => { await control.current.redeem(invite.trim()); setInvite(''); await refreshQualification(); })}>{zh ? '兑换并查询' : 'Redeem and check'}</button>
      <button disabled={busy} onClick={() => void run(refreshQualification)}>{zh ? '查询资格与额度' : 'Check access and allowance'}</button>
      <p>{checkingQualification ? (zh ? '正在更新资格与额度…' : 'Updating access and allowance…') : qualification ? `${zh ? '本周期已用：理解 / 计划' : 'Used this period: understanding / plans'} ${qualification.used.understand}/${qualification.limits.understand} · ${qualification.used.generate}/${qualification.limits.generate}` : (zh ? '资格及额度查询失败，请重试' : 'Access and allowance are unknown')}</p>
      {qualification && !qualification.aiEnabled && <p>{aiStatusMessage('AI_DISABLED', locale)}</p>}
      {accountingPending && <p role="status">{aiStatusMessage('ACCOUNTING_PENDING', locale)}</p>}
      {sending && <button onClick={() => void cancelReal()}>{zh ? '停止等待' : 'Stop waiting'}</button>}
    </section>}
    {error && <p role="alert">{error}</p>}
    {demo && <label>{zh ? '合成主题判定注入（仅演示，不检测文本语义）' : 'synthetic topic decision injection (demo only; no semantic detection)'}<select value={mockTopicKind} onChange={event => { setMockTopicKind(event.target.value as GuidedTopicDecision['kind']); setSendScope(undefined); }}><option value="related">{zh ? '相关健身' : 'related fitness'}</option><option value="unrelated">{zh ? '无关请求' : 'unrelated request'}</option><option value="clarification_needed">{zh ? '需要澄清' : 'clarification needed'}</option><option value="safety_limit">{zh ? '诊断或治疗限制' : 'safety limit'}</option></select></label>}
    {pendingArchive && <section className="guided-section"><p>{zh ? '已返回的响应保留在当前页，尚未完整存档；刷新可能丢失。重试仅保存，不重新调用。' : 'The returned response is retained on this page but not fully archived; refresh may lose it. Retrying saves only.'}</p><pre>{pendingArchive.message.content}</pre><button disabled={busy} onClick={() => void run(() => saveMockArchive(pendingArchive))}>{zh ? '重试存档已有响应' : 'retry archiving existing response'}</button></section>}
    <section ref={thread} className="guided-section dialogue-thread" role="log" aria-label={zh ? '对话记录' : 'conversation'}>{state.messages.map(message => <article key={message.id} data-role={message.role}><span>{message.role === 'user' ? (zh ? '你' : 'you') : 'AI'} · <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</time></span><p>{message.content}</p></article>)}</section>
    {!localReady && <p role="status">{zh ? '正在读取本地资料…' : 'Loading local information…'}</p>}
    {!demo && <fieldset className="schedule-preferences" disabled={busy}><legend>{zh ? '计划范围与常用训练时间' : 'Planning range and usual training time'}</legend>
      <label>{zh ? '计划范围（1–14 天）' : 'Planning range (1–14 days)'}<select value={rangeDays} onChange={event => { setRangeDays(Number(event.target.value)); setConfirmedSlots([]); invalidate(); }}>{Array.from({length:14},(_,i) => <option key={i+1} value={i+1}>{i+1} {zh ? '天' : 'days'}</option>)}</select></label>
      <label>{zh ? '常用开始时间' : 'Usual start time'}<input type="time" required value={usualTime} onChange={event => { setUsualTime(event.target.value); invalidate(); }} /></label>
      <label>{zh ? '每次训练分钟数' : 'Minutes per session'}<input type="number" min="1" max="240" value={sessionMinutes} onChange={event => { const minutes = Number(event.target.value); setSessionMinutes(minutes); setConfirmedSlots(slots => slots.map(slot => ({...slot,durationMinutes:minutes}))); invalidate(); }} /></label>
    </fieldset>}
    <label>{zh ? '目标、补充或调整想法' : 'goal, clarification or changes'}<textarea disabled={!localReady} value={draft} onChange={event => { setDraft(event.target.value); setReadyToSchedule(false); invalidate(); }} /></label>
    {question && <><p>{demo ? (zh ? '合成追问：' : 'Synthetic question: ') : (zh ? '还想确认：' : 'One more question: ')}{question}</p><label>{zh ? '补充回答（可留空）' : 'optional clarification answer'}<textarea value={clarificationAnswer} onChange={event => { setClarificationAnswer(event.target.value); invalidate(); }} /></label></>}{responseText && <p>{responseText}</p>}
    {!demo && <><p>{zh ? '发送当前消息、最近的目标对话和训练条件。信息齐全后逐日确认训练时间，再生成计划；身体数据和训练历史仅在下方勾选后用于生成。' : 'Send shares your message, recent goal conversation and training conditions. When ready, confirm daily training times before generating a plan. Body data and training history are included for generation only if selected below.'}</p>
      <p id="chat-quota-notice"><strong>{zh ? '发送后使用 1 次理解额度；确认逐日时间并生成计划时，使用 1 次生成额度。修改计划使用 1 次生成额度。请求受理后计次，采用已有计划不扣次数。' : 'Sending uses 1 AI understanding allowance; confirming the schedule and generating a plan uses 1 generation allowance. Revising a plan uses 1 generation allowance. Accepted requests count; adopting a returned plan uses no allowance.'}</strong>{qualification && ` ${zh ? '本月剩余：' : 'Remaining this month: '}${Math.max(0, qualification.limits.understand - qualification.used.understand)} / ${Math.max(0, qualification.limits.generate - qualification.used.generate)} (${zh ? '理解 / 生成' : 'understanding / generation'})` }</p>
      <button className="dialogue-send" aria-describedby="chat-quota-notice" disabled={busy || !localReady || !draft.trim() || !qualification?.aiEnabled || qualification.reconciliationRequired || checkingQualification} onClick={() => void run(() => sendDirect('understand'))}>{planning ? (zh ? '正在生成计划…' : 'Generating plan…') : sending ? (zh ? '正在整理目标…' : 'Understanding…') : (zh ? '发送' : 'Send')}</button></>}
    {demo && <><button disabled={busy || !localReady} onClick={() => void run(() => prepareSending('understand'))}>{zh ? '预览理解目标的发送范围' : 'preview scope for understanding'}</button>
    <button disabled={busy || !localReady} onClick={() => void run(() => prepareSending('clarify'))}>{zh ? '预览必要追问的发送范围' : 'preview scope for clarification'}</button></>}
    <button disabled={busy || !draft.trim()} onClick={() => void run(async () => { await guidedService.appendMessage({ id: crypto.randomUUID(), conversationId, role: 'user', content: draft.trim(), createdAt: new Date().toISOString() }, state.revision); if (demo) setSummary(draft.trim()); setDraft(''); invalidate(); })}>{zh ? '保存想法（不外发）' : 'save your thoughts locally'}</button>
    <details className="guided-section"><summary>{demo ? (zh ? '核对目标和具体日期' : 'review the goal and exact dates') : (zh ? '目标与可选资料' : 'Goal and optional information')}</summary>
      <label>{zh ? '目标理解' : 'goal interpretation'}<textarea value={summary} onChange={event => { setSummary(event.target.value); invalidate(); }} /></label>
      {demo && <><button disabled={!summary.trim() || busy} onClick={() => setUnderstandingConfirmed(true)}>{zh ? '确认理解' : 'confirm interpretation'}</button>
      <label>{zh ? '开始日期' : 'start date'}<input type="date" value={startDate} onChange={event => { setStartDate(event.target.value); invalidate(); }} /></label>
      <label>{zh ? '结束日期' : 'end date'}<input type="date" value={endDate} onChange={event => { setEndDate(event.target.value); invalidate(); }} /></label>
      <p>{zone}</p><DateCalendar locale={locale} today={dateInZone(Date.now(), zone)} selected={dates} onChange={value => { setDates(value); invalidate(); }} onActive={() => {}} occupied={[]} />
      <p>{dates.join(', ')}</p></>}<label><input type="checkbox" checked={includeBody} onChange={event => { setIncludeBody(event.target.checked); invalidate(); }} />{zh ? '本次包含已提供的身体信息' : 'include supplied body information this time'}</label>
      <p>{zh ? '包括已提供的年龄、生理性别回答及身体数值。默认不包含；仅勾选后在生成或调整计划时发送。' : 'Includes supplied age, biological sex response and body measurements. Excluded by default; sent only when selected for plan generation or revision.'}</p>
      <label><input type="checkbox" checked={includeHistory} onChange={event => { setIncludeHistory(event.target.checked); invalidate(); }} />{zh ? '生成时包含所选范围的训练、组记录和体重（含未完成状态，可选）' : 'include training, sets and weights in the selected range for generation (including unfinished states; optional)'}</label>
      {includeHistory && <fieldset><legend>{zh ? '本次历史范围，默认最近28天' : 'history scope, last 28 days by default'}</legend>
        <label>{zh ? '历史开始日期' : 'history from'}<input type="date" value={historyFrom} onChange={event => { setHistoryFrom(event.target.value); invalidate(); }} /></label>
        <label>{zh ? '历史结束日期' : 'history to'}<input type="date" value={historyTo} onChange={event => { setHistoryTo(event.target.value); invalidate(); }} /></label>
      </fieldset>}
      {demo && <button disabled={busy || !understandingConfirmed} onClick={() => void run(() => prepareSending())}>{zh ? '预览本次发送范围' : 'preview sending scope'}</button>}

    </details>
    {!demo && readyToSchedule && <ScheduleConfirmation locale={locale} dates={nextPlanningWindow(planningAnchor, zone, rangeDays).dates} slots={confirmedSlots} usualTime={usualTime} durationMinutes={sessionMinutes} disabled={busy || !qualification?.aiEnabled || !!qualification.reconciliationRequired || checkingQualification} onChange={slots => { setConfirmedSlots(slots); invalidate(); }} onConfirm={() => void run(() => sendDirect('program'))} />}
    {!demo && <p>{zh ? '计划范围（1–14 天）：' : 'Default planning window: '}{nextPlanningWindow(planningAnchor, zone, rangeDays).startDate} → {nextPlanningWindow(planningAnchor, zone, rangeDays).endDate} · {zone}。{zh ? '选择训练日并确认时间后，AI 按目标和约束生成内容。' : 'Choose training dates and confirm times, then AI generates the training content.'}</p>}
    {adopted && <p role="status">{zh ? '计划已采用，可返回记录面板开始训练。' : 'Plan adopted. Return to the dashboard to start training.'}</p>}
    {sendScope && <section className="guided-section"><h2>{zh ? '本次发送范围' : 'sending scope'}</h2><p>{sendScope.purpose}</p><pre>{JSON.stringify(sendScope.scope, null, 2)}</pre>{sendScope.refinement && <p>{sendScope.refinement}</p>}<p>{sendScope.startDate} → {sendScope.endDate} · {sendScope.timeZone}</p><p>{sendScope.dates?.join(', ')}</p>
      <button disabled={busy || !demo && (!qualification?.aiEnabled || qualification.reconciliationRequired)} onClick={() => void run(sendFixture)}>{zh ? '确认发送' : 'confirm sending'}</button><button onClick={invalidate}>{zh ? '返回' : 'back'}</button></section>}
    {candidate && <section className="guided-section"><h2>{demo ? (zh ? '完整候选，尚未生效' : 'complete candidate, not active yet') : (zh ? '你的训练计划' : 'Your training plan')}</h2>
      {demo ? <ProgramDashboard locale={locale} title={candidate.name} status="candidate" startDate={candidate.startDate} endDate={candidate.endDate} elapsedDays={0} totalDays={(Date.parse(candidate.endDate) - Date.parse(candidate.startDate)) / 86400000 + 1} completedWorkouts={0} plannedWorkouts={candidate.days.length} todayLabel={zh ? '确认前不会更改当前计划' : 'the current plan is unchanged until confirmation'} rationale={candidate.explanation} /> : <><h3>{candidate.name}</h3><p>{candidate.goal}</p><p>{candidate.startDate} → {candidate.endDate} · {candidate.timeZone} · {candidate.days.length} {zh ? '个训练日' : 'training days'}</p><p className="candidate-notes">{candidate.explanation}</p><p>{adopted ? (zh ? '已保存到训练日历。' : 'Saved to your training calendar.') : (zh ? '确认采用后加入训练日历。' : 'Adopt this plan to add it to your training calendar.')}</p></>}
      {[...candidate.days].sort((a, b) => a.date.localeCompare(b.date)).map(day => <article className="candidate-day" key={day.date}><h3>{day.date}{day.startTime && ` · ${day.startTime} · ${day.durationMinutes} min`}</h3>{[...day.exercises].sort((a, b) => a.order - b.order).map(item => { const exercise = exercises.find(exercise => exercise.id === item.exerciseId); return <div key={item.order}><h4>{item.order + 1}. {exercise?.name[locale]}</h4><p>{item.targetSets.length} {zh ? '组' : 'sets'}</p><ol>{formatGuidedTargets(item.targetSets, locale, item.setTimings).map((target, index) => <li key={index}>{target}</li>)}</ol>{item.notes && <p className="candidate-notes">{item.notes}</p>}{exercise && <details><summary>{zh ? '动作步骤与注意事项（动作目录）' : 'Movement guidance (exercise catalog)'}</summary><ol>{exercise.steps[locale].map((step, index) => <li key={index}>{step}</li>)}</ol><p>{exercise.cautions[locale].join(' ')}</p></details>}</div>; })}</article>)}
      {demo && <button disabled={busy} onClick={() => { setSummary(candidate.goal); setStartDate(candidate.startDate); setEndDate(candidate.endDate); setDates(candidate.days.map(day => day.date)); setUnderstandingConfirmed(false); setSendScope(undefined); }}>{zh ? '按此候选重新核对' : 'review this candidate again'}</button>}
      <button disabled={busy || adopted || state.programs.some(program => program.candidateId === candidate.id) || demo && (!understandingConfirmed || !candidateMatchesReview)} onClick={() => void run(async () => { if (demo && (!understandingConfirmed || !candidateMatchesReview)) throw new Error(zh ? '目标或日期已变化，请重新核对候选。' : 'goal or dates changed; review the candidate again.'); const before = await guidedService.read(); if (!before.candidates.some(item => item.id === candidate.id)) await guidedService.retainCandidate(candidate, before.revision); const current = await guidedService.read(); await guidedService.applyCandidate(candidate.id, current.revision, demo ? fixtureLimits.maxDays : guidedServiceLimits.maxDays); setLocalCandidate(undefined); setAdopted(true); })}>{demo ? (zh ? '确认完整计划' : 'confirm complete plan') : (adopted || state.programs.some(program => program.candidateId === candidate.id) ? (zh ? '计划已保存' : 'Plan saved') : (zh ? '采用计划' : 'Adopt plan'))}</button>
      {demo ? <button disabled={busy || !draft.trim() || !understandingConfirmed} onClick={() => void run(() => prepareSending('refine'))}>{zh ? '预览候选调整的发送范围' : 'preview scope for candidate revision'}</button> : <button aria-describedby="chat-quota-notice" disabled={busy || !draft.trim() || !qualification?.aiEnabled || qualification.reconciliationRequired || checkingQualification} onClick={() => void run(() => sendDirect('refine'))}>{zh ? '按当前要求调整计划' : 'Revise plan with these changes'}</button>}
      {localCandidate && !state.candidates.some(item => item.id === localCandidate.id) && <><p>{zh ? '候选保留在当前页，尚未保存成功；重试只保存已有内容。' : 'candidate retained on this page; saving has not succeeded. retry saves the existing content only.'}</p><button disabled={busy} onClick={() => void run(() => guidedService.retainCandidate(localCandidate, state.revision))}>{zh ? '重试保存候选' : 'retry saving candidate'}</button></>}
      <p>{zh ? '候选修改通过对话继续提出；不会恢复手动自定义课表。' : 'request revisions through dialogue; there is no manual custom-plan editor.'}</p>
    </section>}
    <Link to="/">{zh ? '返回记录面板' : 'return to dashboard'}</Link>
  </div>;
}
