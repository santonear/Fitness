import type { GuidedLocale } from './GuidedOnboarding';
import type { SetMetrics } from '../../../domain/models';
import '../../guided.css';

export interface GuidedExerciseView {
  id: string;
  name: string;
  targets: string[];
  safety: string;
  steps?: string[];
  commonMistakes?: string[];
  reason?: string;
}
export function formatGuidedTargets(targets: SetMetrics[], locale: GuidedLocale): string[] {
  return targets.map((target, index) => {
    const set = locale === 'zh' ? `第${index + 1}组` : `set ${index + 1}`;
    switch (target.metricType) {
      case 'reps_load': return `${set} · ${target.reps} ${locale === 'zh' ? '次' : 'reps'} · ${target.loadGrams / 1000} kg`;
      case 'reps': return `${set} · ${target.reps} ${locale === 'zh' ? '次' : 'reps'}`;
      case 'duration': return `${set} · ${target.durationSeconds} s`;
      case 'duration_distance': return `${set} · ${target.durationSeconds} s · ${target.distanceMeters === undefined ? locale === 'zh' ? '距离未设置' : 'distance not specified' : `${target.distanceMeters / 1000} km`}`;
    }
  });
}
export interface ProgramDashboardProps {
  locale: GuidedLocale;
  title: string;
  status: 'active' | 'paused' | 'cancelled' | 'completed' | 'none' | 'candidate';
  startDate?: string;
  endDate?: string;
  elapsedDays: number;
  totalDays: number;
  completedWorkouts: number;
  plannedWorkouts: number;
  todayLabel: string;
  exercises?: GuidedExerciseView[];
  rationale?: string;
  uncertainties?: string[];
  measurements?: { label: string; value: string | null; source?: string }[];
  actionLabel?: string;
  onToday?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onDialogue?: () => void;
  busy?: boolean;
}
export function ProgramDashboard(props: ProgramDashboardProps) {
  const { locale, title, status, startDate, endDate, elapsedDays, totalDays, completedWorkouts, plannedWorkouts, todayLabel, exercises = [], rationale, uncertainties = [], measurements = [], actionLabel, onToday, onPause, onResume, onCancel, onDialogue, busy } = props;
  const t = (zh: string, en: string) => locale === 'en' ? en : zh;
  const statuses = { active: t('进行中', 'active'), paused: t('已暂停', 'paused'), cancelled: t('已取消', 'cancelled'), completed: t('已结束', 'completed'), none: t('尚无当前计划', 'no current plan'), candidate: t('候选，尚未生效', 'candidate, not active yet') };
  const percent = plannedWorkouts > 0 ? Math.round(Math.min(1, Math.max(0, completedWorkouts / plannedWorkouts)) * 100) : null;
  return <section className="guided-panel guided-dashboard" aria-busy={busy}>
    <div className="guided-topline"><span>{t('欢迎回来', 'welcome back')}</span><span>{statuses[status]}</span></div>
    <h2>{title}</h2>
    {(startDate || endDate) && <p>{startDate ?? '—'} → {endDate ?? '—'}</p>}
    <section className="guided-today"><h3>{t('今天', 'today')}</h3><p>{todayLabel}</p>{onToday && <button type="button" className="guided-primary" disabled={busy} onClick={onToday}>{actionLabel ?? t('进入训练', 'open workout')}</button>}</section>
    <div className="guided-progress-overview">
      <div className="guided-completion-ring" role="img" aria-label={percent === null ? t('暂无计划进度', 'no plan progress yet') : `${t('训练完成', 'workouts completed')} ${percent}%`}>
        <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" className="guided-ring-track" /><circle cx="60" cy="60" r="50" className="guided-ring-fill" pathLength="100" strokeDasharray={`${percent ?? 0} 100`} /></svg>
        <div><span>{percent === null ? '—' : `${percent}%`}</span><small>{t('训练完成', 'completed')}</small></div>
      </div>
    <div className="guided-progress-pair">
      <div><h3>{t('时间进度', 'time progress')}</h3><p>{elapsedDays} / {totalDays} {t('天', 'days')}</p><progress aria-label={t('时间进度', 'time progress')} value={Math.min(totalDays, Math.max(0, elapsedDays))} max={Math.max(1, totalDays)} /></div>
      <div><h3>{t('训练完成进度', 'completed workouts')}</h3><p>{completedWorkouts} / {plannedWorkouts} {t('次', 'workouts')}</p><progress aria-label={t('训练完成进度', 'completed workouts')} value={Math.min(plannedWorkouts, Math.max(0, completedWorkouts))} max={Math.max(1, plannedWorkouts)} /></div>
    </div>
    </div>
    {(rationale || uncertainties.length > 0) && <section className="guided-section"><h3>{t('为什么这样安排', 'why this schedule')}</h3>{rationale && <p>{rationale}</p>}{uncertainties.map((item, index) => <p key={index}>{item}</p>)}</section>}
    {exercises.length > 0 && <section className="guided-section"><h3>{t('动作与目标', 'exercises and targets')}</h3>{exercises.map(exercise => <article className="guided-exercise" key={exercise.id}>
      <h4>{exercise.name}</h4><ul>{exercise.targets.map((target, index) => <li key={index}>{target}</li>)}</ul><p>{t('安全提醒：', 'safety: ')}{exercise.safety}</p>
      <details><summary>{t('步骤、常见错误与安排理由', 'steps, common mistakes and rationale')}</summary>
        {exercise.steps && <ol>{exercise.steps.map((text, index) => <li key={index}>{text}</li>)}</ol>}
        {exercise.commonMistakes && <><h4>{t('常见错误', 'common mistakes')}</h4><ul>{exercise.commonMistakes.map((text, index) => <li key={index}>{text}</li>)}</ul></>}
        {exercise.reason && <p>{exercise.reason}</p>}
      </details>
    </article>)}</section>}
    <div className="guided-actions">{status === 'active' && onPause && <button type="button" disabled={busy} onClick={onPause}>{t('暂停计划', 'pause plan')}</button>}{status === 'paused' && onResume && <button type="button" disabled={busy} onClick={onResume}>{t('恢复原计划', 'resume plan')}</button>}{(status === 'active' || status === 'paused') && onCancel && <button type="button" disabled={busy} onClick={onCancel}>{t('取消计划', 'cancel plan')}</button>}{onDialogue && <button type="button" disabled={busy} onClick={onDialogue}>{t('聊一聊计划', 'discuss your plan')}</button>}</div>
    {measurements.length > 0 && <section className="guided-section"><h3>{t('身体记录', 'body measurements')}</h3><p>{t('仅作参考；缺测不记为零。', 'for reference; missing measurements are not zero.')}</p><dl className="guided-measurements">{measurements.map((measurement, index) => <div key={index}><dt>{measurement.label}</dt><dd>{measurement.value ?? t('未测量', 'not measured')}{measurement.source && <span>{measurement.source}</span>}</dd></div>)}</dl></section>}
  </section>;
}
