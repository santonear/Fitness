import { getExerciseMedia } from '../../catalog/media';
import { useEffect, useState } from 'react';
import { loadExerciseDetails, catalogMetadata } from '../../catalog/registry';
import type { Exercise, Locale } from '../../domain/models';
import { ExerciseMedia } from './ExerciseMedia';

export function ExerciseDetails({ exercise, locale }: { exercise: Exercise; locale: Locale }) {
  const [details, setDetails] = useState<Awaited<ReturnType<typeof loadExerciseDetails>>>();
  const [failed, setFailed] = useState(false);
  const external = catalogMetadata.has(exercise.id) && !getExerciseMedia(exercise.id);
  useEffect(() => { let active = true; setDetails(undefined); setFailed(false);
    if (external) void loadExerciseDetails(exercise.id).then(value => { if (active) setDetails(value); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [exercise.id, external]);
  const tr = (zh: string, en: string) => locale === 'zh' ? zh : en;
  return <>
    {external && <p>{tr('以下详细说明与注意事项为 RepDB 英文原文。', 'Instructions and tips below are the original RepDB English text.')}</p>}
    {external && !details && <p role="status">{failed ? tr('说明加载失败，请重新打开详情。', 'Instructions could not load. Reopen the details.') : tr('正在加载说明…', 'Loading instructions…')}</p>}
    <h3>{tr('动作步骤', 'Steps')}</h3><ol lang={external ? 'en' : locale}>{(details?.steps ?? exercise.steps[locale]).map((step, index) => <li key={index}>{step}</li>)}</ol>
    <h3>{tr('注意事项', 'Cautions')}</h3><div lang={external ? 'en' : locale}>{(details?.cautions ?? exercise.cautions[locale]).map((tip, index) => <p key={index}>{tip}</p>)}</div>
    <ExerciseMedia exerciseId={exercise.id} exerciseName={exercise.name[locale]} locale={locale} />
  </>;
}
