import { Rules } from '../../../engine/data';
import { engineCopy } from '../../../coach/engine-copy';
import { ChoiceRow } from '../../components/kit';
export function cmrAnswerSummary(answers: Record<string, boolean>) {
  const keys = new Rules().get('safety.screen.cmr_symptoms').symptoms as string[];
  return {
    complete: keys.every(key => typeof answers[key] === 'boolean'),
    symptoms: keys.some(key => answers[key] === true),
  };
}
/** Each missing answer stays unknown; selecting No is an explicit answer. */
export function CmrSymptomsQuestions({
  answers,
  onChange,
  locale,
}: {
  answers: Record<string, boolean>;
  onChange: (answers: Record<string, boolean>) => void;
  locale: 'zh' | 'en';
}) {
  const keys = new Rules().get('safety.screen.cmr_symptoms').symptoms as string[];
  return (
    <>
      {keys.map(key => (
        <ChoiceRow
          key={key}
          label={engineCopy(`safety.copy.cmr_${key}`, locale)}
          options={[
            [false, locale === 'zh' ? '否' : 'No'],
            [true, locale === 'zh' ? '是' : 'Yes'],
          ]}
          value={answers[key]}
          onPick={answer => {
            if (answer !== undefined) onChange({ ...answers, [key]: answer });
          }}
        />
      ))}
    </>
  );
}
