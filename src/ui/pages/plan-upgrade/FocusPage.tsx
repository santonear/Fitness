import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AnatomyMap, PrimaryButton, SegmentedTabs } from '../../components/kit';
import { sessionMuscleFocus } from '../../../application/rules/plan-upgrade';
import { exercises } from '../../../catalog/exercises';
import { planPagesCopy } from '../../../i18n/features/plan-upgrade/pages';
import { fillLine } from '../../../i18n/features/coach/yaya-v5';
import { useMainline } from '../../mainline/context';
import type { FocusState } from '../home/NowPanel';
import { figureSex, figureShape, shownFocus } from './logic';
import { lastFigureSex, setLastFigureSex } from './prefs';
import { useWidth } from './useWidth';
import './plan-upgrade.css';

/** 今天练这里 (UIUX20261008 V9.14): the figure fills the page; title, legend, numbered cards, start and the figure toggle only. */
export function FocusPage() {
  const { data, locale, busy, start, startManual, navigate } = useMainline();
  const state = useLocation().state as FocusState | null;
  const c = planPagesCopy[locale];
  const values = data?.profile?.bodyDetails?.values;
  const [sex, setSex] = useState(() => figureSex(values?.biologicalSex, lastFigureSex()));
  const [picked, setPicked] = useState<string>();
  const [mapRef, width] = useWidth<HTMLDivElement>();
  if (!state?.exerciseIds?.length) return <Navigate to="/" replace/>;
  const focus = sessionMuscleFocus(state.exerciseIds);
  const shown = shownFocus(focus, picked);
  const name = (id: string) => exercises.find(exercise => exercise.id === id)?.name[locale] ?? id;
  const go = () => { if (state.templateId) void start(state.templateId); else void startManual(state.exerciseIds); };
  return <main className="pu-page pu-focus">
    <header className="pu-head">
      <h1 className="v9-display">{c.focusTitle}</h1>
      <SegmentedTabs label={c.sexLabel} value={sex} onChange={value => { const next = value === 'female' ? 'female' : 'male'; setSex(next); setLastFigureSex(next); }}
        options={[{ value: 'male', label: c.male }, { value: 'female', label: c.female }]}/>
    </header>
    <div className="pu-map" ref={mapRef}>
      <AnatomyMap locale={locale} width={width} labels primary={shown.primary} secondary={shown.secondary} shape={figureShape(values, sex)}/>
    </div>
    <div className="pu-legend" aria-hidden="true"><span><i className="pu-dot"/>{c.primary}</span><span><i className="pu-dot" data-role="secondary"/>{c.secondary}</span></div>
    <ol className="pu-cards">
      {state.exerciseIds.map((id, index) => <li key={id}><button type="button" aria-pressed={picked === id} onClick={() => setPicked(picked === id ? undefined : id)}>
        <span className="pu-num v9-num" aria-hidden="true">{index + 1}</span><span>{name(id)}</span></button></li>)}
    </ol>
    <PrimaryButton block disabled={busy || !!data?.active} onClick={go}>{fillLine(c.start, { minutes: state.minutes })}</PrimaryButton>
    <PrimaryButton tone="text" size="sm" onClick={() => navigate('/')}>{c.back}</PrimaryButton>
  </main>;
}
