import referralCopy from '../../../../data/training-engine/postpartum-referral-copy.json';
import { useState, useEffect } from 'react';
import {
  postpartumReferralKeys,
  needsPostpartumReferralCheck,
  type ReferralOccasion,
} from '../../../application/postpartum-referral';
import { DATA, calendarDay } from '../../../engine/data';
import { engineCopy } from '../../../coach/engine-copy';
import { engineTrainingCopy } from '../../../i18n/features/training/engine';
import zh from '../../../i18n/features/coach/zh.json';
import en from '../../../i18n/features/coach/en.json';
import { Button } from '../../components/common';
import { useMainline, workflow } from '../../mainline/context';
const urgent = DATA.rules.find(r => r.id === 'postpartum.urgent')!.value!.items as string[],
  symptoms = DATA.rules.find(r => r.id === 'postpartum.symptom_regression')!.value!.when.contains_any as string[];
const excerpts = {
  zh: [
    '大量出血',
    '发烧',
    '伤口红肿发热或渗液',
    '小腿疼痛或肿胀',
    '胸痛',
    '呼吸困难',
    '漏尿',
    '沉重感',
    '下坠',
    '盆腔或腹部疼痛',
    '出血又出现或一直不停',
  ],
  en: [
    'Heavy bleeding',
    'fever',
    "wound that's hot, red or oozing",
    'calf pain or swelling',
    'chest pain',
    'breathlessness',
    'Leaking',
    'heaviness',
    'dragging',
    'pelvic or tummy pain',
    "bleeding that comes back or won't stop",
  ],
};
/** Exact source manual ch12 §postpartum.referral_signs: full conditions, never shortened to generic leakage/pain. */
export const postpartumReferralLabels = postpartumReferralKeys.map(
  key => referralCopy[key as keyof typeof referralCopy].zh,
);
export function PostpartumReferralQuestions({
  occasion = 'weekly_checkin',
  phase,
  requestedAt,
}: {
  occasion?: ReferralOccasion;
  phase?: 1 | 2 | 3;
  requestedAt?: string;
}) {
  const { data, locale, t, busy, run } = useMainline(),
    [answers, setAnswers] = useState<Record<string, boolean>>({});
  if (!data || data.state?.coachProfile?.population?.kind !== 'postpartum') return null;
  const today = calendarDay(new Date().toISOString(), data.profile?.timeZone ?? 'Asia/Shanghai')!;
  if (
    !needsPostpartumReferralCheck(data.state.postpartumReferralChecks, occasion, {
      asOfDate: today,
      timeZone: data.profile?.timeZone ?? 'Asia/Shanghai',
      phase,
      requestedAt,
    })
  )
    return null;
  const common = locale === 'zh' ? zh : en;
  return (
    <fieldset disabled={busy}>
      <p>{engineCopy('postpartum.copy.warning.warning', locale)}</p>
      {postpartumReferralKeys.map(key => (
        <label key={key}>
          {referralCopy[key as keyof typeof referralCopy][locale]}
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
            <option value="true">{common.yes}</option>
            <option value="false">{common.no}</option>
          </select>
        </label>
      ))}
      <Button
        disabled={
          !Object.values(answers).some(Boolean) &&
          !postpartumReferralKeys.every(key => typeof answers[key] === 'boolean')
        }
        onClick={() =>
          void run(async () => {
            await workflow.reportPostpartumReferral({ occasion, phase, answers }, data.metadata.dataRevision);
            setAnswers({});
          })
        }
      >
        {t.confirm}
      </Button>
    </fieldset>
  );
}
/** Option labels are verbatim excerpts of approved source copy; no new clinical questions. */
export function PostpartumSafetyPanel() {
  const { data, locale, t, busy, run, navigate } = useMainline(),
    [absent, setAbsent] = useState<Record<string, boolean>>({}),
    [seen, setSeen] = useState(false),
    state = data?.state,
    safety = state?.postpartumSafety,
    copy = engineTrainingCopy[locale],
    common = locale === 'zh' ? zh : en;
  useEffect(() => {
    setSeen(false);
    setAbsent({});
  }, [safety?.urgentAt, safety?.regression?.requiredAt]);
  if (!data || (state?.coachProfile?.population?.kind !== 'postpartum' && !safety?.urgentAt && !safety?.regression))
    return null;
  const keys = [...urgent, ...symptoms],
    source =
      engineCopy('postpartum.copy.urgent.urgent', locale) + ' ' + engineCopy('postpartum.copy.warning.warning', locale),
    label = (key: string) => {
      const value = excerpts[locale][keys.indexOf(key)];
      return source.includes(value) ? value : key;
    };
  const positive = (group: 'urgent' | 'regression', key: string) =>
    void run(async () => {
      await workflow.reportPostpartumSymptoms(
        data.active?.id,
        {
          urgent: group === 'urgent' ? { [key]: true } : {},
          regression: group === 'regression' ? { [key]: true } : {},
        },
        data.metadata.dataRevision,
      );
      setAbsent({});
      setSeen(false);
      if (group === 'urgent') navigate('/workout/recovery');
    });
  return (
    <section>
      <PostpartumReferralQuestions />
      <details>
        <summary>{copy.stop}</summary>
        <p>{engineCopy('postpartum.copy.urgent.urgent', locale)}</p>
        {urgent.map(key => (
          <Button key={key} disabled={busy} onClick={() => positive('urgent', key)}>
            {label(key)}
          </Button>
        ))}
        <p>{engineCopy('postpartum.copy.warning.warning', locale)}</p>
        {symptoms.map(key => (
          <Button key={key} disabled={busy} onClick={() => positive('regression', key)}>
            {label(key)}
          </Button>
        ))}
      </details>
      {safety?.urgentAt && <p role="alert">{engineCopy('postpartum.copy.urgent.paused', locale)}</p>}
      {safety?.regression && (
        <>
          <p role="status">{engineCopy('postpartum.copy.warning.regressed', locale)}</p>
          {state?.coachProfile?.healthStorageConsent && (
            <fieldset disabled={busy}>
              {keys.map(key => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={absent[key] === true}
                    onChange={event => setAbsent({ ...absent, [key]: event.target.checked })}
                  />
                  {label(key)}: {common.no}
                </label>
              ))}
              <Button
                disabled={!keys.every(key => absent[key] === true)}
                onClick={() =>
                  void run(async () => {
                    await workflow.reportPostpartumSymptoms(
                      undefined,
                      {
                        urgent: Object.fromEntries(urgent.map(key => [key, false])),
                        regression: Object.fromEntries(symptoms.map(key => [key, false])),
                      },
                      data.metadata.dataRevision,
                    );
                    setAbsent({});
                  })
                }
              >
                {t.confirm}
              </Button>
            </fieldset>
          )}
        </>
      )}
      {(safety?.urgentAt || safety?.regression) && (
        <fieldset disabled={busy}>
          <label>
            <input type="checkbox" checked={seen} onChange={event => setSeen(event.target.checked)} />
            {engineCopy('redflag.copy.confirm_professional_seen', locale)}
          </label>
          <Button
            disabled={!seen}
            onClick={() =>
              void run(async () => {
                await workflow.confirmPostpartumProfessionalSeen(data.metadata.dataRevision);
                setSeen(false);
              })
            }
          >
            {t.confirm}
          </Button>
        </fieldset>
      )}
    </section>
  );
}
