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
import { targetText } from '../components/ExerciseTargets';
import { dateInZone } from '../../application/progress';
import { guidedInputSnapshot, confirmGuidedSending, createGuidedDialogueMockClient, guidedCandidateMatchesReview } from '../../ai/guided-dialogue';
import type { GuidedDialogueRequest, GuidedSendingScope } from '../../domain/guided-ai-contracts';
import { executeGuidedTopicDecision, GUIDED_TOPIC_POLICY_VERSION, type GuidedTopicDecision } from '../../backend/guided-topic-policy';
import { sendGuidedDialogue } from '../../ai/guided-transport';
import { createFetchAiClient } from '../../ai/client';
import { statusFeedback as aiStatusMessage } from '../../ai/status-feedback';
import { guidedServiceLimits } from '../../backend/guided-provider';

// This switch is a local integration fixture, never a production model implementation.
const demo = import.meta.env.DEV && import.meta.env.VITE_GUIDED_DEMO === '1';
const fixtureLimits = { maxDays: 7, maxRangeDays: 31, maxExercisesPerDay: 4, maxSetsPerExercise: 4, maxInputBytes: 32768, maxOutputBytes: 65536 };
export function GuidedDialoguePage() {
  const { i18n } = useTranslation(); const locale: 'zh' | 'en' = i18n.resolvedLanguage === 'zh' ? 'zh' : 'en'; const zh = locale === 'zh';
  const [state, setState] = useState<GuidedState>(emptyGuidedState); const [draft, setDraft] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const control = useRef(createFetchAiClient());
  const [invite, setInvite] = useState('');
  const [qualification, setQualification] = useState<Awaited<ReturnType<typeof control.current.status>>>();
  const [accountingPending, setAccountingPending] = useState(false);
  const [sending, setSending] = useState(false);
  const [localReady, setLocalReady] = useState(false);
  const inFlight = useRef<{ requestId: string; abort: AbortController; cancelled: boolean } | undefined>(undefined);
  const actionLock = useRef(false);
  const inputEpoch = useRef(0);
  const currentGeneration = useRef(0);
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
  const candidate = localCandidate ?? [...state.candidates].reverse().find(item => !state.programs.some(program => program.candidateId === item.id));
  const candidateMatchesReview = Boolean(candidate && guidedCandidateMatchesReview(candidate, { goal: summary, startDate, endDate, timeZone: zone, dates }));
  useEffect(() => {
    setLocalReady(false);
    let live = true; let stop = () => {};
    void profileService.initialize(locale).then(() => { if (!live) return; const subscription = liveQuery(async () => ({ state: await guidedService.read(), profile: await profileService.getProfile(), metadata: await database.metadata.toCollection().first() })).subscribe({ next: result => { setState(result.state); if (result.profile) setZone(result.profile.timeZone); setGeneration(result.metadata?.restoreGeneration ?? 0); setLocalReady(true); }, error: reason => { setLocalReady(false); setError(String(reason)); } }); stop = () => subscription.unsubscribe(); }).catch(reason => { if (live) setError(String(reason)); });
    return () => { live = false; stop(); };
  }, [locale]);
  currentGeneration.current = generation;
  useEffect(() => () => { if (inFlight.current) { inFlight.current.cancelled = true; inFlight.current.abort.abort(); } }, []);
  async function refreshQualification() { setQualification(undefined); const status = await control.current.status(); setQualification(status); setAccountingPending(Boolean(status.pending)); }
  async function run(operation: () => Promise<unknown>) { if (actionLock.current) return; actionLock.current = true; setBusy(true); setError(''); try { await operation(); } catch (reason) { const code = reason instanceof Error ? reason.message : String(reason); setError(!demo && /^[A-Z_]+$/.test(code) ? aiStatusMessage(code, locale) : code); } finally { actionLock.current = false; setBusy(false); } }
  function invalidate() { inputEpoch.current++; setUnderstandingConfirmed(false); setSendScope(undefined); }
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
      request.confirmedSummary !== request.scope.goal ? request.confirmedSummary : '',
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
  async function prepareSending(purpose: GuidedDialogueRequest['purpose'] = 'program') {
    if (!localReady) throw new Error(zh ? '本地资料尚未读取完成，请稍后再试。' : 'Local information is still loading. Please wait.');
    if (pendingArchive) throw new Error(zh ? '请先重试存档已有响应，再继续对话。' : 'archive the retained response before continuing.');
    const goalAnswer = state.onboarding?.answers.goal; const goal = purpose === 'refine' ? candidate?.goal : (purpose === 'understand' || purpose === 'clarify' ? draft.trim() || summary.trim() : summary.trim() || draft.trim()) || (goalAnswer?.status === 'answered' ? String(goalAnswer.value) : '');
    if (!goal) throw new Error(zh ? '先填写目标或想法。' : 'enter a goal or thought first.');
    if ((purpose === 'program' || purpose === 'refine') && (!dates.length || !startDate || !endDate || !understandingConfirmed)) throw new Error(zh ? '先确认理解、起止日期和具体训练日期。' : 'confirm interpretation, phase range and exact training dates first.');
    if (purpose === 'refine' && (!candidate || !draft.trim())) throw new Error(zh ? '填写候选调整想法。' : 'enter your requested revision.');
    const bodyKeys = ['age', 'biologicalSex', 'heightCm', 'weightKg', 'waistCm', 'bodyFatPercent'];
    const planning = purpose === 'program' || purpose === 'refine';
    const answers = state.onboarding?.answers ?? {};
    const conditions: GuidedSendingScope['conditions'] = {}; const body: NonNullable<GuidedSendingScope['body']> = {};
    for (const [key, answer] of Object.entries(answers)) {
      if (!planning) continue;
      if (key === 'goal') continue;
      if (bodyKeys.includes(key)) { if (includeBody) body[key] = answer; } else conditions[key] = answer;
    }
    if (clarificationAnswer.trim()) conditions.dialogueAnswer = clarificationAnswer.trim();
    if (purpose === 'refine' && candidate) conditions.candidateReference = { name: candidate.name, days: candidate.days, explanation: candidate.explanation };
    const dependencies = await guidedService.captureDependencies();
    if (dependencies.onboardingSnapshot !== JSON.stringify(answers)) throw new Error(zh ? '引导条件已更新，请重新打开预览。' : 'onboarding changed; reopen the preview.');
    const input = { version: 'guided-dialogue-v1' as const, conversationId, restoreGeneration: generation, purpose, locale, scope: { goal, conditions, ...(planning && includeBody ? { body } : {}), ...(planning && includeHistory ? { history: await historySnapshot() } : {}) },
      ...((purpose === 'program' || purpose === 'refine') ? { startDate, endDate, dates: [...dates].sort() } : {}), timeZone: zone, confirmedSummary: summary || goal,
      ...(purpose === 'refine' && candidate ? { refinement: draft.trim(), candidateId: candidate.id } : {}) };
    const request = { ...input, requestId: crypto.randomUUID(), inputSnapshot: guidedInputSnapshot(input) };
    confirmGuidedSending(request); setPreviewDependencies(JSON.stringify(dependencies)); setSendScope(request);
  }
  async function sendReal() {
    if (!sendScope || pendingArchive) return;
    const request = sendScope;
    const dependencies = await guidedService.captureDependencies();
    if (JSON.stringify(dependencies) !== previewDependencies || request.restoreGeneration !== currentGeneration.current ||
        (request.scope.history !== undefined && request.scope.history !== await historySnapshot())) throw new Error('STALE_INPUT');
    const active = { requestId: request.requestId, abort: new AbortController(), cancelled: false };
    inFlight.current = active; setSending(true);
    const epoch = inputEpoch.current;
    try {
      const result = await sendGuidedDialogue(request, confirmGuidedSending(request), active.abort.signal);
      setAccountingPending(result.accounting === 'pending');
      // Obtain current admission state. A successful response is not a fee settlement.
      try { await refreshQualification(); } catch { setQualification(undefined); }
      const metadata = await repository.readMetadata();
      if (active.cancelled || epoch !== inputEpoch.current || request.restoreGeneration !== (metadata.restoreGeneration ?? 0) ||
          JSON.stringify(await guidedService.captureDependencies()) !== previewDependencies) throw new Error('STALE_INPUT');
      const response = result.response;
      setSendScope(undefined);
      if (response.purpose === 'refused') { await archiveRefusal(request, response.message); return; }
      if (response.purpose === 'understand') { setSummary(response.summary); setResponseText(response.uncertainties.join('\n')); setUnderstandingConfirmed(false); }
      if (response.purpose === 'clarify') setQuestion(response.question);
      const nextCandidate = 'candidate' in response ? { ...response.candidate, ...dependencies } : undefined;
      if (nextCandidate) setLocalCandidate(nextCandidate);
      const content = response.purpose === 'understand' ? [response.summary, ...response.uncertainties].join('\n')
        : response.purpose === 'clarify' ? response.question : nextCandidate ? `${nextCandidate.name}\n${nextCandidate.explanation}` : '';
      const archive = { userMessage: mockUserMessage(request), message: mockMessage(request, content, nextCandidate?.id), ...(nextCandidate ? { candidate: nextCandidate } : {}) };
      setPendingArchive(archive); await saveMockArchive(archive);
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
  return <div className="guided-page"><h1>{zh ? '一起制定计划' : 'plan together'}</h1>
    <p role="status">{demo ? (zh ? '本地合成演示，无网络或模型调用；示例限制为7个日期、31天范围，不代表生产支持。' : 'local synthetic demo; no network or model call. fixture limits are not production promises.') : (zh ? 'AI 由 Fitness 后台提供。发送前请核对本次范围；资料与训练仍保存在本机。' : 'AI is provided by the Fitness backend. Review each sending scope; profile and training stay on this device.')}</p>
    {!demo && <section className="guided-section"><h2>{zh ? 'AI 试用资格' : 'AI trial access'}</h2>
      <label>{zh ? '邀请码' : 'Invitation code'}<input value={invite} onChange={event => setInvite(event.target.value)} autoComplete="off" /></label>
      <button disabled={busy || !invite.trim()} onClick={() => void run(async () => { await control.current.redeem(invite.trim()); setInvite(''); await refreshQualification(); })}>{zh ? '兑换并查询' : 'Redeem and check'}</button>
      <button disabled={busy} onClick={() => void run(refreshQualification)}>{zh ? '查询资格与额度' : 'Check access and allowance'}</button>
      <p>{qualification ? `${zh ? '本周期已用：理解 / 计划' : 'Used this period: understanding / plans'} ${qualification.used.understand}/${qualification.limits.understand} · ${qualification.used.generate}/${qualification.limits.generate}` : (zh ? '资格及额度尚未确认' : 'Access and allowance are unknown')}</p>
      {qualification && !qualification.aiEnabled && <p>{aiStatusMessage('AI_DISABLED', locale)}</p>}
      {accountingPending && <p role="status">{aiStatusMessage('ACCOUNTING_PENDING', locale)}</p>}
      {sending && <button onClick={() => void cancelReal()}>{zh ? '停止等待' : 'Stop waiting'}</button>}
    </section>}
    {error && <p role="alert">{error}</p>}
    {demo && <label>{zh ? '合成主题判定注入（仅演示，不检测文本语义）' : 'synthetic topic decision injection (demo only; no semantic detection)'}<select value={mockTopicKind} onChange={event => { setMockTopicKind(event.target.value as GuidedTopicDecision['kind']); setSendScope(undefined); }}><option value="related">{zh ? '相关健身' : 'related fitness'}</option><option value="unrelated">{zh ? '无关请求' : 'unrelated request'}</option><option value="clarification_needed">{zh ? '需要澄清' : 'clarification needed'}</option><option value="safety_limit">{zh ? '诊断或治疗限制' : 'safety limit'}</option></select></label>}
    {pendingArchive && <section className="guided-section"><p>{zh ? '已返回的响应保留在当前页，尚未完整存档；刷新可能丢失。重试仅保存，不重新调用。' : 'The returned response is retained on this page but not fully archived; refresh may lose it. Retrying saves only.'}</p><pre>{pendingArchive.message.content}</pre><button disabled={busy} onClick={() => void run(() => saveMockArchive(pendingArchive))}>{zh ? '重试存档已有响应' : 'retry archiving existing response'}</button></section>}
    <section className="guided-section" aria-label={zh ? '对话记录' : 'conversation'}>{state.messages.map(message => <article key={message.id}><span>{message.role === 'user' ? (zh ? '你' : 'you') : 'ai'} · <time>{message.createdAt}</time></span><p>{message.content}</p></article>)}</section>
    {!localReady && <p role="status">{zh ? '正在读取本地资料…' : 'Loading local information…'}</p>}
    <label>{zh ? '目标、补充或调整想法' : 'goal, clarification or changes'}<textarea disabled={!localReady} value={draft} onChange={event => { setDraft(event.target.value); invalidate(); }} /></label>
    {question && <><p>{demo ? (zh ? '合成追问：' : 'Synthetic question: ') : (zh ? '还想确认：' : 'One more question: ')}{question}</p><label>{zh ? '补充回答（可留空）' : 'optional clarification answer'}<textarea value={clarificationAnswer} onChange={event => { setClarificationAnswer(event.target.value); invalidate(); }} /></label></>}{responseText && <p>{responseText}</p>}
    <button disabled={busy || !localReady} onClick={() => void run(() => prepareSending('understand'))}>{zh ? '预览理解目标的发送范围' : 'preview scope for understanding'}</button>
    <button disabled={busy || !localReady} onClick={() => void run(() => prepareSending('clarify'))}>{zh ? '预览必要追问的发送范围' : 'preview scope for clarification'}</button>
    <button disabled={busy || !draft.trim()} onClick={() => void run(async () => { await guidedService.appendMessage({ id: crypto.randomUUID(), conversationId, role: 'user', content: draft.trim(), createdAt: new Date().toISOString() }, state.revision); setSummary(draft.trim()); setDraft(''); invalidate(); })}>{zh ? '保存想法（不外发）' : 'save your thoughts locally'}</button>
    <details className="guided-section"><summary>{zh ? '核对目标和具体日期' : 'review the goal and exact dates'}</summary>
      <label>{zh ? '目标理解' : 'goal interpretation'}<textarea value={summary} onChange={event => { setSummary(event.target.value); invalidate(); }} /></label>
      <button disabled={!summary.trim() || busy} onClick={() => setUnderstandingConfirmed(true)}>{zh ? '确认理解' : 'confirm interpretation'}</button>
      <label>{zh ? '开始日期' : 'start date'}<input type="date" value={startDate} onChange={event => { setStartDate(event.target.value); invalidate(); }} /></label>
      <label>{zh ? '结束日期' : 'end date'}<input type="date" value={endDate} onChange={event => { setEndDate(event.target.value); invalidate(); }} /></label>
      <p>{zone}</p><DateCalendar locale={locale} today={dateInZone(Date.now(), zone)} selected={dates} onChange={value => { setDates(value); invalidate(); }} onActive={() => {}} occupied={[]} />
      <p>{dates.join(', ')}</p><label><input type="checkbox" checked={includeBody} onChange={event => { setIncludeBody(event.target.checked); invalidate(); }} />{zh ? '本次包含已提供的身体信息' : 'include supplied body information this time'}</label>
      <p>{zh ? '包括已提供的年龄、生理性别回答及身体数值。默认不包含；请核对下方发送预览。' : 'Includes supplied age, biological sex response and body measurements. Excluded by default; check the sending preview below.'}</p>
      <label><input type="checkbox" checked={includeHistory} onChange={event => { setIncludeHistory(event.target.checked); invalidate(); }} />{zh ? '本次包含所选范围的训练、组记录和体重（含未完成状态；预览后确认，可拒绝）' : 'include training, sets and weights in the selected range (including unfinished states; optional, review before confirming)'}</label>
      {includeHistory && <fieldset><legend>{zh ? '本次历史范围，默认最近28天' : 'history scope, last 28 days by default'}</legend>
        <label>{zh ? '历史开始日期' : 'history from'}<input type="date" value={historyFrom} onChange={event => { setHistoryFrom(event.target.value); invalidate(); }} /></label>
        <label>{zh ? '历史结束日期' : 'history to'}<input type="date" value={historyTo} onChange={event => { setHistoryTo(event.target.value); invalidate(); }} /></label>
      </fieldset>}
      <button disabled={busy || !understandingConfirmed} onClick={() => void run(() => prepareSending())}>{zh ? '预览本次发送范围' : 'preview sending scope'}</button>
    </details>
    {sendScope && <section className="guided-section"><h2>{zh ? '本次发送范围' : 'sending scope'}</h2><p>{sendScope.purpose}</p><pre>{JSON.stringify(sendScope.scope, null, 2)}</pre>{sendScope.refinement && <p>{sendScope.refinement}</p>}<p>{sendScope.startDate} → {sendScope.endDate} · {sendScope.timeZone}</p><p>{sendScope.dates?.join(', ')}</p>
      <button disabled={busy || !demo && (!qualification?.aiEnabled || qualification.reconciliationRequired)} onClick={() => void run(sendFixture)}>{zh ? '确认发送' : 'confirm sending'}</button><button onClick={invalidate}>{zh ? '返回' : 'back'}</button></section>}
    {candidate && <section className="guided-section"><h2>{zh ? '完整候选，尚未生效' : 'complete candidate, not active yet'}</h2>
      <ProgramDashboard locale={locale} title={candidate.name} status="candidate" startDate={candidate.startDate} endDate={candidate.endDate} elapsedDays={0} totalDays={(Date.parse(candidate.endDate) - Date.parse(candidate.startDate)) / 86400000 + 1} completedWorkouts={0} plannedWorkouts={candidate.days.length} todayLabel={zh ? '确认前不会更改当前计划' : 'the current plan is unchanged until confirmation'} rationale={candidate.explanation} />
      {candidate.days.map(day => <article key={day.date}><h3>{day.date}</h3>{day.exercises.map(item => <div key={item.order}><p>{exercises.find(exercise => exercise.id === item.exerciseId)?.name[locale]}</p><ol>{item.targetSets.map((target, index) => <li key={index}>{targetText(target, locale)}</li>)}</ol></div>)}</article>)}
      <button disabled={busy} onClick={() => { setSummary(candidate.goal); setStartDate(candidate.startDate); setEndDate(candidate.endDate); setDates(candidate.days.map(day => day.date)); setUnderstandingConfirmed(false); setSendScope(undefined); }}>{zh ? '按此候选重新核对' : 'review this candidate again'}</button>
      <button disabled={busy || !understandingConfirmed || !candidateMatchesReview} onClick={() => void run(async () => { if (!understandingConfirmed || !candidateMatchesReview) throw new Error(zh ? '目标或日期已变化，请重新核对候选。' : 'goal or dates changed; review the candidate again.'); const before = await guidedService.read(); if (!before.candidates.some(item => item.id === candidate.id)) await guidedService.retainCandidate(candidate, before.revision); const current = await guidedService.read(); await guidedService.applyCandidate(candidate.id, current.revision, demo ? fixtureLimits.maxDays : guidedServiceLimits.maxDays); setLocalCandidate(undefined); })}>{zh ? '确认完整计划' : 'confirm complete plan'}</button>
      <button disabled={busy || !draft.trim() || !understandingConfirmed} onClick={() => void run(() => prepareSending('refine'))}>{zh ? '预览候选调整的发送范围' : 'preview scope for candidate revision'}</button>
      {localCandidate && !state.candidates.some(item => item.id === localCandidate.id) && <><p>{zh ? '候选保留在当前页，尚未保存成功；重试只保存已有内容。' : 'candidate retained on this page; saving has not succeeded. retry saves the existing content only.'}</p><button disabled={busy} onClick={() => void run(() => guidedService.retainCandidate(localCandidate, state.revision))}>{zh ? '重试保存候选' : 'retry saving candidate'}</button></>}
      <p>{zh ? '候选修改通过对话继续提出；不会恢复手动自定义课表。' : 'request revisions through dialogue; there is no manual custom-plan editor.'}</p>
    </section>}
    <Link to="/">{zh ? '返回记录面板' : 'return to dashboard'}</Link>
  </div>;
}
