import type { Caution } from '../../../engine/contracts';
import { painQuestionKeys } from '../../../application/pain-events';
import { engineCopy } from '../../../coach/engine-copy';
import { engineTrainingCopy } from '../../../i18n/features/training/engine';
import { Chip } from '../../components/common';

export interface JointPainCheckinDraft {
  painScore?: number;
  painArea?: Caution;
  redFlagAnswers?: Record<string, boolean>;
}
/** A partial answer is a draft, never an implicit negative screening result. */
export function JointPainCheckinFields({
  value,
  onChange,
  locale,
  disabled,
}: {
  value: JointPainCheckinDraft;
  onChange: (value: JointPainCheckinDraft) => void;
  locale: 'zh' | 'en';
  disabled: boolean;
}) {
  const t = engineTrainingCopy[locale],
    questions = value.painArea ? painQuestionKeys([value.painArea]) : [];
  return (
    <fieldset disabled={disabled}>
      <label>
        {t.painScore}
        <input
          type="number"
          min="0"
          max="10"
          step="1"
          value={value.painScore ?? ''}
          onChange={event => {
            const number = event.target.value === '' ? undefined : event.target.valueAsNumber;
            onChange({
              ...value,
              painScore:
                number !== undefined && Number.isInteger(number) && number >= 0 && number <= 10 ? number : undefined,
            });
          }}
        />
      </label>
      <label>
        {t.area}
        <select
          value={value.painArea ?? ''}
          onChange={event =>
            onChange({ ...value, painArea: (event.target.value as Caution) || undefined, redFlagAnswers: undefined })
          }
        >
          <option value="">{t.choose}</option>
          {(['knee', 'back', 'shoulder', 'wrist', 'other'] as const).map((area, index) => (
            <option key={area} value={area}>
              {t.areas[index]}
            </option>
          ))}
        </select>
      </label>
      {questions.map(key => (
        <fieldset key={key}>
          <legend>{engineCopy(`redflag.copy.question_${key}`, locale)}</legend>
          {([true, false] as const).map(answer => (
            <Chip
              key={String(answer)}
              selected={value.redFlagAnswers?.[key] === answer}
              onClick={() => {
                const answers = { ...value.redFlagAnswers };
                if (answers[key] === answer) delete answers[key];
                else answers[key] = answer;
                onChange({ ...value, redFlagAnswers: answers });
              }}
            >
              {locale === 'zh' ? (answer ? '是' : '否') : answer ? 'Yes' : 'No'}
            </Chip>
          ))}
        </fieldset>
      ))}
    </fieldset>
  );
}
