import { useState } from 'react';
import type { SetFact, SetFeedbackEvent } from '../../../domain/v8/contracts';
import { setFeedbackEventSchema } from '../../../domain/schemas';
import { engineTrainingCopy } from '../../../i18n/features/training/engine';
import { Button, Chip } from '../../components/common';

export function SetFeedback({
  fact,
  events,
  locale,
  busy,
  onAppend,
  painAllowed = false,
  onHealthSettings,
  promptPainAreas = [],
}: {
  fact: SetFact;
  events: SetFeedbackEvent[];
  locale: 'zh' | 'en';
  busy: boolean;
  onAppend: (event: SetFeedbackEvent) => void;
  painAllowed?: boolean;
  promptPainAreas?: NonNullable<SetFeedbackEvent['painArea']>[];
  onHealthSettings?: () => void;
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
    [score, setScore] = useState<number>(),
    [area, setArea] = useState<SetFeedbackEvent['painArea']>(),
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
      ...(effort === 'discomfort' ? { painScore: score, painArea: area } : {}),
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
        <div className="v8-inline-panel">
          {!painAllowed && onHealthSettings && (
            <Button onClick={onHealthSettings}>{locale === 'zh' ? '设置' : 'Settings'}</Button>
          )}
          <fieldset disabled={!painAllowed}>
            <label>
              {t.painScore}
              <input
                type="number"
                min="0"
                max="10"
                step="1"
                value={Number.isFinite(score) ? score : ''}
                onChange={event => setScore(event.target.value === '' ? undefined : event.target.valueAsNumber)}
              />
            </label>
            <label>
              {t.area}
              <select
                aria-label={t.area}
                value={area ?? ''}
                onChange={event => setArea((event.target.value as SetFeedbackEvent['painArea']) || undefined)}
              >
                <option value="">{t.choose}</option>
                {(['knee', 'back', 'shoulder', 'wrist', 'other'] as const).map((value, index) => (
                  <option key={value} value={value}>
                    {t.areas[index]}
                  </option>
                ))}
              </select>
            </label>
            <Button
              disabled={
                !painAllowed ||
                !validRir ||
                score === undefined ||
                !Number.isInteger(score) ||
                score < 0 ||
                score > 10 ||
                !area
              }
              onClick={() => append('discomfort')}
            >
              {t.record}
            </Button>
          </fieldset>
        </div>
      )}
    </fieldset>
  );
}
