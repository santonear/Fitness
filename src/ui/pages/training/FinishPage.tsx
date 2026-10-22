import { workoutSeconds, trainingMinutes } from '../../../application/workout-duration';
import { TEXT_LIMITS, cleanText, textIssue } from '../../../domain/input-guard';
import { FieldIssue } from '../../components/common/FieldIssue';
import { fillLine, yayaThemeTone, yayaV5 } from '../../../i18n/features/coach/yaya-v5';
import { useState } from 'react';
import type { Feedback } from '../../../domain/v8/contracts';
import { Button } from '../../components/common';
import {
  Card,
  ChoiceChip,
  PrimaryButton,
  StatTile,
  WeekStrip,
  Yaya,
  formatClock,
  type WeekStripDay,
} from '../../components/kit';
import { useMainline, workflow, format } from '../../mainline/context';
import { activityDate } from '../../../application/v8-activity';
import { dayOf, shiftDate, volumeKg, weekStart, weekStreak, weeklyRemaining } from '../../../application/review/charts';
import { templateLabel } from '../../../i18n/features/plan/labels';
import zh from '../../../i18n/features/training/finish.zh.json';
import en from '../../../i18n/features/training/finish.en.json';
import './player.css';
const feels = ['easy', 'right', 'tired', 'very_tired'] as const;
const reasons = ['time', 'fatigue', 'discomfort', 'equipment_busy', 'not_today', 'other'] as const;
export function FinishPage() {
  const { data, facts, t, name, run, navigate, busy, locale, appearance } = useMainline();
  const [feedback, setFeedback] = useState<Feedback>({ reasons: [] });
  const active = data?.active;
  const [endedAt] = useState(() => new Date().toISOString());
  if (!active)
    return (
      <main>
        <p>{t.noTraining}</p>
        <Button onClick={() => navigate('/')}>{t.next}</Button>
      </main>
    );
  const done = active.sets.length,
    complete = done === active.plannedSetCount;
  const copy = locale === 'en' ? en : zh;
  const noteIssue = textIssue(feedback.note, TEXT_LIMITS.long);
  const seconds = workoutSeconds(active.startedAt, endedAt),
    elapsed = trainingMinutes(seconds);
  const ordinal = facts
    ? facts.movementCount - Object.values(facts.activityCounts).reduce((sum, count) => sum + count, 0) + 1
    : 1;
  // This session plus saved ones; facts are read only and nothing here is written.
  const timeZone = data.profile?.timeZone ?? active.timeZone ?? 'Asia/Shanghai',
    today = activityDate(timeZone),
    monday = weekStart(today);
  const current = done > 0 ? [{ ...active, endedAt, status: complete ? 'complete' : 'partial' }] : [];
  const rows = [
    ...data.workouts.filter(row => row.id !== active.id && (row.status === 'complete' || row.status === 'partial')),
    ...current,
  ];
  const thisWeek = rows.filter(row => dayOf(row, timeZone) >= monday && dayOf(row, timeZone) <= today);
  const target = data.version?.weeklyTarget;
  const progress = weeklyRemaining(
    target ?? 0,
    thisWeek.filter(row => row.status === 'complete').length,
    thisWeek.filter(row => row.status === 'partial').length,
  );
  const streak = weekStreak(rows, today, timeZone);
  // 芽芽话术 v5 §18 (theme voice) and §2 (partial); unknown themes keep the earlier sentence.
  const tones = yayaThemeTone[locale].done,
    tone = tones[appearance.theme as keyof typeof tones],
    weekDone = thisWeek.filter(row => row.status === 'complete').length;
  const message =
    done === 0
      ? t.zeroMessage
      : complete
        ? tone
          ? fillLine(tone, { count: weekDone, target: target ?? weekDone })
          : format(t.completeMessage, { count: ordinal })
        : fillLine(yayaV5[locale].partialDone, { sets: done });
  const days: WeekStripDay[] = copy.weekdays.map((label, i) => {
    const day = shiftDate(monday, i),
      on = thisWeek.filter(row => dayOf(row, timeZone) === day),
      state = on.some(row => row.status === 'complete') ? 'done' : on.length ? 'partial' : 'rest';
    return {
      key: day,
      label,
      state,
      today: day === today,
      description: format(state === 'done' ? copy.dayDone : state === 'partial' ? copy.dayPartial : copy.dayRest, {
        day: day === today ? copy.today : label,
      }),
    };
  });
  const volume = volumeKg(active),
    moves = new Set(active.sets.map(s => `${s.itemIndex}`)).size;
  const template =
    active.templateSnapshot ??
    data.versions.find(v => v.id === active.planVersionId)?.templates.find(s => s.id === active.templateId);
  return (
    <main className="wk-page wk-finish">
      <p className="wk-muted">
        {template
          ? templateLabel(template, locale, data.versions.find(v => v.id === active.planVersionId)?.templates)
          : t.manual}{' '}
        · {today}
      </p>
      <Card variant="hero" padding="lg" className="wk-finish-hero" as="section" aria-labelledby="wk-finish-title">
        <div>
          <h1 id="wk-finish-title" className="v9-display">
            {done === 0 ? copy.titleZero : complete ? copy.titleComplete : copy.titlePartial}
          </h1>
          <span className="wk-finish-time v9-num">{formatClock(seconds)}</span>
          <span className="wk-muted">
            {elapsed > 0 ? format(copy.elapsed, { minutes: elapsed }) : copy.elapsedShort}
          </span>
        </div>
        <Yaya className="wk-finish-yaya" pose={done === 0 ? 'care' : 'celebrate'} size={120} float={false} alt="" />
      </Card>
      <div className="wk-finish-message">
        <p>{message}</p>
        {done > 0 && !complete && <p>{format(copy.ordinal, { count: ordinal })}</p>}
      </div>
      <div className="wk-stats">
        <Card padding="sm">
          <StatTile
            label={copy.sets}
            value={done}
            unit={` / ${active.plannedSetCount}`}
            progress={active.plannedSetCount ? done / active.plannedSetCount : 0}
          />
        </Card>
        {volume > 0 ? (
          <Card padding="sm">
            <StatTile label={copy.volume} value={volume} unit={` ${copy.kg}`} />
          </Card>
        ) : (
          <Card padding="sm">
            <StatTile label={copy.moves} value={moves} />
          </Card>
        )}
      </div>
      <Card as="section" className="wk-week" aria-label={copy.thisWeek}>
        <div className="wk-week-head">
          <p>
            <strong>
              {target
                ? format(copy.weekDone, { done: progress.done, target })
                : format(copy.weekDoneNoTarget, { done: progress.done })}
            </strong>
          </p>
          {target ? (
            <p className="wk-muted">{progress.left ? format(copy.weekLeft, { left: progress.left }) : copy.weekMet}</p>
          ) : null}
        </div>
        <WeekStrip label={copy.thisWeek} days={days} />
        {streak >= 2 && <p className="wk-muted">{format(copy.streak, { weeks: streak })}</p>}
      </Card>
      <fieldset>
        <legend>{t.feel}</legend>
        <div className="v8-capsules">
          {feels.map((feel, i) => (
            <ChoiceChip
              key={feel}
              selected={feedback.feel === feel}
              onClick={() => setFeedback({ ...feedback, feel: feedback.feel === feel ? undefined : feel })}
            >
              {t.feelOptions[i]}
            </ChoiceChip>
          ))}
        </div>
      </fieldset>
      {!complete && (
        <fieldset>
          <legend>{t.shortfall}</legend>
          <div className="v8-capsules">
            {reasons.map((reason, i) => (
              <ChoiceChip
                key={reason}
                selected={feedback.reasons.includes(reason)}
                onClick={() => {
                  const next = feedback.reasons.includes(reason)
                    ? feedback.reasons.filter(r => r !== reason)
                    : [...feedback.reasons, reason];
                  setFeedback({
                    ...feedback,
                    reasons: next,
                    ...(!next.includes('discomfort') ? { discomfortExerciseIds: undefined } : {}),
                  });
                }}
              >
                {t.reasonOptions[i]}
              </ChoiceChip>
            ))}
          </div>
        </fieldset>
      )}
      {feedback.reasons.includes('discomfort') && (
        <fieldset>
          <legend>{t.which}</legend>
          <div className="v8-capsules">
            {[...new Set(active.sets.map(s => s.exerciseId))].map(id => (
              <ChoiceChip
                key={id}
                selected={feedback.discomfortExerciseIds?.includes(id) ?? false}
                onClick={() =>
                  setFeedback({
                    ...feedback,
                    discomfortExerciseIds: feedback.discomfortExerciseIds?.includes(id)
                      ? feedback.discomfortExerciseIds.filter(i => i !== id)
                      : [...(feedback.discomfortExerciseIds ?? []), id],
                  })
                }
              >
                {name(id)}
              </ChoiceChip>
            ))}
          </div>
        </fieldset>
      )}
      <label>
        {t.note}
        <textarea
          value={feedback.note ?? ''}
          maxLength={TEXT_LIMITS.long}
          aria-invalid={noteIssue ? true : undefined}
          onChange={e => setFeedback({ ...feedback, note: e.target.value })}
        />
        <FieldIssue issue={noteIssue} locale={locale} max={TEXT_LIMITS.long} />
      </label>
      <PrimaryButton
        disabled={busy || !!noteIssue}
        onClick={() =>
          void run(async () => {
            await workflow.finish(
              active.id,
              { ...feedback, ...(feedback.note !== undefined ? { note: cleanText(feedback.note) } : {}) },
              false,
              endedAt,
            );
            navigate('/review');
          })
        }
      >
        {t.save}
      </PrimaryButton>
    </main>
  );
}
