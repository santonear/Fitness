import { useEffect, useState } from 'react';
import type { LastWeekSummary } from '../../../application/last-week';
import type { NextWeekTip } from '../../../application/yaya-tips';
import { homeCopy } from '../../../i18n/features/home/copy';
import { fill } from '../../../i18n/features/onboarding/entry';
import { yayaTips } from '../../../i18n/features/coach/yaya-tips';
import { Card, PrimaryButton, ProgressRing, Yaya } from '../../components/kit';
import { foldNextWeek, markWeekdayAsked, nextWeekFolded, weekdayName } from './plan-tips';

const closedKey = (profileId: string, week: string) => `fitness-last-week-card:${profileId}:${week}`;
/** The card was closed for this week (also read by 今天 so it does not repeat the card's tip). */
export function lastWeekClosed(profileId: string, week: string) {
  try {
    return localStorage.getItem(closedKey(profileId, week)) === '1';
  } catch {
    return false;
  }
}

/** “下周怎么调” (G): the gap in facts, one option, and the choice stays with the user. */
function tipText(tip: NextWeekTip, locale: 'zh' | 'en') {
  const y = yayaTips[locale];
  switch (tip.kind) {
    case 'pain':
      return fill(y.pain, { area: tip.areas.map(area => y.areas[area]).join(y.areaJoin) });
    case 'zero':
      return y.zero;
    case 'weekday':
      return fill(y.weekday, { weekday: weekdayName(tip, locale) });
    case 'short':
      return fill(y.short, { actual: tip.actual, gap: tip.gap, minutes: tip.minutes });
    case 'overdone':
      return fill(y.overdone, { extra: tip.extra, next: tip.next });
    case 'on-track':
      return y.onTrack;
  }
}
/** The change note saved with the new version (it names the old goal, so the earlier plan is easy to find). */
export function tipSummary(tip: NextWeekTip, locale: 'zh' | 'en') {
  const s = yayaTips[locale].summary;
  switch (tip.kind) {
    case 'zero':
      return fill(s.zero, { target: tip.target });
    case 'weekday':
      return fill(s.weekday, { weekday: weekdayName(tip, locale), minutes: tip.minutes });
    case 'short':
      return fill(s.short, { minutes: tip.minutes });
    case 'overdone':
      return fill(s.overdone, { target: tip.target, next: tip.next });
    default:
      return '';
  }
}

/** 上周一张图: one compact card on 今天 in a new week, until it is closed or the review is opened. */
export function LastWeekCard({
  summary,
  profileId,
  locale,
  name,
  onReview,
  tip,
  busy,
  onAdjust,
  onSwaps,
}: {
  summary: LastWeekSummary;
  profileId: string;
  locale: 'zh' | 'en';
  name: (exerciseId: string) => string;
  onReview: () => void;
  /** “下周怎么调”: at most one, decided by nextWeekTip. */
  tip?: NextWeekTip;
  busy?: boolean;
  /** Saves the tip's plan change as a new version; resolves true when saved. */
  onAdjust?: (tip: NextWeekTip) => Promise<boolean>;
  /** Opens the existing swap panel for an exercise of today's session (pain tip). */
  onSwaps?: () => void;
}) {
  const t = homeCopy[locale].lastWeek,
    y = yayaTips[locale],
    [hidden, setHidden] = useState(() => lastWeekClosed(profileId, summary.week)),
    [folded, setFolded] = useState(() => nextWeekFolded(profileId, summary.week));
  const shownTip = !hidden && !folded ? tip : undefined;
  // Case 3 shares v5 §14 with 今天: once said here, 今天 does not say it again this week.
  useEffect(() => {
    if (shownTip?.kind === 'weekday') markWeekdayAsked(profileId, summary.week, 'lastweek');
  }, [shownTip?.kind, profileId, summary.week]);
  if (hidden) return null;
  const close = () => {
    try {
      localStorage.setItem(closedKey(profileId, summary.week), '1');
    } catch {
      /* Closing still works for this visit without storage. */
    }
    setHidden(true);
  };
  const fold = () => {
    foldNextWeek(profileId, summary.week);
    setFolded(true);
  };
  const gain = summary.improvement,
    value = gain && (gain.metric === 'loadGrams' ? Math.round(gain.gain / 100) / 10 : gain.gain);
  const adjust = () => {
    if (shownTip && onAdjust)
      void onAdjust(shownTip).then(saved => {
        if (saved) fold();
      });
  };
  return (
    <Card variant="raised" padding="md" as="section" className="v9-home-lastweek" aria-labelledby="v9-home-lastweek">
      {summary.done > 0 ? (
        <ProgressRing value={summary.target > 0 ? summary.done / summary.target : 1} size={64} stroke={6}>
          <span className="v9-num">
            {summary.done}/{summary.target}
          </span>
        </ProgressRing>
      ) : (
        <Yaya pose="care" size={56} alt="" />
      )}
      <div>
        <h2 id="v9-home-lastweek">{t.title}</h2>
        <p>{summary.done > 0 ? fill(t.done, { done: summary.done, target: summary.target }) : t.none}</p>
        {summary.done > 0 && gain && (
          <p className="v9-home-lastweek-note">
            {fill(t[gain.metric === 'loadGrams' ? 'load' : gain.metric === 'reps' ? 'reps' : 'duration'], {
              name: name(gain.exerciseId),
              value: value ?? 0,
            })}
          </p>
        )}
        {shownTip && (
          <div className="v9-home-tip" role="status" data-tip={shownTip.kind}>
            <p>{tipText(shownTip, locale)}</p>
            {shownTip.kind === 'pain' ? (
              <div className="v9-home-row">
                <PrimaryButton tone="quiet" size="sm" onClick={fold}>
                  {y.painOk}
                </PrimaryButton>
                {onSwaps && (
                  <PrimaryButton tone="quiet" size="sm" onClick={onSwaps}>
                    {y.painSwaps}
                  </PrimaryButton>
                )}
              </div>
            ) : (
              shownTip.kind !== 'on-track' && (
                <div className="v9-home-row">
                  <PrimaryButton tone="quiet" size="sm" disabled={busy || !onAdjust} onClick={adjust}>
                    {shownTip.kind === 'overdone' ? fill(y.overdoneYes, { next: shownTip.next }) : y.adjust}
                  </PrimaryButton>
                  <PrimaryButton tone="text" size="sm" onClick={fold}>
                    {shownTip.kind === 'overdone' ? fill(y.overdoneNo, { target: shownTip.target }) : y.notNow}
                  </PrimaryButton>
                </div>
              )
            )}
          </div>
        )}
        <PrimaryButton
          tone="quiet"
          size="sm"
          onClick={() => {
            close();
            onReview();
          }}
        >
          {t.review}
        </PrimaryButton>
      </div>
      <button type="button" className="v8-control v8-icon-button v8-press" aria-label={t.close} onClick={close}>
        ×
      </button>
    </Card>
  );
}
