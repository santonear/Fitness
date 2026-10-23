import { useFeature } from '../useFeature';
import { TEXT_LIMITS, textIssue } from '../../domain/input-guard';
import { FieldIssue } from './common/FieldIssue';
import { claimDirectActivation, receiptKey, applicationSchema } from '../../ai/trial-recovery';
import { AppIcon, StatusIcon } from './AppIcon';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import type { ApplicationKind } from '../../backend/trial-applications';
import { randomHex } from '../../domain/hex';
import {
  type Application,
  type policyStatusSchema,
  accessStatusSchema,
  configSchema,
  displayNameKey,
  trialApi,
  accessError,
} from './trial/trial-api';
import { TrialApplicationForm } from './trial/TrialApplicationForm';
import { ChoiceChip, PrimaryButton } from './kit';

export { trialApi } from './trial/trial-api';

export function TrialAccess({
  onContinue,
  onSkip,
  onStartPlanning,
}: {
  onContinue?: () => void;
  onSkip?: () => void;
  onStartPlanning?: () => void;
}) {
  const navigate = useNavigate();
  const assistantV2 = useFeature('aiAssistantV2');
  const { i18n } = useTranslation();
  const zh = !i18n.resolvedLanguage?.startsWith('en');
  const [status, setStatus] = useState<z.infer<typeof policyStatusSchema>>();
  const [apps, setApps] = useState<Application[]>([]);
  const [qualificationState, setQualificationState] = useState<'unknown' | 'none' | 'active' | 'expired' | 'revoked'>(
    'unknown',
  );
  const [sessionValid, setSessionValid] = useState(false);
  const [config, setConfig] = useState<{ available: boolean; siteKey: string | null }>();
  const [receipt, setReceipt] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [code, setCode] = useState('');
  const [proof, setProof] = useState('');
  const [challenge, setChallenge] = useState(0);
  const [kind, setKind] = useState<ApplicationKind>('new');
  const [form, setForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [link, setLink] = useState('');
  const requestId = useRef(crypto.randomUUID());
  async function refresh(owner = receipt, start = false) {
    setQualificationState('unknown');
    setStatus(undefined);
    setSessionValid(false);
    let [qualification, applications, availability] = await Promise.allSettled([
      trialApi('trial/access-status', owner ? { receipt: owner } : {}).then(value => accessStatusSchema.parse(value)),
      owner ? trialApi<Application[]>('trial/applications', { receipt: owner }) : Promise.resolve([]),
      trialApi<{ available: boolean; siteKey: string | null }>('trial/application-config'),
    ]);
    if (availability.status === 'fulfilled') setConfig(configSchema.parse(availability.value));
    if (applications.status === 'fulfilled') setApps(z.array(applicationSchema).parse(applications.value));
    if (qualification.status === 'rejected') throw qualification.reason;
    if (
      applications.status === 'fulfilled' &&
      !qualification.value.sessionValid &&
      qualification.value.qualification !== 'revoked' &&
      qualification.value.qualification !== 'expired' &&
      (await claimDirectActivation(owner, applications.value, body => trialApi('trial/claim', body)))
    ) {
      [qualification, applications] = await Promise.allSettled([
        trialApi('trial/access-status', owner ? { receipt: owner } : {}).then(value => accessStatusSchema.parse(value)),
        trialApi<Application[]>('trial/applications', { receipt: owner }),
      ]);
    }
    if (qualification.status === 'rejected') throw qualification.reason;
    const access = qualification.value;
    setQualificationState(access.qualification);
    setSessionValid(access.sessionValid);
    if (access.qualification !== 'none') setStatus(access);
    const valid = access.qualification === 'active' && access.sessionValid;
    if (valid && onContinue) onContinue();
    if (applications.status === 'fulfilled') setApps(z.array(applicationSchema).parse(applications.value));
    else throw applications.reason;
    if (availability.status === 'rejected') throw availability.reason;
    if (start && valid && !onContinue) {
      if (onStartPlanning) onStartPlanning();
      else navigate('/');
    }
  }
  useEffect(() => {
    let value = '';
    try {
      const incoming = new URLSearchParams(location.hash.slice(1)).get('trial');
      if (incoming && /^[a-f0-9]{64}$/.test(incoming)) {
        localStorage.setItem(receiptKey, incoming);
        history.replaceState(null, '', location.pathname + location.search);
      }
      value = localStorage.getItem(receiptKey) ?? '';
      setReceipt(value);
      setName((localStorage.getItem(displayNameKey) ?? '').slice(0, 60));
    } catch {
      setError(zh ? '无法保存申请凭证，请允许本地存储。' : 'Allow browser storage to keep your application receipt.');
    }
    void refresh(value)
      .catch(e => setError(accessError(e, zh)))
      .finally(() => setLoaded(true));
  }, []);
  async function run(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
    } catch (e) {
      setError(accessError(e, zh));
    } finally {
      setBusy(false);
    }
  }
  const nameIssue = textIssue(name, TEXT_LIMITS.name),
    noteIssue = textIssue(note, TEXT_LIMITS.note),
    locale = zh ? 'zh' : 'en';
  async function submit() {
    if (nameIssue || noteIssue) return;
    await run(async () => {
      let owner = receipt;
      if (!owner) {
        owner = randomHex();
        localStorage.setItem(receiptKey, owner);
        setReceipt(owner);
      }
      try {
        await trialApi('trial/apply', { receipt: owner, id: requestId.current, kind, name, note, proof });
        setForm(false);
        requestId.current = crypto.randomUUID();
        await refresh(owner);
      } finally {
        setProof('');
        setChallenge(value => value + 1);
      }
    });
  }
  async function redeem() {
    if (!name.trim() || !code.trim() || nameIssue) return;
    await run(async () => {
      // The name is a local greeting, not a second authentication credential.
      localStorage.setItem(displayNameKey, name.trim());
      await trialApi('trial/redeem', { code: code.trim() });
      setCode('');
      await refresh(receipt, true);
    });
  }
  const pending = apps.some(
    a => (a.state === 'pending' && !a.pendingExpired) || (a.state === 'approved' && (a.claimUntil ?? 0) > Date.now()),
  );
  const hasTrial = Boolean(status || apps.some(a => a.state === 'claimed'));
  const active = qualificationState === 'active' && sessionValid;
  const quotaExhausted =
    !assistantV2 &&
    status &&
    !status.planningBudgetDisabled &&
    status.used &&
    status.limits &&
    status.used.generate >= status.limits.generate;
  const budgetInsufficient =
    !assistantV2 && status?.budgetAvailable && (!status.budgetAvailable.understand || !status.budgetAvailable.generate);
  const words = {
    pending: zh ? '等待审核' : 'Awaiting review',
    approved: zh ? '已批准，待领取' : 'Approved · ready to claim',
    rejected: zh ? '未获批准' : 'Not approved',
    claimed: zh ? '已领取' : 'Claimed',
  };
  return (
    <section className="trial-access" aria-labelledby="trial-title">
      <span className="trial-kicker">FITNESS · AI ACCESS</span>
      <h1 id="trial-title">{zh ? 'AI 试用资格' : 'AI trial access'}</h1>
      <p>
        {zh
          ? '已有邀请码？填写用户名和邀请码，即可开始。还没有邀请码可以申请试用。'
          : 'Have an invitation? Enter your name and code to get started, or apply for a trial.'}
      </p>
      {!loaded && (
        <p role="status">
          <AppIcon name="info" />
          {zh ? '正在查询资格…' : 'Checking your trial…'}
        </p>
      )}
      {error && (
        <p role="alert">
          <StatusIcon status="error" />
          {error}
        </p>
      )}
      {notice && (
        <p role="status">
          <AppIcon name="info" />
          {notice}
        </p>
      )}
      {loaded && qualificationState === 'none' && (
        <p role="status">
          <AppIcon name="info" />
          {zh
            ? '此浏览器尚无可验证的试用资格。可兑换邀请码或查看申请。'
            : 'No verified trial on this browser. Redeem an invitation or check your application.'}
        </p>
      )}
      {status && (
        <div className="trial-summary">
          <strong>
            {qualificationState === 'expired'
              ? zh
                ? '试用已到期，可申请延期'
                : 'Trial expired — request an extension'
              : qualificationState === 'revoked'
                ? zh
                  ? '资格已撤销，请联系管理员'
                  : 'Access revoked — contact the administrator'
                : !sessionValid
                  ? zh
                    ? '资格有效，但此浏览器未启用；可恢复领取或申请补发'
                    : 'Trial active, but this browser is not activated. Recover the claim or request a replacement.'
                  : zh
                    ? 'AI 试用有效'
                    : 'Your AI trial is active'}
          </strong>
          <p>
            {zh ? '有效期至：' : 'Valid until: '}
            {new Date(status.expiresAt).toLocaleString(zh ? 'zh-CN' : 'en')}
          </p>
          <PrimaryButton size="md" disabled={busy} onClick={() => navigate('/')}>
            {zh ? '返回训练' : 'Return to training'}
          </PrimaryButton>
          {quotaExhausted && (
            <p role="status">
              <AppIcon name="info" />
              {zh
                ? '个人次数不足，请等待本期重置或联系管理员。'
                : 'Personal quota exhausted. Wait for the monthly reset or contact the administrator.'}
            </p>
          )}
          {budgetInsufficient && (
            <p role="status">
              <AppIcon name="info" />
              {zh
                ? '项目预算不足，新的 AI 请求暂不可用。请稍后刷新或联系管理员。'
                : 'Project budget is insufficient for new AI requests. Refresh later or contact the administrator.'}
            </p>
          )}
          <p>
            {zh
              ? '试用资格只影响 AI 服务，手动训练和本地记录始终可用。'
              : 'Trial access applies to AI services. Manual training and local records remain available.'}
          </p>
        </div>
      )}
      <ul className="trial-applications">
        {apps.map(a => (
          <li key={a.id}>
            <strong>
              {a.kind === 'extend'
                ? zh
                  ? '延期申请 · '
                  : 'Extension · '
                : a.kind === 'replace'
                  ? zh
                    ? '补发申请 · '
                    : 'Replacement · '
                  : ''}
              {words[a.state]}
            </strong>
            {a.reason && <p>{a.reason}</p>}
            {a.state === 'approved' && (
              <PrimaryButton
                tone="quiet"
                size="md"
                disabled={busy || (a.claimUntil ?? 0) <= Date.now()}
                onClick={() =>
                  void run(async () => {
                    await trialApi('trial/claim', { receipt, id: a.id });
                    await refresh();
                  })
                }
              >
                {(a.claimUntil ?? 0) <= Date.now()
                  ? zh
                    ? '领取已过期'
                    : 'Claim expired'
                  : zh
                    ? '领取并启用'
                    : 'Claim and activate'}
              </PrimaryButton>
            )}
            {a.state === 'claimed' && !active && qualificationState === 'active' && (
              <PrimaryButton
                tone="quiet"
                size="md"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await trialApi('trial/claim', { receipt, id: a.id });
                    await refresh();
                  })
                }
              >
                {zh ? '恢复领取结果' : 'Recover claim result'}
              </PrimaryButton>
            )}
          </li>
        ))}
      </ul>
      <div className="trial-actions">
        {!active && (
          <ChoiceChip selected={!form} disabled={busy} onClick={() => setForm(false)}>
            {zh ? '已有邀请码，开始使用' : 'Use an invitation'}
          </ChoiceChip>
        )}
        <PrimaryButton
          size="md"
          disabled={busy || pending || !config?.available || qualificationState === 'revoked'}
          onClick={() => {
            setKind(hasTrial ? 'extend' : 'new');
            setForm(true);
          }}
        >
          {hasTrial ? (zh ? '申请延期 30 天' : 'Request 30-day extension') : zh ? '申请 AI 试用' : 'Apply for AI trial'}
        </PrimaryButton>
        {hasTrial && qualificationState !== 'expired' && qualificationState !== 'revoked' && (
          <PrimaryButton
            tone="quiet"
            size="md"
            disabled={busy || pending || !config?.available}
            onClick={() => {
              setKind('replace');
              setForm(true);
            }}
          >
            {zh ? '申请补发／更换设备' : 'Request replacement / change device'}
          </PrimaryButton>
        )}
      </div>
      {!active && !form && (
        <form
          className="trial-redeem"
          onSubmit={e => {
            e.preventDefault();
            void redeem();
          }}
        >
          <fieldset disabled={busy}>
            <legend>{zh ? '使用邀请码启动' : 'Start with your invitation'}</legend>
            <label>
              {zh ? '用户名（称呼）' : 'Your name'}
              <input
                required
                maxLength={TEXT_LIMITS.name}
                autoComplete="nickname"
                value={name}
                aria-invalid={nameIssue ? true : undefined}
                onChange={e => setName(e.target.value)}
              />
            </label>
            <FieldIssue issue={nameIssue} locale={locale} max={TEXT_LIMITS.name} />
            <label>
              {zh ? '邀请码' : 'Invitation code'}
              <input
                required
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={code}
                onChange={e => setCode(e.target.value)}
              />
            </label>
            <PrimaryButton type="submit" size="md" disabled={!loaded || !name.trim() || !code.trim() || !!nameIssue}>
              {busy ? (zh ? '正在启用…' : 'Activating…') : zh ? '启用并开始制定计划' : 'Activate and start planning'}
            </PrimaryButton>
            <p className="trial-entry-note">
              {zh
                ? '称呼仅保存在此设备。邀请码用于启用试用，训练记录也保存在本机。'
                : 'Your name and training records stay on this device. The code activates your trial.'}
            </p>
          </fieldset>
        </form>
      )}
      {loaded && config && !config.available && (
        <p>
          {zh
            ? '申请服务暂未开放；仍可使用已有邀请码启动。'
            : 'Applications are not available yet; you can still use an invitation.'}
        </p>
      )}
      {form && (
        <TrialApplicationForm
          zh={zh}
          busy={busy}
          kind={kind}
          name={name}
          setName={setName}
          note={note}
          setNote={setNote}
          requestId={requestId}
          nameIssue={nameIssue}
          noteIssue={noteIssue}
          locale={locale}
          assistantV2={assistantV2}
          config={config}
          challenge={challenge}
          proof={proof}
          setProof={setProof}
          setForm={setForm}
          submit={submit}
        />
      )}

      <PrimaryButton tone="quiet" size="md" disabled={busy} onClick={() => void run(() => refresh())}>
        {zh ? '刷新状态' : 'Refresh status'}
      </PrimaryButton>
      {receipt && (
        <>
          <PrimaryButton
            tone="quiet"
            size="md"
            disabled={busy}
            onClick={() => setLink(`${location.origin}/trial#trial=${receipt}`)}
          >
            {zh ? '查看私密领取链接' : 'Show private claim link'}
          </PrimaryButton>
          {link && (
            <label>
              {zh ? '请自行保管，不要公开分享' : 'Keep this private; do not share publicly'}
              <input readOnly value={link} onFocus={e => e.target.select()} />
            </label>
          )}
        </>
      )}
      {onSkip && (
        <PrimaryButton tone="text" size="sm" onClick={onSkip}>
          {zh ? '先看看应用' : 'Explore the app first'}
        </PrimaryButton>
      )}
    </section>
  );
}
