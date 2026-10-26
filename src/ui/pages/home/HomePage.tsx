import { answerText } from '../../../application/preset-text';
import { PelvicFloorDailyNotice } from '../training/PelvicFloorDailyNotice';
import { CautionMorningControls } from '../training/CautionMorningControls';
import { PregnancySafetyControls } from '../training/PregnancySafetyControls';
import { CardiacClearancePanel } from '../training/CardiacClearancePanel';
import { PostpartumSafetyPanel } from '../training/PostpartumSafetyPanel';
import { CheckinCard } from '../training/CheckinCard';
import { recordSwap } from '../../mainline/ai-nudge';
import { TargetChanges } from '../training/TargetChanges';
import { PendingPainReview } from '../../components/PendingPainReview';
import { PainProfessionalConfirmation } from '../../components/PainProfessionalConfirmation';
import { historyDangerReview, pendingPainReviews } from '../../../application/pain-events';
import { engineCopy } from '../../../coach/engine-copy';
import { useFeature } from '../../useFeature';
import { planLifecycleCopy } from '../../../i18n/features/plan/lifecycle';
import { planViewCopy } from '../../../i18n/features/plan/view';
import { homeCopy } from '../../../i18n/features/home/copy';
import { fill } from '../../../i18n/features/onboarding/entry';
import {
  planStartDate,
  regionLabels,
  sessionNames,
  startDateLabel,
  weekSchedule,
  weekdayIndex,
  weekdayLabel,
  weekdays,
  type Weekday,
} from '../../../application/plan-presentation';
import { startDateCopy } from '../../../i18n/features/plan/start-date';
import { nextTrainingDate, sessionForDate } from '../../../application/training-dates';
import { addDays } from '../../../application/plan-presentation';
import { PageSwitches } from '../../components/PageSwitches';
import { useExerciseTools } from '../../components/ExerciseTools';
import { exerciseToolsCopy } from '../../../i18n/features/plan/exercise-tools';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, PrimaryButton, WeekStrip, Yaya } from '../../components/kit';
import { useMainline, workflow, format } from '../../mainline/context';
import { createV8DataService } from '../../../persistence/v8-access';
import { repository } from '../../../persistence/repository';
import { PlanStops, PlanTip } from '../plan/WeekPlan';
import { SourceWarmupSteps } from '../training/SourceWarmupSteps';
import { PrescriptionTempo } from '../training/PrescriptionDetails';
import { durationText } from '../../components/ExerciseTargets';
import { engineTrainingCopy } from '../../../i18n/features/training/engine';
import { effortWords } from '../../../i18n/features/plan/view';
import { exercises } from '../../../catalog/exercises';
import type { PlannedItem } from '../../../domain/v8/contracts';

/** Plain-language prescription: cue, load, rest and effort in words (no RIR). */
function ItemPrescription({ item, locale }: { item: PlannedItem; locale: 'zh' | 'en' }) {
  const p = item.prescription;
  if (!p) return null;
  const t = engineTrainingCopy[locale],
    strength = ['main', 'accessory'].includes(p.block);
  return (
    <dl>
      {p.safetyCue && <dd>{p.safetyCue[locale]}</dd>}
      {p.loadDescription && (
        <>
          <dt>{t.load}</dt>
          <dd>{p.loadDescription[locale]}</dd>
        </>
      )}
      {strength && (
        <>
          <dt>{t.rest}</dt>
          <dd>{durationText(p.restSeconds, locale, true)}</dd>
        </>
      )}
      <PrescriptionTempo prescription={p} locale={locale} />
      {strength && <dd>{effortWords(p.rir, locale)}</dd>}
    </dl>
  );
}
import { DayTimeline } from './DayTimeline';
import { dayViewCopy } from '../../../i18n/features/home/day-view';
import { NowPanel, type FocusState } from './NowPanel';
import { LastWeekCard } from './LastWeekCard';
import { lastWeekSummary } from '../../../application/last-week';
import { nextWeekTip, skipDayTip, type NextWeekTip } from '../../../application/yaya-tips';
import { painPromptAreas } from '../../../application/pain-followup';
import { SkipDayLine, markWeekdayAsked, skipDayResting, weekdayAsked } from './plan-tips';
import { lastWeekClosed, tipSummary } from './LastWeekCard';
import './home.css';
import { utcDay, DAY_MS, weekStart } from '../../../domain/local-date';

const localDay = (timeZone: string, date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
/** 今天 (V9 home): today's session and start first; status check and week below. The 芽芽 orb is the only AI entry here. */
export function HomePage() {
  const engineEnabled = useFeature('trainingEngine');
  // Training reminders are off by default (Bo 2026-10-19); old dates stay saved until they return.
  const remindersEnabled = useFeature('trainingReminders');
  const location = useLocation(),
    applied = (location.state as { applied?: boolean } | null)?.applied === true;
  const [preview, setPreview] = useState<{
    revision: number;
    versionId: string;
    templateId: string;
    value: Awaited<ReturnType<typeof workflow.nextTargetPreview>>;
  }>();
  const {
    data,
    facts,
    previousFacts,
    t,
    slots,
    name,
    start,
    navigate,
    busy,
    run,
    locale,
    restartPlanning,
    setHomeTemplateId,
    setReviewKind,
    applyPlanCandidate,
  } = useMainline();
  const [choice, setChoice] = useState<string>();
  const legacyDates = remindersEnabled && !!data?.hasFutureLegacyDates;
  const h = homeCopy[locale],
    pv = planViewCopy[locale],
    sd = startDateCopy[locale];
  const tools = useExerciseTools('today', {
    swapBlocked: data?.active ? exerciseToolsCopy[locale].blocked : undefined,
  });
  const version = data?.version,
    templates = version?.templates ?? [];
  const last = data?.workouts
    .filter(w => w.planVersionId === version?.id && w.status !== 'in_progress' && w.status !== 'abandoned')
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const suggested =
    templates[(templates.findIndex(s => s.id === last?.templateId) + 1) % Math.max(1, templates.length)];
  const original = templates.find(s => s.id === choice) ?? suggested;
  const override = data?.state?.nextWorkoutOverride;
  const baseline =
    override && original && override.planVersionId === version?.id && override.templateId === original.id
      ? { ...override!.template, id: original!.id }
      : original;
  useEffect(() => {
    let alive = true;
    if (!engineEnabled || !original || !data?.version) {
      setPreview(undefined);
      return;
    }
    const templateId = original.id,
      versionId = data.version.id,
      revision = data.metadata.dataRevision;
    void workflow
      .nextTargetPreview(templateId)
      .then(value => {
        if (alive) setPreview({ templateId, versionId, revision, value });
      })
      .catch(() => {
        if (alive) setPreview(undefined);
      });
    return () => {
      alive = false;
    };
  }, [engineEnabled, original?.id, version?.id, data?.metadata.dataRevision]);
  const currentPreview =
    engineEnabled &&
    preview?.revision === data?.metadata.dataRevision &&
    preview?.versionId === version?.id &&
    preview?.templateId === original?.id
      ? preview.value
      : undefined;
  const hasPendingPain = pendingPainReviews(data?.workouts ?? []).length > 0;
  const previewBlocked =
    !!data?.state?.cardiacPause ||
    !!data?.state?.postpartumSafety?.urgentAt ||
    !!data?.state?.trainingPause ||
    hasPendingPain ||
    (!!currentPreview && 'blocked' in currentPreview && currentPreview.blocked === true);
  const previewPending = engineEnabled && !!version?.enginePlan && !currentPreview;
  const selected = currentPreview?.template ?? baseline;
  useEffect(() => {
    setHomeTemplateId(selected?.id);
  }, [selected?.id]);
  useEffect(() => () => setHomeTemplateId(undefined), []);
  const acknowledge = (reminders = false) =>
    void run(async () => {
      await createV8DataService(repository).acknowledgeMigrationNotice();
      if (reminders) navigate('/settings#reminders');
    });
  const lastSelected = data?.workouts
    .filter(w => w.templateId === selected?.id && w.planVersionId === version?.id && w.status !== 'abandoned')
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  // Presentation only: names, weekdays and this week's done days.
  const timeZone = data?.profile?.timeZone ?? 'Asia/Shanghai',
    now = new Date(),
    todayIndex = weekdayIndex(now, timeZone),
    today = weekdays[todayIndex];
  const names = sessionNames(templates, locale),
    schedule = version ? weekSchedule(version) : { sessions: [], chosen: false };
  const todayDate = localDay(timeZone, now),
    startDate = version ? planStartDate(version, timeZone) : undefined,
    notStarted = !!startDate && startDate > todayDate;
  // Calendar-picked days (Bo 2026-10-19) replace the weekly rhythm for 今天 and the week strip.
  const picked = version?.trainingDates?.length ? version.trainingDates : undefined,
    pickedNext = picked ? nextTrainingDate(picked, addDays(todayDate, 1)) : undefined;
  const scheduledToday =
    !notStarted && (picked ? picked.includes(todayDate) : schedule.sessions.some(session => session.day === today));
  const shown = (template?: { id: string }) => (template ? (names.get(template.id) ?? '') : '');
  const monday = new Date(Date.parse(localDay(timeZone, now) + 'T00:00:00Z') - todayIndex * DAY_MS);
  const weekDates = weekdays.map((_, index) => utcDay(monday.getTime() + index * DAY_MS));
  const doneDays: Partial<Record<Weekday, 'done' | 'partial'>> = {};
  // Only an explicitly chosen start date hides this week's earlier sessions; older plans keep their full week.
  const beforeStart = (index: number) => !!version?.startDate && weekDates[index] < version.startDate;
  for (const workout of data?.workouts ?? []) {
    const index = weekDates.indexOf(workout.localDate);
    if (index < 0) continue;
    if (workout.status === 'complete') doneDays[weekdays[index]] = 'done';
    else if (workout.status === 'partial' && doneDays[weekdays[index]] !== 'done')
      doneDays[weekdays[index]] = 'partial';
  }
  const nextSession =
    schedule.sessions.find(
      session => weekdays.indexOf(session.day) > todayIndex && !beforeStart(weekdays.indexOf(session.day)),
    ) ?? schedule.sessions[0];
  // Trained today: 今天 already moved on, so it heads the next session instead of calling it today's.
  const mainToday = scheduledToday && !doneDays[today];
  // 再下一次 follows the plan page's week (Bo 2026-10-26): the session after the one 今天 shows; picked dates keep the rotation.
  const followSession =
    nextSession &&
    (mainToday
      ? nextSession
      : schedule.sessions[(schedule.sessions.indexOf(nextSession) + 1) % schedule.sessions.length]);
  const following =
    (!picked && templates.find(item => item.id === followSession?.templateId)) ||
    (templates.length && selected
      ? templates[(templates.findIndex(item => item.id === selected.id) + 1) % templates.length]
      : undefined);
  const parts = selected ? regionLabels(selected, locale) : [];
  const dateText = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en', {
    timeZone,
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(now);
  // Finished sessions live in 回顾 (Bo 2026-10-22); 今天 keeps its panel and only links there.
  const trainedToday = (data?.workouts ?? []).some(
    w => w.localDate === todayDate && (w.status === 'complete' || w.status === 'partial'),
  );
  // 上周一张图: only with a plan that already ran last week, and someone who has trained before.
  const planStarts = (data?.versions ?? [])
    .filter(v => v.planId === data?.plan?.id)
    .map(v => planStartDate(v, timeZone))
    .filter((date): date is string => !!date)
    .sort();
  const lastWeek = lastWeekSummary({
    today: todayDate,
    facts: previousFacts,
    weeklyTarget: version?.weeklyTarget ?? 0,
    planFirstStart: version ? planStarts[0] : undefined,
    currentStart: startDate,
    hasRecord:
      (data?.workouts ?? []).some(w => w.status === 'complete' || w.status === 'partial') ||
      (data?.activities.length ?? 0) > 0,
    active: !!data?.active,
  });
  // 芽芽's plan tips (v5 §14, 上周 “下周怎么调”): only for an editable plan with nothing in progress.
  const profileId = data?.metadata.localProfileId ?? '',
    thisWeek = weekStart(todayDate);
  const editable = !!version && !!data?.plan && !data.plan.readOnly && !data.active && !notStarted;
  const planVersions = (data?.versions ?? []).filter(v => v.planId === data?.plan?.id);
  const asked = profileId ? weekdayAsked(profileId, thisWeek) : undefined;
  const weekTip: NextWeekTip | undefined =
    editable && lastWeek && previousFacts
      ? nextWeekTip({
          from: previousFacts.from,
          to: previousFacts.to,
          done: lastWeek.done,
          target: lastWeek.target,
          today: todayDate,
          timeZone,
          version: version!,
          versions: planVersions,
          workouts: data!.workouts,
          activities: data!.activities,
          followedUpWorkoutIds: (data!.state?.painFollowupRestrictions ?? []).map(row => row.sourceWorkoutId),
          planFirstStart: planStarts[0],
          weekdayAskedThisWeek: asked === 'today',
        })
      : undefined;
  const cardSaysWeekday = weekTip?.kind === 'weekday' && !!lastWeek && !lastWeekClosed(profileId, lastWeek.week);
  const skipDay =
    editable && asked !== 'lastweek' && !cardSaysWeekday && !skipDayResting(profileId, todayDate)
      ? skipDayTip({
          version: version!,
          versions: planVersions,
          workouts: data!.workouts,
          activities: data!.activities,
          timeZone,
          today: todayDate,
        })
      : undefined;
  useEffect(() => {
    if (skipDay && profileId) markWeekdayAsked(profileId, thisWeek, 'today');
  }, [!!skipDay, profileId, thisWeek]);
  // “看替代动作”: the exercise from last week's note in today's session, else one that loads the same area.
  const painSwap =
    weekTip?.kind === 'pain' && selected && !data?.active
      ? (() => {
          const index = selected.items.findIndex(item => weekTip.exerciseIds.includes(item.exerciseId));
          const loaded =
            index >= 0
              ? index
              : selected.items.findIndex(item => painPromptAreas(item.exerciseId, weekTip.areas).length > 0);
          return loaded >= 0
            ? { templateId: selected.id, itemIndex: loaded, exerciseId: selected.items[loaded]!.exerciseId }
            : undefined;
        })()
      : undefined;
  // 今天练这里 comes before every start from the panel (V9.14).
  const startNow = (state: FocusState) => navigate('/today-focus', { state });
  const strip = weekdays.map((day, index) => {
    const pickedId = picked ? sessionForDate(version!, weekDates[index]) : undefined;
    const planned = picked
      ? pickedId
        ? { day, templateId: pickedId }
        : undefined
      : beforeStart(index)
        ? undefined
        : schedule.sessions.find(session => session.day === day);
    return {
      key: day,
      label: weekdayLabel(day, locale, true),
      state: doneDays[day] ?? (planned ? 'planned' : 'rest'),
      today: index === todayIndex,
      description: `${weekdayLabel(day, locale)} · ${doneDays[day] === 'done' ? pv.done : doneDays[day] === 'partial' ? pv.partial : planned ? shown(templates.find(item => item.id === planned.templateId)) : pv.rest}`,
    } as const;
  });
  return (
    <main className="v9-home">
      <header className="v9-home-head">
        <div>
          <span className="v9-home-date">{dateText}</span>
          <h1 className="v9-display">{h.title}</h1>
        </div>
        <div className="v9-home-head-side">
          <PageSwitches />
          <span className="v9-num v9-home-day" aria-hidden="true">
            {localDay(timeZone, now).slice(8)}
          </span>
        </div>
      </header>
      {applied && version && (
        <Card variant="raised" padding="md" className="v9-home-applied" role="status">
          <Yaya pose="cheer" size={52} alt="" />
          <p>
            {notStarted && startDate
              ? fill(h.appliedLater, { date: startDateLabel(startDate, todayDate, locale) })
              : h.applied}
          </p>
        </Card>
      )}
      <PelvicFloorDailyNotice />
      <CardiacClearancePanel />
      <PostpartumSafetyPanel />
      <PregnancySafetyControls />
      <PendingPainReview />
      {data?.state?.trainingPause && <p role="status">{engineCopy('redflag.copy.paused_banner', locale)}</p>}
      {data?.state?.trainingPause &&
        data.state.coachProfile?.healthStorageConsent &&
        data.state.coachProfile.screening?.completedAt &&
        data.state.coachProfile.screening.parqAnswers?.length === 7 &&
        data.state.coachProfile.screening.rescreenRequired !== true &&
        Date.parse(data.state.coachProfile.screening.completedAt) >=
          Date.parse(data.state.trainingPause.requiredAt) && (
          <PainProfessionalConfirmation
            pauseRequiredAt={data.state.trainingPause.requiredAt}
            review={historyDangerReview(data.workouts, data.state.coachProfile.screening.redFlagReview)}
            locale={locale}
            busy={busy}
            confirmLabel={t.confirm}
            onConfirm={() =>
              void run(async () => {
                await workflow.confirmPainProfessionalSeen(data.metadata.dataRevision);
              })
            }
          />
        )}
      {data?.state?.notice && !data.state.notice.acknowledged && (data.state.notice.planCount > 1 || legacyDates) && (
        <Card variant="raised" padding="md" as="section" className="v9-home-panel">
          {data.state.notice.planCount > 1 && (
            <p>
              {format(t.migrationPlans, {
                count: data.state.notice.planCount,
                name: answerText(data.state.notice.currentPlanName ?? data.plan?.name ?? '', locale),
              })}
            </p>
          )}
          {legacyDates && (
            <>
              <p>{t.migrationDates}</p>
              <PrimaryButton tone="quiet" size="sm" onClick={() => acknowledge(true)}>
                {t.setReminder}
              </PrimaryButton>
            </>
          )}
          <PrimaryButton tone="quiet" size="sm" onClick={() => acknowledge()}>
            {legacyDates ? t.dismissMigration : t.understood}
          </PrimaryButton>
        </Card>
      )}
      {data?.active && (
        <PrimaryButton tone="quiet" onClick={() => navigate(`/workout/${data.active!.id}`)}>
          {t.ongoing}
        </PrimaryButton>
      )}
      {engineEnabled && currentPreview && <PlanStops plan={currentPreview} locale={locale} />}
      {lastWeek && data && (
        <LastWeekCard
          key={lastWeek.week}
          summary={lastWeek}
          profileId={data.metadata.localProfileId}
          locale={locale}
          name={name}
          onReview={() => {
            setReviewKind('week');
            navigate('/review');
          }}
          tip={weekTip}
          busy={busy}
          onAdjust={tip =>
            'proposal' in tip
              ? applyPlanCandidate({ ...tip, summary: tipSummary(tip, locale) }).then(Boolean)
              : Promise.resolve(false)
          }
          {...(painSwap
            ? {
                onSwaps: () =>
                  tools.openSwap(
                    painSwap,
                    document.activeElement instanceof HTMLElement ? document.activeElement : null,
                  ),
              }
            : {})}
        />
      )}
      {trainedToday && (
        <p className="v9-home-reason">
          <PrimaryButton
            tone="text"
            size="sm"
            onClick={() => {
              setReviewKind('week');
              navigate('/review');
            }}
          >
            {dayViewCopy[locale].doneToday}
          </PrimaryButton>
        </p>
      )}
      {selected ? (
        <>
          <section className="v9-home-now" aria-label={h.today}>
            <p className="v9-home-reason">
              {notStarted && startDate
                ? fill(sd.startsOn, { date: startDateLabel(startDate, todayDate, locale) })
                : mainToday || !nextSession
                  ? h.today
                  : picked
                    ? pickedNext
                      ? fill(h.nextOn, { day: startDateLabel(pickedNext, todayDate, locale) })
                      : h.today
                    : fill(h.nextOn, {
                        day: `${schedule.chosen ? '' : h.suggested}${weekdayLabel(nextSession.day, locale)}`,
                      })}{' '}
              · {shown(selected)}
            </p>
            {/* What today trains comes before how long (V9.20). */}
            {parts.length > 0 && (
              <div className="v9-home-parts" role="group" aria-label={h.parts}>
                {parts.map(part => (
                  <span key={part}>{part}</span>
                ))}
              </div>
            )}
            {/* Before the chosen start date the panel stays but has no start button (Bo 2026-10-23, 10-25); 手动训练 stays below. */}
            <NowPanel
              template={selected}
              weekDates={weekDates}
              today={todayDate}
              blocked={busy || !!data?.active || previewBlocked || previewPending}
              {...(notStarted ? {} : { onStart: startNow })}
            />
            {notStarted && <p className="v9-home-reason">{sd.notStarted}</p>}
            {skipDay && <SkipDayLine key={skipDay.weekday} change={skipDay} today={todayDate} />}
            <p className="v9-home-reason">
              {!last
                ? t.firstWorkoutReason
                : lastSelected?.status === 'partial'
                  ? t.partialReason
                  : format(t.reason, { minutes: selected.estimatedMinutes })}
            </p>
          </section>
          {engineEnabled && currentPreview && (
            <>
              <TargetChanges
                suggestions={currentPreview.suggestions}
                templateId={selected.id}
                locale={locale}
                name={name}
              />
              <PlanTip
                plan={{
                  ...currentPreview,
                  notices: currentPreview.notices.filter(
                    notice => !['pregnancy.pelvic_floor.copy', 'postpartum.pelvic_floor.copy'].includes(notice.code),
                  ),
                }}
                locale={locale}
                onEditEnvironment={() => navigate('/settings/engine#environment')}
              />
            </>
          )}
          {/* Order and timing belongs to a session that can start today (Bo 2026-10-25). */}
          {!notStarted && (
            <DayTimeline
              planStart={version?.startTime}
              template={selected}
              locale={locale}
              timeZone={timeZone}
              todayDate={todayDate}
              name={name}
              active={data?.active}
              details={(item, index) => (
                <>
                  <p>{exercises.find(e => e.id === item.exerciseId)?.steps[locale].join(' ')}</p>
                  {engineEnabled && (
                    <>
                      <SourceWarmupSteps template={selected} itemIndex={index} />
                      <ItemPrescription item={item} locale={locale} />
                    </>
                  )}
                  <div className="v9-item-actions">{tools.buttons(selected.id, index, item.exerciseId)}</div>
                </>
              )}
            />
          )}
          <div className="v9-home-row">
            <PrimaryButton
              tone="quiet"
              size="sm"
              disabled={templates.length < 2}
              onClick={() => {
                setChoice(templates[(templates.findIndex(item => item.id === selected.id) + 1) % templates.length].id);
                recordSwap(todayDate);
              }}
            >
              {t.switch}
            </PrimaryButton>
            <PrimaryButton tone="quiet" size="sm" onClick={() => navigate('/manual')}>
              {t.manual}
            </PrimaryButton>
            <PrimaryButton tone="quiet" size="sm" onClick={() => navigate('/activity')}>
              {t.recordActivity}
            </PrimaryButton>
          </div>
        </>
      ) : (
        <Card variant="raised" padding="lg" as="section" className="v9-home-empty">
          <Yaya pose="side" size={120} alt="" />
          <p>{planLifecycleCopy[locale].empty}</p>
          {/* The panel stays without a plan too, with no start button (Bo 2026-10-26). */}
          <NowPanel template={undefined} weekDates={weekDates} today={todayDate} blocked />
          <PrimaryButton onClick={restartPlanning}>{planLifecycleCopy[locale].create}</PrimaryButton>
          <div className="v9-home-row">
            <PrimaryButton tone="quiet" size="sm" onClick={() => navigate('/manual')}>
              {t.manual}
            </PrimaryButton>
            <PrimaryButton tone="quiet" size="sm" onClick={() => navigate('/activity')}>
              {t.recordActivity}
            </PrimaryButton>
          </div>
        </Card>
      )}
      <CheckinCard />
      {version && (
        <Card variant="raised" padding="md" as="section" className="v9-home-week" aria-labelledby="v9-home-week-title">
          <div className="v9-home-week-head">
            <h2 id="v9-home-week-title">{h.week}</h2>
            {facts && (
              <slots.WeekProgress
                complete={facts.complete}
                partial={facts.partial}
                target={version.weeklyTarget}
                label={format(t.week, { complete: facts.complete, partial: facts.partial })}
              />
            )}
          </div>
          <WeekStrip label={h.week} days={strip} />
          {following && followSession && (
            <p className="v9-home-next">
              <span>{h.after}</span>
              <strong>
                {fill(h.afterLine, {
                  day: `${schedule.chosen ? '' : h.suggested}${weekdayLabel(followSession.day, locale)}`,
                  name: shown(following),
                  minutes: following.estimatedMinutes,
                })}
              </strong>
              {regionLabels(following, locale).length > 0 && <span>{regionLabels(following, locale).join(' · ')}</span>}
            </p>
          )}
        </Card>
      )}
      {tools.sheets}
    </main>
  );
}
