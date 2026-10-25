import { useEffect, useState } from 'react';
import { DEFAULT_TIME_ZONE, addDays } from '../../../domain/local-date';
import { goalCheckDue } from '../../../application/yaya-tips';
import { planStartDate } from '../../../application/plan-presentation';
import { answerText } from '../../../application/preset-text';
import { activityDate } from '../../../application/v8-activity';
import { TEXT_LIMITS, textIssue } from '../../../domain/input-guard';
import { goalPhrase, yayaTips } from '../../../i18n/features/coach/yaya-tips';
import { fillLine, yayaV5 } from '../../../i18n/features/coach/yaya-v5';
import { planPagesCopy } from '../../../i18n/features/plan-upgrade/pages';
import { ChoiceChip, PrimaryButton, Yaya } from '../../components/kit';
import { FieldIssue } from '../../components/common/FieldIssue';
import { useMainline } from '../../mainline/context';

/** Fewer than one session in this many days counts as “最近练得少”. */
const QUIET_DAYS = 14;

const askedKey = (profileId: string) => `fitness-goal-check:${profileId}`;
function lastAsked(profileId: string) {
  try {
    const value = localStorage.getItem(askedKey(profileId));
    return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
}
function markAsked(profileId: string, today: string) {
  try {
    localStorage.setItem(askedKey(profileId), today);
  } catch {
    /* Without storage it may ask again next visit. */
  }
}

type Stage = 'ask' | 'pick' | 'kept' | 'changed';

/**
 * K · 每月问一次“目标还是这个吗” on 回顾 (Bo 2026-10-25). Shown once when due, never pushed; × waits for next month.
 * “还是这个” changes nothing. A new goal goes through 重新制定计划 with the goal filled in: the new plan is saved
 * only when the person confirms it there, and the current plan stays in 我的计划 to switch back to.
 */
export function GoalCheck() {
  const c = useMainline(),
    { data, locale } = c,
    y = yayaTips[locale];
  const profileId = data?.metadata.localProfileId ?? '',
    today = activityDate(data?.profile?.timeZone ?? DEFAULT_TIME_ZONE);
  const zone = data?.profile?.timeZone ?? DEFAULT_TIME_ZONE;
  const firstStart = (data?.versions ?? [])
    .filter(v => v.planId === data?.plan?.id)
    .map(v => planStartDate(v, zone))
    .filter((date): date is string => !!date)
    .sort()[0];
  const due =
    !!profileId && !!data?.plan && !data.plan.readOnly && goalCheckDue(firstStart, lastAsked(profileId), today);
  const [stage, setStage] = useState<Stage>();
  const [goal, setGoal] = useState(''),
    [own, setOwn] = useState<string>();
  useEffect(() => {
    if (due && !stage) {
      setStage(data?.version?.goalText.trim() ? 'ask' : 'pick');
      markAsked(profileId, today);
    }
  }, [due]);
  if (!stage) return null;
  const current = answerText(data?.version?.goalText.trim() ?? '', locale);
  const quiet = !(data?.workouts ?? []).some(
    w => (w.status === 'complete' || w.status === 'partial') && w.localDate >= addDays(today, -QUIET_DAYS),
  );
  const line =
    stage === 'kept'
      ? y.goalKept
      : stage === 'changed'
        ? y.goalChanged
        : !current
          ? y.goalAskNone
          : stage === 'pick'
            ? y.goalAskNone
            : quiet
              ? fillLine(y.goalAskLess, { goal: goalPhrase(current, locale, locale === 'en') })
              : fillLine(y.goalAsk, { goal: goalPhrase(current, locale) });
  const choose = (text: string) => {
    setGoal(text.trim());
    setStage('changed');
  };
  // 看看新计划: the existing re-plan entry, starting from the new goal (an unconfirmed draft is asked about first).
  const replan = () => {
    if (c.candidate) return c.restartPlanning();
    c.startFresh();
    c.setAnswers(previous => ({ ...previous, goalText: goal }));
  };
  const issue = own !== undefined ? textIssue(own, TEXT_LIMITS.short) : undefined;
  return (
    <section className="rv-goal-check" aria-live="polite">
      <p className="rv-yaya-line">
        <Yaya pose="think" size={36} alt="" />
        <span>{line}</span>
        <button
          type="button"
          className="v8-control v8-icon-button v8-press"
          aria-label={y.close}
          onClick={() => setStage(undefined)}
        >
          ×
        </button>
      </p>
      {stage === 'ask' && (
        <div className="rv-actions">
          <PrimaryButton tone="quiet" size="sm" onClick={() => setStage('kept')}>
            {quiet ? y.goalKeepLess : y.goalKeep}
          </PrimaryButton>
          <PrimaryButton tone="quiet" size="sm" onClick={() => setStage('pick')}>
            {y.goalChange}
          </PrimaryButton>
        </div>
      )}
      {stage === 'pick' && (
        <>
          <div className="rv-actions" role="group" aria-label={y.goalAskNone}>
            {yayaV5[locale].meetWhyOptions.map(option => (
              <ChoiceChip key={option} size="sm" selected={false} onClick={() => choose(option)}>
                {option}
              </ChoiceChip>
            ))}
            <ChoiceChip size="sm" selected={own !== undefined} onClick={() => setOwn(own ?? '')}>
              {planPagesCopy[locale].yourWords}
            </ChoiceChip>
          </div>
          {own !== undefined && (
            <div className="rv-actions">
              <input
                className="v8-control"
                value={own}
                maxLength={TEXT_LIMITS.short}
                placeholder={y.goalOwnPlaceholder}
                aria-label={planPagesCopy[locale].yourWords}
                aria-invalid={issue ? true : undefined}
                onChange={event => setOwn(event.target.value)}
              />
              <FieldIssue issue={issue} locale={locale} max={TEXT_LIMITS.short} />
              <PrimaryButton tone="quiet" size="sm" disabled={!own.trim() || !!issue} onClick={() => choose(own)}>
                {y.goalOwnSave}
              </PrimaryButton>
            </div>
          )}
        </>
      )}
      {stage === 'changed' && (
        <div className="rv-actions">
          <PrimaryButton size="sm" disabled={c.busy} onClick={replan}>
            {y.goalSeePlan}
          </PrimaryButton>
          <PrimaryButton tone="quiet" size="sm" onClick={() => setStage(undefined)}>
            {y.goalNotNow}
          </PrimaryButton>
        </div>
      )}
    </section>
  );
}
