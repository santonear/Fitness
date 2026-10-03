import { useRef, useState, type FormEvent } from 'react';
import { exercises } from '../../catalog/exercises';
import { parseMetric } from '../../domain/units';
import type { Adjustment, ExerciseSnapshot, Locale, SetInput, SetRecord } from '../../domain/models';
import { metricText } from './CompletionReview';
import { WorkoutTimer } from './WorkoutTimer';

interface Props {
  sessionId: string;
  exercise: ExerciseSnapshot;
  sets: SetRecord[];
  locale: Locale;
  busy: boolean;
  onSave: (input: SetInput) => Promise<void>;
  onAdjust: (command: Adjustment, message?: string) => Promise<void>;
}

export function ExerciseEditor({ sessionId, exercise, sets, locale, busy, onSave, onAdjust }: Props) {
  const zh = locale === 'zh';
  const nextOrder = sets.reduce((max, set) => Math.max(max, set.order + 1), 0);

  function replace(exerciseId: string) {
    const replacement = exercises.find(entry => entry.id === exerciseId)!;
    const incompatible = replacement.metricType !== exercise.metricType && sets.length > 0;
    if (incompatible && !window.confirm(zh
      ? '替换会清除不兼容的已保存组，确认？'
      : 'Replace and clear incompatible saved sets?')) return;
    void onAdjust({ type: 'replace_exercise', exerciseInstanceId: exercise.exerciseInstanceId, exerciseId, confirmClearMetrics: incompatible });
  }

  function removeExercise() {
    if (sets.length && !window.confirm(zh
      ? '删除此动作及全部已保存组？'
      : 'Remove this exercise and all saved sets?')) return;
    void onAdjust({ type: 'remove_exercise', exerciseInstanceId: exercise.exerciseInstanceId, confirmDeleteRecords: sets.length > 0 }, zh ? '动作已删除' : 'Exercise removed');
  }

  function removeSet(setId: string) {
    if (!window.confirm(zh ? '删除此已保存组？' : 'Remove this saved set?')) return;
    void onAdjust({ type: 'remove_set', setId, confirmDeleteRecords: true }, zh ? '已保存组已删除' : 'Saved set removed');
  }

  return (
    <section className="workout-exercise">
      <h2>{exercise.name[locale]}</h2>
      {exercise.targetSets.length > 0 && (
        <details>
          <summary>{zh ? '计划目标（非实际值）' : 'Planned targets (not actual values)'}</summary>
          <pre>{JSON.stringify(exercise.targetSets, null, 2)}</pre>
        </details>
      )}
      {sets.map(set => (
        <div key={`${set.id}-${set.revision}`}>
          <SetForm exercise={exercise} locale={locale} busy={busy} saved={set} onSave={onSave} />
          <button disabled={busy} onClick={() => removeSet(set.id)}>{zh ? '删除已保存组' : 'Remove saved set'}</button>
        </div>
      ))}
      <SetForm key={`${sessionId}-${exercise.exerciseInstanceId}-${exercise.exerciseId}-${sets.map(set => set.id).sort().join(',')}`} sessionId={sessionId} exercise={exercise} locale={locale} busy={busy} order={nextOrder} onSave={onSave} />
      <label>
        {zh ? '替换动作' : 'Replace exercise'}
        <select value={exercise.exerciseId} disabled={busy} onChange={event => replace(event.target.value)}>
          {exercises.map(entry => <option key={entry.id} value={entry.id}>{entry.name[locale]}</option>)}
        </select>
      </label>
      <button disabled={busy} onClick={removeExercise}>{zh ? '删除动作' : 'Remove exercise'}</button>
    </section>
  );
}

interface SetFormProps {
  sessionId?: string;
  exercise: ExerciseSnapshot;
  locale: Locale;
  busy: boolean;
  saved?: SetRecord;
  order?: number;
  onSave: (input: SetInput) => Promise<void>;
}

function SetForm({ sessionId, exercise, locale, busy, saved, order = 0, onSave }: SetFormProps) {
  const zh = locale === 'zh';
  const [reps, setReps] = useState(saved?.reps?.toString() ?? '');
  const [load, setLoad] = useState(saved?.loadGrams === undefined ? '' : String(saved.loadGrams / 1000));
  const [seconds, setSeconds] = useState(saved?.durationSeconds?.toString() ?? '');
  const [km, setKm] = useState(saved?.distanceMeters === undefined ? '' : String(saved.distanceMeters / 1000));
  const [notes, setNotes] = useState(saved?.notes ?? '');
  const [error, setError] = useState('');
  const id = useRef(saved?.id ?? crypto.randomUUID());

  function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const metrics = parseActualMetrics(exercise, { reps, load, seconds, km });
      void onSave({ id: id.current, exerciseInstanceId: exercise.exerciseInstanceId, order: saved?.order ?? order, ...metrics, completed: true, notes });
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  return (
    <form onSubmit={submit}>
      <fieldset disabled={busy}>
        <legend>{saved ? (zh ? '已保存组' : 'Saved set') : (zh ? '下一组' : 'Next set')}</legend>
        {sessionId && !saved && <WorkoutTimer sessionId={sessionId} exerciseInstanceId={exercise.exerciseInstanceId} locale={locale} busy={busy}
          onCandidate={['duration', 'duration_distance'].includes(exercise.metricType) ? setSeconds : undefined} />}
        {saved && <p>{metricText(saved, locale)} {saved.notes}</p>}
        {['reps', 'reps_load'].includes(exercise.metricType) && (
          <label>{zh ? '次数' : 'Reps'}<input inputMode="numeric" value={reps} onChange={event => setReps(event.target.value)} required /></label>
        )}
        {exercise.metricType === 'reps_load' && (
          <label>{zh ? '负重（千克）' : 'Load (kg)'}<input inputMode="decimal" value={load} onChange={event => setLoad(event.target.value)} required /></label>
        )}
        {['duration', 'duration_distance'].includes(exercise.metricType) && (
          <label>{zh ? '时长（秒）' : 'Duration (seconds)'}<input inputMode="numeric" value={seconds} onChange={event => setSeconds(event.target.value)} required /></label>
        )}
        {exercise.metricType === 'duration_distance' && (
          <label>{zh ? '距离（公里，可选）' : 'Distance (km, optional)'}<input inputMode="decimal" value={km} onChange={event => setKm(event.target.value)} /></label>
        )}
        <label>{zh ? '组备注' : 'Set notes'}<input value={notes} onChange={event => setNotes(event.target.value)} /></label>
        <button type="submit">{saved ? (zh ? '更新组' : 'Update set') : (zh ? '记录组' : 'Record set')}</button>
        {error && <p role="alert">{error}</p>}
      </fieldset>
    </form>
  );
}

function parseActualMetrics(exercise: ExerciseSnapshot, fields: { reps: string; load: string; seconds: string; km: string }) {
  switch (exercise.metricType) {
    case 'reps_load': return parseMetric({ metricType: 'reps_load', reps: fields.reps, loadKg: fields.load });
    case 'reps': return parseMetric({ metricType: 'reps', reps: fields.reps });
    case 'duration': return parseMetric({ metricType: 'duration', durationSeconds: fields.seconds });
    case 'duration_distance': return parseMetric({ metricType: 'duration_distance', durationSeconds: fields.seconds, ...(fields.km ? { distanceKm: fields.km } : {}) });
  }
}
