import { useState } from 'react';
import { daysBetween } from '../../../domain/local-date';
import type { WeekdayChange } from '../../../application/yaya-tips';
import { weekdays } from '../../../application/plan-presentation';
import { fillLine, yayaV5 } from '../../../i18n/features/coach/yaya-v5';
import { yayaTips } from '../../../i18n/features/coach/yaya-tips';
import { PrimaryButton } from '../../components/kit';
import { useMainline } from '../../mainline/context';

/** Per-device notes for 芽芽's plan tips on 今天; storage errors only mean the tip may show again. */
const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Closing still works for this visit. */
  }
};

/** Who already asked about the missed weekday this week: 今天's line (v5 §14) or the 上周 card (G case 3). */
const askedKey = (profileId: string) => `fitness-weekday-asked:${profileId}`;
export function weekdayAsked(profileId: string, week: string): 'today' | 'lastweek' | undefined {
  const [savedWeek, by] = (read(askedKey(profileId)) ?? '').split(':');
  return savedWeek === week && (by === 'today' || by === 'lastweek') ? by : undefined;
}
export const markWeekdayAsked = (profileId: string, week: string, by: 'today' | 'lastweek') => {
  if (!weekdayAsked(profileId, week)) write(askedKey(profileId), `${week}:${by}`);
};

/** “不用” on 今天 rests the missed-weekday line for four weeks. */
const SKIP_REST_DAYS = 28;
const skipClosedKey = (profileId: string) => `fitness-skip-day-closed:${profileId}`;
export function skipDayResting(profileId: string, today: string) {
  const closed = read(skipClosedKey(profileId));
  return !!closed && /^\d{4}-\d{2}-\d{2}$/.test(closed) && daysBetween(closed, today) < SKIP_REST_DAYS;
}

/** “下一步怎么调” on the 上周 card: “先不改” or a saved change folds it for that week. */
const nextWeekKey = (profileId: string, week: string) => `fitness-next-week-tip:${profileId}:${week}`;
export const nextWeekFolded = (profileId: string, week: string) => read(nextWeekKey(profileId, week)) === '1';
export const foldNextWeek = (profileId: string, week: string) => write(nextWeekKey(profileId, week), '1');

export const weekdayName = (change: Pick<WeekdayChange, 'weekday'>, locale: 'zh' | 'en') =>
  yayaTips[locale].weekdays[weekdays.indexOf(change.weekday)]!;

/** v5 §14 on 今天: one compact line with 改吧 / 不用; 改吧 saves a new plan version (undo in the toast). */
export function SkipDayLine({ change, today }: { change: WeekdayChange; today: string }) {
  const c = useMainline(),
    y = yayaV5[c.locale],
    profileId = c.data?.metadata.localProfileId ?? '';
  const [closed, setClosed] = useState(false);
  if (closed) return null;
  const day = weekdayName(change, c.locale);
  const close = () => {
    write(skipClosedKey(profileId), today);
    setClosed(true);
  };
  return (
    <div className="v9-home-tip" role="status">
      <p>{fillLine(y.skipDay, { weekday: day })}</p>
      <div className="v9-home-row">
        <PrimaryButton
          tone="quiet"
          size="sm"
          disabled={c.busy}
          onClick={() =>
            void c
              .applyLocalChange({
                proposal: change.proposal,
                summary: fillLine(yayaTips[c.locale].summary.weekday, { weekday: day, minutes: change.minutes }),
              })
              .then(saved => {
                if (saved) close();
              })
          }
        >
          {y.skipDayYes}
        </PrimaryButton>
        <PrimaryButton tone="text" size="sm" onClick={close}>
          {y.skipDayNo}
        </PrimaryButton>
      </div>
    </div>
  );
}
