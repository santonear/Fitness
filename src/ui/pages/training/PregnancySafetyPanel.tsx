import { pregnancyStopKeys, pregnancySupineKeys } from '../../../application/pregnancy-safety';
import { useState } from 'react';
import type { BirthReportInput } from '../../../application/birth-report';
import { engineCopy } from '../../../coach/engine-copy';
import { Button } from '../../components/common';

const stopLabels = {
  zh: [
    '阴道出血',
    '规律的疼痛宫缩',
    '有液体流出',
    '运动前就呼吸费力或休息后仍气喘',
    '胸痛',
    '头晕或要晕倒',
    '头痛',
    '腿没力气、站不稳',
    '小腿疼痛或肿胀',
    '腹痛',
  ],
  en: [
    'vaginal bleeding',
    'regular painful contractions',
    'fluid leaking',
    "breathlessness before exercise or that doesn't ease afterwards",
    'chest pain',
    'dizziness or feeling faint',
    'a headache',
    'weakness that affects your balance',
    'calf pain or swelling',
    'tummy pain',
  ],
};
const supineLabels = {
  zh: ['头晕', '恶心', '不舒服'],
  en: ['lightheaded', 'sick', 'unwell'],
};
/** Every label is verified against approved copy; no inferred questions or new clinical wording. */
export function pregnancySafetyOptions(locale: 'zh' | 'en', kind: 'stop' | 'supine') {
  const keys = kind === 'stop' ? pregnancyStopKeys : pregnancySupineKeys,
    labels = kind === 'stop' ? stopLabels[locale] : supineLabels[locale],
    copy = engineCopy(kind === 'stop' ? 'pregnancy.stop.copy.stop' : 'pregnancy.supine_symptom.copy', locale);
  if (keys.length !== labels.length || labels.some(label => !copy.includes(label)))
    throw Error('Missing approved pregnancy symptom copy');
  return keys.map((key, index) => ({ key, label: labels[index] }));
}
export interface PregnancySafetyPanelProps {
  locale: 'zh' | 'en';
  busy?: boolean;
  paused?: boolean;
  chestEmergency?: boolean;
  currentSupine?: boolean;
  supineAvoided?: boolean;
  onStop: (keys: readonly string[]) => unknown;
  onSupine: (key: string) => unknown;
  onConfirmProviderContacted?: () => unknown;
  onBirthReported?: (input: BirthReportInput) => unknown;
}
/** Labels follow postpartum.activation and the existing profile editor; unknown is never a negative answer. */
export function BirthReportFields({
  locale,
  busy,
  onReport,
}: {
  locale: 'zh' | 'en';
  busy?: boolean;
  onReport: (input: BirthReportInput) => unknown;
}) {
  const [delivery, setDelivery] = useState(''),
    [answers, setAnswers] = useState<Record<string, boolean>>({}),
    chinese = locale === 'zh',
    fields = ['perinealTrauma', 'postnatalCheckDone', 'cleared'] as const,
    labels = chinese
      ? ['会阴损伤', '产后复查', '产后复查已获准运动']
      : ['Perineal injury', 'Postnatal check completed', 'Cleared to exercise at the postnatal check'];
  return (
    <details>
      <summary>{chinese ? '报告分娩' : 'Report birth'}</summary>
      <fieldset disabled={busy}>
        <label>
          {chinese ? '分娩方式' : 'Delivery'}
          <select value={delivery} onChange={event => setDelivery(event.target.value)}>
            <option value="">—</option>
            <option value="vaginal">{chinese ? '顺产' : 'Vaginal'}</option>
            <option value="assisted_or_tear">{chinese ? '器械助产 / 会阴损伤' : 'Assisted / perineal injury'}</option>
            <option value="cesarean">{chinese ? '剖宫产' : 'Cesarean'}</option>
          </select>
        </label>
        {fields.map((key, index) => (
          <label key={key}>
            {labels[index]}
            <select
              value={answers[key] === undefined ? '' : String(answers[key])}
              onChange={event =>
                setAnswers(prior => {
                  const next = { ...prior };
                  if (event.target.value === '') delete next[key];
                  else next[key] = event.target.value === 'true';
                  return next;
                })
              }
            >
              <option value="">—</option>
              <option value="true">{chinese ? '是' : 'Yes'}</option>
              <option value="false">{chinese ? '否' : 'No'}</option>
            </select>
          </label>
        ))}
        <Button
          disabled={!delivery || !fields.every(key => typeof answers[key] === 'boolean')}
          onClick={() =>
            onReport({
              delivery: delivery as BirthReportInput['delivery'],
              perinealTrauma: answers.perinealTrauma,
              postnatalCheckDone: answers.postnatalCheckDone,
              cleared: answers.cleared,
            })
          }
        >
          {chinese ? '报告分娩' : 'Report birth'}
        </Button>
      </fieldset>
    </details>
  );
}
export function PregnancySafetyPanel({
  locale,
  busy,
  paused,
  chestEmergency,
  currentSupine,
  supineAvoided,
  onStop,
  onSupine,
  onConfirmProviderContacted,
  onBirthReported,
}: PregnancySafetyPanelProps) {
  const confirm =
    locale === 'zh'
      ? '联系过医生或助产士后回来确认'
      : "Once you've spoken to your doctor or midwife, come back and confirm";
  if (!engineCopy('pregnancy.stop.copy.paused', locale).includes(confirm))
    throw Error('Missing approved provider contact copy');
  return (
    <section>
      {onBirthReported && <BirthReportFields locale={locale} busy={busy} onReport={onBirthReported} />}{' '}
      {chestEmergency && <p role="alert">{engineCopy('pregnancy.stop.copy.chest_emergency', locale)}</p>}
      {paused ? (
        <>
          <p role="alert">{engineCopy('pregnancy.stop.copy.paused', locale)}</p>
          {onConfirmProviderContacted && (
            <Button disabled={busy} onClick={onConfirmProviderContacted}>
              {confirm}
            </Button>
          )}
        </>
      ) : (
        <>
          <p>{engineCopy('pregnancy.stop.copy.stop', locale)}</p>
          {pregnancySafetyOptions(locale, 'stop').map(option => (
            <Button key={option.key} disabled={busy} onClick={() => onStop([option.key])}>
              {option.label}
            </Button>
          ))}
        </>
      )}
      {supineAvoided && <p role="status">{engineCopy('pregnancy.supine_symptom.copy', locale)}</p>}
      {!paused && currentSupine && (
        <>
          <p>{engineCopy('pregnancy.supine_symptom.copy', locale)}</p>
          {pregnancySafetyOptions(locale, 'supine').map(option => (
            <Button key={option.key} disabled={busy} onClick={() => onSupine(option.key)}>
              {option.label}
            </Button>
          ))}
        </>
      )}
    </section>
  );
}
