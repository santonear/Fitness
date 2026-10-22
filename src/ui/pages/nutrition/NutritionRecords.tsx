import { useEffect, useState } from 'react';
import { TEXT_LIMITS, cleanText, textIssue } from '../../../domain/input-guard';
import { FieldIssue } from '../../components/common/FieldIssue';
import { createNutritionService } from '../../../application/nutrition';
import { activityDate } from '../../../application/v8-activity';
import type { NutritionRecord } from '../../../domain/lifestyle';
import { repository } from '../../../persistence/repository';
import { lifestyleCopy } from '../../../i18n/features/settings/lifestyle';
import { Button, Chip } from '../../components/common';
import { useMainline } from '../../mainline/context';
import { useFeature } from '../../useFeature';

/** 饮食记录 (local only), shown inside 营养建议. Same form and rules as before the move. */
export function NutritionRecords() {
  const c = useMainline(), t = lifestyleCopy[c.locale], enabled = useFeature('nutrition');
  const zone = c.data!.profile!.timeZone, today = activityDate(zone), earliest = activityDate(zone, -365);
  const [date, setDate] = useState(today), [meal, setMeal] = useState<NutritionRecord['meal']>('breakfast');
  const [portion, setPortion] = useState(''), [calories, setCalories] = useState(''), [records, setRecords] = useState<NutritionRecord[]>([]), [saved, setSaved] = useState(false);
  const [stamp, setStamp] = useState({ revision: c.data!.metadata.dataRevision, generation: c.data!.metadata.restoreGeneration ?? 0 });
  useEffect(() => { void createNutritionService(repository).list().then(setRecords); }, []);
  const portionIssue = textIssue(portion, TEXT_LIMITS.long);
  const validCalories = calories === '' || /^\d+$/.test(calories) && Number(calories) <= 10000;
  return <div className="v9-nutrition-records">
    <p className="v9-nutrition-note">{t.localOnly}</p>
    {!enabled && <p className="v9-nutrition-note">{t.unavailable}</p>}
    {enabled && <div className="v9-nutrition-form"><label>{t.date}<input type="date" value={date} min={earliest} max={today} onChange={e => setDate(e.target.value)} /></label>
      <fieldset><legend>{t.meal}</legend><div className="v8-capsules">{(Object.keys(t.meals) as NutritionRecord['meal'][]).map(key => <Chip key={key} selected={meal === key} onClick={() => setMeal(key)}>{t.meals[key]}</Chip>)}</div></fieldset>
      <label>{t.portion}<textarea maxLength={TEXT_LIMITS.long} value={portion} aria-invalid={portionIssue ? true : undefined} onChange={e => setPortion(e.target.value)} /><FieldIssue issue={portionIssue} locale={c.locale} max={TEXT_LIMITS.long} /></label>
      <label>{t.calories}<input type="number" min={0} max={10000} step={1} value={calories} onChange={e => setCalories(e.target.value)} /></label>
      <Button variant="primary" disabled={c.busy || !validCalories || !date || date > today || date < earliest || !!portionIssue} onClick={() => void c.run(async () => {
        await createNutritionService(repository).save({ id: crypto.randomUUID(), localDate: date, timeZone: zone, meal, ...(cleanText(portion) ? { portion: cleanText(portion) } : {}), ...(calories !== '' ? { calories: Number(calories) } : {}) }, stamp.revision, stamp.generation);
        const meta = await repository.readMetadata(); setStamp({ revision: meta.dataRevision, generation: meta.restoreGeneration ?? 0 }); setRecords(await createNutritionService(repository).list()); setPortion(''); setCalories(''); setSaved(true);
      })}>{t.save}</Button></div>}
    {saved && <p role="status">{t.saved}</p>}
    {!records.length && <p className="v9-nutrition-note">{t.empty}</p>}
    <ul className="v9-nutrition-list">{records.map(row => <li key={row.id}>{row.localDate} · {t.meals[row.meal]}{row.portion ? ` · ${row.portion}` : ''}{row.calories !== undefined ? ` · ${row.calories} kcal` : ''}</li>)}</ul>
  </div>;
}
