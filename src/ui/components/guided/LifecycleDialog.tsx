import { useEffect, useRef, useState } from 'react';
import type { GuidedLocale } from './GuidedOnboarding';
import '../../guided.css';

export interface LifecycleDialogProps {
  locale: GuidedLocale;
  action: 'pause' | 'cancel' | 'resume';
  open: boolean;
  busy?: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
}
export function LifecycleDialog({ locale, action, open, busy = false, error, onClose, onConfirm }: LifecycleDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState('');
  const [confirmCancellation, setConfirmCancellation] = useState(false);
  const t = (zh: string, en: string) => locale === 'en' ? en : zh;
  useEffect(() => {
    if (open) { setReason(''); setConfirmCancellation(false); if (!dialog.current?.open) dialog.current?.showModal(); }
    else dialog.current?.close();
  }, [open, action]);
  const title = action === 'pause' ? t('暂停计划', 'pause plan') : action === 'resume' ? t('恢复原计划', 'resume original plan') : t('取消计划', 'cancel plan');
  return <dialog ref={dialog} className="guided-panel guided-dialog" aria-labelledby="guided-lifecycle-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <h2 id="guided-lifecycle-title">{confirmCancellation ? t('确认取消这个计划？', 'confirm cancellation?') : title}</h2>
    <p>{action === 'resume' ? t('离线也可恢复尚未过期的原安排。错过的训练不会自动补排，到期不自动延长。', 'resume unexpired sessions offline. missed workouts are not rescheduled and the end date is not extended.') : action === 'pause' ? t('本地立即停止后续安排。当前训练和历史会保留；AI 或网络不可用不影响暂停。', 'stop future sessions locally. retain the current workout and history; pausing does not depend on AI or connectivity.') : t('停止后续安排并保留历史和当前训练。取消后不会自动创建新计划。', 'stop future sessions and retain history and the current workout. cancellation does not create a new plan.')}</p>
    {action !== 'resume' && !confirmCancellation && <label>{t('原因（可不说明）', 'reason (optional)')}<textarea value={reason} maxLength={2000} disabled={busy} onChange={event => setReason(event.target.value)} /></label>}
    {confirmCancellation && reason.trim() && <p>{reason}</p>}
    {error && <p role="alert">{error}</p>}
    <div className="guided-actions"><button type="button" autoFocus disabled={busy} onClick={onClose}>{t('返回', 'back')}</button><button type="button" className="guided-primary" disabled={busy} onClick={() => {
      if (action === 'cancel' && !confirmCancellation) { setConfirmCancellation(true); return; }
      onConfirm(reason.trim() || undefined);
    }}>{busy ? t('保存中…', 'saving…') : action === 'cancel' && !confirmCancellation ? t('继续取消', 'continue cancellation') : t('确认', 'confirm')}</button></div>
  </dialog>;
}

export interface GuidedTimelineEntry { id: string; date: string; title: string; detail?: string; result?: string; }
export function GuidedTimeline({ locale, entries }: { locale: GuidedLocale; entries: GuidedTimelineEntry[] }) {
  return <section className="guided-panel guided-timeline"><h2>{locale === 'en' ? 'plan history' : '计划回顾'}</h2>{entries.length === 0 ? <p>{locale === 'en' ? 'no adjustments recorded yet' : '还没有调整记录'}</p> : <ol>{entries.map(entry => <li key={entry.id}><time>{entry.date}</time><h3>{entry.title}</h3>{entry.result && <p>{entry.result}</p>}{entry.detail && <details><summary>{locale === 'en' ? 'view details' : '查看详情'}</summary><p>{entry.detail}</p></details>}</li>)}</ol>}</section>;
}
