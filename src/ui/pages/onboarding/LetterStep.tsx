import { useState } from 'react';
import { TEXT_LIMITS, textIssue } from '../../../domain/input-guard';
import { saveFutureLetter } from '../../../persistence/plan-upgrade-store';
import { planPagesCopy } from '../../../i18n/features/plan-upgrade/pages';
import { FieldIssue } from '../../components/common/FieldIssue';
import { PrimaryButton } from '../../components/kit';
import { OnboardingFrame } from './OnboardingFrame';
import '../plan-upgrade/plan-upgrade.css';

/** 给未来的自己 (Bo 2026-10-22): optional last step after a plan is confirmed, in onboarding and when making a new plan. Kept on this device. */
export function LetterStep({ locale, onDone }: { locale: 'zh' | 'en'; onDone: () => void }) {
  const c = planPagesCopy[locale];
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const issue = textIssue(text, TEXT_LIMITS.long);
  const save = async () => {
    setSaving(true);
    try {
      await saveFutureLetter(text.trim());
      onDone();
    } finally {
      setSaving(false);
    }
  };
  return (
    <OnboardingFrame
      locale={locale}
      step={1}
      total={1}
      screenKey="letter"
      title={c.letterTitle}
      sub={c.letterHint}
      busy={saving}
      footer={
        <>
          <PrimaryButton disabled={saving || !text.trim() || !!issue} onClick={() => void save()}>
            {c.letterSave}
          </PrimaryButton>
          <PrimaryButton tone="quiet" disabled={saving} onClick={onDone}>
            {c.letterSkip}
          </PrimaryButton>
        </>
      }
    >
      <label className="pu-field">
        <textarea
          aria-label={c.letterTitle}
          rows={5}
          maxLength={TEXT_LIMITS.long}
          placeholder={c.letterPlaceholder}
          value={text}
          aria-invalid={issue ? true : undefined}
          onChange={event => setText(event.target.value)}
        />
        <FieldIssue issue={issue} locale={locale} max={TEXT_LIMITS.long} />
      </label>
    </OnboardingFrame>
  );
}
