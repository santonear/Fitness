import type { Caution, PainSide } from '../../../engine/contracts';
import { painQuestionKeys } from '../../../application/pain-events';
import { engineCopy } from '../../../coach/engine-copy';
import { PainCheckinPanel } from './PainCheckinPanel';

export interface JointPainCheckinDraft {
  painScore?: number;
  painArea?: Caution;
  painSide?: PainSide;
  redFlagAnswers?: Record<string, boolean>;
}
/** A partial answer is a draft, never an implicit negative screening result. */
export function JointPainCheckinFields({
  value,
  onChange,
  locale,
  disabled,
  sex,
  areaLocked,
}: {
  value: JointPainCheckinDraft;
  onChange: (value: JointPainCheckinDraft) => void;
  locale: 'zh' | 'en';
  disabled: boolean;
  sex?: 'male' | 'female';
  /** The area came from a follow-up answer. */
  areaLocked?: boolean;
}) {
  const questions = (value.painArea ? painQuestionKeys([value.painArea]) : []).map(key => ({
    key,
    label: engineCopy(`redflag.copy.question_${key}`, locale),
  }));
  return (
    <PainCheckinPanel
      locale={locale}
      sex={sex}
      value={value}
      areaLocked={areaLocked}
      disabled={disabled}
      onChange={next =>
        onChange({
          ...value,
          ...next,
          ...(next.painArea !== value.painArea ? { redFlagAnswers: undefined } : {}),
          ...(next.painSide === undefined ? { painSide: undefined } : {}),
        })
      }
      questions={questions}
      answers={value.redFlagAnswers}
      onAnswer={(key, answer) => {
        const answers = { ...value.redFlagAnswers };
        if (answer === undefined) delete answers[key];
        else answers[key] = answer;
        onChange({ ...value, redFlagAnswers: answers });
      }}
    />
  );
}
