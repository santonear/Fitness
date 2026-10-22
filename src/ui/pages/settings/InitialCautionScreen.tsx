import { useRef } from 'react';
import type { EngineProfileFields } from '../../../application/engine-profile';
import { painQuestionKeys } from '../../../application/pain-events';
import { engineCopy } from '../../../coach/engine-copy';

/** Initial cautions require explicit source answers; an existing valid review is not reset. */
export function InitialCautionScreen({
  value,
  onChange,
  locale,
}: {
  value: EngineProfileFields;
  onChange: (value: EngineProfileFields) => void;
  locale: 'zh' | 'en';
}) {
  const requiredAt = useRef(new Date().toISOString()),
    areas = (value.cautions ?? []).filter(area => area !== 'other'),
    keys = painQuestionKeys(areas),
    screen = value.screening;
  if (!areas.length || !screen) return null;
  const prior = screen.redFlagReview,
    answers = prior?.answers ?? {};
  return (
    <fieldset>
      {keys.map(key => (
        <label key={key}>
          {engineCopy('redflag.copy.question_' + key, locale)}
          <select
            value={answers[key] === undefined ? '' : String(answers[key])}
            onChange={event => {
              const next = { ...answers };
              if (event.target.value === '') delete next[key];
              else next[key] = event.target.value === 'true';
              onChange({
                ...value,
                screening: {
                  ...screen,
                  redFlagReview: {
                    requiredAt: prior?.requiredAt ?? requiredAt.current,
                    areas,
                    questionKeys: keys,
                    answers: next,
                    ...(keys.every(item => typeof next[item] === 'boolean')
                      ? { answeredAt: new Date().toISOString() }
                      : {}),
                  },
                },
              });
            }}
          >
            <option value="">—</option>
            <option value="true">{locale === 'zh' ? '是' : 'Yes'}</option>
            <option value="false">{locale === 'zh' ? '否' : 'No'}</option>
          </select>
        </label>
      ))}
    </fieldset>
  );
}
