import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { liveQuery } from 'dexie';
import { workoutService } from '../../application/workouts';
import { dateInZone, progressService } from '../../application/progress';
import type { ProgressReport } from '../../domain/models';
import { WorkoutPage } from './WorkoutPage';

export function TodayPage() {
  const { i18n } = useTranslation();
  const zh = i18n.resolvedLanguage === 'zh';
  const locale = zh ? 'zh' : 'en';
  const [ongoing, setOngoing] = useState(false);
  const [report, setReport] = useState<ProgressReport>();
  const [error, setError] = useState('');
  // Refresh the date boundary while an open dashboard crosses midnight.
  const [now, setNow] = useState(() => Date.now());
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = dateInZone(now, timeZone);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const subscription = liveQuery(async () => ({
      session: await workoutService.getActiveWorkout(),
      progress: await progressService.queryProgress({ from: '1970-01-01', to: today, timeZone }, now),
    })).subscribe({
      next: ({ session, progress }) => {
        setOngoing(Boolean(session));
        setReport(progress);
        setError('');
      },
      error: reason => setError((reason as Error).message),
    });
    return () => subscription.unsubscribe();
  }, [today, timeZone, now]);

  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (date.getDay() + 6) % 7 + index);
    return dateInZone(date.getTime(), timeZone);
  });
  const weight = report?.bodyWeights.at(-1);
  const rate = report?.completionRate;
  const dateLabel = new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-US', {
    month: 'long', day: 'numeric', weekday: 'long',
  }).format(now);

  return (
    <div className="dashboard">
      <div className="dashboard-heading">
        <div>
          <p className="dashboard-eyebrow">{dateLabel}</p>
          <h1>{zh ? '今日训练' : 'Today'}</h1>
          <p className="muted">{zh ? '训练、日程与进度，清晰呈现。' : 'Your next session, schedule, and progress. All in one place.'}</p>
        </div>
        {ongoing && <Link className="dashboard-link" to="/workout">{zh ? '继续训练' : 'Continue workout'} <span aria-hidden="true">↗</span></Link>}
      </div>
      {error && <p role="alert">{error}</p>}
      <WorkoutPage dashboard />
      <section className="dashboard-summary" aria-label={zh ? '训练概览' : 'Training overview'} aria-busy={!report && !error}>
        {!report ? <p className="muted">{error ? (zh ? '暂时无法读取训练概览。' : 'Training overview is unavailable.') : (zh ? '正在读取本地记录…' : 'Reading local records…')}</p> : <>
          <div className="dashboard-stat">
            <h2>{zh ? '已完成训练' : 'Completed sessions'}</h2>
            <div className="dashboard-value"><strong aria-label={zh ? '已完成训练' : 'Completed sessions'}>{report.history.length}</strong><span>{zh ? '累计' : 'all time'}</span></div>
            <div className="dashboard-activity" aria-label={zh ? '本周已完成训练' : 'Completed training this week'}>
              {week.map(date => {
                const count = report.history.filter(session => session.localDate === date).length;
                return <span key={date} className={count ? 'has-session' : ''} aria-label={`${date}: ${count}`} title={`${date}: ${count}`} />;
              })}
            </div>
            <p className="muted">{zh ? '本周训练记录，完成后计入。' : 'This week’s activity. Sessions count after completion.'}</p>
          </div>
          <div className="dashboard-stat dashboard-plan-stat">
            <div>
              <h2>{zh ? '计划完成率' : 'Plan completion'}</h2>
              <div className="dashboard-value"><strong>{rate === null ? '—' : `${Math.round(rate! * 100)}%`}</strong></div>
              <p className="muted">{rate === null ? (zh ? '暂无到期任务' : 'No tasks due') : (zh ? `${report.completedCount} / ${report.dueCount} 项到期任务已完成` : `${report.completedCount} / ${report.dueCount} due tasks completed`)}</p>
            </div>
            <svg className="dashboard-ring" viewBox="0 0 64 64" role="img" aria-label={zh ? '计划完成情况' : 'Plan completion indicator'}>
              <circle cx="32" cy="32" r="26" fill="none" stroke="var(--dashboard-line)" strokeWidth="5" />
              {rate !== null && <circle cx="32" cy="32" r="26" fill="none" stroke="var(--dashboard-accent)" strokeWidth="5" strokeDasharray={`${rate! * 163.36} 163.36`} transform="rotate(-90 32 32)" />}
              {rate === null && <text x="32" y="37" textAnchor="middle" fill="var(--dashboard-muted)" fontSize="17">—</text>}
            </svg>
          </div>
          <div className="dashboard-stat">
            <h2>{zh ? '最近实测体重' : 'Latest weight'}</h2>
            <div className="dashboard-value"><strong>{weight ? weight.weightGrams / 1000 : '—'}</strong><span>kg</span></div>
            <p className="muted">{weight ? weight.localDate : (zh ? '暂无实测体重记录。' : 'No weight observations yet.')}</p>
            <Link className="dashboard-link" to="/settings">{zh ? '管理体重记录' : 'Manage weight records'} <span aria-hidden="true">↗</span></Link>
          </div>
        </>}
      </section>
      <section className="dashboard-history" aria-label={zh ? '最近训练' : 'Recent training'}>
        <div className="dashboard-section-heading">
          <div><h2>{zh ? '最近训练' : 'Recent training'}</h2><p className="muted">{zh ? '已完成训练，一目了然。' : 'Completed sessions, kept together.'}</p></div>
          <Link className="dashboard-link" to="/progress">{zh ? '查看历史与进度' : 'View history and progress'} <span aria-hidden="true">↗</span></Link>
        </div>
        {report && (report.history.length ? report.history.slice(0, 3).map(session => (
          <article className="dashboard-history-row" key={session.id}>
            <span className="dashboard-history-mark" aria-hidden="true">✓</span>
            <div><h3>{session.exerciseSnapshots.map(exercise => exercise.name[locale]).join(' · ')}</h3><p className="muted">{session.localDate} · {session.planVersionId ? (zh ? '计划训练' : 'Planned workout') : (zh ? '临时训练' : 'Temporary workout')}</p></div>
            <span className="dashboard-badge">{zh ? '已完成' : 'Completed'}</span>
          </article>
        )) : <div className="dashboard-history-row">
          <span className="dashboard-history-mark" aria-hidden="true">↗</span>
          <div><h3>{zh ? '暂无已完成训练。' : 'No completed sessions yet.'}</h3><p className="muted">{zh ? '完成训练后，在这里查看训练历史。' : 'Complete a workout to see your training history here.'}</p></div>
        </div>)}
      </section>
    </div>
  );
}
