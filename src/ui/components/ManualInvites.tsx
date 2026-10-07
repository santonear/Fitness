import { useState } from 'react';
import { trialApi } from './TrialAccess';

type Invite = { inviteId: string; expiresAt: number };
export function ManualInvites({ zh, invites, busy, run }: {
  zh: boolean; invites: Invite[]; busy: boolean; run: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const [issued, setIssued] = useState<Invite & { code: string }>();
  const [copyStatus, setCopyStatus] = useState('');
  return <article className="management-item">
    <h3>{zh ? '手动生成邀请码' : 'Create invitation code'}</h3>
    <p>{zh ? '无需用户先申请。每码仅可兑换一次，7 天内有效，兑换后试用 30 天。个人次数与项目预算限制继续生效。' : 'No application needed. Each code can be redeemed once within 7 days for a 30-day trial. Personal quotas and the project budget still apply.'}</p>
    <button disabled={busy} onClick={() => {
      if (!confirm(zh ? '生成一个新的试用邀请码？请复制后私下交给使用者。' : 'Create one new trial invitation? Copy it and share privately with the recipient.')) return;
      void run(async () => {
        setIssued(undefined); setCopyStatus('');
        setIssued(await trialApi<Invite & { code: string }>('management/invites', {}));
      });
    }}>{zh ? '生成邀请码' : 'Generate invitation'}</button>
    {issued && <div>
      <label>{zh ? '新邀请码' : 'New invitation code'}<input readOnly value={issued.code} onFocus={e => e.target.select()} /></label>
      <p>{zh ? '兑换截止：' : 'Redeem by: '}{new Date(issued.expiresAt).toLocaleString()}</p>
      <button onClick={() => { void Promise.resolve().then(() => navigator.clipboard.writeText(issued.code)).then(
        () => setCopyStatus(zh ? '已复制' : 'Copied'),
        () => setCopyStatus(zh ? '复制失败，请选中邀请码手动复制。' : 'Copy failed. Select the code and copy it manually.'),
      ); }}>{zh ? '复制邀请码' : 'Copy invitation'}</button>
      {copyStatus && <p role="status">{copyStatus}</p>}
      <small>{zh ? '离开此页面后不再显示完整邀请码，请及时保存。' : 'The full code will no longer be shown after leaving this page. Save it now.'}</small>
    </div>}
    <h4>{zh ? '尚未兑换的邀请码' : 'Unredeemed invitations'}</h4>
    <p>{zh ? '若生成后网络中断，先刷新核对下方记录，可撤销未收到的码，再重新生成。列表只显示编号。' : 'If the connection fails during generation, refresh and check these records. Revoke any undelivered code before generating another. Only identifiers are listed.'}</p>
    {invites.length === 0 && <p>{zh ? '暂无有效邀请码' : 'No active invitations'}</p>}
    {invites.map(invite => <div key={invite.inviteId}>
      <p>{zh ? '编号：' : 'ID: '}{invite.inviteId.slice(0, 12)} · {new Date(invite.expiresAt).toLocaleString()}</p>
      <button disabled={busy} aria-label={`${zh ? '撤销邀请码' : 'Revoke invitation'} ${invite.inviteId.slice(0, 12)}`} onClick={() => {
        if (!confirm(zh ? '撤销这个尚未兑换的邀请码？' : 'Revoke this unredeemed invitation?')) return;
        void run(async () => {
          await trialApi('management/invites/revoke', { inviteId: invite.inviteId });
          if (issued?.inviteId === invite.inviteId) { setIssued(undefined); setCopyStatus(''); }
        });
      }}>{zh ? '撤销邀请码' : 'Revoke invitation'}</button>
    </div>)}
  </article>;
}
