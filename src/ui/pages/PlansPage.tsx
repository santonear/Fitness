import { withLegacyConfirmation } from '../legacy-confirmation';
import { DayPlansPanel } from '../components/DayPlansPanel';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { planService } from '../../application/plans';
import { profileService } from '../../application/profile';
import { database } from '../../persistence/db';
import type { Plan, PlanVersion, ScheduledWorkout } from '../../domain/models';
import { exercises } from '../../catalog/exercises';
import { targetText } from '../components/ExerciseTargets';

export function PlansPage() {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === 'zh' ? 'zh' : 'en';
  const zh = locale === 'zh';
  const [plans, setPlans] = useState<Plan[]>([]);
  const [schedule, setSchedule] = useState<ScheduledWorkout[]>([]);
  const [retainedPlans, setRetainedPlans] = useState<string[]>([]);
  const [viewing, setViewing] = useState<{ plan: Plan; version: PlanVersion }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function refresh() {
    const rows = (await database.plans.toArray()).filter(plan => !plan.deletedAt && !plan.model);
    setPlans(rows);
    const guided = await database.guidedStates.get('guided');
    setRetainedPlans(guided?.programs.flatMap(program => program.planIds) ?? []);
    const active = rows.find(plan => plan.status === 'active');
    setSchedule(active
      ? (await database.scheduledWorkouts.where('planVersionId').equals(active.currentVersionId).sortBy('scheduledDate')).filter(row => !row.hiddenAt)
      : []);
  }

  useEffect(() => {
    void profileService.initialize(locale).then(refresh).catch(reason => setError(reason.message));
  }, []);

  async function run(operation: () => Promise<unknown>, successMessage = zh ? '计划已保存' : 'Plan saved', showError = true) {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await operation();
      await refresh();
      setMessage(successMessage);
    } catch (reason) {
      // Editor saves display their own inline error; other page actions keep this alert.
      if (showError) setError(`${(reason as { code?: string }).code ?? 'INVALID'}: ${(reason as Error).message}`);
      throw reason;
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>{zh ? '训练计划' : 'Plans'}</h1>
      <p><Link to="/ai">{zh ? 'AI 计划助手' : 'AI plan assistant'}</Link></p>
      <DayPlansPanel locale={locale} readOnly />
      <h2>{zh ? '旧周计划' : 'Legacy weekly plans'}</h2>
      <p>{zh ? '计划创建和内容修改已改为对话；旧数据不会自动转换。' : 'Create and revise plans through dialogue; old data is not converted automatically.'}</p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <h2>{zh ? '已保存计划' : 'Saved plans'}</h2>
      <ul aria-label={zh ? '已保存计划' : 'Saved plans'}>
        {plans.map(plan => (
          <li key={plan.id}>
            {plan.name} · {zh ? ({ active: '当前', draft: '草稿', archived: '已归档' }[plan.status]) : plan.status}
            <button disabled={busy} onClick={() => {
              void database.planVersions.get(plan.currentVersionId).then(version => {
                if (version) setViewing({ plan, version });
              });
            }}>
              {zh ? '查看课表' : 'view schedule'}
            </button>
            {plan.status === 'draft' && (
              <button disabled={busy} onClick={() => {
                void run(() => withLegacyConfirmation({type:'activate',id:plan.id},zh,confirmation=>planService.activateDraftPlan(plan.id, plan.revision,confirmation))).catch(() => {});
              }}>
                {zh ? '启用草稿' : 'Activate draft'}
              </button>
            )}
            {!retainedPlans.includes(plan.id) && <button disabled={busy} onClick={() => {
              const confirmed = window.confirm(zh
                ? `删除计划“${plan.name}”？未使用的计划会彻底删除；已有训练记录仍保留。`
                : `Delete plan “${plan.name}”? Unused plans will be permanently removed. Existing training records will be preserved.`);
              if (!confirmed) return;
              void run(async () => {
                await planService.deletePlan(plan.id, plan.revision);
                if (viewing?.plan.id === plan.id) setViewing(undefined);
              }, zh ? '计划已删除，已有训练记录仍保留' : 'Plan deleted. Existing training records are preserved.').catch(() => {});
            }}>
              {zh ? '删除' : 'Delete'}
            </button>}
          </li>
        ))}
      </ul>
      {viewing && <section aria-label={zh ? '只读课表' : 'read-only schedule'}>
        <h2>{viewing.plan.name}</h2>
        <p>{zh ? '保留原课表，只读查看。内容调整通过对话提出。' : 'original schedule retained; read only. Discuss changes through dialogue.'}</p>
        {viewing.version.days.map((day, index) => <section key={day.dayId}>
          <h3>{zh ? `第 ${index + 1} 日` : `day ${index + 1}`}</h3>
          <ul>{day.exercises.map(item => <li key={item.exerciseId + item.order}>
            {exercises.find(entry => entry.id === item.exerciseId)?.name[locale] ?? item.exerciseId}
            <ol>{item.targetSets.map((target, position) => <li key={position}>{targetText(target, locale)}</li>)}</ol>{item.notes && <p>{item.notes}</p>}
          </li>)}</ul>
        </section>)}
        <button onClick={() => setViewing(undefined)}>{zh ? '关闭课表' : 'close schedule'}</button>
      </section>}
      <h2>{zh ? '当前计划日程' : 'Current plan schedule'}</h2>
      <p className="muted">
        {zh ? '遗漏的训练不会自动重排。补练或改期请手动操作。'
          : 'Missed training is not automatically moved. Choose make-up training or reschedule explicitly.'}
      </p>
      <ul aria-label={zh ? '日程' : 'Schedule'}>
        {schedule.map(row => <ScheduleRow key={row.id} row={row} zh={zh} busy={busy} run={run} />)}
      </ul>
    </>
  );
}

function ScheduleRow({ row, zh, busy, run }: {
  row: ScheduledWorkout;
  zh: boolean;
  busy: boolean;
  run: (operation: () => Promise<unknown>, successMessage?: string) => Promise<void>;
}) {
  const [date, setDate] = useState(row.scheduledDate);
  return (
    <li>
      {row.originalDate} → {row.scheduledDate} · {row.completedSessionId ? (zh ? '已完成' : 'completed')
        : zh ? (row.status === 'pending' ? '待训练' : '已跳过') : row.status}
      {!row.completedSessionId && (
        <>
          <label>
            {zh ? '新日期' : 'New date'}
            <input type="date" value={date} onChange={event => setDate(event.target.value)} disabled={busy} />
          </label>
          <button disabled={busy} onClick={() => {
            void run(() => withLegacyConfirmation({type:'reschedule',id:row.id,date},zh,confirmation=>planService.rescheduleWorkout(row.id, date, row.revision,confirmation))).catch(() => {});
          }}>
            {zh ? '改期' : 'Reschedule'}
          </button>
          <button disabled={busy || row.status === 'skipped'} onClick={() => {
            void run(() => planService.skipWorkout(row.id, row.revision)).catch(() => {});
          }}>
            {zh ? '跳过' : 'Skip'}
          </button>
          <Link to={`/workout?scheduledWorkoutId=${encodeURIComponent(row.id)}`}>
            {zh ? '开始／补练' : 'Start / make-up'}
          </Link>
        </>
      )}
      <button disabled={busy} onClick={() => {
        if (!window.confirm(zh
          ? '删除此日程？仅从列表隐藏，课表、原计划完成率统计及训练历史仍保留。'
          : 'Delete this schedule? It will be hidden; plan contents, completion statistics and training history are preserved.')) return;
        void run(() => planService.hideScheduledWorkout(row.id, row.revision), zh ? '日程已删除，统计和历史仍保留' : 'Schedule hidden. Statistics and history are preserved.').catch(() => {});
      }}>{zh ? '删除' : 'Delete'}</button>
    </li>
  );
}
