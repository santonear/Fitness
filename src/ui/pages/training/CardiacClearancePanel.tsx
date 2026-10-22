import { useState } from 'react';
import { Rules } from '../../../engine/data';
import { engineCopy } from '../../../coach/engine-copy';
import { Button } from '../../components/common';
import { useMainline, workflow } from '../../mainline/context';
const rules = new Rules();
/** This attestation clears only the independent cardiac pause after a new screening. */
export function CardiacClearancePanel() {
  const { data, locale, t, busy, run, navigate } = useMainline(),
    [date, setDate] = useState(''),
    [intensity, setIntensity] = useState<'moderate' | 'vigorous'>('moderate'),
    [confirmed, setConfirmed] = useState(false);
  const pause = data?.state?.cardiacPause,
    screen = data?.state?.coachProfile?.screening;
  if (!pause || !data) return null;
  const fresh =
    !!data.state?.coachProfile?.healthStorageConsent &&
    !!screen?.completedAt &&
    Date.parse(screen.completedAt) >= Date.parse(pause.requiredAt) &&
    screen.rescreenRequired !== true &&
    screen.parqAnswers?.length === 7 &&
    rules.get('safety.screen.cmr_symptoms').symptoms.every((key: string) => screen.cmrSymptoms?.[key] === false) &&
    screen.symptoms === false;
  return (
    <section>
      <p role="alert">{engineCopy('safety.copy.stop_emergency', locale)}</p>
      <p>{engineCopy('safety.copy.clearance_needed', locale)}</p>
      {!fresh ? (
        <Button onClick={() => navigate('/settings/engine')}>
          {locale === 'zh' ? '运动前自查与训练偏好' : 'Screening and training preferences'}
        </Button>
      ) : (
        <fieldset disabled={busy}>
          <label>
            {locale === 'zh' ? '日期' : 'Date'}
            <input type="date" value={date} onChange={event => setDate(event.target.value)} />
          </label>
          <label>
            {locale === 'zh' ? '强度' : 'Intensity'}
            <select value={intensity} onChange={event => setIntensity(event.target.value as typeof intensity)}>
              {(rules.get('safety.clearance.confirm').attested_intensity_options as ('moderate' | 'vigorous')[]).map(
                value => (
                  <option value={value} key={value}>
                    {locale === 'zh'
                      ? value === 'moderate'
                        ? '中等强度'
                        : '较高强度'
                      : value === 'moderate'
                        ? 'Moderate'
                        : 'Vigorous'}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
            {engineCopy('redflag.copy.confirm_professional_seen', locale)}
          </label>
          <Button
            disabled={!date || !confirmed}
            onClick={() =>
              void run(async () => {
                await workflow.confirmCardiacClearance({ date, intensity }, data.metadata.dataRevision);
                setConfirmed(false);
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
