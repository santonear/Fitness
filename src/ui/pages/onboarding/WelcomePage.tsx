import { useEffect, useRef } from 'react';
import { entryCopy } from '../../../i18n/features/onboarding/entry';
import { PrimaryButton, ProgressRing, Scene, Yaya } from '../../components/kit';
import { useOptionalTheme } from '../../../themes/ThemeProvider';
import './onboarding.css';

/** First launch: one screen that says what the app does, then 开始. Nothing is stored here. */
export function WelcomePage({ locale, onStart, onRestore }: { locale: 'zh' | 'en'; onStart: () => void; onRestore?: () => void }) {
  const t = entryCopy[locale].welcome, heading = useRef<HTMLHeadingElement>(null), theme = useOptionalTheme()?.theme;
  useEffect(() => { heading.current?.focus(); }, []);
  return <main className="v9-welcome" lang={locale}>
    {theme === 'vivid' && <Scene variant="dawn" className="v9-welcome-scene" />}
    <header className="v9-welcome-head"><span className="v9-welcome-kicker">fitness</span><span className="v9-welcome-kicker">{t.kicker}</span><i className="v9-brand-dash" aria-hidden="true" /></header>
    <h1 ref={heading} tabIndex={-1} className="v9-display v9-welcome-title">{t.title}</h1>
    <p className="v9-welcome-sub">{t.sub}</p>
    <div className="v9-welcome-figure"><ProgressRing value={0.72} size={250} stroke={10}><Yaya pose="wave" size={170} alt={t.yaya} /></ProgressRing></div>
    <ul className="v9-welcome-points">{t.points.map(point => <li key={point}>{point}</li>)}</ul>
    <footer className="v9-welcome-actions" data-orb-avoid="">
      <PrimaryButton onClick={onStart}>{t.start}</PrimaryButton>
      {onRestore && <PrimaryButton tone="text" size="md" onClick={onRestore}>{t.restore}</PrimaryButton>}
    </footer>
  </main>;
}
