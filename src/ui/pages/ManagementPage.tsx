import { ApplicationsTable } from '../admin/ApplicationsTable';
import { adminTokens } from '../admin/tokens';
import '../admin/admin.css';
import { AppIcon, StatusIcon } from '../components/AppIcon';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { trialApi } from '../components/TrialAccess';
import { ManualInvites } from '../components/ManualInvites';
import type { ControlService } from '../../backend/control';
type Data = Awaited<ReturnType<ControlService['managementReport']>>;
export function ManagementPage() {
  const { i18n } = useTranslation(); const zh = i18n.resolvedLanguage === 'zh';
  useEffect(() => {
    try { if (!localStorage.getItem('fitness.language')) void i18n.changeLanguage('zh'); }
    catch { void i18n.changeLanguage('zh'); }
  }, [i18n]);
  const [data, setData] = useState<Data>(); const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [costs, setCosts] = useState<Record<string, string>>({});
  const [quotaReasons, setQuotaReasons] = useState<Record<string, string>>({});
  const [replacement, setReplacement] = useState<{ subjectId: string; code: string; expiresAt: number }>();
  const quotaRetries = useRef<Record<string, { id: string; subjectId: string; period: string; reason: string }>>({});
  function restoreQuota(quota: Data['quotas'][number]) {
    const previous = quotaRetries.current[quota.subjectId];
    const input = previous ?? { id: crypto.randomUUID(), subjectId: quota.subjectId, period: quota.period, reason: (quotaReasons[quota.subjectId] ?? '').trim() };
    if (!input.reason || !confirm(zh ? `将此用户 ${input.period} 剩余次数恢复为：计划生成 ${quota.defaults.generate} 次？不延长资格，不改变费用及月预算。` : `Restore this user's ${input.period} remaining quota to ${quota.defaults.generate} plans? Expiry, charges and project budget stay unchanged.`)) return;
    quotaRetries.current[quota.subjectId] = input;
    void run(async () => {
      await trialApi('management/quota-restore', input);
      delete quotaRetries.current[quota.subjectId];
      setQuotaReasons(values => ({ ...values, [quota.subjectId]: '' }));
    });
  }
  const [tab, setTab] = useState<'applications' | 'trials' | 'budget' | 'audit'>('applications');
  async function refresh() { setData(await trialApi<Data>('management/applications', {})); }
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError(false); try { await action(); await refresh(); }
    catch { setError(true); }
    finally { setBusy(false); }
  }
  useEffect(() => { void run(async () => {}); }, []);
  const money = (fen: number) => `¥${(fen / 100).toFixed(2)}`;
  const period = new Intl.DateTimeFormat('en-CA', { timeZone: data?.policy.timeZone ?? 'Asia/Shanghai', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const month = `${period.find(p => p.type === 'year')?.value}-${period.find(p => p.type === 'month')?.value}`;
  const budget = data?.report.budgets.find(b => b.period === month);
  const reserved = data?.report.budgets.reduce((sum, b) => sum + b.reservedFen, 0);
  return <div className="admin-console" style={adminTokens}><aside><a className="management-brand" href="/">Fitness.</a><p>{zh ? '管理工作台' : 'Management'}</p>
    <nav aria-label={zh ? '管理导航' : 'Management navigation'}>{(['applications','trials','budget','audit'] as const).map((name, i) => <button key={name} aria-current={tab === name ? 'page' : undefined} onClick={() => setTab(name)}>{(zh ? ['申请审核','试用资格','预算与用量','操作记录'] : ['Applications','Trials','Budget & usage','Audit log'])[i]}</button>)}</nav>
    <p>{zh ? '仅管理员可访问。训练数据仍在用户设备。' : 'Administrator only. Training data remains on users’ devices.'}</p></aside>
    <main><header><div><span className="admin-kicker">FITNESS CONTROL</span><h1>{zh ? '应用管理' : 'Application management'}</h1></div><div><button disabled={busy} onClick={() => void run(async () => {})}><AppIcon name="refresh"/>{zh ? '刷新' : 'Refresh'}</button><button onClick={() => void i18n.changeLanguage(zh ? 'en' : 'zh')}>{zh ? 'English' : '中文'}</button></div></header>
      {error && <p role="alert"><StatusIcon status="error"/>{zh ? '操作或状态查询失败，请刷新核对。不要将未知状态当成成功。' : 'The operation or status check failed. Refresh to verify; the outcome is unknown.'}{data && (zh ? ' 以下保留上次成功读取的数据，当前状态未知。' : ' Values below are from the last successful read; current status is unknown.')}</p>}{busy && <p role="status"><AppIcon name="info"/>{zh ? '正在处理…' : 'Working…'}</p>}
      <div className="management-summary"><article><span>{zh ? 'AI 控制开关' : 'AI control switch'}</span><strong>{data ? (data.report.aiEnabled ? (zh ? '开启' : 'Enabled') : (zh ? '关闭' : 'Disabled')) : '—'}</strong><small>{zh ? '开关状态不代表模型或网络可用' : 'This does not prove model or network availability'}</small></article>
        <article><span>{zh ? '已预留未结算' : 'Reserved, not settled'}</span><strong>{reserved === undefined ? '—' : money(reserved)}</strong></article>
        <article><span>{zh ? '本月剩余预算' : 'Available monthly budget'}</span><strong>{data?.policy.planningBudgetDisabled ? (zh ? '暂不限制' : 'Temporarily unlimited') : reserved === undefined || !data ? '—' : money(Math.max(0, data.policy.budgetLimit - (budget?.spentFen ?? 0) - reserved))}</strong><small>{data?.policy.planningBudgetDisabled ? (zh ? '理解/生成金额限制关闭；费用继续记录' : 'Planning budget limits off; accounting retained') : data ? `${zh ? '月上限' : 'Monthly cap'} ${money(data.policy.budgetLimit)} · ${zh ? '单次上限' : 'Request bound'} ${money(data.policy.reservation)}` : '—'}</small></article></div>
      {data && <p>{zh ? '最后读取：' : 'Last read: '}{new Date(data.report.capturedAt).toLocaleString()} · {data.policy.timeZone}{data.service.reconciliationRequired && <strong role="alert"> {zh ? '账本需要核对，暂停新增调用' : 'Reconciliation required; new calls blocked'}</strong>}</p>}
      <p>{zh ? '当前站点：' : 'Current site: '}{location.origin} · {zh ? '供应商连接状态未主动探测；此页不发起模型调用。' : 'Provider connectivity is not actively probed; this page makes no model calls.'}</p>
      {tab === 'audit' && <section><h2>{zh ? '最近操作记录' : 'Recent audit events'}</h2><ul>{data?.audit.map((item, index) => <li key={index}>{new Date(item.at).toLocaleString()} · {item.event} {item.subjectId}</li>)}</ul><h3>{zh ? '额度恢复记录' : 'Quota restorations'}</h3>{data?.quotaRestorations?.map(item => <p key={item.id}>{new Date(item.at).toLocaleString()} · {item.subjectId} · {item.period} · {item.reason}</p>)}</section>}
      {tab === 'applications' && <section><h2>{zh ? '申请审核' : 'Application review'}</h2>{data?.applications.length === 0 && <p>{zh ? '暂无申请' : 'No applications yet'}</p>}
        {data && <ApplicationsTable applications={data.applications} zh={zh} busy={busy} run={run} reasons={reasons} setReasons={setReasons} />}<button disabled={busy || !data} onClick={() => void run(() => trialApi('management/application-retention', {}))}>{zh ? '清理已超过保留期的申请资料' : 'Clear application details past retention'}</button></section>}
      {tab === 'trials' && <section><h2>{zh ? '试用资格' : 'Trial qualifications'}</h2>{data && <ManualInvites zh={zh} invites={data.invites ?? []} busy={busy} run={run} />}{data?.report.subjects.map(s => <article className="management-item" key={s.subjectId}><strong>{s.subjectId}</strong><p>{new Date(s.expiresAt).toLocaleString()} · {s.revoked ? (zh ? '已撤销' : 'Revoked') : s.expired ? (zh ? '已到期' : 'Expired') : (zh ? '有效' : 'Active')}</p><button disabled={busy || s.revoked} onClick={() => { if (confirm(zh ? '撤销此资格？已保存训练不受影响。' : 'Revoke this trial? Saved training is unaffected.')) void run(() => trialApi('management/revoke', { subjectId: s.subjectId })); }}>{zh ? '撤销资格' : 'Revoke trial'}</button>
        <p>{data.applications.find(a => a.subjectId === s.subjectId)?.name ?? (zh ? '邀请码用户' : 'Invitation user')}</p>
        <button disabled={busy || s.expired} onClick={() => { if (confirm(zh ? '为此用户生成新激活码？旧会话和旧码立即失效；原有效期和已用次数保留。新码7天内兑换，且不超过原有效期。' : 'Generate a replacement code? Existing sessions and codes stop working immediately. Expiry and usage stay unchanged. Redeem within 7 days or the original expiry, whichever is earlier.')) void run(async () => { setReplacement(undefined); setReplacement(await trialApi('management/reissue', { subjectId: s.subjectId })); }); }}>{zh ? '生成此用户激活码' : 'Generate user activation code'}</button>
        {replacement?.subjectId === s.subjectId && <label>{zh ? '新激活码（离开页面后不再显示）' : 'New activation code (shown only here)'}<input readOnly value={replacement.code} onFocus={e => e.target.select()} /></label>}
        <button disabled={busy} onClick={() => { if (confirm(zh ? '删除此账号？资格、登录会话和激活码立即失效，并从用户列表移除。保留费用、用量和操作记录；不删除设备上的训练数据。' : 'Delete this account? Access, sessions and codes stop working immediately and the account leaves this list. Billing, usage and audit records remain. Device training data is unchanged.')) void run(async () => { await trialApi('management/subject-delete', { subjectId: s.subjectId }); if (replacement?.subjectId === s.subjectId) setReplacement(undefined); }); }}>{zh ? '删除账号' : 'Delete account'}</button>
        {data.quotas?.filter(q => q.subjectId === s.subjectId).map(q => <div key={q.period}>
          <p>{q.period} · {zh ? '剩余计划生成次数：' : 'Remaining plan generations: '}{Math.max(0, q.limits.generate - q.used.generate)}</p>
          <p>{zh ? '本月累计使用：' : 'Recorded monthly usage: '}{q.used.understand} / {q.used.generate}</p>
          <label>{zh ? '恢复原因' : 'Restoration reason'}<input maxLength={200} disabled={busy || Boolean(quotaRetries.current[s.subjectId])} value={quotaReasons[s.subjectId] ?? ''} onChange={e => setQuotaReasons({ ...quotaReasons, [s.subjectId]: e.target.value })} /></label>
          <button disabled={busy || s.revoked || s.expired || (!quotaReasons[s.subjectId]?.trim() && !quotaRetries.current[s.subjectId])} onClick={() => restoreQuota(q)}>{quotaRetries.current[s.subjectId] ? (zh ? '重试同一次恢复' : 'Retry same restoration') : (zh ? '刷新额度' : 'Refresh quota')}</button>
          {quotaRetries.current[s.subjectId] && <button disabled={busy} onClick={() => { if (confirm(zh ? '请先刷新并核对操作记录。确认结束此次重试？这不会撤销可能已完成的恢复。' : 'Refresh and check the audit log first. End this retry? This does not undo a restoration that may have completed.')) { delete quotaRetries.current[s.subjectId]; setQuotaReasons(values => ({ ...values, [s.subjectId]: '' })); } }}>{zh ? '结束此次重试' : 'End this retry'}</button>}
          <small>{zh ? '恢复剩余次数至默认上限，仅本月有效；保留历史用量，仍受项目预算和并发限制。' : 'Restore remaining counts to defaults for this month. Usage history, project budget and concurrency limits remain in force.'}</small>
        </div>)}
      </article>)}</section>}
      {tab === 'budget' && <section><h2>{zh ? '费用核算' : 'Cost reconciliation'}</h2><p>{zh ? '预留不是实际费用。仅依据供应商账单核算；无法归属的费用继续保留。' : 'Reservations are not actual charges. Settle only against supplier billing evidence; retain unresolved amounts.'}</p>{data?.report.requests.map(r => <article key={`${r.subjectId}:${r.requestId}`} className="management-item"><strong>{r.requestId}</strong><p>{r.operation} · {r.period} · {r.status} · {money(r.boundFen)}</p>{r.status === 'pending' && <><label>{zh ? '已核对实际费用（分）' : 'Verified actual cost (fen)'}<input type="number" min="0" step="1" value={costs[`${r.subjectId}:${r.requestId}`] ?? ''} onChange={e => setCosts({ ...costs, [`${r.subjectId}:${r.requestId}`]: e.target.value })} /></label><button disabled={busy || !/^\d+$/.test(costs[`${r.subjectId}:${r.requestId}`] ?? '')} onClick={() => { if (confirm(zh ? '确认已核对账单并按此金额结算？' : 'Confirm the bill was verified and settle this amount?')) void run(() => trialApi('management/settle', { subjectId: r.subjectId, requestId: r.requestId, actualCost: Number(costs[`${r.subjectId}:${r.requestId}`]) })); }}>{zh ? '确认核算' : 'Confirm settlement'}</button></>}</article>)}</section>}
    </main></div>;
}
