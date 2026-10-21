import { useEffect, useState } from 'react';
import { ChoiceChip, PrimaryButton } from '../../components/kit';
import { yayaV5, fillLine } from '../../../i18n/features/coach/yaya-v5';
import { planPagesCopy } from '../../../i18n/features/plan-upgrade/pages';
import { useMainline } from '../../mainline/context';
import { breathingCycles, breathingPhase } from './logic';
import './plan-upgrade.css';

/** 现在有点烦 (v5 §13): 3–5 minutes of slow breathing. Local only; nothing is saved or logged. */
export function CalmPage() {
  const { locale, navigate } = useMainline();
  const c = planPagesCopy[locale], y = yayaV5[locale];
  const [minutes, setMinutes] = useState(3);
  const [elapsed, setElapsed] = useState<number>();
  const [answer, setAnswer] = useState<'better' | 'same' | 'still'>();
  const total = breathingCycles(minutes).totalSeconds;
  const running = elapsed !== undefined && elapsed < total;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setElapsed(value => value === undefined ? value : value + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  const finished = elapsed !== undefined && elapsed >= total;
  return <main className="pu-page pu-calm">
    <header className="pu-head"><h1 className="v9-display">{c.calmTitle}</h1></header>
    <p className="pu-line">{y.calmStart}</p>
    {elapsed === undefined && <>
      <div className="pu-row" role="group" aria-label={c.calmTitle}>{[3, 4, 5].map(value => <ChoiceChip key={value} selected={minutes === value} onClick={() => setMinutes(value)}>{fillLine(c.calmMinutes, { minutes: value })}</ChoiceChip>)}</div>
      <PrimaryButton block onClick={() => setElapsed(0)}>{c.calmTitle}</PrimaryButton>
    </>}
    {running && <section className="pu-breath" aria-live="polite">
      <strong className="v9-display">{breathingPhase(elapsed) === 'inhale' ? c.inhale : c.exhale}</strong>
      <span className="v9-num pu-line">{Math.floor((total - elapsed) / 60)}:{String((total - elapsed) % 60).padStart(2, '0')}</span>
      <PrimaryButton tone="quiet" size="sm" onClick={() => setElapsed(total)}>{c.calmDone}</PrimaryButton>
    </section>}
    {finished && !answer && <section className="pu-card"><p>{y.calmAsk}</p><div className="pu-row">
      <ChoiceChip selected={false} onClick={() => setAnswer('better')}>{y.calmBetter}</ChoiceChip>
      <ChoiceChip selected={false} onClick={() => setAnswer('same')}>{y.calmSame}</ChoiceChip>
      <ChoiceChip selected={false} onClick={() => setAnswer('still')}>{y.calmStill}</ChoiceChip>
    </div></section>}
    {answer === 'still' && <p className="pu-line" role="status">{y.calmStillLine}</p>}
    {(answer || elapsed === undefined) && <PrimaryButton tone="text" size="sm" onClick={() => navigate('/')}>{c.back}</PrimaryButton>}
  </main>;
}
