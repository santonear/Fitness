import { createPortal } from 'react-dom';
import { useRef, useState } from 'react';
import type { ScheduledWorkout } from '../../../domain/models';
import { clockTime, timeMinutes, trainingSlotSchema } from '../../../domain/training-time';

export function TrainingTimeEditor({ task, locale, disabled, revision, generation, onSave }: {
  task: ScheduledWorkout; locale: 'zh' | 'en'; disabled: boolean; revision: number; generation: number;
  onSave: (task: ScheduledWorkout, time: string, revision: number, generation: number, durationMinutes?: number) => Promise<unknown>;
}) {
  const zh = locale === 'zh';
  const [preview, setPreview] = useState<string>();
  const [pending, setPending] = useState<{ task: ScheduledWorkout; time: string; revision: number; generation: number; durationMinutes: number }>();
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const drag = useRef<{ y: number; initial: number; time: string; task: ScheduledWorkout; revision: number; generation: number } | undefined>(undefined);
  const blocked = disabled || !!task.completedSessionId || task.status !== 'pending';
  const start = preview ?? task.startTime ?? '00:00';
  function cancelDrag() { drag.current = undefined; setPreview(undefined); }
  return <>
    {task.startTime && task.durationMinutes ? <div className="calendar-training-block" data-training-id={task.id} style={{ top: `${timeMinutes(start) * .8}px`, height: `${task.durationMinutes * .8}px` }}>
      <span>{start}–{clockTime(timeMinutes(start) + task.durationMinutes)} · {task.durationMinutes} {zh ? '分钟' : 'min'}</span>
      <button disabled={blocked || busy} className="calendar-drag-handle" aria-label={zh ? '拖动调整训练时间' : 'Drag to change training time'}
        onPointerDown={event => { if (blocked || event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { y: event.clientY, initial: timeMinutes(task.startTime!), time: task.startTime!, task: {...task}, revision, generation }; }}
        onPointerMove={event => { const gesture = drag.current; if (!gesture) return; const minute = Math.max(0, Math.min(1440 - task.durationMinutes!, Math.round((gesture.initial + (event.clientY - gesture.y) / .8) / 15) * 15)); gesture.time = clockTime(minute); setPreview(gesture.time); }}
        onPointerUp={event => { const gesture = drag.current; if (!gesture) return; setPending({ task: gesture.task, time: gesture.time, revision: gesture.revision, generation: gesture.generation, durationMinutes: task.durationMinutes! }); cancelDrag(); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
        onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}
        onKeyDown={event => { if (event.key === 'Escape') cancelDrag(); }}
        onClick={event => { if (event.detail === 0) setPending({task:{...task},time:task.startTime!,revision,generation,durationMinutes:task.durationMinutes!}); }}>{zh ? '调整时间' : 'Change time'} ↕</button>
    </div> : <button disabled={blocked || busy} onClick={() => setPending({task:{...task},time:'',revision,generation,durationMinutes:30})}>{zh ? '设置训练时间' : 'Set training time'}</button>}
    {pending && createPortal(<div className="training-time-dialog" role="dialog" aria-modal="false" aria-label={zh ? '确认修改训练时间' : 'Confirm training time change'} onKeyDown={event => { if (event.key === 'Escape' && !busy) { setPending(undefined); setError(''); } }}>
      <h3>{zh ? '确认修改训练时间' : 'Confirm training time change'}</h3><p>{pending.task.scheduledDate} · {pending.task.startTime} → {pending.time}</p>
      <label>{zh ? '新的开始时间' : 'New start time'}<input autoFocus type="time" disabled={busy} value={pending.time} onChange={event => setPending({...pending,time:event.target.value})} /></label>
      {pending.task.durationMinutes === undefined && <label>{zh ? '预留分钟数' : 'Reserved minutes'}<input type="number" min="1" max="1440" value={pending.durationMinutes} disabled={busy} onChange={event => setPending({...pending,durationMinutes:Number(event.target.value)})} /></label>}
      <p>{zh ? '确认后同步更新整体计划、月视图和日视图，不消耗 AI 额度。' : 'Confirm to update the plan and both calendar views. No AI allowance is used.'}</p>
      {error && <p role="alert">{error}</p>}
      <button disabled={busy || !trainingSlotSchema.safeParse({date:pending.task.scheduledDate,startTime:pending.time,durationMinutes:pending.durationMinutes}).success} onClick={async () => { setBusy(true); setError(''); try { await onSave(pending.task,pending.time,pending.revision,pending.generation,pending.durationMinutes); setPending(undefined); } catch { setError(zh ? '未能保存，计划或训练状态可能已变化。请取消后重新打开。' : 'Could not save. The plan or workout may have changed; cancel and reopen.'); } finally { setBusy(false); } }}>{zh ? '确认修改' : 'Confirm change'}</button>
      <button disabled={busy} onClick={() => {setPending(undefined);setError('');}}>{zh ? '取消' : 'Cancel'}</button>
    </div>, document.body)}
  </>;
}
