import { PrescriptionDetails } from '../PrescriptionDetails';
import { SourceWarmupSteps } from '../SourceWarmupSteps';
import { engineCopy } from '../../../../coach/engine-copy';
import { type ReactNode } from 'react';
import { Button } from '../../../components/common';
import { PrimaryButton, CountdownRing, Yaya } from '../../../components/kit';
import { format } from '../../../mainline/context';
import { holdStart, holdPause, holdRemaining, restRemaining, restDone, restExtend, restTotal } from '../timer-logic';
import { ExerciseMediaHero, focusIfLost } from './workout-parts';
import type { WorkoutModel } from './workout-model';

/** The rest countdown or the current exercise, below the player header. */
export function workoutBody(m: WorkoutModel) {
  const {
    engineEnabled,
    t,
    locale,
    name,
    busy,
    slots,
    active,
    painPreview,
    setSwapQuery,
    setSwapFilters,
    setGuideId,
    panel,
    setReplacement,
    setReason,
    panelTrigger,
    guideTrigger,
    setGuideOpen,
    showPanel,
    copy,
    p,
    engineCopyText,
    setRestExtra,
    restKey,
    now,
    item,
    template,
    restPlan,
    exerciseIdOf,
    effectiveId,
    prescription,
    relativePower,
    guide,
    excluded,
    painBlocked,
    setsOf,
    done,
    allDone,
    thisDone,
    timer,
    timerStatus,
    setHold,
    loadText,
    targetText,
    complete,
    restItem,
    restShown,
    restNext,
    leaveRest,
    nextText,
    feedback,
  } = m;
  let body: ReactNode;
  if (restShown && restPlan) {
    const left = restRemaining(restPlan, now),
      finished = restDone(restPlan, now),
      nextId = restNext ? exerciseIdOf(restNext.itemIndex, restNext.exerciseId) : undefined,
      sameItem = restNext?.itemIndex === restItem!.itemIndex;
    body = (
      <section className="wk-rest" aria-labelledby="wk-rest-title">
        <div className="wk-rest-head">
          <Yaya pose="cheer" size={56} mode="disc" alt="" float={false} />
          <div>
            <h1 id="wk-rest-title" className="v9-display" tabIndex={-1} ref={focusIfLost}>
              {p.restTitle}
            </h1>
            <p className="wk-muted">{p.restHint}</p>
          </div>
        </div>
        <div className="wk-rest-ring">
          <CountdownRing
            remaining={left}
            total={restTotal(restPlan)}
            label={p.restLeft}
            caption={p.restCaption}
            size={232}
            stroke={12}
          />
        </div>
        <p className="wk-rest-status" role="status">
          {finished ? p.restDone : ''}
        </p>
        <div className="wk-rest-actions">
          <PrimaryButton
            tone="quiet"
            size="md"
            block
            aria-label={p.addRestLabel}
            onClick={() => setRestExtra(prior => ({ ...prior, [restKey]: restExtend(restPlan, Date.now()) }))}
          >
            <span className="v9-num">{p.addRest}</span>
          </PrimaryButton>
          {!finished && (
            <PrimaryButton tone="quiet" size="md" block onClick={leaveRest}>
              {p.skipRest}
            </PrimaryButton>
          )}
        </div>
        {restNext && nextId && (
          <div className="v9-card wk-next" data-variant="inset" data-padding="sm">
            <span className="wk-muted">{sameItem ? p.upNext : p.nextExercise}</span>
            <strong>{name(nextId)}</strong>
            <span>
              {format(t.setCount, { current: setsOf(restNext.itemIndex) + 1, total: restNext.plannedSetCount })}
            </span>
          </div>
        )}
        {finished && <PrimaryButton onClick={leaveRest}>{sameItem ? p.startNext : p.startNextExercise}</PrimaryButton>}
        {feedback}
      </section>
    );
  } else
    body = (
      <>
        {!excluded.has(item.itemIndex) && (
          <section
            className="wk-focus"
            onClickCapture={event => {
              const button = (event.target as HTMLElement).closest('button');
              if (button) panelTrigger.current = button;
            }}
          >
            <ExerciseMediaHero
              key={effectiveId}
              id={effectiveId}
              locale={locale}
              label={copy.details}
              noMedia={p.noMedia}
              onOpen={trigger => {
                guideTrigger.current = trigger;
                setGuideId(effectiveId);
                setGuideOpen(true);
              }}
            />
            <div className="wk-title">
              <p className="wk-muted">
                {format(t.setCount, { current: Math.min(done + 1, item.plannedSetCount), total: item.plannedSetCount })}
              </p>
              <h1 className="v9-display" tabIndex={-1} ref={focusIfLost}>
                {name(effectiveId)}
              </h1>
            </div>
            {timer && !thisDone ? (
              <div className="wk-timer">
                <CountdownRing
                  remaining={holdRemaining(timer, now)}
                  total={timer.total}
                  label={p.timeLeft}
                  caption={p.hold}
                  size={156}
                  stroke={10}
                />
                <div className="wk-timer-side">
                  <PrimaryButton
                    tone="quiet"
                    size="md"
                    block
                    disabled={busy || painBlocked}
                    onClick={() =>
                      setHold(timerStatus === 'running' ? holdPause(timer, Date.now()) : holdStart(timer, Date.now()))
                    }
                  >
                    {timerStatus === 'running'
                      ? p.pauseTimer
                      : timerStatus === 'paused'
                        ? p.resumeTimer
                        : timerStatus === 'done'
                          ? p.restartTimer
                          : p.startTimer}
                  </PrimaryButton>
                  <PrimaryButton
                    tone="text"
                    size="sm"
                    aria-label={t.edit}
                    disabled={busy || timerStatus === 'running'}
                    onClick={() => showPanel('edit')}
                  >
                    <span className="v9-num">
                      {loadText} · {targetText}
                    </span>
                  </PrimaryButton>
                  <p className="wk-muted" role="status">
                    {timerStatus === 'done' ? p.timeUp : ''}
                  </p>
                </div>
              </div>
            ) : (
              <slots.SetValue
                label={t.edit}
                loadText={loadText}
                targetText={targetText}
                onEdit={() => showPanel('edit')}
                disabled={busy || thisDone}
              />
            )}
          </section>
        )}
        <PrimaryButton className="wk-complete" disabled={busy || !!panel || painBlocked} onClick={complete}>
          {allDone ? (excluded.size ? engineCopyText.end : t.allDone) : thisDone ? t.exerciseDone : t.completeSet}
        </PrimaryButton>
        <p className="wk-next-line wk-muted">{nextText()}</p>
        {excluded.size > 0 && !painPreview?.value.notices.includes(engineCopy('pain.copy.drop_pattern', locale)) && (
          <p role="status">{engineCopy('pain.copy.drop_pattern', locale)}</p>
        )}
        {feedback}
        {!excluded.has(item.itemIndex) && (
          <section className="wk-details">
            <h2 className="wk-section-title">{copy.points}</h2>
            <ul className="exercise-guide-points" aria-label={copy.points}>
              {guide.keyPoints.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
            {(engineEnabled || relativePower) && (
              <>
                <SourceWarmupSteps
                  template={template}
                  itemIndex={item.itemIndex}
                  exerciseId={effectiveId}
                  unreplayedChanges={Boolean(active.substitutions?.length || active.painActions?.length)}
                />
                <PrescriptionDetails prescription={prescription} locale={locale} />
              </>
            )}
            <Button
              onClick={event => {
                setReplacement('');
                setSwapQuery('');
                setSwapFilters({});
                setReason('other');
                showPanel('swap', event.currentTarget);
              }}
              disabled={thisDone || painBlocked}
            >
              {t.changeExercise}
            </Button>
          </section>
        )}
      </>
    );
  return body;
}
