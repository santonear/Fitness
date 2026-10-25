import { answerText } from '../../../application/preset-text';
import { engineDisplayNotices } from '../../../application/engine-presentation';
import { localDateIn, planReasons, startDateLabel, weekdayIndex } from '../../../application/plan-presentation';
import { StartDatePicker } from '../../components/StartDatePicker';
import type { EnginePlan } from '../../../engine/contracts';
import { planLifecycleCopy } from '../../../i18n/features/plan/lifecycle';
import { planViewCopy } from '../../../i18n/features/plan/view';
import type { CoachResponse } from '../../../coach/contracts';
import { EXERCISE_IDS } from '../../../catalog/exercise-ids';
import type { V8Locale } from '../../../i18n/namespaces.contract';
import type { ThemeSlots } from '../../../themes/contract';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { enter, grow, reducedMotion } from '../../motion';
import { ExerciseGuidePanel } from '../../components/ExerciseGuide';
import { PrimaryButton, SegmentedTabs, Yaya } from '../../components/kit';
import { equipmentLabel } from '../../../catalog/taxonomy';
import { HomeExit } from '../../components/HomeExit';
import { MonthPlan } from '../plan/MonthPlan';
import { planCalendarCopy } from '../../../i18n/features/plan/calendar';
import { trainingDaysCopy } from '../../../i18n/features/plan/training-days';
import { fill } from '../../../i18n/features/onboarding/entry';
import { WeekPlan, PlanReasons, PlanStops, PlanTip, SessionItems } from '../plan/WeekPlan';
import './onboarding.css';

export type OnboardingProposal = Extract<CoachResponse, { type: 'plan_proposal' }>;
interface PlanDraftPageProps {
  locale: V8Locale;
  candidate: OnboardingProposal & {
    profile?: { place?: string; equipment?: readonly string[]; cautions?: readonly unknown[] };
    enginePlan?: EnginePlan;
    startDate?: string;
    trainingDates?: string[];
    startTime?: string;
  };
  /** Updates the draft's start date (local YYYY-MM-DD); nothing is saved until the user accepts. */
  onStartDate?: (date: string) => void;
  /** Back to the training-day calendar (the draft is rebuilt from the new days). */
  onEditDays?: () => void;
  /** 回到今天: clears the unconfirmed draft and answers (after confirming). */
  onHome?: () => void;
  /** Fresh from 生成计划: show 芽芽排课 first (about 1.5 s, tap to skip, never under reduced motion). */
  building?: boolean;
  /** Kept for callers; the draft no longer labels local plans (P1 #9/#14). */
  basic?: boolean;
  busy?: boolean;
  error?: string;
  slots?: Partial<Pick<ThemeSlots, 'BrandMark' | 'AiLine'>>;
  exerciseText: (exerciseId: string) => { name: string; instructions: string };
  timeZone?: string;
  /** Parent must revalidate candidate identity, version and restore generation before writing. */
  onConfirm: (candidate: OnboardingProposal) => void;
  onDiscuss: () => void;
  onDiscard?: () => void;
  onEditCautions?: () => void;
}
/** Plan draft (V9 plan screen): week calendar, named sessions, why, one tip at the bottom, then confirm. */
export function PlanDraftPage({
  locale,
  candidate,
  busy = false,
  error,
  exerciseText,
  timeZone,
  onConfirm,
  onDiscuss,
  onDiscard,
  onEditCautions,
  onStartDate,
  onEditDays,
  onHome,
  building = false,
}: PlanDraftPageProps) {
  const t = planViewCopy[locale],
    plan = candidate.proposal;
  const [detail, setDetail] = useState<string>(),
    trigger = useRef<HTMLElement | null>(null),
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  // The new plan arrives piece by piece and the week's bars grow up, so 芽芽's work is seen (V9.20).
  useLayoutEffect(() => {
    const main = heading.current?.closest('main');
    if (!main) return;
    [...main.children].forEach((part, i) => enter(part, 'up', i * 70));
    main
      .querySelectorAll('.v9-week[data-variant="bars"] .v9-week-mark > span')
      .forEach((bar, i) => grow(bar, 250 + i * 50));
  }, []);
  const notices = candidate.enginePlan
    ? engineDisplayNotices(candidate.enginePlan).map(notice => notice.message[locale])
    : [];
  const stored = [...new Set(plan.reasons)].filter(
    reason => !notices.includes(reason) && reason !== notices.join(' ') && reason.trim(),
  );
  const reasons = stored.length ? stored : planReasons(plan, locale);
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    today = weekdayIndex(new Date(), zone),
    todayDate = localDateIn(zone);
  const days = candidate.trainingDates ?? [],
    d = trainingDaysCopy[locale],
    cal = planCalendarCopy[locale];
  const startDate =
    days[0] ?? (candidate.startDate && candidate.startDate >= todayDate ? candidate.startDate : todayDate);
  // Bo 2026-10-19: the draft is a month calendar; picked days open on 月, weekly plans keep 周 first.
  const [view, setView] = useState<'week' | 'month'>(days.length ? 'month' : 'week');
  const datedPlan = { ...plan, ...(days.length ? { trainingDates: days } : {}) };
  const details = (template: Parameters<typeof SessionItems>[0]['template']) => (
    <SessionItems
      template={template}
      locale={locale}
      name={id => exerciseText(id).name}
      hideDistance={id => candidate.profile?.place === 'home' && id === EXERCISE_IDS.walking}
      onExercise={(id, _index, element) => {
        trigger.current = element;
        setDetail(id);
      }}
    />
  );
  return (
    <>
      <main className="v9-plan-screen" lang={locale} aria-busy={busy}>
        {onHome && (
          <nav className="v9-plan-nav" aria-label={d.draftCalendar}>
            <HomeExit locale={locale} dirty disabled={busy} onLeave={onHome} />
          </nav>
        )}
        <header className="v9-plan-head">
          <span className="v9-plan-kicker">{answerText(plan.goalText, locale)}</span>
          <h1 ref={heading} tabIndex={-1} className="v9-display">
            {t.draftTitle}
          </h1>
        </header>
        <p className="v9-plan-line v9-plan-ready">
          <Yaya pose="head" size={30} mode="disc" alt="" float={false} />
          <span>{t.building.ready}</span>
        </p>
        <PlanStops plan={candidate.enginePlan} locale={locale} />
        {days.length > 0 ? (
          <p className="v9-plan-line" data-testid="draft-days">
            {fill(days.length === 1 ? d.daysOne : d.days, {
              count: days.length,
              from: startDateLabel(days[0], todayDate, locale, false),
              to: startDateLabel(days.at(-1)!, todayDate, locale, false),
            })}
            {candidate.startTime && <> · {fill(d.startsAt, { time: candidate.startTime })}</>}
            {onEditDays && (
              <>
                {' '}
                <PrimaryButton tone="text" size="sm" disabled={busy} onClick={onEditDays}>
                  {d.editDays}
                </PrimaryButton>
              </>
            )}
          </p>
        ) : (
          onStartDate && (
            <StartDatePicker
              value={startDate}
              today={todayDate}
              locale={locale}
              disabled={busy}
              onChange={onStartDate}
            />
          )
        )}
        <SegmentedTabs
          label={cal.view}
          value={view}
          onChange={value => setView(value === 'month' ? 'month' : 'week')}
          options={[
            { value: 'week', label: cal.week },
            { value: 'month', label: cal.month },
          ]}
        />
        {view === 'month' ? (
          <MonthPlan
            key={startDate}
            plan={datedPlan}
            workouts={[]}
            locale={locale}
            todayDate={todayDate}
            startDate={startDate}
            timeZone={zone}
            initialDate={startDate}
            details={details}
          />
        ) : (
          <WeekPlan
            plan={datedPlan}
            locale={locale}
            today={today}
            startDate={startDate}
            todayDate={todayDate}
            details={details}
          />
        )}
        <PlanReasons reasons={reasons} locale={locale} />
        {onEditCautions && (
          <p className="v9-plan-line">
            {t.cautionsExcluded}{' '}
            <PrimaryButton tone="text" size="sm" onClick={onEditCautions}>
              {t.editCautions}
            </PrimaryButton>
          </p>
        )}
        <PlanTip
          plan={candidate.enginePlan}
          locale={locale}
          onEditEnvironment={() => window.location.assign('/settings/engine#environment')}
        />
        {error && <p role="alert">{error}</p>}
        <footer className="v9-plan-actions" data-orb-avoid="">
          <PrimaryButton
            disabled={busy || !plan.templates.length}
            onClick={() => {
              if (!busy && plan.templates.length)
                onConfirm(
                  onStartDate && !days.length ? ({ ...candidate, startDate } as OnboardingProposal) : candidate,
                );
            }}
          >
            {busy ? t.saving : t.accept}
          </PrimaryButton>
          <PrimaryButton tone="quiet" disabled={busy} onClick={onDiscuss}>
            {t.discuss}
          </PrimaryButton>
          {onDiscard && (
            <PrimaryButton tone="text" size="md" disabled={busy} onClick={onDiscard}>
              {planLifecycleCopy[locale].discard}
            </PrimaryButton>
          )}
        </footer>
        <ExerciseGuidePanel
          id={detail}
          locale={locale}
          open={!!detail}
          onClose={() => setDetail(undefined)}
          triggerRef={trigger}
        />
      </main>
      {building && <PlanBuilding locale={locale} candidate={candidate} />}
    </>
  );
}

const buildingMs = 1500;
/** 芽芽排课: four lines about what was just weighed, from the answers and the draft itself (V9.20). */
function PlanBuilding({ locale, candidate }: Pick<PlanDraftPageProps, 'locale' | 'candidate'>) {
  const [open, setOpen] = useState(() => !reducedMotion());
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setOpen(false), buildingMs);
    return () => window.clearTimeout(timer);
  }, [open]);
  if (!open) return null;
  const t = planViewCopy[locale].building,
    { profile, proposal } = candidate,
    count = proposal.weeklyTarget,
    minutes = proposal.templates.map(template => template.estimatedMinutes),
    low = Math.min(...minutes),
    high = Math.max(...minutes),
    equipment = profile?.equipment?.map(key => equipmentLabel(key, locale)).join(locale === 'zh' ? '、' : ', ');
  const lines = [
    t.read,
    count > 1 ? fill(t.week, { count }) : t.weekOne,
    (equipment ? fill(t.equipment, { equipment }) : t.place) + (profile?.cautions?.length ? t.cautions : ''),
    ...(minutes.length ? [fill(t.minutes, { range: low === high ? `${low}` : `${low}–${high}` })] : []),
  ];
  return (
    <div className="v9-plan-building" role="status" onClick={() => setOpen(false)}>
      <Yaya pose="think" size={120} alt="" float={false} />
      <ol>
        {lines.map(line => (
          <li key={line}>{line}</li>
        ))}
      </ol>
      <PrimaryButton tone="text" size="sm" onClick={() => setOpen(false)}>
        {t.skip}
      </PrimaryButton>
    </div>
  );
}
