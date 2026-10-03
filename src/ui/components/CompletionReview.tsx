import type { SetRecord, WorkoutSession, TrainingMemo, Locale } from '../../domain/models';

export function metricText(set:SetRecord,locale:Locale){
 const parts:string[]=[];
 if(set.reps!==undefined)parts.push(`${set.reps} ${locale==='zh'?'次':'reps'}`);
 if(set.loadGrams!==undefined)parts.push(`${set.loadGrams/1000} kg`);
 if(set.durationSeconds!==undefined)parts.push(`${set.durationSeconds} s`);
 if(set.distanceMeters!==undefined)parts.push(`${set.distanceMeters/1000} km`);
 return parts.join(' · ')|| (locale==='zh'?'尚未记录实际值':'No actual values recorded');
}
export function WorkoutFacts({session,sets,locale}:{session:WorkoutSession;sets:SetRecord[];locale:Locale}){
 const zh=locale==='zh';return <>
  <p>{session.localDate} · {session.timeZone} · {session.startedAt} {session.completedAt&&`→ ${session.completedAt}`}</p>
  <p>{zh?({in_progress:'进行中',completed:'已完成',abandoned:'已放弃'}[session.status]):session.status}</p>
  <p>{session.planVersionId?`${zh?'计划版本':'Plan version'}: ${session.planVersionId} · ${session.plannedDayId}`:zh?'临时训练':'Temporary workout'}</p>
  {session.notes&&<p>{session.notes}</p>}
  {session.exerciseSnapshots.map(exercise=><section key={exercise.exerciseInstanceId} className="workout-facts">
   <h3>{exercise.name[locale]}</h3><p>{exercise.notes}</p>
   {exercise.originalExerciseId&&<p>{zh?'原动作':'Original exercise'}: {session.originalExerciseSnapshots.find(e=>e.exerciseInstanceId===exercise.exerciseInstanceId)?.name[locale]??exercise.originalExerciseId}</p>}
   <ol>{sets.filter(s=>s.exerciseInstanceId===exercise.exerciseInstanceId).map(set=><li key={set.id}>{metricText(set,locale)} · {set.completed?(zh?'已记录':'Recorded'):(zh?'未完成':'Incomplete')} {set.notes&&<span> · {set.notes}</span>}</li>)}</ol>
  </section>)}
 </>;
}
export function CompletionReview({session,sets,locale,busy,onBack,onConfirm}:{session:WorkoutSession;sets:SetRecord[];locale:Locale;busy:boolean;onBack:()=>void;onConfirm:()=>void}){
 const zh=locale==='zh';return <section aria-label={zh?'完成前核对':'Completion review'}><h2>{zh?'核对实际记录':'Review actual records'}</h2><WorkoutFacts session={session} sets={sets} locale={locale}/><p>{zh?'完成后记录只读，不能修改或删除。':'Completed records are read only and cannot be edited or deleted.'}</p><button disabled={busy} onClick={onBack}>{zh?'返回编辑':'Return to editing'}</button><button disabled={busy} onClick={onConfirm}>{zh?'确认完成':'Confirm completion'}</button></section>;
}
export function TrainingMemoView({memo,locale}:{memo:TrainingMemo;locale:Locale}){
 const zh=locale==='zh';return <section aria-label={zh?'全量训练备忘':'Full training memo'}><h2>{zh?'全量训练备忘':'Full training memo'}</h2><p>{zh?'本地事实，无 AI 摘要。':'Local facts, without AI summaries.'} · {memo.sessions.length} {zh?'次训练':'sessions'} · {memo.updatedAt}</p>
 {memo.sessions.map(entry=><article key={entry.session.id}><WorkoutFacts session={entry.session} sets={entry.sets} locale={locale}/><details><summary>{zh?'原始快照与完整字段':'Original snapshots and complete fields'}</summary><pre>{JSON.stringify(entry,null,2)}</pre></details></article>)}
 </section>;
}
