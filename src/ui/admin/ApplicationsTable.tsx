import { useState, type Dispatch, type SetStateAction } from 'react';
import type { ControlService } from '../../backend/control';
import { trialApi } from '../components/TrialAccess';
import { adminCopy } from '../../i18n/features/admin/copy';

type Application = Awaited<ReturnType<ControlService['managementReport']>>['applications'][number];
export function ApplicationsTable({ applications, zh, busy, run, reasons, setReasons }: {
  reasons: Record<string, string>; setReasons: Dispatch<SetStateAction<Record<string, string>>>;
  applications: Application[]; zh: boolean; busy: boolean;
  run: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const text = adminCopy[zh ? 'zh' : 'en'];
  const [copyStatus, setCopyStatus] = useState<'copied' | 'copyFailed'>();
  return <>
    {copyStatus && <p role="status">{copyStatus === 'copyFailed' ? text.errors.copyFailed : text.copied}</p>}
    <div className="admin-table-scroll" role="region" aria-label={text.table} tabIndex={0}>
      <table className="admin-applications" aria-label={text.table} aria-busy={busy}>
        <thead><tr>{text.columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
        <tbody>{applications.map(a => <tr key={a.id}>
          <th scope="row"><span>{a.name}</span><button type="button" className="admin-text-action admin-id" aria-label={`${text.copy} ${a.id.slice(0, 8)}`} onClick={() => {
            void Promise.resolve().then(() => navigator.clipboard.writeText(a.id)).then(
              () => setCopyStatus('copied'), () => setCopyStatus('copyFailed'),
            );
          }}>{a.id.slice(0, 8)}</button></th>
          <td>{text.kinds[a.kind]}</td>
          <td><span className="admin-state" data-state={a.state}>{text.states[a.state]}</span></td>
          <td><time dateTime={new Date(a.createdAt).toISOString()}>{new Date(a.createdAt).toLocaleString(zh ? 'zh-CN' : 'en-US')}</time></td>
          <td className="admin-notes">{a.note && <p>{a.note}</p>}{a.reason && <p>{a.reason}</p>}
            {a.directlyActivated && <p>{text.activated}</p>}
            {a.state === 'pending' && <><label>{text.note}<input maxLength={200} disabled={busy} value={reasons[a.id] ?? ''} onChange={e => setReasons(values => ({ ...values, [a.id]: e.target.value }))} /></label><small>{text.effects[a.kind]}</small></>}
          </td>
          <td className="admin-actions">
            {a.state === 'pending' && <>
              <button type="button" className="admin-primary" disabled={busy} onClick={() => void run(() => trialApi('management/application-review', { id: a.id, decision: 'approve', reason: reasons[a.id] ?? '' }))}>{text.approve}</button>
              <button type="button" disabled={busy || !reasons[a.id]?.trim()} onClick={() => void run(() => trialApi('management/application-review', { id: a.id, decision: 'reject', reason: reasons[a.id] }))}>{text.reject}</button>
            </>}
            {a.kind === 'new' && !a.subjectId && (a.state === 'pending' || a.state === 'approved') && <button type="button" className="admin-text-action" disabled={busy} onClick={() => {
              if (confirm(text.confirm)) void run(() => trialApi('management/application-activate', { id: a.id }));
            }}>{text.activate}</button>}
          </td>
        </tr>)}</tbody>
      </table>
    </div>
  </>;
}

