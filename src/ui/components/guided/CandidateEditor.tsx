import type { ProgramCandidate } from '../../../domain/guided-contracts';
import { exercises } from '../../../catalog/exercises';
import { formatGuidedTargets } from './ProgramDashboard';

export function CandidateEditor({ candidate, locale, disabled, onChange }: {
  candidate: ProgramCandidate; locale: 'zh' | 'en'; disabled: boolean; onChange: (value: ProgramCandidate) => void;
}) {
  const zh = locale === 'zh';
  function dayChange(index: number, patch: Partial<ProgramCandidate['days'][number]>) {
    onChange({ ...candidate, days: candidate.days.map((day, i) => i === index ? { ...day, ...patch } : day) });
  }
  return <fieldset className="v31-candidate-editor" disabled={disabled}>
    <label>{zh ? '计划名称' : 'Plan name'}<input value={candidate.name} onChange={event => onChange({...candidate, name: event.target.value})} /></label>
    <p>{candidate.goal}</p><p>{candidate.explanation}</p>
    {candidate.days.map((day, dayIndex) => <article className="v31-candidate-day" key={day.date}>
      <h3>{day.date}</h3><div className="v31-ai-fields"><label>{zh ? '开始时间' : 'Start time'}<input type="time" value={day.startTime ?? ''} onChange={event => dayChange(dayIndex, { startTime: event.target.value, durationMinutes: day.durationMinutes ?? 30 })} /></label><label>{zh ? '训练分钟数' : 'Minutes'}<input type="number" min="1" max="240" value={day.durationMinutes ?? 30} onChange={event => dayChange(dayIndex, { startTime: day.startTime ?? '19:00', durationMinutes: Number(event.target.value) })} /></label></div>
      {day.exercises.map((item, exerciseIndex) => {
        const exercise = exercises.find(value => value.id === item.exerciseId);
        function update(patch: Partial<typeof item>) { dayChange(dayIndex, {exercises: day.exercises.map((value, index) => index === exerciseIndex ? {...value, ...patch} : value)}); }
        return <section key={item.order} className="v31-candidate-exercise"><h4>{exerciseIndex + 1}. {exercise?.name[locale]}</h4>
          <ol>{formatGuidedTargets(item.targetSets, locale, item.setTimings).map((target, index) => <li key={index}>{target}</li>)}</ol>
          <details><summary>{zh ? '编辑本日动作目标' : 'Edit this day’s exercise targets'}</summary>
            {item.targetSets.map((target, setIndex) => <fieldset key={setIndex}><legend>{zh ? `第 ${setIndex + 1} 组` : `Set ${setIndex + 1}`}</legend><div className="v31-ai-fields">
              {Object.entries(target).filter(([key]) => key !== 'metricType').map(([key, value]) => <label key={key}>{({reps: zh ? '次数' : 'Repetitions', loadGrams: zh ? '负重（克）' : 'Load (g)', durationSeconds: zh ? '时长（秒）' : 'Duration (s)', distanceMeters: zh ? '距离（米）' : 'Distance (m)'} as Record<string,string>)[key] ?? key}<input type="number" min={key === 'loadGrams' ? 0 : 1} value={Number(value)} onChange={event => {
                const next = Number(event.target.value);
                update({targetSets: item.targetSets.map((set, index) => index === setIndex ? {...set, [key]: next} : set),
                  ...(key === 'durationSeconds' && item.setTimings ? {setTimings: item.setTimings.map((timing, index) => index === setIndex ? {...timing, durationSeconds: next} : timing)} : {})});
              }} /></label>)}
              {item.setTimings && <><label>{zh ? '预计动作时间（秒）' : 'Estimated active time (s)'}<input type="number" min="1" value={item.setTimings[setIndex].durationSeconds} disabled={'durationSeconds' in target} onChange={event => update({setTimings: item.setTimings!.map((timing, index) => index === setIndex ? {...timing, durationSeconds: Number(event.target.value)} : timing)})} /></label><label>{zh ? '组后休息（秒）' : 'Rest after set (s)'}<input type="number" min="0" value={item.setTimings[setIndex].restSeconds} onChange={event => update({setTimings: item.setTimings!.map((timing, index) => index === setIndex ? {...timing, restSeconds: Number(event.target.value)} : timing)})} /></label></>}
            </div></fieldset>)}
          </details>
          <label>{zh ? '动作备注' : 'Exercise notes'}<textarea value={item.notes ?? ''} onChange={event => update({notes: event.target.value})} /></label>
          {exercise && <details><summary>{zh ? '动作步骤与注意事项' : 'Movement steps and cautions'}</summary><ol>{exercise.steps[locale].map((text, index) => <li key={index}>{text}</li>)}</ol><p>{exercise.cautions[locale].join(' ')}</p></details>}
        </section>;
      })}
    </article>)}
  </fieldset>;
}
