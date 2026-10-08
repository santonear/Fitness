import { AppIcon, StatusIcon } from './AppIcon';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { backupService, MAX_BACKUP_BYTES } from '../../application/backup';
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

export function BackupPanel({ restored = false }: { restored?: boolean }) {
  const { i18n } = useTranslation();
  const zh = i18n.resolvedLanguage === 'zh';
  const [preview, setPreview] = useState<ValidatedBackup>();
  const [exported, setExported] = useState(false);
  const [kept, setKept] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [step, setStep] = useState(restored ? 4 : 1);
  const restoreFile = useRef<HTMLInputElement>(null);

  async function run(operation: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage(zh ? '准备备份或校验文件中，请稍候。' : 'Preparing backup or validating file. Please wait.');
    try { await operation(); }
    catch (reason) {
      setMessage('');
      const code = reason instanceof DomainError ? reason.code : 'UNEXPECTED';
      const messages: Record<string, [string, string]> = {
        BACKUP_TOO_LARGE: [`文件超过支持上限：16 MiB（${MAX_BACKUP_BYTES} 字节）。原数据未替换。请保留原库，勿清理浏览器数据。`, `The file exceeds 16 MiB (${MAX_BACKUP_BYTES} bytes). Existing data has not been replaced. Keep this library and do not clear browser data.`],
        BACKUP_INVALID: ['文件无法读取或 JSON 内容无效。请选择可读取的原始备份文件重试。原库未替换。', 'The file cannot be read or its JSON is invalid. Select an accessible original backup and retry. Existing data has not been replaced.'],
        BACKUP_REFERENCE_INVALID: ['备份数据关联无效。请选择有效完整备份；原库未替换。', 'Backup data references are invalid. Select a valid complete backup; existing data has not been replaced.'],
        BACKUP_VERSION_UNSUPPORTED: ['不支持此备份版本。请使用兼容应用；原库未替换。', 'This backup version is unsupported. Use a compatible app; existing data has not been replaced.'],
        CONFLICT: ['本地数据已变化，请重新选择恢复文件、下载并保管最新现库备份，再确认替换。原库未替换。', 'Local data changed. Select the restore file again, download and keep a fresh current backup, then confirm replacement. Existing data has not been replaced.'],
        STORAGE_FULL: ['本地存储空间不足，恢复未完成。保留原库与备份，勿清理训练数据。', 'Local storage is full. Restore did not complete. Keep the original library and backups; do not clear training data.'],
      };
      setError(`${code}: ${messages[code]?.[zh ? 0 : 1] ?? (zh ? '操作失败，原库未替换。请保留备份并重试。' : 'Operation failed; existing data has not been replaced. Keep the backup and retry.')}`);
      if (code === 'CONFLICT') {
        setStep(1);
        setPreview(undefined); setExported(false); setKept(false); setConfirmed(false);
        if (restoreFile.current) restoreFile.current.value = '';
      }
    } finally { setBusy(false); }
  }

  return (
    <section className="v31-backup" aria-label={zh ? 'JSON 备份与恢复' : 'JSON backup and restore'}>
      <h2>{zh ? '备份与恢复' : 'Backup and restore'}</h2>
      <p>{zh ? '可以恢复旧版备份；含日期计划的新备份需要此版或兼容的新版本。旧版不支持升级后的日期计划和新备份，请勿直接回退操作同一本地库；回退前保管升级前备份，并使用隔离环境。' : 'Older backups can be restored here. Date plans and new backups require this or a compatible newer app. Older apps do not support the new data: do not roll back against the same library. Keep a pre-upgrade backup and use an isolated environment.'}</p>
      <p>{zh ? `手动下载完整 JSON，保管到浏览器以外。恢复将替换全部本地数据。支持上限：16 MiB（${MAX_BACKUP_BYTES} 个 UTF-8 字节）。旧版应用可能无法恢复超过旧上限的文件。` : `Download complete JSON and keep it outside this browser. Restore replaces all local data. Supported limit: 16 MiB (${MAX_BACKUP_BYTES} UTF-8 bytes). Older apps may reject files above their old limit.`}</p>
      <button disabled={busy} onClick={() => void run(async () => {
        download(await backupService.exportBackup());
        setMessage(zh ? '备份下载已开始，请确认文件已保管。' : 'Backup download started. Check that the file is kept.');
      })}>{zh ? '导出 JSON 备份' : 'Export JSON backup'}</button>
      <ol className="v31-backup-steps" aria-label={zh?'恢复步骤':'Restore steps'}>{(zh?['文件预检','现库保管','双重确认','恢复结果']:['Validate file','Keep current data','Confirm replacement','Restore result']).map((label,index)=><li key={label} aria-current={step===index+1?'step':undefined}><b>{index+1}</b> {label}</li>)}</ol>
      <div hidden={step!==1}><label>
        {zh ? '恢复 JSON 文件' : 'Restore JSON file'}
        <input ref={restoreFile} type="file" accept=".json,application/json" disabled={busy} onChange={event => {
          const file = event.target.files?.[0];
          setPreview(undefined);
          setExported(false);
          setKept(false);
          setConfirmed(false);
          setStep(1);
          if (file) void run(async () => {
            setPreview(await backupService.validateBackup(file));
            setMessage('');
          });
        }} />
      </label>
      {preview&&<><p>{zh?'备份校验通过。文件与引用检查已完成。':'Backup validated, including its data references.'}</p><button onClick={()=>setStep(2)}>{zh?'下一步：保管当前数据':'Next: keep current data'}</button></>}
      </div>
      {preview && (
        <>
          <div hidden={step!==2}><h3>{zh?'替换前，先保管当前数据':'Keep your current data first'}</h3>
          <p>{zh ? `将恢复 ${preview.envelope.data.plans.length} 个计划、${preview.envelope.data.sessions.length} 次训练。` : `Restore ${preview.envelope.data.plans.length} plans and ${preview.envelope.data.sessions.length} workouts.`}</p>
          <button disabled={busy} onClick={() => void run(async () => {
            setExported(false); setKept(false); setConfirmed(false);
            const receipt = await backupService.exportBackupWithReceipt();
            if (receipt.dataRevision !== preview.expectedRevision) throw new DomainError('CONFLICT', 'Backup preview is stale');
            download(receipt.blob);
            setExported(true);
            setMessage(zh ? '当前数据下载已发起，请核对文件并确认已保管；尚未替换原库。' : 'Current-data download started. Check the file and confirm you have kept it; the original library has not been replaced.');
          })}>{zh ? '替换前下载当前数据' : 'Download current data before replacement'}</button>
          <label><input type="checkbox" disabled={busy || !exported} checked={kept} onChange={event => setKept(event.target.checked)} />{zh ? '我已下载并保管当前备份' : 'I have downloaded and kept the current backup'}</label>
          <div className="v31-actions"><button disabled={busy} onClick={()=>setStep(1)}>{zh?'上一步':'Back'}</button><button disabled={busy||!exported||!kept} onClick={()=>setStep(3)}>{zh?'下一步：确认替换':'Next: confirm replacement'}</button></div></div>
          <div hidden={step!==3}><h3>{zh?'核对替换范围':'Review the replacement'}</h3><p>{zh?`将替换为 ${preview.envelope.data.plans.length} 个计划、${preview.envelope.data.sessions.length} 次训练。AI 资格与服务端额度不受此恢复影响。`:`Replace with ${preview.envelope.data.plans.length} plans and ${preview.envelope.data.sessions.length} workouts. Server-side AI access and quota are unaffected.`}</p>
          <label><input type="checkbox" disabled={busy||!exported} checked={kept} onChange={event=>setKept(event.target.checked)} />{zh?'我确认当前数据已另行完整保管':'I confirm my current data is safely kept separately'}</label>
          <label><input type="checkbox" disabled={busy} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />{zh ? '我确认替换全部本地数据' : 'I confirm replacing all local data'}</label>
          <button disabled={busy || !exported || !kept || !confirmed} onClick={() => void run(async () => {
            await backupService.importBackup(preview, { backupExported: exported && kept, replacementConfirmed: confirmed, expectedRevision: preview.expectedRevision });
            setMessage(zh ? '恢复成功。' : 'Restore succeeded.');
            setStep(4);
          })}>{zh ? '替换本地数据' : 'Replace local data'}</button>
          <button disabled={busy} onClick={()=>setStep(2)}>{zh?'上一步':'Back'}</button></div>

        </>
      )}
      <div hidden={step!==4}><h3>{zh?'恢复完成':'Restore complete'}</h3><p>{zh?'已重新读取本地数据。训练资格和费用账本仍以服务端为准。':'Local data has been reloaded. AI access and accounting remain on the server.'}</p><button onClick={()=>setStep(1)}>{zh?'恢复另一份备份':'Restore another backup'}</button></div>
      {error && <p role="alert"><StatusIcon status="error"/>{error}</p>}
      <p aria-live="polite">{message}</p>
    </section>
  );
}
