import { useEffect, useState } from 'react';
import { createNutritionService } from '../../../application/nutrition';
import { activityDate } from '../../../application/v8-activity';
import type { NutritionRecord } from '../../../domain/lifestyle';
import { repository } from '../../../persistence/repository';
import { lifestyleCopy } from '../../../i18n/features/settings/lifestyle';
import { Button, Chip } from '../../components/common';
import { useMainline } from '../../mainline/context';
import { useFeature } from '../../useFeature';
export function NutritionPage() {
  const c = useMainline(), t = lifestyleCopy[c.locale], enabled = useFeature('nutrition');
  const zone = c.data!.profile!.timeZone, today = activityDate(zone);
  const [date, setDate] = useState(today), [meal, setMeal] = useState<NutritionRecord['meal']>('breakfast');
  const [portion, setPortion] = useState(''), [calories, setCalories] = useState(''), [records, setRecords] = useState<NutritionRecord[]>([]), [saved, setSaved] = useState(false);
  const [stamp, setStamp] = useState({ revision: c.data!.metadata.dataRevision, generation: c.data!.metadata.restoreGeneration ?? 0 });
  useEffect(() => { void createNutritionService(repository).list().then(setRecords); }, []);
  const validCalories = calories === '' || /^\d+$/.test(calories) && Number(calories) <= 10000;
  return <main><Button onClick={() => c.navigate('/settings')}>{t.back}</Button><h1>{t.nutrition}</h1><p>{t.localOnly}</p>
    {!enabled && <p>{t.unavailable}</p>}
    {enabled && <><label>{t.date}<input type="date" value={date} max={today} onChange={e => setDate(e.target.value)} /></label>
      <fieldset><legend>{t.meal}</legend><div className="v8-capsules">{(Object.keys(t.meals) as NutritionRecord['meal'][]).map(key => <Chip key={key} selected={meal === key} onClick={() => setMeal(key)}>{t.meals[key]}</Chip>)}</div></fieldset>
      <label>{t.portion}<textarea maxLength={500} value={portion} onChange={e => setPortion(e.target.value)} /></label>
      <label>{t.calories}<input type="number" min={0} max={10000} step={1} value={calories} onChange={e => setCalories(e.target.value)} /></label>
      <Button variant="primary" disabled={c.busy || !validCalories || !date || date > today} onClick={() => void c.run(async () => {
        await createNutritionService(repository).save({ id: crypto.randomUUID(), localDate: date, timeZone: zone, meal, ...(portion.trim() ? { portion: portion.trim() } : {}), ...(calories !== '' ? { calories: Number(calories) } : {}) }, stamp.revision, stamp.generation);
        const meta = await repository.readMetadata(); setStamp({ revision: meta.dataRevision, generation: meta.restoreGeneration ?? 0 }); setRecords(await createNutritionService(repository).list()); setPortion(''); setCalories(''); setSaved(true);
      })}>{t.save}</Button></>}
    {saved && <p role="status">{t.saved}</p>}
    {!records.length && <p>{t.empty}</p>}
    <ul>{records.map(row => <li key={row.id}>{row.localDate} · {t.meals[row.meal]}{row.portion ? ` · ${row.portion}` : ''}{row.calories !== undefined ? ` · ${row.calories} kcal` : ''}</li>)}</ul>
  </main>;
}
