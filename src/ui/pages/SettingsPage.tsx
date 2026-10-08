import { CoachPreferences } from '../components/CoachPreferences';
import { AppIcon, StatusIcon } from '../components/AppIcon';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { profileService } from '../../application/profile';
import { bodyWeightService } from '../../application/body-weight';
import type { BodyWeightObservation, LocalProfile, TrainingPreferences } from '../../domain/models';
import { DomainError } from '../../domain/errors';
import { trainingMemoryService } from '../../application/training-memory';
import type { TrainingMemo } from '../../domain/models';
import { TrainingMemoView } from '../components/CompletionReview';
import { BackupPanel } from '../components/BackupPanel';
import { Link, useSearchParams } from 'react-router-dom';
import { AppearanceCards } from '../components/Appearance';
import { TrialAccess } from '../components/TrialAccess';

const labels = {
  en: { goal: 'Goal', experience: 'Experience', equipment: 'Available equipment (comma separated)', days: 'Days per week', minutes: 'Session minutes', height: 'Height (cm)', weight: 'Profile weight (kg)', constraints: 'Constraints', weekdays: 'Training weekdays (1–7, comma separated)', location: 'Training location', categories: 'Exercise preferences', zone: 'Time zone', save: 'Save profile', clear: 'Clear preferences', date: 'Observation date', observed: 'Observed weight (kg)', saveWeight: 'Save weight', history: 'Weight history', edit: 'Edit', delete: 'Delete', cancel: 'Cancel edit', saved: 'Profile saved', weightSaved: 'Weight saved', deleted: 'Weight deleted', optional: 'All training preferences are optional. You can use manual training without completing them.', local: 'Data stays in this browser. Browser cleanup can remove it; keep manual backups.' },
  zh: { goal: '目标', experience: '训练经验', equipment: '可用器械（逗号分隔）', days: '每周天数', minutes: '每次分钟数', height: '身高（厘米）', weight: '资料体重（千克）', constraints: '限制条件', weekdays: '训练星期（1–7，逗号分隔）', location: '训练地点', categories: '运动偏好', zone: '时区', save: '保存资料', clear: '清除偏好', date: '记录日期', observed: '实测体重（千克）', saveWeight: '保存体重', history: '体重历史', edit: '编辑', delete: '删除', cancel: '取消编辑', saved: '资料已保存', weightSaved: '体重已保存', deleted: '体重已删除', optional: '训练偏好均为可选项。不填也可以手动训练。', local: '数据保存在此浏览器。浏览器清理可能删除数据，请保留手动备份。' },
};
type Fields = Record<'goal' | 'experience' | 'equipment' | 'days' | 'minutes' | 'height' | 'weight' | 'constraints' | 'weekdays', string>;
const blank: Fields = { goal: '', experience: '', equipment: '', days: '', minutes: '', height: '', weight: '', constraints: '', weekdays: '' };
function fieldsFrom(p?: TrainingPreferences): Fields {
  return { goal: p?.goal ?? '', experience: p?.experience ?? '', equipment: p?.availableEquipment?.join(', ') ?? '', days: p?.daysPerWeek?.toString() ?? '', minutes: p?.sessionMinutes?.toString() ?? '', height: p?.heightCm?.toString() ?? '', weight: p?.weightGrams === undefined ? '' : String(p.weightGrams / 1000), constraints: p?.constraints ?? '', weekdays: p?.trainingWeekdays?.join(', ') ?? '' };
}
function kgGrams(value: string): number {
  if (!/^\d+(\.\d{1,3})?$/.test(value.trim())) throw new DomainError('INVALID', 'Enter positive kilograms with at most three decimals');
  return Math.round(Number(value) * 1000);
}
export function SettingsPage({ restored = false }: { restored?: boolean }) {
  const [params, setParams] = useSearchParams();
  const tabs = ['trial','backup','profile','appearance'] as const;
  const tab = tabs.includes(params.get('tab') as typeof tabs[number]) ? params.get('tab')! : 'trial';
  const [memo, setMemo] = useState<TrainingMemo>();
  const { t, i18n } = useTranslation();
  const l = labels[i18n.resolvedLanguage === 'zh' ? 'zh' : 'en'];
  const [profile, setProfile] = useState<LocalProfile>();
  const [fields, setFields] = useState<Fields>(blank);
  const [zone, setZone] = useState('');
  const [location, setLocation] = useState<TrainingPreferences['trainingLocation']>();
  const [categories, setCategories] = useState<NonNullable<TrainingPreferences['exercisePreferences']>>([]);
  const [weights, setWeights] = useState<BodyWeightObservation[]>([]);
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  const [weight, setWeight] = useState('');
  const [editing, setEditing] = useState<BodyWeightObservation>();
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  function applyProfile(p: LocalProfile) { setProfile(p); setFields(fieldsFrom(p.trainingPreferences)); setZone(p.timeZone); setLocation(p.trainingPreferences?.trainingLocation); setCategories(p.trainingPreferences?.exercisePreferences ?? []); }
  useEffect(() => {
    let active = true;
    void profileService.setLocale(i18n.resolvedLanguage === 'zh' ? 'zh' : 'en').then(async p => {
      const rows = await bodyWeightService.listBodyWeights();
      if (active) { applyProfile(p); setWeights(rows); }
    }).catch(e => { if (active) setError(e instanceof DomainError ? `${e.code}: ${e.message}` : String(e)); });
    return () => { active = false; };
  }, [i18n, i18n.resolvedLanguage]);
  async function run(operation: () => Promise<void>) { setBusy(true); setError(''); setStatus(''); try { await operation(); } catch(e) { setError(e instanceof DomainError ? `${e.code}: ${e.message}` : String(e)); } finally { setBusy(false); } }
  async function save(clear = false) {
    if (!profile) return;
    await run(async () => {
      const number = (value: string) => value.trim() ? Number(value) : undefined;
      const text = (value: string) => value.trim() || undefined;
      const preferences: TrainingPreferences | undefined = clear ? undefined : { updatedAt: new Date().toISOString(), goal: text(fields.goal), experience: text(fields.experience), availableEquipment: fields.equipment.trim() ? fields.equipment.split(',').map(s => s.trim()).filter(Boolean) : undefined, daysPerWeek: number(fields.days), sessionMinutes: number(fields.minutes), heightCm: number(fields.height), weightGrams: fields.weight ? kgGrams(fields.weight) : undefined, constraints: text(fields.constraints), trainingWeekdays: fields.weekdays.trim() ? fields.weekdays.split(',').map(Number) : undefined, trainingLocation: location, exercisePreferences: categories.length ? categories : undefined };
      const saved = await profileService.saveProfile({ locale: i18n.resolvedLanguage === 'zh' ? 'zh' : 'en', timeZone: zone, units: 'metric', trainingPreferences: preferences }, profile.revision);
      applyProfile(saved); setStatus(l.saved);
    });
  }
  function submit(e: FormEvent) { e.preventDefault(); void save(); }
  return <div className="settings-page v31-settings"><h1>{t('settings')}</h1><p>{l.local}</p>
    {error && <p role="alert"><StatusIcon status="error"/>{error}</p>}
    <div className="v31-tabs" role="tablist" aria-label={i18n.resolvedLanguage === 'zh'?'设置分类':'Settings sections'}>{tabs.map((name,index)=><button key={name} role="tab" aria-selected={name===tab} aria-controls={`settings-${name}`} id={`tab-${name}`} onClick={()=>setParams({tab:name})}>{(i18n.resolvedLanguage==='zh'?['AI 资格与额度','备份恢复','偏好与资料','外观与版式']:['AI access & quota','Backup & restore','Profile & preferences','Appearance & layout'])[index]}</button>)}</div>
    <section role="tabpanel" id="settings-trial" aria-labelledby="tab-trial" hidden={tab!=='trial'}>{tab==='trial'&&<TrialAccess />}</section>
    <section role="tabpanel" id="settings-backup" aria-labelledby="tab-backup" hidden={tab!=='backup'}>{profile && <BackupPanel restored={restored} />}</section>
    <section role="tabpanel" id="settings-appearance" aria-labelledby="tab-appearance" hidden={tab!=='appearance'}><AppearanceCards />{profile && <CoachPreferences />}</section>
    <section role="tabpanel" id="settings-profile" aria-labelledby="tab-profile" hidden={tab!=='profile'}><p>{l.optional}</p><Link to="/onboarding">{i18n.resolvedLanguage === 'zh' ? '查看或修改10阶段引导资料' : 'Review or edit 10-stage onboarding'}</Link>
    <button disabled={!profile || busy} onClick={() => void run(async () => { setMemo(await trainingMemoryService.readTrainingMemo()); })}>{i18n.resolvedLanguage === 'zh' ? '读取全量训练备忘' : 'Read full training memo'}</button>
    {memo && <TrainingMemoView memo={memo} locale={i18n.resolvedLanguage === 'zh' ? 'zh' : 'en'} />}
    <p role="status"><AppIcon name="info"/>{status}</p>
    <form onSubmit={submit}><fieldset disabled={!profile || busy}>
      {Object.keys(blank).map(key => { const k = key as keyof Fields; return <label key={k}>{l[k]}<input value={fields[k]} onChange={e => setFields({ ...fields, [k]: e.target.value })} inputMode={['days','minutes','height','weight'].includes(k) ? 'decimal' : 'text'} /></label>; })}
      <label>{l.zone}<input value={zone} onChange={e => setZone(e.target.value)} /></label>
      <label>{l.location}<select value={location ?? ''} onChange={e => setLocation((e.target.value || undefined) as typeof location)}><option value="">—</option>{(['home','gym','outdoors','other'] as const).map(v => <option key={v} value={v}>{i18n.resolvedLanguage === 'zh' ? { home: '家中', gym: '健身房', outdoors: '户外', other: '其他' }[v] : v}</option>)}</select></label>
      <fieldset><legend>{l.categories}</legend>{(['strength','cardio','bodyweight'] as const).map(v => <label key={v}><input type="checkbox" checked={categories.includes(v)} onChange={e => setCategories(e.target.checked ? [...categories,v] : categories.filter(c => c !== v))} />{t(v)}</label>)}</fieldset>
      <button type="submit">{l.save}</button><button type="button" onClick={() => void save(true)}>{l.clear}</button>
    </fieldset></form>
    <form onSubmit={e => { e.preventDefault(); void run(async () => { await bodyWeightService.saveBodyWeight({ id: editing?.id, localDate: date, weightGrams: kgGrams(weight), timeZone: editing?.timeZone ?? zone }, editing?.revision); setWeights(await bodyWeightService.listBodyWeights()); setEditing(undefined); setStatus(l.weightSaved); }); }}><fieldset disabled={!profile || busy}>
      <label>{l.date}<input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label>
      <label>{l.observed}<input required inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)} /></label>
      <button type="submit">{l.saveWeight}</button>{editing && <button type="button" onClick={() => { setEditing(undefined); setWeight(''); }}>{l.cancel}</button>}
    </fieldset></form>
    <ul aria-label={l.history}>{weights.map(row => <li key={row.id}>{row.localDate} · {row.weightGrams / 1000} kg · {row.timeZone} <button disabled={busy} onClick={() => { setEditing(row); setDate(row.localDate); setWeight(String(row.weightGrams / 1000)); }}>{l.edit}</button> <button disabled={busy} onClick={() => void run(async () => { await bodyWeightService.deleteBodyWeight(row.id, row.revision); setWeights(await bodyWeightService.listBodyWeights()); if (editing?.id === row.id) setEditing(undefined); setStatus(l.deleted); })}>{l.delete}</button></li>)}</ul>
    </section></div>;
}
