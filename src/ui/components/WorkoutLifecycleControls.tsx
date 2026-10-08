import { AppIcon, StatusIcon } from './AppIcon';
import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { guidedService } from '../../application/guided';
import type { Locale } from '../../domain/models';
export function WorkoutLifecycleControls({ sessionId, locale, onPaused }: { sessionId: string; locale: Locale; onPaused: (paused: boolean) => void }) {
  const [paused, setPaused] = useState(false); const [revision, setRevision] = useState(0); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { const subscription = liveQuery(() => guidedService.read()).subscribe({ next: state => {
    const paused = state.events.filter(item => item.sessionId === sessionId && ['workout_paused', 'workout_resumed'].includes(item.action)).at(-1)?.action === 'workout_paused';
    setPaused(paused); setRevision(state.revision); onPaused(paused);
  }, error: reason => setError(String(reason)) }); return () => subscription.unsubscribe(); }, [sessionId]);
  return <section className="guided-section"><p>{locale === 'zh' ? '训练可在离线时暂停和恢复；AI 不会自动结束训练。' : 'pause and resume offline; AI never ends this workout automatically.'}</p>
    <button disabled={busy} onClick={() => { setBusy(true); setError(''); void guidedService.workoutTransition(sessionId, !paused, revision).catch(reason => setError(String(reason))).finally(() => setBusy(false)); }}>{locale === 'zh' ? paused ? '恢复训练' : '暂停训练' : paused ? 'resume workout' : 'pause workout'}</button>
    {error && <p role="alert"><StatusIcon status="error"/>{error}</p>}</section>;
}
