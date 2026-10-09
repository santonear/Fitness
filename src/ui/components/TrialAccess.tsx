import {applicationSchema,claimDirectActivation,receiptKey} from '../../ai/trial-recovery';
import { AppIcon, StatusIcon } from './AppIcon';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import type { ApplicationKind } from '../../backend/trial-applications';

type Application = z.infer<typeof applicationSchema>;
type Status = z.infer<typeof statusSchema>;
const counts = z.object({ understand: z.number().int().nonnegative(), generate: z.number().int().nonnegative() });
const statusSchema = z.object({ expiresAt: z.number().finite(), used: counts, limits: counts, period: z.string().optional(), pending: z.number().int().nonnegative().optional(), reconciliationRequired: z.boolean().optional(), aiEnabled: z.boolean().optional() });
const policyStatusSchema = statusSchema.extend({ planningBudgetDisabled: z.boolean().optional(), resetAt: z.number().finite().optional(), timeZone: z.string().optional(), maxDays: z.number().int().min(1).max(14).optional(), maximumRequestCost: z.number().int().nonnegative().optional(), budgetAvailable: z.object({ understand: z.boolean(), generate: z.boolean() }).optional() });
const accessStatusSchema = z.discriminatedUnion('qualification', [z.object({ qualification: z.literal('none'), sessionValid: z.literal(false) }), ...(['active','expired','revoked'] as const).map(qualification => policyStatusSchema.extend({ qualification: z.literal(qualification), sessionValid: z.boolean() }))]);
const configSchema = z.object({ available: z.boolean(), siteKey: z.string().nullable() });
const displayNameKey = 'fitness-trial-display-name-v1';
export async function trialApi<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1/${path}`, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
    signal: AbortSignal.timeout(10000), headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'CONTROL_UNAVAILABLE');
  return data as T;
}
const messages: Record<string, [string, string]> = {
  APPLICATION_PENDING: ['已有申请正在处理，请刷新查看。', 'An application is already being processed. Refresh its status.'],
  APPLICATION_RATE_LIMIT: ['今天已提交申请，请保留凭证并稍后查看。', 'An application was submitted today. Keep your receipt and check later.'],
  APPLICATION_BUSY: ['当前申请较多，请稍后再试。', 'Applications are busy right now. Please try again later.'],
  APPLICATIONS_UNAVAILABLE: ['申请服务暂未开放，已有邀请码仍可兑换。', 'Applications are not available yet. Existing invitation codes can still be redeemed.'],
  APPLICATION_CAPACITY: ['申请队列暂满，请稍后再试。', 'The application queue is full. Please try later.'],
  VERIFICATION_REQUIRED: ['申请未提交：安全验证未通过。请在验证成功后再次点击“提交申请”；若仍失败，请联系管理员。', 'Application not submitted: security verification failed. Complete the check and submit again; contact the administrator if it still fails.'],
  QUALIFICATION_REQUIRED: ['资格已到期或不可用，请查看申请或联系管理员。', 'Your trial has expired or is unavailable. Check your application or contact the administrator.'],
  INVITE_INVALID: ['邀请码或领取资格已失效，请申请补发。', 'The invitation has expired or is no longer valid. Request a replacement.'],
  SUBJECT_EXPIRED: ['试用已到期，本地训练仍可使用。可以申请延期。', 'Your trial has expired. Local training remains available; you can request an extension.'],
  SUBJECT_NOT_FOUND: ['资格不可用或已撤销，本地训练数据未改变。', 'Access is unavailable or revoked. Local training data is unchanged.'],
  USE_EXTENSION: ['已有资格，请申请延期或补发。', 'You already have a trial. Request an extension or replacement.'],
};
export function accessError(reason: unknown, zh: boolean) {
  const key = reason instanceof Error ? reason.message : '';
  return messages[key]?.[zh ? 0 : 1] ?? (zh ? '暂时无法完成操作，状态未知。请稍后刷新，已保存训练不受影响。' : 'The service is unavailable; status is unknown. Refresh later. Saved training is unaffected.');
}
type Turnstile = { render(element: HTMLElement, options: Record<string, unknown>): string; remove(id: string): void };
function SecurityCheck({ siteKey, onProof }: { siteKey: string; onProof: (proof: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false, id: string | undefined;
    const api = () => (window as unknown as { turnstile?: Turnstile }).turnstile;
    const render = () => { if (!disposed && host.current && api()) id = api()!.render(host.current, { sitekey: siteKey, size: 'compact', action: 'trial_application', callback: onProof, 'expired-callback': () => onProof(''), 'error-callback': () => onProof('') }); };
    let script = document.querySelector<HTMLScriptElement>('script[data-trial-turnstile]');
    if (api()) render();
    else {
      if (!script) { script = document.createElement('script'); script.dataset.trialTurnstile = 'true'; script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; document.head.append(script); }
      script.addEventListener('load', render);
    }
    return () => { disposed = true; script?.removeEventListener('load', render); if (id) api()?.remove(id); };
  }, [siteKey, onProof]);
  return <div ref={host} />;
}

export function TrialAccess({ onContinue, onSkip }: { onContinue?: () => void; onSkip?: () => void }) {
  const navigate = useNavigate();
  const { i18n } = useTranslation(); const zh = i18n.resolvedLanguage === 'zh';
  const [status, setStatus] = useState<z.infer<typeof policyStatusSchema>>(); const [apps, setApps] = useState<Application[]>([]);
  const [qualificationState, setQualificationState] = useState<'unknown'|'none'|'active'|'expired'|'revoked'>('unknown');
  const [sessionValid, setSessionValid] = useState(false);
  const [config, setConfig] = useState<{ available: boolean; siteKey: string | null }>();
  const [receipt, setReceipt] = useState(''); const [name, setName] = useState(''); const [note, setNote] = useState('');
  const [code, setCode] = useState(''); const [proof, setProof] = useState(''); const [challenge, setChallenge] = useState(0);
  const [kind, setKind] = useState<ApplicationKind>('new'); const [form, setForm] = useState(false);
  const [busy, setBusy] = useState(false); const [loaded, setLoaded] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [link, setLink] = useState(''); const requestId = useRef(crypto.randomUUID());
  async function refresh(owner = receipt, start = false) {
    setQualificationState('unknown'); setStatus(undefined); setSessionValid(false);
    let [qualification, applications, availability] = await Promise.allSettled([
      trialApi<Status>('trial/status'), owner ? trialApi<Application[]>('trial/applications', { receipt: owner }) : Promise.resolve([]),
      trialApi<{ available: boolean; siteKey: string | null }>('trial/application-config'),
    ]);
    if (availability.status === 'fulfilled') setConfig(configSchema.parse(availability.value));
    if (applications.status === 'fulfilled' && qualification.status === 'rejected' && qualification.reason instanceof Error && qualification.reason.message === 'QUALIFICATION_REQUIRED' &&
      await claimDirectActivation(owner, applications.value, body => trialApi('trial/claim', body))) {
      [qualification, applications] = await Promise.allSettled([trialApi<Status>('trial/status'), trialApi<Application[]>('trial/applications', { receipt: owner })]);
    }
    if (qualification.status === 'fulfilled') { setStatus(policyStatusSchema.parse(qualification.value)); setQualificationState('active'); setSessionValid(true); if (onContinue) onContinue(); }
    else {
      if (!(qualification.reason instanceof Error) || qualification.reason.message !== 'QUALIFICATION_REQUIRED') throw qualification.reason;
      const access = accessStatusSchema.parse(await trialApi('trial/access-status', owner ? { receipt: owner } : {}));
      setQualificationState(access.qualification); setSessionValid(access.sessionValid);
      if (access.qualification !== 'none') setStatus(access);
    }
    if (applications.status === 'fulfilled') setApps(z.array(applicationSchema).parse(applications.value)); else throw applications.reason;
    if (availability.status === 'rejected') throw availability.reason;
    if (start && qualification.status === 'fulfilled' && !onContinue) navigate('/ai');
  }
  useEffect(() => {
    let value = '';
    try {
      const incoming = new URLSearchParams(location.hash.slice(1)).get('trial');
      if (incoming && /^[a-f0-9]{64}$/.test(incoming)) { localStorage.setItem(receiptKey, incoming); history.replaceState(null, '', location.pathname + location.search); }
      value = localStorage.getItem(receiptKey) ?? ''; setReceipt(value);
      setName((localStorage.getItem(displayNameKey) ?? '').slice(0, 60));
    } catch { setError(zh ? '无法保存申请凭证，请允许本地存储。' : 'Allow browser storage to keep your application receipt.'); }
    void refresh(value).catch(e => setError(accessError(e, zh))).finally(() => setLoaded(true));
  }, []);
  async function run(task: () => Promise<void>) {
    if (busy) return; setBusy(true); setError(''); setNotice('');
    try { await task(); } catch (e) { setError(accessError(e, zh)); } finally { setBusy(false); }
  }
  async function submit() {
    await run(async () => {
      let owner = receipt;
      if (!owner) { owner = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem(receiptKey, owner); setReceipt(owner); }
      try {
        await trialApi('trial/apply', { receipt: owner, id: requestId.current, kind, name, note, proof });
        setForm(false); requestId.current = crypto.randomUUID(); await refresh(owner);
      } finally { setProof(''); setChallenge(value => value + 1); }
    });
  }
  async function redeem() {
    if (!name.trim() || !code.trim()) return;
    await run(async () => {
      // The name is a local greeting, not a second authentication credential.
      localStorage.setItem(displayNameKey, name.trim());
      await trialApi('trial/redeem', { code: code.trim() });
      setCode(''); await refresh(receipt, true);
    });
  }
  const pending = apps.some(a => a.state === 'pending' || a.state === 'approved' && (a.claimUntil ?? 0) > Date.now());
  const hasTrial = Boolean(status || apps.some(a => a.state === 'claimed'));
  const active = qualificationState === 'active' && sessionValid;
  const quotaExhausted = status && (status.used.generate >= status.limits.generate);
  const budgetInsufficient = status?.budgetAvailable && (!status.budgetAvailable.understand || !status.budgetAvailable.generate);
  const planningPaused = !active || quotaExhausted || budgetInsufficient || status?.aiEnabled === false || status?.reconciliationRequired;
  const words = { pending: zh ? '等待审核' : 'Awaiting review', approved: zh ? '已批准，待领取' : 'Approved · ready to claim', rejected: zh ? '未获批准' : 'Not approved', claimed: zh ? '已领取' : 'Claimed' };
  const statusDetails = <>
    <div className="v31-service-status"><p><strong>{zh?'平台状态：':'Service: '}</strong>{status?.aiEnabled===true?(zh?'模型已启用':'Model enabled'):status?.aiEnabled===false?(zh?'模型已关闭，本地训练可继续':'Model disabled; local training stays available'):(zh?'未知':'Unknown')}</p><p><strong>{zh?'核算状态：':'Accounting: '}</strong>{status?.reconciliationRequired?(zh?'需要对账，新增请求暂停':'Reconciliation required; requests paused'):status?.pending?(zh?`${status.pending} 个请求待核算；是否允许继续由服务端判定`:`${status.pending} requests pending; the server determines availability`):status?.pending===0?(zh?'无待核算请求':'No pending requests'):(zh?'未知':'Unknown')}</p><p>{zh?'项目预算与个人次数分别限制请求。这里不推算项目剩余金额；资格有效不代表下一次 AI 请求一定获准。':'Project budget and personal quota are separate limits. Project balance is not estimated here; valid access does not guarantee admission of the next request.'}</p></div>
  </>;
  return <section className="trial-access" aria-labelledby="trial-title">
    <span className="trial-kicker">FITNESS · AI ACCESS</span><h1 id="trial-title">{zh ? '一起开始，开启 AI 试用' : 'Start together. Unlock your AI trial.'}</h1>
    <p>{zh ? '已有邀请码？填写用户名和邀请码，即可开始。还没有邀请码可以申请试用。' : 'Have an invitation? Enter your name and code to get started, or apply for a trial.'}</p>
    {!loaded && <p role="status"><AppIcon name="info"/>{zh ? '正在查询资格…' : 'Checking your trial…'}</p>}
    {error && <p role="alert"><StatusIcon status="error"/>{error}</p>}{notice && <p role="status"><AppIcon name="info"/>{notice}</p>}
    {loaded && qualificationState === 'none' && <p role="status"><AppIcon name="info"/>{zh ? '此浏览器尚无可验证的试用资格。可兑换邀请码或查看申请。' : 'No verified trial on this browser. Redeem an invitation or check your application.'}</p>}
    {status && <div className="trial-summary"><strong>{qualificationState === 'expired' ? (zh ? '试用已到期，可申请延期' : 'Trial expired — request an extension') : qualificationState === 'revoked' ? (zh ? '资格已撤销，请联系管理员' : 'Access revoked — contact the administrator') : !sessionValid ? (zh ? '资格有效，但此浏览器未启用；可恢复领取或申请补发' : 'Trial active, but this browser is not activated. Recover the claim or request a replacement.') : (zh ? 'AI 试用有效' : 'Your AI trial is active')}</strong><p>{zh ? '有效期至：' : 'Valid until: '}{new Date(status.expiresAt).toLocaleString(zh ? 'zh-CN' : 'en')}</p>
      <button className="trial-primary" disabled={busy || Boolean(planningPaused)} onClick={() => navigate('/ai')}>{zh ? '开始制定训练计划' : 'Start planning your training'}</button>
      {quotaExhausted && <p role="status"><AppIcon name="info"/>{zh ? '个人次数不足，请等待本期重置或联系管理员。' : 'Personal quota exhausted. Wait for the monthly reset or contact the administrator.'}</p>}
      {budgetInsufficient && <p role="status"><AppIcon name="info"/>{zh ? '项目预算不足，新的 AI 请求暂不可用。请稍后刷新或联系管理员。' : 'Project budget is insufficient for new AI requests. Refresh later or contact the administrator.'}</p>}
      {status.maxDays !== undefined && <p>{zh ? `每次最多选择 ${status.maxDays} 个训练日` : `Select up to ${status.maxDays} training dates per request`}</p>}
      {!status.planningBudgetDisabled && status.maximumRequestCost !== undefined && <p>{zh ? '单请求费用上限：' : 'Per-request cost limit: '}¥{(status.maximumRequestCost / 100).toFixed(2)}</p>}
      <p>{zh ? '确认目标、选择日期、核对外发内容，再审阅并保存计划。' : 'Confirm your goal, choose dates, review what is sent, then preview and save.'}</p></div>}
    {active && statusDetails}
    <ul className="trial-applications">{apps.map(a => <li key={a.id}><strong>{a.kind === 'extend' ? (zh ? '延期申请 · ' : 'Extension · ') : a.kind === 'replace' ? (zh ? '补发申请 · ' : 'Replacement · ') : ''}{words[a.state]}</strong><small>{a.id}</small>{a.reason && <p>{a.reason}</p>}
      {a.state === 'approved' && <button disabled={busy || (a.claimUntil ?? 0) <= Date.now()} onClick={() => void run(async () => { await trialApi('trial/claim', { receipt, id: a.id }); await refresh(); })}>{(a.claimUntil ?? 0) <= Date.now() ? (zh ? '领取已过期' : 'Claim expired') : (zh ? '领取并启用' : 'Claim and activate')}</button>}
      {a.state === 'claimed' && !active && qualificationState === 'active' && <button disabled={busy} onClick={() => void run(async () => { await trialApi('trial/claim', { receipt, id: a.id }); await refresh(); })}>{zh ? '恢复领取结果' : 'Recover claim result'}</button>}</li>)}</ul>
    <div className="trial-actions">
      {!active && <button aria-pressed={!form} disabled={busy} onClick={() => setForm(false)}>{zh ? '已有邀请码，开始使用' : 'Use an invitation'}</button>}
      <button className="trial-primary" disabled={busy || pending || !config?.available || qualificationState === 'revoked'} onClick={() => { setKind(hasTrial ? 'extend' : 'new'); setForm(true); }}>{hasTrial ? (zh ? '申请延期 30 天' : 'Request 30-day extension') : (zh ? '申请 AI 试用' : 'Apply for AI trial')}</button>
      {hasTrial && qualificationState !== 'expired' && qualificationState !== 'revoked' && <button disabled={busy || pending || !config?.available} onClick={() => { setKind('replace'); setForm(true); }}>{zh ? '申请补发／更换设备' : 'Request replacement / change device'}</button>}
    </div>
    {!active && !form && <form className="trial-redeem" onSubmit={e => { e.preventDefault(); void redeem(); }}><fieldset disabled={busy}>
      <legend>{zh ? '使用邀请码启动' : 'Start with your invitation'}</legend>
      <label>{zh ? '用户名（称呼）' : 'Your name'}<input required maxLength={60} autoComplete="nickname" value={name} onChange={e => setName(e.target.value)} /></label>
      <label>{zh ? '邀请码' : 'Invitation code'}<input required autoComplete="off" autoCapitalize="none" spellCheck={false} value={code} onChange={e => setCode(e.target.value)} /></label>
      <button type="submit" className="trial-primary" disabled={!loaded || !name.trim() || !code.trim()}>{busy ? (zh ? '正在启用…' : 'Activating…') : (zh ? '启用并开始制定计划' : 'Activate and start planning')}</button>
      <p className="trial-entry-note">{zh ? '称呼仅保存在此设备。邀请码用于启用试用，训练记录也保存在本机。' : 'Your name and training records stay on this device. The code activates your trial.'}</p>
    </fieldset></form>}
    {loaded && config && !config.available && <p>{zh ? '申请服务暂未开放；仍可使用已有邀请码启动。' : 'Applications are not available yet; you can still use an invitation.'}</p>}
    {form && <form onSubmit={e => { e.preventDefault(); void submit(); }}><fieldset disabled={busy}>
      <legend>{kind === 'extend' ? (zh ? '申请延期' : 'Extension request') : kind === 'replace' ? (zh ? '申请补发' : 'Replacement request') : (zh ? '申请试用' : 'Trial application')}</legend>
      <label>{zh ? '称呼' : 'Name'}<input required maxLength={60} value={name} onChange={e => { setName(e.target.value); requestId.current = crypto.randomUUID(); }} /></label>
      <label>{zh ? '申请说明（可选，请勿填写健康或敏感信息）' : 'Note (optional; no health or sensitive information)'}<textarea maxLength={300} value={note} onChange={e => { setNote(e.target.value); requestId.current = crypto.randomUUID(); }} /></label>
      <p>{kind === 'extend' ? (zh ? '批准后延长 30 天，不重置次数或预算。' : 'Approval adds 30 days without resetting usage or budgets.') : kind === 'replace' ? (zh ? '批准补发将撤销旧浏览器资格，不延长期限或增加次数。' : 'Approval revokes the old browser session without adding time or usage.') : (zh ? '批准后 7 天内领取，兑换后试用 30 天。AI 调用还受个人次数与项目预算限制。' : 'Claim within 7 days of approval for a 30-day trial. Personal usage and project budget limits still apply.')}</p>
      <p>{zh ? '申请资料用于审核；关闭后按保留规则清理。安全验证由 Cloudflare 提供。' : 'Application details are used for review and cleared under the retention policy. Cloudflare provides the security check.'}</p>
      <details><summary>{zh ? '申请资料如何保存' : 'How application details are retained'}</summary><p>{zh ? '不收集邮箱或训练数据。未获批申请关闭后保留 30 天；获批申请在试用结束且相关事项处理完毕后保留 30 天，再清理申请资料。费用与必要审计记录独立保留。' : 'No email or training data is collected. Unapproved application details are retained for 30 days after closure; approved details for 30 days after the trial and related matters are complete. Billing and necessary audit records are retained separately.'}</p></details>
      {config?.siteKey && <SecurityCheck key={challenge} siteKey={config.siteKey} onProof={setProof} />}
      <button type="submit" disabled={!proof}>{zh ? '提交申请' : 'Submit application'}</button><button type="button" onClick={() => setForm(false)}>{zh ? '返回' : 'Back'}</button>
    </fieldset></form>}

    {!active && statusDetails}
    <button disabled={busy} onClick={() => void run(() => refresh())}>{zh ? '刷新状态' : 'Refresh status'}</button>
    {receipt && <><button disabled={busy} onClick={() => setLink(`${location.origin}/trial#trial=${receipt}`)}>{zh ? '查看私密领取链接' : 'Show private claim link'}</button>{link && <label>{zh ? '请自行保管，不要公开分享' : 'Keep this private; do not share publicly'}<input readOnly value={link} onFocus={e => e.target.select()} /></label>}</>}
    {onSkip && <button className="trial-skip" onClick={onSkip}>{zh ? '先看看应用' : 'Explore the app first'}</button>}
  </section>;
}
