import { useState } from 'react';
import type { SetFact, SetFeedbackEvent } from '../../../domain/v8/contracts';
import { setFeedbackEventSchema } from '../../../domain/schemas';
import { engineTrainingCopy } from '../../../i18n/features/training/engine';
import { Button, Chip } from '../../components/common';
import { PrimaryButton } from '../../components/kit';
import { PainCheckinPanel, type PainCheckinValue } from './PainCheckinPanel';

export function SetFeedback({
  fact,
  events,
  locale,
  busy,
  onAppend,
  painAllowed = false,
  onHealthSettings,
  promptPainAreas = [],
  sex,
}: {
  fact: SetFact;
  events: SetFeedbackEvent[];
  locale: 'zh' | 'en';
  busy: boolean;
  onAppend: (event: SetFeedbackEvent) => void;
  painAllowed?: boolean;
  promptPainAreas?: NonNullable<SetFeedbackEvent['painArea']>[];
  onHealthSettings?: () => void;
  /** Figure for the pain picker, from the profile. */
  sex?: 'male' | 'female';
}) {
  const t = engineTrainingCopy[locale],
    latest = events
      .filter(
        event =>
          event.exerciseId === fact.exerciseId &&
          event.itemIndex === fact.itemIndex &&
          event.setIndex === fact.setIndex,
      )
      .at(-1);
  const [discomfort, setDiscomfort] = useState(false),
    [pain, setPain] = useState<PainCheckinValue>({}),
    [rir, setRir] = useState<number>();
  const validRir = rir === undefined || (Number.isFinite(rir) && rir >= 0 && rir <= 10);
  function append(effort: SetFeedbackEvent['effort']) {
    const parsed = setFeedbackEventSchema.safeParse({
      id: crypto.randomUUID(),
      itemIndex: fact.itemIndex,
      setIndex: fact.setIndex,
      exerciseId: fact.exerciseId,
      createdAt: new Date().toISOString(),
      effort,
      ...(rir !== undefined ? { rir } : {}),
      ...(effort === 'discomfort'
        ? { painScore: pain.painScore, painArea: pain.painArea, ...(pain.painSide ? { painSide: pain.painSide } : {}) }
        : {}),
    });
    if (parsed.success && (effort !== 'discomfort' || painAllowed)) {
      onAppend(parsed.data);
      setDiscomfort(false);
    }
  }
  return (
    <fieldset disabled={busy}>
      <legend>
        {t.feedback} · {fact.setIndex + 1}
      </legend>
      <div className="v8-capsules">
        {(['too_light', 'right', 'too_hard', 'discomfort'] as const).map((effort, index) => (
          <Chip
            key={effort}
            selected={effort === 'discomfort' ? discomfort || latest?.effort === effort : latest?.effort === effort}
            disabled={!validRir}
            onClick={() => {
              if (effort === 'discomfort') {
                setDiscomfort(!discomfort);
                return;
              }
              if (latest?.effort === effort && latest.rir === rir) return;
              append(effort);
            }}
          >
            {t.efforts[index]}
          </Chip>
        ))}
      </div>
      <details>
        <summary>{t.rir}</summary>
        <input
          aria-label={t.rir}
          type="number"
          min="0"
          max="10"
          step="1"
          value={Number.isFinite(rir) ? rir : ''}
          onChange={event => setRir(event.target.value === '' ? undefined : event.target.valueAsNumber)}
        />
        {latest && latest.effort !== 'discomfort' && (
          <Button disabled={!validRir || rir === undefined || latest.rir === rir} onClick={() => append(latest.effort)}>
            {t.record}
          </Button>
        )}
      </details>
      {(discomfort || promptPainAreas.length > 0) && (
        <div className="wk-pain">
          {!painAllowed && onHealthSettings && (
            <Button onClick={onHealthSettings}>{locale === 'zh' ? '设置' : 'Settings'}</Button>
          )}
          <PainCheckinPanel
            locale={locale}
            sex={sex}
            disabled={!painAllowed}
            value={pain}
            onChange={setPain}
            finish={
              <PrimaryButton
                disabled={
                  !painAllowed ||
                  !validRir ||
                  pain.painScore === undefined ||
                  !Number.isInteger(pain.painScore) ||
                  pain.painScore < 0 ||
                  pain.painScore > 10 ||
                  !pain.painArea
                }
                onClick={() => append('discomfort')}
              >
                {t.record}
              </PrimaryButton>
            }
          />
        </div>
      )}
    </fieldset>
  );
}
