import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { entryCopy, fill } from '../../../i18n/features/onboarding/entry';
import { HomeExit } from '../../components/HomeExit';
import { PrimaryButton } from '../../components/kit';

interface OnboardingFrameProps {
  locale: 'zh' | 'en';
  /** 1-based outer step and total. */
  step: number; total: number;
  /** 0–1 position inside the current step (health check sub-screens). */
  within?: number;
  /** Re-focuses the heading whenever this key changes (each screen). */
  screenKey: string;
  title: ReactNode; sub?: ReactNode; counter?: string;
  onBack?: () => void; backDisabled?: boolean;
  /** 回到今天 (clears unsaved answers after confirming when `homeDirty`). */
  onHome?: () => void; homeDirty?: boolean;
  children?: ReactNode; footer?: ReactNode; busy?: boolean;
}
/** One screen of the V9 onboarding: back, progress track, question, choices and a pinned footer. */
export function OnboardingFrame({ locale, step, total, within = 0, screenKey, title, sub, counter, onBack, backDisabled, onHome, homeDirty = true, children, footer, busy }: OnboardingFrameProps) {
  const t = entryCopy[locale], heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { window.scrollTo?.(0, 0); heading.current?.focus({ preventScroll: true }); }, [screenKey]);
  const ratio = Math.min(1, Math.max(0, (step - 1 + (within > 0 ? within : 1)) / total));
  return <main className="v9-onboarding" lang={locale} aria-busy={busy}>
    <header className="v9-onboarding-top">
      {onHome && <HomeExit locale={locale} dirty={homeDirty} disabled={busy} onLeave={onHome} />}
      <div className="v9-track" role="progressbar" aria-label={fill(t.step, { step, total })} aria-valuemin={1} aria-valuemax={total} aria-valuenow={step}><span style={{ '--progress': ratio.toFixed(3) } as CSSProperties} /></div>
      <span className="v9-onboarding-count v9-num" aria-hidden="true">{String(step).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
    </header>
    <section className="v9-onboarding-body">
      {counter && <p className="v9-onboarding-counter">{counter}</p>}
      <h1 ref={heading} tabIndex={-1} className="v9-display">{title}</h1>
      {sub && <p className="v9-onboarding-sub">{sub}</p>}
      {children}
    </section>
    {/* Bo 2026-10-19: a labelled 上一步 beside 下一步 instead of a bare “<” in the corner. */}
    {(footer || onBack) && <footer className="v9-onboarding-footer" data-orb-avoid="">{footer}
      {onBack && <PrimaryButton tone="quiet" size="md" className="v9-onboarding-back" disabled={backDisabled} onClick={onBack}><span aria-hidden="true">‹ </span>{t.back}</PrimaryButton>}</footer>}
  </main>;
}
