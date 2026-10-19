import './training-calendar.css';
import { useRef, useState } from 'react';
import { homeExitCopy } from '../../i18n/features/plan/training-days';
import { MorphPanel } from './common';
import { PrimaryButton } from './kit';

/**
 * 回到今天 on a sub-page (Bo 2026-10-19). With unsaved input it first asks, then `onLeave` clears that
 * input and opens 今天. Saved plans and workout records are never touched here.
 */
export function HomeExit({ locale, dirty = false, onLeave, disabled = false }: { locale: 'zh' | 'en'; dirty?: boolean; onLeave: () => void; disabled?: boolean }) {
  const t = homeExitCopy[locale], trigger = useRef<HTMLElement | null>(null), [asking, setAsking] = useState(false);
  return <>
    <PrimaryButton tone="text" size="sm" className="v9-home-exit" disabled={disabled}
      onClick={event => { if (!dirty) { onLeave(); return; } trigger.current = event.currentTarget; setAsking(true); }}>{t.home}</PrimaryButton>
    <MorphPanel open={asking} onClose={() => setAsking(false)} triggerRef={trigger} title={t.title} closeLabel={t.cancel}>
      <p>{t.hint}</p>
      <PrimaryButton onClick={() => { setAsking(false); onLeave(); }}>{t.confirm}</PrimaryButton>
    </MorphPanel>
  </>;
}
