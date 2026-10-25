import { useEffect, useRef, useState } from 'react';
import type { FitnessTestRecord } from '../../../domain/plan-upgrade';
import { DEFAULT_TIME_ZONE, todayIn } from '../../../domain/local-date';
import { starterAvailable, starterComparison, starterProgress } from '../../../application/starter-program';
import { planStartDate } from '../../../application/plan-presentation';
import { listFitnessTests, setStarterProgram } from '../../../persistence/plan-upgrade-store';
import { steadyStarterCopy } from '../../../i18n/features/coach/yaya-steady-starter';
import { fillLine } from '../../../i18n/features/coach/yaya-v5';
import { planPagesCopy } from '../../../i18n/features/plan-upgrade/pages';
import { testValueText } from '../plan-upgrade/logic';
import { Card, PrimaryButton } from '../../components/kit';
import { MorphPanel } from '../../components/common';
import { useMainline } from '../../mainline/context';

// 自己排 hides the offer on this device for that plan (a per-viewer convenience, not plan data).
const dismissedKey = 'fitness.starterDismissed';
const dismissedFor = (planId: string) => {
  try {
    return localStorage.getItem(dismissedKey) === planId;
  } catch {
    return false;
  }
};
const setDismissed = (planId: string | undefined) => {
  try {
    if (planId) localStorage.setItem(dismissedKey, planId);
    else localStorage.removeItem(dismissedKey);
  } catch {
    /* The offer simply shows again next time. */
  }
};
const counted = (status: string) => status === 'complete' || status === 'partial';

/** 新手 4 周 on 计划 (Bo 2026-10-25): offer, week progress with quit, and the finish card. By-day plans only. */
export function StarterProgramCard() {
  const { data, locale, busy, run, restartPlanning } = useMainline();
  const y = steadyStarterCopy[locale];
  const [hidden, setHidden] = useState(false);
  const [left, setLeft] = useState(false);
  const [asking, setAsking] = useState(false);
  const [tests, setTests] = useState<FitnessTestRecord[]>([]);
  const quitRef = useRef<HTMLElement | null>(null);
  const plan = data?.plan,
    version = data?.version,
    program = version?.starterProgram;
  const timeZone = data?.profile?.timeZone ?? DEFAULT_TIME_ZONE,
    today = todayIn(timeZone);
  const workouts = data?.workouts ?? [];
  const progress = program ? starterProgress(program, workouts, today) : undefined;
  useEffect(() => {
    if (!progress?.finished) return;
    let alive = true;
    void listFitnessTests()
      .then(rows => {
        if (alive) setTests(rows);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [progress?.finished]);
  if (!data || !plan || !version || plan.readOnly || plan.deletedAt) return null;
  const change = (startDate: string | undefined, summary: string, after?: () => void) =>
    void run(async () => {
      await setStarterProgram(plan.id, startDate, summary);
      after?.();
    });
  const blocked = busy || !!data.active;

  if (program && progress && !progress.finished) {
    const line = progress.missedLastWeek
      ? fillLine(y.starterMissed, { n: progress.week })
      : fillLine(y.starterWeeks[progress.week - 1]!, { n: progress.lastWeekSessions });
    return (
      <section className="v9-plan-more" aria-labelledby="starter-title">
        <Card variant="raised" padding="md">
          <h2 id="starter-title">{y.starterTitle}</h2>
          <strong className="v9-num" data-testid="starter-progress">
            {fillLine(y.starterProgress, { n: progress.week })}
          </strong>
          <p>{line}</p>
          <div className="v9-plan-tools">
            <PrimaryButton
              tone="quiet"
              size="sm"
              disabled={blocked}
              onClick={event => {
                quitRef.current = event.currentTarget;
                setAsking(true);
              }}
            >
              {y.starterQuit}
            </PrimaryButton>
          </div>
        </Card>
        <MorphPanel
          open={asking}
          title={y.starterQuitAsk}
          closeLabel={y.starterQuitNo}
          onClose={() => {
            if (!busy) setAsking(false);
          }}
          triggerRef={quitRef}
        >
          <PrimaryButton
            disabled={blocked}
            onClick={() =>
              change(undefined, y.starterLeft, () => {
                setAsking(false);
                setLeft(true);
                setHidden(false);
                setDismissed(undefined);
              })
            }
          >
            {y.starterQuitYes}
          </PrimaryButton>
        </MorphPanel>
      </section>
    );
  }
  if (program && progress?.finished) {
    const compared = starterComparison(tests, program.startDate);
    const c = planPagesCopy[locale];
    return (
      <section className="v9-plan-more" aria-labelledby="starter-title">
        <Card variant="raised" padding="md">
          <h2 id="starter-title">{y.starterTitle}</h2>
          <p>
            {compared
              ? fillLine(y.starterDone, {
                  n: progress.sessions,
                  item: c.testItems[compared.item].replace(/（.*）|\s*\(.*\)/, ''),
                  a: testValueText(compared.item, compared.from, locale),
                  b: testValueText(compared.item, compared.to, locale),
                })
              : fillLine(y.starterDoneCount, { n: progress.sessions })}
          </p>
          <div className="v9-plan-tools">
            <PrimaryButton size="sm" disabled={blocked} onClick={() => change(undefined, y.starterFinished)}>
              {y.starterKeep}
            </PrimaryButton>
            <PrimaryButton tone="quiet" size="sm" disabled={blocked} onClick={restartPlanning}>
              {y.starterChange}
            </PrimaryButton>
          </div>
        </Card>
      </section>
    );
  }
  // Offered to someone new on a by-day plan, and again to anyone who tried it on this plan.
  const fresh = !workouts.some(w => counted(w.status)),
    tried = data.versions.some(v => v.planId === plan.id && v.starterProgram);
  const offered = starterAvailable(version) && (fresh || tried) && !hidden && !dismissedFor(plan.id);
  if (!offered) return left ? <p role="status">{y.starterQuitDone}</p> : null;
  const start = planStartDate(version, timeZone);
  return (
    <section className="v9-plan-more" aria-labelledby="starter-title">
      {left && <p role="status">{y.starterQuitDone}</p>}
      <Card variant="raised" padding="md">
        <h2 id="starter-title">{y.starterTitle}</h2>
        <p>{y.starterOffer}</p>
        <p>{y.starterHonest}</p>
        <div className="v9-plan-tools">
          <PrimaryButton
            size="sm"
            disabled={blocked}
            onClick={() => {
              setLeft(false);
              change(start && start > today ? start : today, y.starterStarted);
            }}
          >
            {y.starterUse}
          </PrimaryButton>
          <PrimaryButton
            tone="quiet"
            size="sm"
            disabled={busy}
            onClick={() => {
              setDismissed(plan.id);
              setHidden(true);
            }}
          >
            {y.starterOwn}
          </PrimaryButton>
        </div>
      </Card>
    </section>
  );
}
