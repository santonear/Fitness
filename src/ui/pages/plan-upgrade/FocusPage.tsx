import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnatomyMap, PrimaryButton, SegmentedTabs } from '../../components/kit';
import { sessionMuscleFocus, weeklyMuscleLoad } from '../../../application/rules/plan-upgrade';
import { muscleTip, type MuscleTip } from '../../../application/yaya-tips';
import { MUSCLE_GROUP_NAMES } from '../../../domain/plan-upgrade';
import { DEFAULT_TIME_ZONE, addDays, todayIn, weekStart } from '../../../domain/local-date';
import { exercises } from '../../../catalog/exercises';
import { planPagesCopy } from '../../../i18n/features/plan-upgrade/pages';
import { fillLine, yayaV5 } from '../../../i18n/features/coach/yaya-v5';
import { yayaTips } from '../../../i18n/features/coach/yaya-tips';
import { useMainline } from '../../mainline/context';
import type { FocusState } from '../home/NowPanel';
import { figureSex, figureShape, shownFocus, weekSetEntries } from './logic';
import { lastFigureSex, setLastFigureSex } from './prefs';
import { useWidth } from './useWidth';
import './plan-upgrade.css';

/** 今天练这里 (UIUX20261008 V9.14): the figure fills the page; title, legend, numbered cards, start and the figure toggle only. */
/**
 * v5 §8 on 今天练这里 (Bo 2026-10-25): one line when a group the plan works is still short this week, else when push
 * clearly outweighs pull. “补上 / 加” changes today's session at once as a new plan version (undo in the toast).
 */
function ScanTip({ tip, state }: { tip: MuscleTip; state: FocusState }) {
  const { locale, busy, applyPlanCandidate } = useMainline();
  const go = useNavigate();
  const [closed, setClosed] = useState(false);
  if (closed) return null;
  const y = yayaV5[locale],
    s = yayaTips[locale].summary;
  const name = tip.kind === 'gap' ? MUSCLE_GROUP_NAMES[tip.group][locale === 'zh' ? 0 : 1] : '',
    group = locale === 'zh' ? name : name.toLowerCase();
  const apply = () =>
    void applyPlanCandidate({
      ...tip,
      summary: tip.kind === 'gap' ? fillLine(s.gap, { group, sets: tip.sets }) : s.pushPull,
    }).then(saved => {
      if (!saved) return;
      setClosed(true);
      const template = saved.templates.find(row => row.id === tip.template.id) ?? tip.template;
      // The page follows the saved session: its exercises and minutes.
      go('/today-focus', {
        replace: true,
        state: {
          ...state,
          exerciseIds: [...new Set(template.items.map(item => item.exerciseId))],
          minutes: template.estimatedMinutes,
        } satisfies FocusState,
      });
    });
  return (
    <div className="pu-tip" role="status">
      <p>{tip.kind === 'gap' ? fillLine(y.scanGap, { group, sets: tip.sets }) : y.scanPushPull}</p>
      <div className="pu-tip-row">
        <PrimaryButton tone="quiet" size="sm" disabled={busy} onClick={apply}>
          {tip.kind === 'gap' ? y.scanGapYes : y.scanPushPullYes}
        </PrimaryButton>
        <PrimaryButton tone="text" size="sm" onClick={() => setClosed(true)}>
          {tip.kind === 'gap' ? y.scanGapNo : y.scanPushPullNo}
        </PrimaryButton>
      </div>
    </div>
  );
}

export function FocusPage() {
  const { data, locale, busy, start, startManual, navigate } = useMainline();
  const state = useLocation().state as FocusState | null;
  // Weekly sets per group, counted the same way as 今天's panel.
  const today = todayIn(data?.profile?.timeZone ?? DEFAULT_TIME_ZONE),
    monday = weekStart(today);
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  const weekSets = weekSetEntries(data?.workouts ?? [], weekDates);
  const tip =
    state?.templateId && data?.version && data.plan && !data.plan.readOnly && !data.active
      ? muscleTip({
          version: data.version,
          templateId: state.templateId,
          weekLoads: weeklyMuscleLoad(weekSets),
          weekSets,
        })
      : undefined;
  const c = planPagesCopy[locale];
  const values = data?.profile?.bodyDetails?.values;
  const [sex, setSex] = useState(() => figureSex(values?.biologicalSex, lastFigureSex()));
  const [picked, setPicked] = useState<string>();
  const [mapRef, width] = useWidth<HTMLDivElement>();
  if (!state?.exerciseIds?.length) return <Navigate to="/" replace />;
  const focus = sessionMuscleFocus(state.exerciseIds);
  const shown = shownFocus(focus, picked);
  const name = (id: string) => exercises.find(exercise => exercise.id === id)?.name[locale] ?? id;
  const go = () => {
    if (state.templateId) void start(state.templateId);
    else void startManual(state.exerciseIds);
  };
  return (
    <main className="pu-page pu-focus">
      <header className="pu-head">
        <h1 className="v9-display">{c.focusTitle}</h1>
        <SegmentedTabs
          label={c.sexLabel}
          value={sex}
          onChange={value => {
            const next = value === 'female' ? 'female' : 'male';
            setSex(next);
            setLastFigureSex(next);
          }}
          options={[
            { value: 'male', label: c.male },
            { value: 'female', label: c.female },
          ]}
        />
      </header>
      <div className="pu-map" ref={mapRef}>
        <AnatomyMap
          locale={locale}
          width={width}
          labels
          primary={shown.primary}
          secondary={shown.secondary}
          shape={figureShape(values, sex)}
        />
      </div>
      <div className="pu-legend" aria-hidden="true">
        <span>
          <i className="pu-dot" />
          {c.primary}
        </span>
        <span>
          <i className="pu-dot" data-role="secondary" />
          {c.secondary}
        </span>
      </div>
      {tip && state && <ScanTip key={`${data?.version?.id}:${tip.kind}`} tip={tip} state={state} />}
      <ol className="pu-cards">
        {state.exerciseIds.map((id, index) => (
          <li key={id}>
            <button
              type="button"
              aria-pressed={picked === id}
              onClick={() => setPicked(picked === id ? undefined : id)}
            >
              <span className="pu-num v9-num" aria-hidden="true">
                {index + 1}
              </span>
              <span>{name(id)}</span>
            </button>
          </li>
        ))}
      </ol>
      <PrimaryButton block disabled={busy || !!data?.active} onClick={go}>
        {fillLine(c.start, { minutes: state.minutes })}
      </PrimaryButton>
      <PrimaryButton tone="text" size="sm" onClick={() => navigate('/')}>
        {c.back}
      </PrimaryButton>
    </main>
  );
}
