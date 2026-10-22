import { useState } from 'react';
import { cautionJoints, type CautionJoint, type CautionLevels } from '../../../application/caution-safety';
import { painQuestionKeys } from '../../../application/pain-events';
import { DATA } from '../../../engine/data';
import { engineCopy } from '../../../coach/engine-copy';
import { Button } from '../../components/common';
interface CautionSettingsPanelProps {
  locale: 'zh' | 'en';
  busy?: boolean;
  levels: CautionLevels;
  activeJoints?: readonly CautionJoint[];
  onReview: (input: {
    joint: CautionJoint;
    level: 0 | 1;
    answers: Record<string, boolean>;
    requestedAt: string;
  }) => unknown;
}
/** Settings-only explanation explicitly approved by the user; never emitted as a plan notice. */
export const cautionSettingsExplanation = {
  zh: '本版本不会自动恢复动作幅度或箱高；身体感觉好转后，可以在设置里取消该部位的注意标记。',
  en: 'This version doesn’t automatically restore range of motion or box height. When you feel better, you can turn off the caution for that area in Settings.',
};
export function CautionSettingsPanel({ locale, busy, levels, activeJoints = [], onReview }: CautionSettingsPanelProps) {
  const [attempt, setAttempt] = useState<{ joint: CautionJoint; level: 0 | 1; requestedAt: string }>(),
    [answers, setAnswers] = useState<Record<string, boolean>>({}),
    source = DATA.rules.find(rule => rule.id === 'caution.activation')!.value!,
    keys = attempt ? painQuestionKeys([attempt.joint]) : [];
  return (
    <section>
      <p>{cautionSettingsExplanation[locale]}</p>
      {cautionJoints.map(joint => (
        <label key={joint}>
          <input
            type="checkbox"
            checked={(levels[joint]?.level ?? (activeJoints.includes(joint) ? 1 : 0)) > 0}
            disabled={busy || levels[joint]?.level === 2}
            onChange={event => {
              setAttempt({ joint, level: event.target.checked ? 1 : 0, requestedAt: new Date().toISOString() });
              setAnswers({});
            }}
          />
          {source[locale === 'zh' ? 'ui_label_zh' : 'ui_label_en'][joint]}
        </label>
      ))}
      {attempt && (
        <fieldset disabled={busy}>
          {keys.map(key => (
            <label key={key}>
              {engineCopy('redflag.copy.question_' + key, locale)}
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
                <option value="true">{locale === 'zh' ? '是' : 'Yes'}</option>
                <option value="false">{locale === 'zh' ? '否' : 'No'}</option>
              </select>
            </label>
          ))}
          <Button
            disabled={!Object.values(answers).some(Boolean) && !keys.every(key => typeof answers[key] === 'boolean')}
            onClick={() => onReview({ ...attempt, answers })}
          >
            {locale === 'zh' ? '确认' : 'Confirm'}
          </Button>
        </fieldset>
      )}
    </section>
  );
}
