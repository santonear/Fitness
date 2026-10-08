import { AppIcon, StatusIcon } from '../AppIcon';
import { useState } from 'react';
import { NumericWheel } from './NumericWheel';
import type { GuidedLocale } from './GuidedOnboarding';
import '../../guided.css';

export type GuidedMeasurementKind = 'weight' | 'waist' | 'bodyFat';
export interface GuidedMeasurementInput { kind: GuidedMeasurementKind; value: number; date: string; method: string; }
export interface GuidedMeasurementObservation extends GuidedMeasurementInput { id: string; }
export interface GuidedMeasurementsProps {
  locale: GuidedLocale;
  onSave: (measurement: GuidedMeasurementInput) => void | Promise<void>;
  observations: GuidedMeasurementObservation[];
  busy?: boolean;
  error?: string;
}
export function measurementUnit(kind: GuidedMeasurementKind) { return kind === 'weight' ? 'kg' : kind === 'waist' ? 'cm' : '%'; }
export function measurementDelta(current: GuidedMeasurementObservation, previous: GuidedMeasurementObservation) {
  return current.kind === previous.kind ? Math.round((current.value - previous.value) * 10) / 10 : null;
}
const configs = {
  weight: { min: 30, max: 300, step: .1, sample: 70 },
  waist: { min: 40, max: 200, step: .1, sample: 80 },
  bodyFat: { min: 3, max: 65, step: .1, sample: 20 },
};
function todayLocal() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function GuidedMeasurements({ locale, onSave, observations, busy = false, error }: GuidedMeasurementsProps) {
  const t = (zh: string, en: string) => locale === 'en' ? en : zh;
  const [kind, setKind] = useState<GuidedMeasurementKind>('weight');
  const [value, setValue] = useState<number | ''>('');
  const [date, setDate] = useState(todayLocal);
  const [method, setMethod] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const disabled = busy || saving;
  const labels = { weight: t('体重', 'weight'), waist: t('腰围', 'waist'), bodyFat: t('体脂率', 'body fat') };
  const config = configs[kind];
  const valid = value !== '' && Number.isFinite(value) && value >= config.min && value <= config.max && date !== '' && (kind === 'weight' || method.trim() !== '');
  const sorted = [...observations].sort((a, b) => b.date.localeCompare(a.date));
  return <section className="guided-panel guided-body-panel" aria-busy={disabled}>
    <h2>{t('身体记录', 'body measurements')}</h2>
    <dl className="guided-body-overview">{(['weight', 'waist', 'bodyFat'] as const).map(metric => {
      const records = sorted.filter(item => item.kind === metric);
      const latest = records[0];
      const delta = latest && records[1] ? measurementDelta(latest, records[1]) : null;
      return <div key={metric}><dt>{labels[metric]}</dt><dd>{latest ? <>{latest.value}<small> {measurementUnit(metric)}</small></> : '—'}</dd><p>{latest?.date ?? t('尚未记录', 'not recorded yet')}</p>{delta !== null && <p>{t('较上次', 'since previous')} {delta > 0 ? '+' : ''}{delta} {metric === 'bodyFat' ? t('个百分点', 'percentage points') : measurementUnit(metric)}</p>}</div>;
    })}</dl>
    <p>{t('尽量在相同条件下测量。腰围、体脂率及变化仅作参考，不作诊断或训练负荷依据。', 'measure under similar conditions. waist, body fat and changes are references, not diagnoses or training load prescriptions.')}</p>
    <details className="guided-measurement-entry"><summary>{t('记录身体变化', 'record a measurement')}</summary>
    <form onSubmit={async event => {
      event.preventDefault();
      if (!valid || disabled) return;
      setSaving(true); setSaveError('');
      try { await onSave({ kind, value, date, method: kind === 'weight' ? t('用户记录', 'user recorded') : method.trim() }); setValue(''); }
      catch (failure) { setSaveError(failure instanceof Error ? failure.message : t('保存失败，请重试。', 'saving failed; try again.')); }
      finally { setSaving(false); }
    }}>
      <div className="guided-actions" role="group" aria-label={t('测量指标', 'measurement type')}>{(['weight', 'waist', 'bodyFat'] as const).map(item => <button type="button" key={item} aria-pressed={kind === item} disabled={disabled} onClick={() => { setKind(item); setValue(''); setMethod(''); setSaveError(''); }}>{labels[item]}</button>)}</div>
      <NumericWheel locale={locale} label={labels[kind]} value={value} onChange={setValue} {...config} unit={measurementUnit(kind)} disabled={disabled} />
      <label>{t('测量日期', 'measurement date')}<input type="date" required value={date} disabled={disabled} onChange={event => setDate(event.target.value)} /></label>
      {kind !== 'weight' && <label className="guided-measurement-method">{t('测量方法或来源', 'measurement method or source')}<input type="text" required maxLength={200} value={method} disabled={disabled} placeholder={kind === 'waist' ? t('例如软尺', 'for example, measuring tape') : t('例如体脂秤；记录设备或方法', 'for example, body fat scale; note device or method')} onChange={event => setMethod(event.target.value)} /></label>}
      {(error || saveError) && <p role="alert"><StatusIcon status="warning"/>{error || saveError}</p>}
      <div className="guided-actions"><button className="guided-primary" disabled={disabled || !valid} type="submit">{disabled ? t('保存中…', 'saving…') : t('确认保存测量值', 'confirm and save measurement')}</button></div>
    </form>
    </details>
    <section className="guided-section"><h3>{t('测量趋势', 'measurement history')}</h3>
      {sorted.length === 0 ? <p>{t('尚无测量记录；缺测不记为零。', 'no measurements yet; missing values are not zero.')}</p> : <ol className="guided-measurement-history">{sorted.map((observation, index) => {
        const previous = sorted.slice(index + 1).find(item => item.kind === observation.kind);
        const delta = previous ? measurementDelta(observation, previous) : null;
        return <li key={observation.id}><time>{observation.date}</time><p>{labels[observation.kind]} · {observation.value} {measurementUnit(observation.kind)}</p><p>{observation.method}</p>{delta !== null && <p>{t('与上次相比', 'change since previous measurement')} {delta > 0 ? '+' : ''}{delta} {observation.kind === 'bodyFat' ? t('个百分点', 'percentage points') : measurementUnit(observation.kind)}</p>}</li>;
      })}</ol>}
    </section>
  </section>;
}
