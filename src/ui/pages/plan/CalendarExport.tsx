import { useEffect, useState } from 'react';
import type { PlanVersion } from '../../../domain/v8/contracts';
import { trainingCalendar } from '../../../application/calendar-export';
import { coachReminderService } from '../../../application/coach-reminders';
import { planCalendarCopy } from '../../../i18n/features/plan/calendar';
import { PrimaryButton } from '../../components/kit';
import { downloadBlob } from '../../components/download';

/**
 * 添加到手机日历: the training days as an .ics file made on the device. Nothing is sent anywhere.
 * WeChat's in-app browser cannot save files, so there it only says how to open the page in a browser.
 */
export function CalendarExport({
  plan,
  todayDate,
  startDate,
  locale,
}: {
  plan: PlanVersion;
  todayDate: string;
  startDate?: string;
  locale: 'zh' | 'en';
}) {
  const t = planCalendarCopy[locale],
    [reminderTime, setReminderTime] = useState<string>(),
    [wechat, setWechat] = useState(false);
  useEffect(() => {
    let alive = true;
    void coachReminderService
      .preferences()
      .then(ledger => {
        if (alive) setReminderTime(ledger.preferences.time);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  // The reminder time the person set wins; then the plan's own start time; then 19:30.
  const ics = trainingCalendar({
    plan,
    today: todayDate,
    startDate,
    time: reminderTime ?? plan.startTime,
    summary: t.eventTitle,
    description: t.eventNote,
  });
  if (!ics) return null;
  return (
    <div className="v9-plan-calendar-export">
      <PrimaryButton
        tone="quiet"
        size="sm"
        onClick={() => {
          if (/MicroMessenger/i.test(navigator.userAgent)) setWechat(true);
          else downloadBlob(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), 'fitness-training.ics');
        }}
      >
        {t.add}
      </PrimaryButton>
      <p role={wechat ? 'status' : undefined}>{wechat ? t.wechat : t.addHint}</p>
    </div>
  );
}
