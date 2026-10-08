import { AppIcon, StatusIcon } from '../components/AppIcon';
import { useEffect, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { guidedService } from '../../application/guided';
import { slotTasks } from '../../application/day-plans';
import { evaluateSlot } from '../../domain/day-slot-policy';
import { profileService } from '../../application/profile';
import type { BodyWeightObservation, LocalProfile } from '../../domain/models';
import { repository } from '../../persistence/repository';
import { captureGuidedHistory } from '../../application/guided-history';
import { type GuidedState, type ProgramCandidate } from '../../domain/guided-contracts';
import { guidedInputSnapshot, confirmGuidedSending } from '../../ai/guided-dialogue';
import type { GuidedDialogueRequest } from '../../domain/guided-ai-contracts';
import { sendGuidedDialogue } from '../../ai/guided-transport';
import { createFetchAiClient } from '../../ai/client';
import { statusFeedback } from '../../ai/status-feedback';
import { guidedServiceLimits } from '../../backend/guided-provider';
import { dateInZone } from '../../application/progress';
import { PlanDatePicker } from '../components/PlanDatePicker';
import { CandidateEditor } from '../components/guided/CandidateEditor';
import '../v31-ai.css';
import { localAgeAccess, answered } from '../../domain/onboarding-v4';
import { displayAnswer } from '../components/guided/onboarding-v4-content';

type Attempt = { request: GuidedDialogueRequest; dependencies: string; epoch: number };
type Slot = { date: string; startTime: string; durationMinutes: number; focus: string };
type Archive = { messages: GuidedState['messages']; candidate?: ProgramCandidate };
type OptionalBody = NonNullable<GuidedDialogueRequest['scope']['body']>;

/** Only explicit saved body fields; measurements supersede older profile/onboarding values. */
function optionalBody(profile: LocalProfile | undefined, data: GuidedState, weights: BodyWeightObservation[]): OptionalBody {
  const body: OptionalBody = {};
  for (const key of ['age', 'biologicalSex', 'heightCm', 'weightKg', 'waistCm', 'bodyFatPercent']) {
    const answer = data.onboarding?.answers[key];
    if (answer?.status === 'answered') body[key] = { value: answer.value, source: data.onboarding?.version === 4 ? 'onboarding-v4' : 'legacy-onboarding', recordedAt: data.onboarding!.updatedAt };
  }
  const preferences = profile?.trainingPreferences;
  if (data.onboarding?.version !== 4 && preferences?.heightCm !== undefined) body.heightCm = { value: preferences.heightCm, unit: 'cm', source: 'profile', recordedAt: preferences.updatedAt };
  if (data.onboarding?.version !== 4 && preferences?.weightGrams !== undefined) body.weightKg = { value: preferences.weightGrams / 1000, unit: 'kg', source: 'profile', recordedAt: preferences.updatedAt };
  const weight = [...weights].sort((a, b) => b.localDate.localeCompare(a.localDate) || b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id))[0];
  if (weight) body.weightKg = { value: weight.weightGrams / 1000, unit: 'kg', source: 'body-weight-observation', observedOn: weight.localDate, timeZone: weight.timeZone, recordedAt: weight.updatedAt };
  for (const kind of ['waist', 'bodyFat'] as const) {
    const observation = data.observations.filter(item => item.kind === kind).sort((a, b) => b.localDate.localeCompare(a.localDate) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0];
    if (observation) body[kind === 'waist' ? 'waistCm' : 'bodyFatPercent'] = { value: observation.value, unit: observation.unit, source: 'body-observation', observedOn: observation.localDate, timeZone: observation.timeZone, recordedAt: observation.createdAt, method: observation.method };
  }
  return body;
}
async function currentBody() {
  const [profile, data, weights] = await Promise.all([profileService.getProfile(), guidedService.read(), repository.db.bodyWeights.toArray()]);
  return optionalBody(profile, data, weights);
}

/** Four separate decisions: send goal, approve understanding, send plan, save locally. */
export function GuidedDialoguePage() {
  const location = useLocation();
  const { i18n } = useTranslation();
  const locale: 'zh' | 'en' = i18n.resolvedLanguage === 'zh' ? 'zh' : 'en'; const zh = locale === 'zh';
  const [body, setBody] = useState<OptionalBody>({});
  const [ageAccess, setAgeAccess] = useState<'adult'|'minor'|'unknown'>('unknown');
  const [v4, setV4] = useState(false);
  const [onboardingConfirmed, setOnboardingConfirmed] = useState(true);
  const [scheduleReviewed, setScheduleReviewed] = useState(true);
  const answerSnapshot = useRef<string | undefined>(undefined);
  const [ready, setReady] = useState(false); const [step, setStep] = useState(1);
  const [goal, setGoal] = useState(''); const [experience, setExperience] = useState('');
  const [venue, setVenue] = useState(''); const [equipment, setEquipment] = useState(''); const [restrictions, setRestrictions] = useState('');
  const [otherConditions, setOtherConditions] = useState('');
  const [minutes, setMinutes] = useState(30); const [usualTime, setUsualTime] = useState('19:00');
  const [summary, setSummary] = useState(''); const [questions, setQuestions] = useState<string[]>([]);
  const [goalConsent, setGoalConsent] = useState(false); const [approved, setApproved] = useState(false);
  const [slots, setSlots] = useState<Slot[]>(() => {
    const supplied: unknown = location.state?.selectedDates;
    return Array.isArray(supplied) ? [...new Set(supplied.filter((date): date is string => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort().slice(0, guidedServiceLimits.maxDays).map(date => ({date, startTime:'19:00', durationMinutes:30, focus:''})) : [];
  }); const [occupied, setOccupied] = useState<string[]>([]);
  const [zone, setZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [generation, setGeneration] = useState(0);
  const [includeBody, setIncludeBody] = useState(false); const [includeHistory, setIncludeHistory] = useState(false);
  const [historyFrom, setHistoryFrom] = useState(() => dateInZone(Date.now() - 27 * 86400000, zone));
  const [historyTo, setHistoryTo] = useState(() => dateInZone(Date.now(), zone));
  const [preview, setPreview] = useState<Attempt>(); const [sendConsent, setSendConsent] = useState(false);
  const [candidate, setCandidate] = useState<ProgramCandidate>(); const [usedHistory, setUsedHistory] = useState(false);
  const [saveConsent, setSaveConsent] = useState(false); const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [archive, setArchive] = useState<Archive>();
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false); const [checking, setChecking] = useState(true);
  const control = useRef(createFetchAiClient());
  const [qualification, setQualification] = useState<Awaited<ReturnType<typeof control.current.status>>>();
  const [accountingPending, setAccountingPending] = useState(false);
  const [conversationId] = useState(() => crypto.randomUUID());
  const initialized = useRef(false); const epoch = useRef(0); const currentGeneration = useRef(0);
  const lock = useRef(false); const attempt = useRef<Attempt | undefined>(undefined);
  const active = useRef<{ id: string; controller: AbortController; cancelled: boolean } | undefined>(undefined);
  currentGeneration.current = generation;

  function invalidateGoal() {
    epoch.current++; attempt.current = undefined; setGoalConsent(false); setApproved(false); setSummary(''); setQuestions([]);
    setPreview(undefined); setSendConsent(false); setSaveConsent(false); setNotice('');
  }
  function invalidatePlan() { epoch.current++; attempt.current = undefined; setPreview(undefined); setSendConsent(false); setSaveConsent(false); }
  async function run(work: () => Promise<unknown>) {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await work(); } catch (reason) {
      const code = reason instanceof Error ? reason.message : String(reason);
      setError(/^[A-Z_]+$/.test(code) ? statusFeedback(code, locale) : code);
    } finally { lock.current = false; setBusy(false); }
  }
  async function refreshQualification() {
    setChecking(true); setQualification(undefined);
    try { const result = await control.current.status(); setQualification(result); setAccountingPending(Boolean(result.pending)); return result; }
    finally { setChecking(false); }
  }
  useEffect(() => {
    let live = true; let stop = () => {};
    void profileService.initialize(locale).then(() => {
      if (!live) return;
      const subscription = liveQuery(async () => {
        const profile = await profileService.getProfile(); const data = await guidedService.read();
        const metadata = await repository.readMetadata(); const timeZone = profile?.timeZone ?? zone;
        const tasks = await slotTasks(repository, timeZone);
        const weights = await repository.db.bodyWeights.toArray();
        return { data, profile, body: optionalBody(profile, data, weights), timeZone, generation: metadata.restoreGeneration ?? 0,
          dates: [...new Set(tasks.map(task => task.projectedDate))].filter(date => evaluateSlot(tasks, date).occupants.length > 0) };
      }).subscribe({ next: result => {
        setV4(result.data.onboarding?.version === 4); setAgeAccess(localAgeAccess(result.data.onboarding?.answers ?? {}));
        setOnboardingConfirmed(result.data.onboarding?.version !== 4 || result.data.onboarding.completed);
        const signature = JSON.stringify(result.data.onboarding?.answers ?? {});
        if (answerSnapshot.current !== undefined && answerSnapshot.current !== signature) invalidateGoal();
        answerSnapshot.current = signature;
        setBody(result.body); setZone(result.timeZone); setGeneration(result.generation); setOccupied(result.dates); setReady(true);
        if (!initialized.current) {
          initialized.current = true;
          const answers = result.data.onboarding?.answers ?? {};
          const value = (key: string) => answers[key]?.status === 'answered' ? (result.data.onboarding?.version === 4 ? displayAnswer(answers[key].value, locale) : String(answers[key].value)) : '';
          const preferences = result.profile?.trainingPreferences;
          setGoal(preferences?.goal ?? value('goal')); setExperience(preferences?.experience ?? value('experience'));
          setVenue(preferences?.trainingLocation ?? value('location')); setEquipment(preferences?.availableEquipment?.join(', ') ?? value('equipment')); setRestrictions(preferences?.constraints ?? value('safety'));
          if (preferences?.sessionMinutes !== undefined) setMinutes(preferences.sessionMinutes);
          setOtherConditions([value('time'), value('preferences')].filter(Boolean).join(' · '));
          if (result.data.onboarding?.version === 4) {
            setGoal(value('goal')); setExperience(value('experience')); setVenue(value('location')); setEquipment(value('equipment')); setRestrictions(value('safety')); setOtherConditions(value('preferences'));
            const schedule = answered(answers, 'schedule');
            setScheduleReviewed(Array.isArray(schedule) && schedule.every(v=>v!==''));
            if (Array.isArray(schedule)) { if(schedule[0] !== '') setUsualTime(schedule[0].padStart(2,'0')+':00'); if(schedule[1] !== '') setMinutes(Number(schedule[1])); }
          }
        }
      }, error: reason => { setReady(false); setError(String(reason)); } });
      stop = () => subscription.unsubscribe();
    }).catch(reason => setError(String(reason)));
    return () => { live = false; stop(); };
  }, []);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void refreshQualification().catch(() => {}); };
    refresh(); window.addEventListener('focus', refresh); window.addEventListener('online', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  useEffect(() => { invalidatePlan(); setGoalConsent(false); setApproved(false); }, [locale, generation, zone]);
  useEffect(() => () => { epoch.current++; if (active.current) { active.current.cancelled = true; active.current.controller.abort(); } }, []);

  const conditions = { experience, venue, equipment, restrictions, otherConditions, sessionMinutes: minutes, usualStartTime: usualTime };
  const bodySnapshot = JSON.stringify(body);
  const hasBody = Object.keys(body).length > 0;
  useEffect(() => { if (includeBody) { invalidatePlan(); if (!hasBody) setIncludeBody(false); } }, [bodySnapshot]);
  const maxDates = Math.min(guidedServiceLimits.maxDays, qualification?.maxDays ?? guidedServiceLimits.maxDays);
  const ageBlocked = ageAccess === 'minor' || v4 && ageAccess !== 'adult';
  const canSend = ready && onboardingConfirmed && !ageBlocked && scheduleReviewed && !busy && !checking && !!qualification?.aiEnabled && !qualification.reconciliationRequired;
  const dates = slots.map(slot => slot.date).sort();
  const conflict = dates.some(date => occupied.includes(date));
  const candidateConflicts = candidate?.days.filter(day => occupied.includes(day.date)).map(day => day.date) ?? [];
  const title = zh ? ['确认目标', '选择日期', '核对外发', '预览并保存'] : ['Confirm goal', 'Choose dates', 'Review sending', 'Preview & save'];
  const historySnapshot = () => captureGuidedHistory(repository, historyFrom, historyTo, guidedServiceLimits.maxInputBytes);

  async function prepare(purpose: 'understand' | 'program'): Promise<Attempt> {
    if (!scheduleReviewed) throw new Error('CONFIRMATION_REQUIRED');
    if (!ready || !goal.trim()) throw new Error(zh ? '请先填写训练目标。' : 'Enter your training goal first.');
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(usualTime)) throw new Error(zh ? '请填写 1–240 分钟及有效开始时间。' : 'Enter 1–240 minutes and a valid start time.');
    const version = epoch.current; const dependencies = await guidedService.captureDependencies();
    if (purpose === 'program' && (!approved || !summary.trim() || !dates.length || dates.length > maxDates)) throw new Error('CONFIRMATION_REQUIRED');
    if (purpose === 'program' && conflict) throw new Error(zh ? '所选日期已有训练，请返回修改日期。' : 'A selected date is occupied. Review your dates.');
    if (purpose === 'program' && dates.length && (Date.parse(dates.at(-1)!) - Date.parse(dates[0])) / 86400000 + 1 > guidedServiceLimits.maxRangeDays) throw new Error('RANGE_TOO_LARGE');
    const input = { version: 'guided-dialogue-v1' as const, conversationId, restoreGeneration: currentGeneration.current, purpose, locale,
      ...(v4 ? { onboardingVersion: 4 as const, adultConfirmed: ageAccess === 'adult' } : {}),
      scope: { goal: goal.trim(), conditions: { ...conditions, ...(purpose === 'program' ? { dailyFocus: slots.map(({date, focus}) => ({date, focus})) } : {}) },
        ...(purpose === 'program' && includeBody && hasBody ? { body } : {}), ...(purpose === 'program' && includeHistory ? { history: await historySnapshot() } : {}) },
      ...(purpose === 'program' ? { startDate: dates[0], endDate: dates.at(-1)!, dates, schedule: slots.map(({date, startTime, durationMinutes}) => ({date, startTime, durationMinutes})) } : {}),
      timeZone: zone, confirmedSummary: purpose === 'program' ? summary : goal.trim() };
    const request = { ...input, requestId: crypto.randomUUID(), inputSnapshot: guidedInputSnapshot(input) };
    confirmGuidedSending(request);
    if (epoch.current !== version) throw new Error('STALE_INPUT');
    return { request, dependencies: JSON.stringify(dependencies), epoch: version };
  }
  async function archiveResponse(value: Archive) {
    // Candidate references must exist before the assistant message is committed.
    if (value.candidate) {
      const current = await guidedService.read();
      if (!current.candidates.some(item => item.id === value.candidate!.id)) await guidedService.retainCandidate(value.candidate, current.revision);
    }
    for (const message of value.messages) {
      const current = await guidedService.read();
      if (!current.messages.some(item => item.id === message.id)) await guidedService.appendMessage(message, current.revision);
    }
    setArchive(undefined);
  }
  async function send(value: Attempt) {
    const local = await guidedService.read(); const access = localAgeAccess(local.onboarding?.answers ?? {});
    if (local.onboarding?.version === 4 && !local.onboarding.completed) throw new Error(zh ? '请先核对并确认引导资料。' : 'Review and confirm your onboarding profile first.');
    if (access === 'minor' || local.onboarding?.version === 4 && access !== 'adult') throw new Error(zh ? '成人 AI 仅向已确认18岁及以上的用户开放。可以继续使用手动训练。' : 'Adult AI requires a confirmed age of 18 or above. Manual training remains available.');
    if (archive) throw new Error(zh ? '请先重试保存已收到的响应；不会再次调用 AI。' : 'Archive the received response first; this does not call AI again.');
    if (value.epoch !== epoch.current || value.request.restoreGeneration !== currentGeneration.current || JSON.stringify(await guidedService.captureDependencies()) !== value.dependencies ||
      (value.request.scope.history !== undefined && value.request.scope.history !== await historySnapshot()) ||
      (value.request.scope.body !== undefined && JSON.stringify(value.request.scope.body) !== JSON.stringify(await currentBody()))) throw new Error('STALE_INPUT');
    attempt.current = value;
    const inFlight = { id: value.request.requestId, controller: new AbortController(), cancelled: false };
    active.current = inFlight; setSending(true);
    try {
      const result = await sendGuidedDialogue(value.request, confirmGuidedSending(value.request), inFlight.controller.signal);
      setAccountingPending(result.accounting === 'pending');
      const metadata = await repository.readMetadata();
      if (inFlight.cancelled || value.epoch !== epoch.current || value.request.restoreGeneration !== (metadata.restoreGeneration ?? 0) || JSON.stringify(await guidedService.captureDependencies()) !== value.dependencies) throw new Error('STALE_INPUT');
      const response = result.response;
      let content = '';
      let returned: ProgramCandidate | undefined;
      if (response.purpose === 'understand') { setSummary(response.summary); setQuestions(response.uncertainties); setApproved(false); content = [response.summary, ...response.uncertainties].join('\n'); }
      else if (response.purpose === 'refused') { content = response.message; setNotice(content); }
      else if ('candidate' in response) {
        returned = { ...response.candidate, ...JSON.parse(value.dependencies) };
        setCandidate(returned); setUsedHistory(value.request.scope.history !== undefined); setSaved(false); setEditing(false); setSaveConsent(false); setStep(4);
        content = `${response.candidate.name}\n${response.candidate.explanation}`;
      } else { content = response.question; setQuestions([response.question]); }
      const valueToArchive: Archive = { candidate: returned, messages: [
        { id: crypto.randomUUID(), conversationId, role: 'user', content: value.request.scope.goal, requestId: value.request.requestId, createdAt: new Date().toISOString() },
        { id: crypto.randomUUID(), conversationId, role: 'assistant', content, requestId: value.request.requestId, createdAt: new Date().toISOString(), ...(returned ? {candidateId: returned.id} : {}) },
      ] };
      attempt.current = undefined; setPreview(undefined); setGoalConsent(false); setSendConsent(false);
      setArchive(valueToArchive); await archiveResponse(valueToArchive);
    } finally {
      if (active.current === inFlight) active.current = undefined;
      setSending(false); void refreshQualification().catch(() => {});
    }
  }
  async function sendGoal() {
    if (!goalConsent) throw new Error('CONFIRMATION_REQUIRED');
    await send(attempt.current?.request.purpose === 'understand' ? attempt.current : await prepare('understand'));
  }
  async function previewPlan() { const value = await prepare('program'); setPreview(value); setSendConsent(false); setStep(3); }
  async function stopWaiting() {
    const pending = active.current; if (!pending) return;
    pending.cancelled = true; pending.controller.abort(); setAccountingPending(true); setQualification(undefined);
    try { await control.current.cancel(pending.id); } catch { /* Cancellation cannot prove that submission was free. */ }
    setNotice(zh ? '已停止等待，费用仍需核算。可继续使用本地训练。' : 'Stopped waiting. Costs may still be pending; local training remains available.');
  }
  function changeDates(next: string[]) { invalidatePlan(); setSlots(next.map(date => slots.find(slot => slot.date === date) ?? {date, startTime: usualTime, durationMinutes: minutes, focus: ''})); }

  return <div className="v31-ai" aria-busy={busy}>
    <header className="v31-ai-heading"><div><span className="v31-eyebrow">AI PLANNER</span><h1>{zh ? '一起制定训练计划' : 'Build your training plan'}</h1><p>{zh ? '由目标出发，选择具体日期，核对外发内容，最后审阅并保存。' : 'Start with your goal, choose exact dates, review what is sent, then save your proposal.'}</p></div><Link to="/plans">{zh ? '返回计划' : 'Back to plans'}</Link></header>
    <ol className="v31-ai-steps" aria-label={zh ? '制定计划步骤' : 'Planning steps'}>{title.map((item, index) => <li key={item} aria-current={step === index + 1 ? 'step' : undefined}><span>{String(index + 1).padStart(2, '0')}</span>{item}</li>)}</ol>
    <section className="v31-ai-access"><div><strong>{zh ? 'AI 资格与额度' : 'AI access & allowance'}</strong><p role="status"><AppIcon name="info"/>{checking ? (zh ? '正在更新…' : 'Updating…') : qualification ? `${zh ? '本月剩余 理解 / 生成：' : 'Remaining understanding / generation: '}${Math.max(0, qualification.limits.understand - qualification.used.understand)} / ${Math.max(0, qualification.limits.generate - qualification.used.generate)}` : (zh ? '资格及额度未知，请查询或前往试用资格。' : 'Access and allowance unknown. Refresh or check trial access.')}</p>{qualification && !qualification.aiEnabled && <p>{statusFeedback('AI_DISABLED', locale)}</p>}{accountingPending && <p>{statusFeedback('ACCOUNTING_PENDING', locale)}</p>}</div><div className="v31-ai-actions"><button disabled={busy || checking} onClick={() => void run(refreshQualification)}>{zh ? '刷新资格' : 'Refresh access'}</button><Link to="/trial">{zh ? '试用资格 / 邀请码' : 'Trial access / invitation'}</Link></div></section>
    {error && <p className="v31-ai-feedback" role="alert">{error}</p>}{notice && <p role="status"><AppIcon name="info"/>{notice}</p>}
    {step === 4 && !saved && candidateConflicts.length > 0 && <p className="v31-ai-feedback" role="status">{zh ? '日期冲突：' : 'Date conflicts: '}{candidateConflicts.join(' · ')}. {zh ? '候选及编辑仍保留，任何冲突都会阻止整批保存。' : 'Your proposal and edits remain available. Any conflict prevents the entire save.'}</p>}
    {!ready && <p role="status"><AppIcon name="info"/>{zh ? '正在读取本地资料…' : 'Loading local information…'}</p>}
    {sending && <button onClick={() => void stopWaiting()}>{zh ? '停止等待（费用可能已产生）' : 'Stop waiting (costs may apply)'}</button>}
    {!onboardingConfirmed && <p role="alert"><StatusIcon status="warning"/>{zh ? '资料已修改，请重新核对并确认。' : 'Your profile changed. Review and confirm it again.'} <Link to="/onboarding">{zh ? '核对资料' : 'Review profile'}</Link></p>}{ageBlocked && <p role="alert"><StatusIcon status="warning"/>{zh ? '成人 AI 暂不可用：请在引导资料中确认年龄。12–17岁仅使用本地引导和手动训练。' : 'Adult AI is unavailable. Confirm age in onboarding; ages 12–17 can use local onboarding and manual training.'} <Link to="/onboarding">{zh ? '查看引导资料' : 'Review onboarding'}</Link></p>}{archive && <aside className="v31-ai-feedback"><p>{zh ? '响应保留在当前页面，尚未完整存档；刷新可能丢失。重试只保存已有响应，不再次调用 AI。' : 'The response is retained on this page but not fully archived; refreshing may lose it. Retry saves it without another AI call.'}</p><button disabled={busy} onClick={() => void run(() => archiveResponse(archive))}>{zh ? '重试保存响应' : 'Retry archiving response'}</button></aside>}
    <section className="v31-ai-card">
      {step === 1 && <><h2>{zh ? '01 · 我想达到什么目标' : '01 · What would you like to achieve?'}</h2><p>{zh ? '只收集当前计划真正需要的信息；身体资料与训练历史在第三步单独选择。' : 'Share what this plan needs. Body data and training history are separate choices in step 3.'}</p>
        <fieldset disabled={busy || !ready}><label>{zh ? '训练目标与约束' : 'Training goal and constraints'}<textarea value={goal} onChange={event => {setGoal(event.target.value); invalidateGoal();}} /></label>
        <div className="v31-ai-fields"><label>{zh ? '训练经验' : 'Experience'}<input value={experience} onChange={event => {setExperience(event.target.value); invalidateGoal();}} /></label><label>{zh ? '训练场地' : 'Location'}<input value={venue} onChange={event => {setVenue(event.target.value); invalidateGoal();}} /></label><label>{zh ? '可用器械' : 'Equipment'}<input value={equipment} onChange={event => {setEquipment(event.target.value); invalidateGoal();}} /></label><label>{zh ? '动作限制（可选）' : 'Movement restrictions (optional)'}<input value={restrictions} onChange={event => {setRestrictions(event.target.value); invalidateGoal();}} /></label><label>{zh ? '每次训练分钟数' : 'Minutes per session'}<input type="number" min="1" max="240" value={minutes} onChange={event => {setMinutes(Number(event.target.value)); invalidateGoal();}} /></label><label>{zh ? '常用开始时间' : 'Usual start time'}<input type="time" value={usualTime} onChange={event => {setUsualTime(event.target.value); invalidateGoal();}} /></label></div>
        {!scheduleReviewed && <label><input type="checkbox" checked={false} onChange={() => {setScheduleReviewed(true); invalidateGoal();}} />{zh ? '引导中时间安排未知。上方时间只是示例；我已修改或明确确认这些时间。' : 'Schedule was unknown in onboarding. The times above are examples; I have edited or explicitly confirmed them.'}</label>}{v4 && <p>{zh ? '同时发送已确认适用于成人的标记，不发送年龄数值。' : 'An adult-eligibility confirmation is sent; your numeric age is not sent here.'}</p>}<label>{zh ? '时间安排与其他偏好（可选）' : 'Availability and other preferences (optional)'}<textarea value={otherConditions} onChange={event => {setOtherConditions(event.target.value); invalidateGoal();}} /></label><p>{zh ? '本次仅发送上面的目标、经验、场地、器械、动作限制、时长、常用时间与其他偏好，以及界面语言和时区。' : 'This sends only the goal, experience, location, equipment, restrictions, duration, usual time and other preferences above, plus language and time zone.'}</p>
        <label className="v31-ai-consent"><input type="checkbox" checked={goalConsent} onChange={event => setGoalConsent(event.target.checked)} />{zh ? '我已核对上述内容，同意发送给 AI 理解；请求受理后使用 1 次理解额度。' : 'I reviewed this information and consent to AI understanding. An accepted request uses 1 understanding allowance.'}</label>
        <button className="v31-primary" disabled={!canSend || !goalConsent || !goal.trim() || !!archive} onClick={() => void run(sendGoal)}>{sending ? (zh ? '正在理解…' : 'Understanding…') : attempt.current?.request.purpose === 'understand' ? (zh ? '重试本次理解请求' : 'Retry this understanding request') : (zh ? '理解目标' : 'Understand goal')}</button></fieldset>
        {summary && <div className="v31-ai-understanding"><h3>{zh ? 'AI 目标理解 · 待确认' : 'AI understanding · review needed'}</h3><p>{summary}</p>{questions.length > 0 && <><p>{zh ? '请在上方补充这些必要信息，再次理解目标：' : 'Add these essential details above, then request understanding again:'}</p><ul>{questions.map((question, index) => <li key={index}>{question}</li>)}</ul></>}<label className="v31-ai-consent"><input type="checkbox" disabled={busy || questions.length > 0} checked={approved} onChange={event => setApproved(event.target.checked)} />{zh ? '我确认这段理解正确' : 'I confirm this understanding is correct'}</label></div>}
      </>}
      {step === 2 && <><h2>{zh ? '02 · 选择具体训练日期' : '02 · Choose exact training dates'}</h2><p>{zh ? `可跨月、不连续选择。当前每次最多 ${maxDates} 个日期，日期范围最多 31 天；每一天都是独立计划。` : `Choose nonconsecutive dates across months: up to ${maxDates} dates within 31 days. Each day is an independent plan.`}</p>{dates.length>maxDates&&<p role="alert"><StatusIcon status="warning"/>{zh?`当前服务每次最多允许 ${maxDates} 个日期，请减少所选日期。`:`The current service allows up to ${maxDates} dates. Reduce your selection.`}</p>}<div className="v31-ai-calendar"><PlanDatePicker locale={locale} today={dateInZone(Date.now(), zone)} selected={dates} onChange={changeDates} occupied={occupied} maxDates={maxDates} /><div><p>{zone} · {dates.length} {zh ? '个训练日' : 'training days'}</p>{slots.map(slot => <fieldset key={slot.date} disabled={busy}><legend>{slot.date}</legend><label>{zh ? '开始时间' : 'Start time'}<input type="time" value={slot.startTime} onChange={event => {invalidatePlan(); setSlots(values => values.map(value => value.date === slot.date ? {...value, startTime: event.target.value} : value));}} /></label><label>{zh ? '训练分钟数' : 'Minutes'}<input type="number" min="1" max="240" value={slot.durationMinutes} onChange={event => {invalidatePlan(); setSlots(values => values.map(value => value.date === slot.date ? {...value, durationMinutes: Number(event.target.value)} : value));}} /></label><label>{zh ? '本日训练重点（可选）' : 'Focus for this day (optional)'}<input value={slot.focus} onChange={event => {invalidatePlan(); setSlots(values => values.map(value => value.date === slot.date ? {...value, focus: event.target.value} : value));}} /></label></fieldset>)}</div></div>{conflict && <p role="alert"><StatusIcon status="warning"/>{zh ? '有日期已被占用，请重新选择。' : 'A date is now occupied. Review your selection.'}</p>}</>}
      {step === 3 && <><h2>{zh ? '03 · 核对 AI 将使用哪些信息' : '03 · Review what AI will receive'}</h2><p>{summary}</p><p>{dates.join(' · ')} · {zone}</p><fieldset disabled={busy}><label className="v31-ai-consent"><input type="checkbox" disabled={!hasBody} checked={includeBody} onChange={event => {setIncludeBody(event.target.checked); invalidatePlan();}} />{zh ? '可选：发送已提供的身体资料' : 'Optional: include supplied body information'}</label><p>{hasBody ? (zh ? '使用各指标最新的已保存测量值；没有测量时使用资料或旧问答值。来源、测量日期或资料更新时间列在下方，资料更新时间不代表测量日期。仅在勾选后发送。' : 'Uses the latest saved measurement for each metric, falling back to profile or earlier answers. Sources, observation dates or record update times are shown below; an update time is not a measurement date. Sent only when selected.') : (zh ? '暂无已保存的身体资料。可先在设置填写身高/体重，或在进度记录测量值。' : 'No saved body information. Add height or weight in Settings, or measurements in Progress.')}</p>{hasBody && <details><summary>{zh ? '查看可选身体资料及来源' : 'Review optional body information and sources'}</summary><pre>{JSON.stringify(body, null, 2)}</pre></details>}<label className="v31-ai-consent"><input type="checkbox" checked={includeHistory} onChange={event => {setIncludeHistory(event.target.checked); invalidatePlan();}} />{zh ? '可选：发送所选日期内的训练、组记录和体重（包括未完成状态）' : 'Optional: include training, sets and weights within the selected range (including unfinished states)'}</label>{includeHistory ? <div className="v31-ai-fields"><label>{zh ? '历史开始日期' : 'History from'}<input type="date" value={historyFrom} onChange={event => {setHistoryFrom(event.target.value); invalidatePlan();}} /></label><label>{zh ? '历史结束日期' : 'History to'}<input type="date" value={historyTo} onChange={event => {setHistoryTo(event.target.value); invalidatePlan();}} /></label></div> : <p>{zh ? '本次未参考你的训练历史' : 'Your training history is not used for this request.'}</p>}</fieldset>
        {!preview ? <button disabled={busy} onClick={() => void run(previewPlan)}>{zh ? '更新发送预览' : 'Update sending preview'}</button> : <><details open><summary>{zh ? '本次实际发送内容' : 'Exact information sent this time'}</summary><pre>{JSON.stringify({ ...preview.request.scope, confirmedSummary: preview.request.confirmedSummary, dates: preview.request.dates, schedule: preview.request.schedule, timeZone: preview.request.timeZone }, null, 2)}</pre></details><label className="v31-ai-consent"><input type="checkbox" disabled={busy} checked={sendConsent} onChange={event => setSendConsent(event.target.checked)} />{zh ? '我确认上述字段与日期，同意生成计划。请求受理后使用 1 次生成额度；取消或超时不代表免计费。' : 'I confirm these fields and dates and consent to plan generation. An accepted request uses 1 generation allowance; cancellation or timeout may still incur costs.'}</label></>}
      </>}
      {step === 4 && candidate && <><h2>{zh ? '04 · 审阅候选，然后保存' : '04 · Review your proposal, then save'}</h2><p role="status"><AppIcon name="info"/>{saved ? (zh ? '保存成功：已加入训练日历。' : 'Saved to your training calendar.') : (zh ? '候选尚未保存。AI 已计费不代表计划已经保存。' : 'Proposal not saved. AI usage does not mean the plan has been saved.')}</p>{!usedHistory && <p>{zh ? '本次未参考你的训练历史' : 'Your training history was not used.'}</p>}{editing && !saved && <p role="status"><AppIcon name="info"/>{zh ? '编辑中 · 更改仅保留在候选中' : 'Editing · changes remain in the proposal'}</p>}<CandidateEditor candidate={candidate} locale={locale} disabled={busy || saved} onChange={value => {setCandidate(value); setEditing(true); setSaveConsent(false);}} />{candidate.restoreGeneration !== generation && <p role="alert"><StatusIcon status="warning"/>{zh ? '本地数据库已恢复，旧候选不能保存。请重新制定计划。' : 'Your local database was restored. This previous proposal cannot be saved.'}</p>}<label className="v31-ai-consent"><input type="checkbox" checked={saveConsent} disabled={saved || busy} onChange={event => setSaveConsent(event.target.checked)} />{zh ? '我已逐日检查内容与时间，确认一次性保存这些独立日计划。任一日期冲突则全部不保存。' : 'I reviewed each day and time and confirm saving these independent daily plans together. Any conflict prevents the entire save.'}</label><button className="v31-primary" disabled={busy || saved || !saveConsent || !!archive || candidate.restoreGeneration !== generation} onClick={() => void run(async () => {await guidedService.saveIndependentCandidate(candidate, guidedServiceLimits.maxDays); setSaved(true); setNotice(zh ? '计划已保存；原有计划和历史保持独立。' : 'Plan saved; existing plans and history remain independent.');})}>{saved ? (zh ? '已保存' : 'Saved') : (zh ? '确认保存全部日计划' : 'Confirm & save all daily plans')}</button>{saved && <Link to="/plans">{zh ? '查看训练日历' : 'View training calendar'}</Link>}</>}
    </section>
    <footer className="v31-ai-footer"><button disabled={busy || step === 1} onClick={() => {setStep(value => value - 1); setSendConsent(false);}}>{zh ? '← 上一步' : '← Back'}</button><span>{title[step - 1]}</span>{step === 1 && <button className="v31-primary" disabled={busy || !approved || !summary || questions.length > 0} onClick={() => setStep(2)}>{zh ? '选择日期 →' : 'Choose dates →'}</button>}{step === 2 && <button className="v31-primary" disabled={busy || !dates.length || dates.length > maxDates || conflict || !approved} onClick={() => void run(previewPlan)}>{zh ? '核对外发 →' : 'Review sending →'}</button>}{step === 3 && <button className="v31-primary" disabled={!canSend || !preview || !sendConsent || !!archive} onClick={() => void run(() => send(attempt.current?.request.purpose === 'program' ? attempt.current : preview!))}>{sending ? (zh ? '正在生成…' : 'Generating…') : attempt.current?.request.purpose === 'program' ? (zh ? '重试本次生成请求' : 'Retry this generation request') : (zh ? '生成候选计划 →' : 'Generate proposal →')}</button>}</footer>
  </div>;
}
