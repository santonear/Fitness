import type { ExerciseSnapshot, Locale, SetMetrics } from '../../domain/models';
import { exercises } from '../../catalog/exercises';

export function targetText(target: SetMetrics, locale: Locale) {
  switch (target.metricType) {
    case 'reps_load': return `${target.reps} ${locale === 'zh' ? '次' : 'reps'} · ${target.loadGrams / 1000} kg`;
    case 'reps': return `${target.reps} ${locale === 'zh' ? '次' : 'reps'}`;
    case 'duration': return `${target.durationSeconds} s`;
    case 'duration_distance': return `${target.durationSeconds} s · ${target.distanceMeters === undefined ? (locale === 'zh' ? '距离未设置' : 'Distance not set') : `${target.distanceMeters / 1000} km`}`;
  }
}

export function ExerciseTargets({ exercise, original, locale }: { exercise: ExerciseSnapshot; original?: ExerciseSnapshot; locale: Locale }) {
  const zh = locale === 'zh';
  const replaced = exercise.originalExerciseId !== undefined;
  const source = original?.exerciseInstanceId === exercise.exerciseInstanceId ? original : undefined;
  const guidance = exercises.find(item => item.id === exercise.exerciseId);
  const textStyle = { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } as const;
  return <div className="exercise-targets">
    <p>{zh ? '来源：本次训练已保存快照' : 'Source: Saved snapshot for this workout'}</p>
    {replaced && <p style={textStyle}>{zh ? '原动作' : 'Original exercise'}: {source?.name[locale] ?? exercise.originalExerciseId}. {zh ? '原动作参考目标，未针对替换动作重新生成' : 'Original exercise reference targets, not regenerated for the replacement'}</p>}
    {exercise.targetSets.length > 0 ? <section aria-label={zh ? '计划目标（非实际记录）' : 'planned targets (not recorded values)'}>
      <p>{zh ? '计划目标（非实际记录）' : 'planned targets (not recorded values)'} · {exercise.targetSets.length} {zh ? '组' : 'sets'}</p>
      <ol className="planned-targets">{exercise.targetSets.map((target, index) => <li key={index}>{targetText(target, locale)}</li>)}</ol>
    </section> : <p>{zh ? '本次动作未设置目标' : 'No targets set for this exercise'}</p>}
    {guidance && <section aria-label={zh ? '动作指导' : 'exercise guidance'}>
      <p>{guidance.cautions[locale].join(' ')}</p>
      <details><summary>{zh ? '动作步骤与安全参考' : 'movement steps and safety reference'}</summary>
        <p>{zh ? '来自当前动作目录，供参考；不是已记录的训练事实。' : 'From the current exercise catalog; guidance, not recorded training facts.'}</p>
        <ol>{guidance.steps[locale].map((step, index) => <li key={index}>{step}</li>)}</ol>
      </details>
    </section>}
    {exercise.notes !== undefined && <details>
      <summary>{zh ? '计划备注' : 'Plan notes'}</summary><p style={textStyle}>{exercise.notes}</p>
    </details>}
    {replaced && source?.notes !== undefined && <details>
      <summary>{zh ? '原动作计划备注（仅参考）' : 'Original exercise plan notes (reference only)'}</summary><p style={textStyle}>{source.notes}</p>
    </details>}
  </div>;
}
