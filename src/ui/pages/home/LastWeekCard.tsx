import { useState } from 'react';
import type { LastWeekSummary } from '../../../application/last-week';
import { homeCopy } from '../../../i18n/features/home/copy';
import { fill } from '../../../i18n/features/onboarding/entry';
import { Card, PrimaryButton, ProgressRing, Yaya } from '../../components/kit';

const closedKey = (profileId: string, week: string) => `fitness-last-week-card:${profileId}:${week}`;
function closed(key: string) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** 上周一张图: one compact card on 今天 in a new week, until it is closed or the review is opened. */
export function LastWeekCard({
  summary,
  profileId,
  locale,
  name,
  onReview,
}: {
  summary: LastWeekSummary;
  profileId: string;
  locale: 'zh' | 'en';
  name: (exerciseId: string) => string;
  onReview: () => void;
}) {
  const t = homeCopy[locale].lastWeek,
    key = closedKey(profileId, summary.week),
    [hidden, setHidden] = useState(() => closed(key));
  if (hidden) return null;
  const close = () => {
    try {
      localStorage.setItem(key, '1');
    } catch {
      /* Closing still works for this visit without storage. */
    }
    setHidden(true);
  };
  const gain = summary.improvement,
    value = gain && (gain.metric === 'loadGrams' ? Math.round(gain.gain / 100) / 10 : gain.gain);
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
