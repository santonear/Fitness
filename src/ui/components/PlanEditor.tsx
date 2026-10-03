import { useEffect, useState, type FormEvent } from 'react';
import { exercises } from '../../catalog/exercises';
import type { Plan, PlanInput, PlanVersion, PlannedExercise, SetMetrics, MetricInput } from '../../domain/models';
import { DomainError } from '../../domain/errors';
import { parseMetric } from '../../domain/units';

type PlanEditorProps = {
  locale: 'zh' | 'en';
  editing?: { plan: Plan; version: PlanVersion };
  busy: boolean;
  onSave: (input: PlanInput, revision?: number) => Promise<void>;
  onRename: (name: string, revision: number) => Promise<void>;
  onCancel: () => void;
};

export function PlanEditor({ locale, editing, busy, onSave, onRename, onCancel }: PlanEditorProps) {
  const zh = locale === 'zh';
  const [name, setName] = useState('');
  const [start, setStart] = useState(new Date().toLocaleDateString('en-CA'));
  const [zone, setZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [weeks, setWeeks] = useState('1');
  const [weekdays, setWeekdays] = useState([3]);
  const [status, setStatus] = useState<'active' | 'draft'>('active');
  const [error, setError] = useState('');
  const defaultExercise: PlannedExercise = {
    exerciseId: 'd16325d9-fc00-4c41-88a1-000000000003',
    order: 0,
    targetSets: [{ metricType: 'reps', reps: 10 }],
  };
  const [items, setItems] = useState<PlannedExercise[]>([defaultExercise]);
  const originalWeekdays = editing?.version.days.filter(day => day.weekIndex === 1).map(day => day.dayOfWeek).sort() ?? [];
  const restricted = Boolean(editing && (
    editing.version.days.some(day => JSON.stringify(day.exercises) !== JSON.stringify(editing.version.days[0].exercises)) ||
    Array.from({ length: editing.version.durationWeeks }, (_, index) => index + 1).some(week =>
      JSON.stringify(editing.version.days.filter(day => day.weekIndex === week).map(day => day.dayOfWeek).sort()) !== JSON.stringify(originalWeekdays))
  ));

  useEffect(() => {
    setError('');
    if (editing) {
      const { plan, version } = editing;
      setName(plan.name);
      setStart(plan.startDate);
      setZone(plan.scheduleTimeZone);
      setWeeks(String(version.durationWeeks));
      setWeekdays(version.days.filter(day => day.weekIndex === 1).map(day => day.dayOfWeek));
      setItems(structuredClone(version.days[0].exercises));
      setStatus(plan.status === 'draft' ? 'draft' : 'active');
    }
  }, [editing]);

  function update(index: number, item: PlannedExercise) {
    setItems(items.map((old, i) => i === index ? item : old));
  }

  function defaultSet(id: string): SetMetrics {
    const exercise = exercises.find(entry => entry.id === id)!;
    return exercise.metricType === 'reps_load' ? { metricType: 'reps_load', reps: 10, loadGrams: 0 }
      : exercise.metricType === 'reps' ? { metricType: 'reps', reps: 10 }
      : exercise.metricType === 'duration' ? { metricType: 'duration', durationSeconds: 30 }
      : { metricType: 'duration_distance', durationSeconds: 600 };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (editing && (restricted || (
      start === editing.plan.startDate && zone === editing.plan.scheduleTimeZone && weeks === String(editing.version.durationWeeks) &&
      JSON.stringify([...weekdays].sort()) === JSON.stringify(originalWeekdays) &&
      JSON.stringify(items) === JSON.stringify(editing.version.days[0].exercises) &&
      status === (editing.plan.status === 'draft' ? 'draft' : 'active')
    ))) {
      await onRename(name, editing.plan.revision);
      return;
    }
    const durationWeeks = Number(weeks);
    if (!Number.isInteger(durationWeeks) || durationWeeks < 1 || durationWeeks > 12 || !weekdays.length) {
      throw new DomainError('INVALID', 'Select 1–12 weeks and at least one weekday');
    }
    const days = Array.from({ length: durationWeeks }, (_, week) => weekdays.map(dayOfWeek => ({
      dayId: crypto.randomUUID(),
      weekIndex: week + 1,
      dayOfWeek,
      exercises: items.map((item, order) => ({ ...item, order })),
    }))).flat();
    await onSave({
      id: editing?.plan.id,
      name,
      source: editing?.plan.source ?? 'manual',
      startDate: start,
      scheduleTimeZone: zone,
      goalSnapshot: editing?.version.goalSnapshot ?? { goal: '' },
      generationMetadata: editing?.version.generationMetadata,
      durationWeeks,
      daysPerWeek: weekdays.length,
      days,
      status,
    }, editing?.plan.revision);
    setError('');
  }

  const weekdayNames = zh
    ? ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <form onSubmit={event => {
      void submit(event).catch(reason => setError(reason.code === 'CONFLICT'
        ? (zh ? '计划已被其他操作更改。你的输入仍保留。请先复制未保存的名称，再刷新页面、重新打开计划后保存。'
          : 'This plan changed elsewhere. Your input is kept. Copy the unsaved name, reload the page, and reopen the plan before saving.')
        : `${reason.code ?? 'INVALID'}: ${reason.message}`));
    }}>
      <fieldset disabled={busy}>
        <legend>{zh ? '手动计划' : 'Manual plan'}</legend>
        <p className="muted">
          {restricted
            ? (zh ? '此计划包含不同训练日或周的内容，当前仅支持修改名称。课表、已有日程调整和历史将保留。'
              : 'This plan has different days or weeks. Only its name can be edited here; its contents, schedule adjustments and history are preserved.')
            : (zh ? '无需填写目标、身高或体重。各训练日重复下面的动作和逐组目标。'
              : 'No goal, height, or weight required. Each selected day repeats these exercises and per-set targets.')}
        </p>
        <label>
          {zh ? '计划名称' : 'Plan name'}
          <input required value={name} onChange={event => setName(event.target.value)} />
        </label>
        <fieldset disabled={restricted}>
        <label>
          {zh ? '开始日期' : 'Start date'}
          <input required type="date" value={start} onChange={event => setStart(event.target.value)} />
        </label>
        <label>
          {zh ? '日程时区' : 'Schedule time zone'}
          <input required value={zone} onChange={event => setZone(event.target.value)} />
        </label>
        <label>
          {zh ? '周期周数' : 'Cycle weeks'}
          <input required type="number" min="1" max="12" step="1" value={weeks}
            onChange={event => setWeeks(event.target.value)} />
        </label>
        <fieldset>
          <legend>{zh ? '训练星期' : 'Training weekdays'}</legend>
          {weekdayNames.map((day, index) => (
            <label key={day}>
              <input type="checkbox" checked={weekdays.includes(index + 1)} onChange={event => {
                setWeekdays(event.target.checked
                  ? [...weekdays, index + 1].sort()
                  : weekdays.filter(value => value !== index + 1));
              }} />
              {day}
            </label>
          ))}
        </fieldset>
        <label>
          {zh ? '保存为' : 'Save as'}
          <select value={status} onChange={event => setStatus(event.target.value as 'active' | 'draft')}>
            <option value="active">{zh ? '当前计划' : 'Active'}</option>
            <option value="draft">{zh ? '草稿' : 'Draft'}</option>
          </select>
        </label>
        {items.map((item, index) => (
          <fieldset key={index}>
            <legend>{zh ? '动作' : 'Exercise'} {index + 1}</legend>
            <label>
              {zh ? '选择动作' : 'Choose exercise'}
              <select value={item.exerciseId} onChange={event => update(index, {
                ...item,
                exerciseId: event.target.value as PlannedExercise['exerciseId'],
                targetSets: [defaultSet(event.target.value)],
              })}>
                {exercises.map(exercise => (
                  <option key={exercise.id} value={exercise.id}>{exercise.name[locale]}</option>
                ))}
              </select>
            </label>
            {item.targetSets.map((target, setIndex) => (
              <fieldset key={`${setIndex}-${target.metricType}`}>
                <legend>{zh ? '组' : 'Set'} {setIndex + 1}</legend>
                <TargetFields target={target} zh={zh} onChange={next => update(index, {
                  ...item,
                  targetSets: item.targetSets.map((set, i) => i === setIndex ? next : set),
                })} />
                <button type="button" disabled={item.targetSets.length === 1} onClick={() => update(index, {
                  ...item,
                  targetSets: item.targetSets.filter((_, i) => i !== setIndex),
                })}>
                  {zh ? '删除组' : 'Remove set'}
                </button>
              </fieldset>
            ))}
            <button type="button" onClick={() => update(index, {
              ...item,
              targetSets: [...item.targetSets, structuredClone(item.targetSets.at(-1)!)],
            })}>
              {zh ? '添加组' : 'Add set'}
            </button>
            <label>
              {zh ? '备注' : 'Notes'}
              <input value={item.notes ?? ''} onChange={event => update(index, { ...item, notes: event.target.value })} />
            </label>
            <button type="button" disabled={index === 0} onClick={() => {
              const next = [...items];
              [next[index - 1], next[index]] = [next[index], next[index - 1]];
              setItems(next);
            }}>
              {zh ? '上移' : 'Move up'}
            </button>
            <button type="button" disabled={items.length === 1}
              onClick={() => setItems(items.filter((_, i) => i !== index))}>
              {zh ? '删除动作' : 'Remove exercise'}
            </button>
          </fieldset>
        ))}
        <button type="button" onClick={() => setItems([...items, structuredClone(defaultExercise)])}>
          {zh ? '添加动作' : 'Add exercise'}
        </button>
        </fieldset>
        <button type="submit">{zh ? '保存计划' : 'Save plan'}</button>
        {editing && <button type="button" onClick={onCancel}>{zh ? '取消编辑' : 'Cancel edit'}</button>}
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

function displayInput(target: SetMetrics): Record<string, string> {
  switch (target.metricType) {
    case 'reps': return { reps: String(target.reps) };
    case 'reps_load': return { reps: String(target.reps), loadKg: String(target.loadGrams / 1000) };
    case 'duration': return { durationSeconds: String(target.durationSeconds) };
    case 'duration_distance': return {
      durationSeconds: String(target.durationSeconds),
      distanceKm: target.distanceMeters === undefined ? '' : String(target.distanceMeters / 1000),
    };
  }
}

function TargetFields({ target, zh, onChange }: {
  target: SetMetrics;
  zh: boolean;
  onChange: (target: SetMetrics) => void;
}) {
  const [fields, setFields] = useState(() => displayInput(target));
  useEffect(() => { setFields(displayInput(target)); }, [target]);
  const labels: Record<string, string> = {
    reps: zh ? '次数' : 'Reps',
    loadKg: zh ? '负重（千克）' : 'Load (kg)',
    durationSeconds: zh ? '时长（秒）' : 'Duration (seconds)',
    distanceKm: zh ? '距离（千米，可选）' : 'Distance (km, optional)',
  };

  return (
    <>
      {Object.keys(fields).map(key => (
        <label key={key}>
          {labels[key]}
          <input type="number" required={key !== 'distanceKm'}
            min={key === 'loadKg' || key === 'distanceKm' ? 0 : 1}
            step={key === 'loadKg' || key === 'distanceKm' ? '0.001' : '1'}
            value={fields[key]} onChange={event => {
              const value = event.target.value;
              setFields({ ...fields, [key]: value });
              const next = { ...displayInput(target), [key]: value };
              if (target.metricType === 'duration_distance' && next.distanceKm === '') delete next.distanceKm;
              try {
                const parsed = parseMetric({ metricType: target.metricType, ...next } as MetricInput);
                event.target.setCustomValidity('');
                onChange(parsed);
              } catch (reason) {
                event.target.setCustomValidity((reason as Error).message);
              }
            }} />
        </label>
      ))}
    </>
  );
}
