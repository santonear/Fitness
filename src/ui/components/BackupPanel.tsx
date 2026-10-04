import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { backupService } from '../../application/backup';
import { DomainError } from '../../domain/errors';
import type { ValidatedBackup } from '../../domain/models';

function download(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `fitness-backup-${new Date().toISOString().replaceAll(':', '-')}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function BackupPanel() {
  const { i18n } = useTranslation();
  const zh = i18n.resolvedLanguage === 'zh';
  const [preview, setPreview] = useState<ValidatedBackup>();
  const [exported, setExported] = useState(false);
  const [kept, setKept] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function run(operation: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try { await operation(); }
    catch (reason) {
      setError(reason instanceof DomainError ? `${reason.code}: ${reason.message}` : String(reason));
    } finally { setBusy(false); }
  }

  return (
    <section aria-label={zh ? 'JSON 备份与恢复' : 'JSON backup and restore'}>
      <h2>{zh ? '备份与恢复' : 'Backup and restore'}</h2>
      <p>{zh ? '可以恢复旧版备份；含日期计划的新备份需要此版或兼容的新版本。旧版不支持升级后的日期计划和新备份，请勿直接回退操作同一本地库；回退前保管升级前备份，并使用隔离环境。' : 'Older backups can be restored here. Date plans and new backups require this or a compatible newer app. Older apps do not support the new data: do not roll back against the same library. Keep a pre-upgrade backup and use an isolated environment.'}</p>
      <p>{zh ? '手动下载 JSON，保管到浏览器以外。恢复将替换全部本地数据，建议文件不超过 10 MB。' : 'Download JSON and keep it outside this browser. Restore replaces all local data; files must be no larger than 10 MB.'}</p>
      <button disabled={busy} onClick={() => void run(async () => {
        download(await backupService.exportBackup());
        setMessage(zh ? '备份下载已开始，请确认文件已保管。' : 'Backup download started. Check that the file is kept.');
      })}>{zh ? '导出 JSON 备份' : 'Export JSON backup'}</button>
      <label>
        {zh ? '恢复 JSON 文件' : 'Restore JSON file'}
        <input type="file" accept=".json,application/json" disabled={busy} onChange={event => {
          const file = event.target.files?.[0];
          setPreview(undefined);
          setExported(false);
          setKept(false);
          setConfirmed(false);
          if (file) void run(async () => {
            setPreview(await backupService.validateBackup(file));
          });
        }} />
      </label>
      {preview && (
        <>
          <p>{zh ? '备份校验通过' : 'Backup validated'}</p>
          <p>{zh ? `将恢复 ${preview.envelope.data.plans.length} 个计划、${preview.envelope.data.sessions.length} 次训练。` : `Restore ${preview.envelope.data.plans.length} plans and ${preview.envelope.data.sessions.length} workouts.`}</p>
          <button disabled={busy} onClick={() => void run(async () => {
            download(await backupService.exportBackup());
            setExported(true);
          })}>{zh ? '替换前下载当前数据' : 'Download current data before replacement'}</button>
          <label><input type="checkbox" disabled={busy || !exported} checked={kept} onChange={event => setKept(event.target.checked)} />{zh ? '我已下载并保管当前备份' : 'I have downloaded and kept the current backup'}</label>
          <label><input type="checkbox" disabled={busy} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />{zh ? '我确认替换全部本地数据' : 'I confirm replacing all local data'}</label>
          <button disabled={busy || !exported || !kept || !confirmed} onClick={() => void run(async () => {
            await backupService.importBackup(preview, { backupExported: exported && kept, replacementConfirmed: confirmed, expectedRevision: preview.expectedRevision });
          })}>{zh ? '替换本地数据' : 'Replace local data'}</button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <p aria-live="polite">{message}</p>
    </section>
  );
}
