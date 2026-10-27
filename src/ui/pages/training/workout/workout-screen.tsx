import type { ReactNode } from 'react';
import { historyDangerReview } from '../../../../application/pain-events';
import { PainProfessionalConfirmation } from '../../../components/PainProfessionalConfirmation';
import { PainFeedbackPanel } from '../PainFeedbackPanel';
import { engineCopy } from '../../../../coach/engine-copy';
import { templateLabel } from '../../../../i18n/features/plan/labels';
import { ExerciseBrowser } from '../../../components/ExerciseBrowser';
import { replacementScore } from '../../../../catalog/catalog-service';
import { initialFilters } from '../manual/selection';
import { Button, Chip, MorphPanel } from '../../../components/common';
import { PrimaryButton, Yaya } from '../../../components/kit';
import { workflow } from '../../../mainline/context';
import { ExerciseGuidePanel } from '../../../components/ExerciseGuide';
import { restTotal, pauseOtherHolds } from '../timer-logic';
import { SET_LIMITS, CueAt } from './workout-parts';
import type { WorkoutModel } from './workout-model';
import { isYogaSession } from '../../../../engine/yoga-session';
import { catalogMetadata } from '../../../../catalog/registry';
import { yayaV5 } from '../../../../i18n/features/coach/yaya-v5';

const CHILDS_POSE = [...catalogMetadata].find(([, meta]) => meta.slug === 'childs-pose')?.[0];

/** The whole player screen around `body`: safety signals, pain prompts, exercise capsules and panels. */
export function workoutScreen(m: WorkoutModel, body: ReactNode) {
  const {
    data,
    t,
    locale,
    name,
    navigate,
    run,
    busy,
    index,
    setIndex,
    values,
    setValues,
    active,
    painSequence,
    painPreviewLoading,
    setPainPreviewLoading,
    painPreview,
    setPainPreview,
    allowedSwapIds,
    swapQuery,
    setSwapQuery,
    swapFilters,
    setSwapFilters,
    guideId,
    setGuideId,
    panel,
    setPanel,
    replacement,
    setReplacement,
    reason,
    setReason,
    panelTrigger,
    guideTrigger,
    safetyInline,
    guideOpen,
    setGuideOpen,
    showPanel,
    editStart,
    copy,
    p,
    engineCopyText,
    setHolds,
    setRestClosed,
    restKey,
    items,
    item,
    template,
    restPlan,
    exerciseIdOf,
    effectiveId,
    exercise,
    needsLoad,
    timed,
    key,
    value,
    load,
    hasLoad,
    distance,
    excluded,
    painBlocked,
    setsOf,
    thisDone,
    timer,
    safetyAttention,
    safetyPanels,
    restShown,
    progressLabel,
    top,
  } = m;
  const yogaRest =
    template &&
    isYogaSession(template) &&
    CHILDS_POSE &&
    CHILDS_POSE !== effectiveId &&
    allowedSwapIds.includes(CHILDS_POSE)
      ? CHILDS_POSE
      : undefined;
  const editInvalid =
    !(value > 0) ||
    !Number.isInteger(value) ||
    value > (timed ? SET_LIMITS.seconds : SET_LIMITS.reps) ||
    (needsLoad && !hasLoad) ||
    (hasLoad && load > SET_LIMITS.kg) ||
    (distance !== undefined &&
      !Number.isNaN(distance) &&
      (!Number.isInteger(distance) || distance < 0 || distance > SET_LIMITS.meters));
  return (
    <main
      className="wk-page"
      data-training-active="true"
      data-screen={restShown ? 'rest' : 'player'}
      data-item={`${item.itemIndex}:${active.sets.length}`}
    >
      {top}
      {timer?.startedAt !== undefined && (
        <CueAt dueAt={timer.startedAt + timer.total * 1000 - timer.accumulatedMs} active={!panel} />
      )}
      {restShown && restPlan && <CueAt dueAt={restPlan.completedAt + restTotal(restPlan) * 1000} active />}
      <p className="wk-template wk-muted">
        {template
          ? templateLabel(template, locale, data?.versions.find(v => v.id === active.planVersionId)?.templates)
          : t.manual}{' '}
        · {progressLabel}
      </p>
      {safetyAttention && (
        <section className="wk-safety-inline" ref={safetyInline} tabIndex={-1} aria-label={p.signals}>
          {safetyPanels}
        </section>
      )}
      {body}
      {painPreview && (
        <PainFeedbackPanel
          key={painPreview.eventId}
          preview={painPreview.value}
          locale={locale}
          busy={busy || painPreviewLoading}
          name={name}
          confirmLabel={t.confirm}
          onAnswersChange={answers => {
            const serial = ++painSequence.current;
            if (!painPreview.value.questions.every(question => typeof answers[question.key] === 'boolean')) {
              setPainPreviewLoading(false);
              setPainPreview({
                ...painPreview,
                value: { ...painPreview.value, replacement: undefined, redFlagsRequired: true },
              });
              return;
            }
            setPainPreviewLoading(true);
            void workflow
              .painFeedbackPreview(active.id, painPreview.eventId, answers)
              .then(value => {
                if (serial === painSequence.current) {
                  setPainPreview({ eventId: painPreview.eventId, value });
                  setPainPreviewLoading(false);
                }
              })
              .catch(() => {
                if (serial === painSequence.current) {
                  setPainPreview(undefined);
                  setPainPreviewLoading(false);
                }
              });
          }}
          onApply={answers =>
            void run(async () => {
              await workflow.applyPainFeedback(active.id, painPreview.eventId, data.metadata.dataRevision, answers);
            })
          }
        />
      )}
      {(active.painReviewRequired || data.state?.trainingPause) && (
        <>
          <p role="status">{engineCopy('redflag.copy.paused_banner', locale)}</p>
          <Button onClick={() => navigate(`/workout/${active.id}/finish`)}>{engineCopyText.end}</Button>
        </>
      )}
      {(active.painReviewRequired || data.state?.trainingPause) &&
        data.state?.coachProfile?.healthStorageConsent?.acceptedAt &&
        data.state.coachProfile.screening?.completedAt &&
        data.state.coachProfile.screening.parqAnswers?.length === 7 &&
        data.state.coachProfile.screening.rescreenRequired !== true &&
        (!data.state.trainingPause ||
          Date.parse(data.state.coachProfile.screening.completedAt) >=
            Date.parse(data.state.trainingPause.requiredAt)) && (
          <PainProfessionalConfirmation
            pauseRequiredAt={data.state?.trainingPause?.requiredAt}
            review={historyDangerReview(data.workouts, data.state.coachProfile.screening?.redFlagReview)}
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
      <div className="v8-capsules wk-capsules" aria-label={t.actions}>
        {items.map((row, i) => (
          <Chip
            key={row.itemIndex}
            selected={i === index}
            disabled={excluded.has(row.itemIndex)}
            onClick={() => {
              if (i !== index) setHolds(prior => pauseOtherHolds(prior, Date.now()));
              setIndex(i);
              setPanel(undefined);
              if (restKey) setRestClosed(prior => [...prior, restKey]);
            }}
          >
            {setsOf(row.itemIndex) >= row.plannedSetCount ? '✓ ' : ''}
            {name(exerciseIdOf(row.itemIndex, row.exerciseId))}
          </Chip>
        ))}
      </div>
      <ExerciseGuidePanel
        id={guideId ?? effectiveId}
        locale={locale}
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        triggerRef={guideTrigger}
      />
      <MorphPanel
        open={!!panel}
        placement={panel === 'pause' || panel === 'safety' ? 'bottom' : 'center'}
        title={
          panel === 'pause'
            ? t.pauseTitle
            : panel === 'edit'
              ? t.edit
              : panel === 'safety'
                ? p.unwellTitle
                : t.changeExercise
        }
        closeLabel={t.close}
        triggerRef={panelTrigger}
        onClose={() => {
          if (panel === 'edit' && editInvalid) setValues(editStart.current);
          setPanel(undefined);
        }}
      >
        <div className="v8-pause-actions">
          {panel === 'safety' ? (
            <div className="wk-safety">
              <div className="wk-safety-head">
                <Yaya pose="care" size={48} mode="disc" alt="" float={false} />
                {safetyAttention && <p>{p.signalsHint}</p>}
              </div>
              <div className="wk-safety-tiles">
                <button
                  type="button"
                  className="v9-card wk-tile v8-press"
                  data-variant="raised"
                  data-padding="sm"
                  disabled={thisDone || painBlocked}
                  onClick={event => {
                    // In a yoga session 芽芽 suggests resting in Child's Pose when it is allowed here.
                    setReplacement(yogaRest ?? '');
                    setSwapQuery('');
                    setSwapFilters({});
                    setReason('discomfort');
                    showPanel('swap', event.currentTarget);
                  }}
                >
                  <strong>{p.jointPain}</strong>
                  <span>{p.jointPainHint}</span>
                </button>
                <button
                  type="button"
                  className="v9-card wk-tile v8-press"
                  data-variant="raised"
                  data-padding="sm"
                  disabled={busy || thisDone}
                  onClick={event => showPanel('edit', event.currentTarget)}
                >
                  <strong>{p.tooHard}</strong>
                  <span>{p.tooHardHint}</span>
                </button>
              </div>
              {!safetyAttention && <div className="wk-safety-panels">{safetyPanels}</div>}
              <PrimaryButton tone="warn" onClick={() => navigate(`/workout/${active.id}/finish`)}>
                {p.endToday}
              </PrimaryButton>
              <PrimaryButton onClick={() => setPanel(undefined)}>{p.keepGoing}</PrimaryButton>
            </div>
          ) : panel === 'pause' ? (
            <>
              <p>{t.pauseHint}</p>
              <Button onClick={() => setPanel(undefined)}>{t.resume}</Button>
              <Button onClick={() => navigate(`/workout/${active.id}/finish`)}>{t.end}</Button>
              <Button
                onClick={() =>
                  void run(async () => {
                    await workflow.finish(active.id, { reasons: [] }, true);
                    navigate('/');
                  })
                }
              >
                {t.abandon}
              </Button>
            </>
          ) : panel === 'edit' ? (
            <>
              <label>
                {timed ? t.seconds : t.reps}
                <input
                  type="number"
                  min="1"
                  max={timed ? SET_LIMITS.seconds : SET_LIMITS.reps}
                  step="1"
                  value={Number.isNaN(value) ? '' : value}
                  onChange={e => setValues({ ...values, [key]: e.target.valueAsNumber })}
                />
              </label>
              {exercise.metricType === 'duration_distance' && (
                <label>
                  {t.meters}
                  <input
                    type="number"
                    min="0"
                    max={SET_LIMITS.meters}
                    step="1"
                    value={distance === undefined || Number.isNaN(distance) ? '' : distance}
                    onChange={e => setValues({ ...values, [`${key}:meters`]: e.target.valueAsNumber })}
                  />
                </label>
              )}
              {needsLoad && (
                <label>
                  {t.kg}
                  <input
                    placeholder={copy.chooseLoad}
                    type="number"
                    min="0"
                    max={SET_LIMITS.kg}
                    step="0.5"
                    value={load === undefined || Number.isNaN(load) ? '' : load}
                    onChange={e => setValues({ ...values, [`${key}:kg`]: e.target.valueAsNumber })}
                  />
                </label>
              )}
              <Button disabled={editInvalid} onClick={() => setPanel(undefined)}>
                {t.confirm}
              </Button>
            </>
          ) : panel === 'swap' ? (
            <>
              {yogaRest && reason === 'discomfort' && <p>{yayaV5[locale].yogaPose}</p>}
              <ExerciseBrowser
                locale={locale}
                query={swapQuery}
                setQuery={setSwapQuery}
                filters={{ ...swapFilters, allowedIds: allowedSwapIds.filter(id => id !== effectiveId) }}
                setFilters={setSwapFilters}
                selected={replacement ? [replacement] : []}
                onSelect={id => setReplacement(id)}
                onDetail={(id, trigger) => {
                  guideTrigger.current = trigger;
                  setGuideId(id);
                  setGuideOpen(true);
                }}
                cautionAreas={data.state?.coachProfile?.cautions ?? []}
                rank={id =>
                  replacementScore(
                    id,
                    effectiveId,
                    initialFilters(
                      [data.state?.coachProfile?.place, ...(data.state?.coachProfile?.equipment ?? [])].join(' '),
                    ).equipment,
                    data.state?.coachProfile?.cautions,
                  )
                }
              />
              <p aria-live="polite">{replacement ? `${t.replacement}: ${name(replacement)}` : t.choose}</p>
              <label>
                {t.reasonLabel}
                <select
                  aria-label={t.reasonLabel}
                  value={reason}
                  onChange={e => setReason(e.target.value as typeof reason)}
                >
                  <option value="other">{t.other}</option>
                  <option value="discomfort">{t.discomfort}</option>
                </select>
              </label>
              <Button
                disabled={!replacement || !allowedSwapIds.includes(replacement) || busy}
                onClick={() =>
                  void run(async () => {
                    await workflow.substitute(active.id, item.itemIndex, replacement, reason);
                    setPanel(undefined);
                  })
                }
              >
                {t.confirm}
              </Button>
            </>
          ) : null}
        </div>
      </MorphPanel>
    </main>
  );
}
