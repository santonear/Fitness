import type { Locale, ScheduledWorkout, SetRecord, WorkoutSession } from '../../domain/models';
import { WorkoutFacts } from './CompletionReview';

export function HistoryDetail({ session, sets, schedule, locale }: {
  session: WorkoutSession;
  sets: SetRecord[];
  schedule?: ScheduledWorkout;
  locale: Locale;
}) {
  const zh = locale === 'zh';
  return (
    <section aria-label={zh ? '历史详情' : 'History details'} className="history-detail">
      <h3>{zh ? '历史详情' : 'History details'}</h3>
      <p className="muted">{zh ? '已完成记录只读，不能修改或删除。' : 'Completed records are read only and cannot be edited or deleted.'}</p>
      {schedule && <p>{zh ? '原计划日期' : 'Original planned date'}: {schedule.originalDate} · {zh ? '实际训练日期' : 'Actual training date'}: {session.localDate}</p>}
      <WorkoutFacts session={session} sets={sets} locale={locale} />
    </section>
  );
}
