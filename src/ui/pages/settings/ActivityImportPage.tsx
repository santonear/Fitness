import { useState } from 'react';
import { createActivityImportService, parseGpxActivities, type ImportedActivityCandidate } from '../../../application/activity-import';
import type { ActivityRecord } from '../../../domain/v8/contracts';
import { repository } from '../../../persistence/repository';
import { lifestyleCopy } from '../../../i18n/features/settings/lifestyle';
import { Button } from '../../components/common';
import { useMainline } from '../../mainline/context';
import { useFeature } from '../../useFeature';
export function ActivityImportPage() {
  const c = useMainline(), t = lifestyleCopy[c.locale], enabled = useFeature('activityImport');
  const [rows, setRows] = useState<ImportedActivityCandidate[]>([]), [type, setType] = useState<ActivityRecord['type']>('other'), [message, setMessage] = useState('');
  const [stamp,setStamp] = useState({ revision: c.data!.metadata.dataRevision, generation: c.data!.metadata.restoreGeneration ?? 0 });
  return <main><Button onClick={() => c.navigate('/settings')}>{t.back}</Button><h1>{t.importActivity}</h1><p>{t.gpxHint}</p>
    {!enabled ? <p>{t.unavailable}</p> : <><label>{t.file}<input type="file" accept=".gpx,application/gpx+xml" onChange={async e => {
      const file = e.target.files?.[0]; setRows([]); setMessage('');
      if (!file) return;
      try { if (file.size > 5 * 1024 * 1024) throw new Error(); setRows(await parseGpxActivities(await file.text(), c.data!.profile!.timeZone)); } catch { setMessage(t.invalid); }
    }} /></label>
    {rows.length > 0 && <section><h2>{t.preview}</h2><label>{t.type}<select value={type} onChange={e => setType(e.target.value as ActivityRecord['type'])}>{(Object.keys(t.types) as ActivityRecord['type'][]).map(key => <option key={key} value={key}>{t.types[key]}</option>)}</select></label>
      <ul>{rows.map(row => <li key={row.receiptId}>{row.localDate} · {row.minutes} {t.minutes}</li>)}</ul>
      <Button variant="primary" disabled={c.busy} onClick={() => void c.run(async () => {
        const result = await createActivityImportService(repository).save(rows, type, stamp.revision, stamp.generation);
        const meta=await repository.readMetadata();setStamp({revision:meta.dataRevision,generation:meta.restoreGeneration??0});
        setMessage(t.result.replace('{added}', String(result.added)).replace('{skipped}', String(result.skipped))); setRows([]);
      })}>{t.confirm}</Button></section>}</>}
    {message && <p role="status">{message}</p>}
  </main>;
}
