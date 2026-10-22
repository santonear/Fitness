import { DATA, calendarDay } from '../../../engine/data';
import { useState } from 'react';
import { engineCopy } from '../../../coach/engine-copy';
import { Button } from '../../components/common';
import { useMainline, workflow } from '../../mainline/context';
/** Injury questions are direct translations of the two source conditions, with no recovery instructions. */
export function OlderFallPanel() {
  const { data, locale, t, busy, run, navigate } = useMainline(),
    [head, setHead] = useState(''),
    [weight, setWeight] = useState(''),
    [seen, setSeen] = useState(false),
    safety = data?.state?.olderSafety,
    [fallAt, setFallAt] = useState(safety?.fallAt);
  // Clear the answers only when a new fall is reported, during render: a mount effect could run after the user already picked an answer and wipe it.
  if (fallAt !== safety?.fallAt) {
    setFallAt(safety?.fallAt);
    setHead('');
    setWeight('');
    setSeen(false);
  }
  const profile = data?.state?.coachProfile,
    day = calendarDay(new Date().toISOString(), data?.profile?.timeZone ?? 'Asia/Shanghai')!,
    birth = profile?.birthYearMonth?.split('-').map(Number),
    parts = day.split('-').map(Number),
    years = birth ? parts[0] - birth[0] - (parts[1] < birth[1] ? 1 : 0) : data?.profile?.bodyDetails?.values.age,
    threshold = DATA.rules.find(rule => rule.id === 'older.activation')!.value!.trigger.any[0].gte;
  if (
    !data ||
    (!safety &&
      profile?.population?.kind !== 'older_adult' &&
      !(profile?.population?.kind === 'general' && years !== undefined && years >= threshold))
  )
    return null;
  const labels =
    locale === 'zh'
      ? { fall: '训练中摔倒了', head: '摔倒时是否撞到了头？', weight: '腿是否不能承重？', yes: '是', no: '否' }
      : {
          fall: 'I fell during this workout',
          head: 'Did you hit your head when you fell?',
          weight: 'Are you unable to put weight on your leg?',
          yes: 'Yes',
          no: 'No',
        };
  return (
    <section>
      {data.active && (
        <Button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await workflow.reportOlderFall(data.active!.id, data.metadata.dataRevision);
              navigate('/workout/recovery');
            })
          }
        >
          {labels.fall}
        </Button>
      )}
      {safety?.reviewRequiredAt && (
        <>
          <p role="alert">{engineCopy('older.stop.copy.fall_injury', locale)}</p>
          {!safety.injuryConfirmed && (
            <fieldset disabled={busy}>
              {[
                [labels.head, head, setHead],
                [labels.weight, weight, setWeight],
              ].map(([label, value, set], index) => (
                <label key={index}>
                  {label as string}
                  <select
                    value={value as string}
                    onChange={event => (set as (value: string) => void)(event.target.value)}
                  >
                    <option value="">—</option>
                    <option value="yes">{labels.yes}</option>
                    <option value="no">{labels.no}</option>
                  </select>
                </label>
              ))}
              <Button
                disabled={!head || !weight}
                onClick={() =>
                  void run(async () => {
                    await workflow.answerOlderFall(
                      { headHit: head === 'yes', cannotBearWeight: weight === 'yes' },
                      data.metadata.dataRevision,
                    );
                  })
                }
              >
                {t.confirm}
              </Button>
            </fieldset>
          )}
          <fieldset disabled={busy}>
            <label>
              <input type="checkbox" checked={seen} onChange={event => setSeen(event.target.checked)} />
              {engineCopy('redflag.copy.confirm_professional_seen', locale)}
            </label>
            <Button
              disabled={!seen}
              onClick={() =>
                void run(async () => {
                  await workflow.confirmOlderFallProfessionalSeen(data.metadata.dataRevision);
                  setSeen(false);
                })
              }
            >
              {t.confirm}
            </Button>
          </fieldset>
        </>
      )}
      {safety && !safety.reviewRequiredAt && !safety.professionalSeenAt && (
        <p>{engineCopy('older.stop.copy.fall_no_injury', locale)}</p>
      )}
    </section>
  );
}
