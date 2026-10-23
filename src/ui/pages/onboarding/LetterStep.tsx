import { useId, useState } from 'react';
import { TEXT_LIMITS, textIssue } from '../../../domain/input-guard';
import { DEFAULT_LETTER_WAIT_DAYS, LETTER_WAIT_DAYS, letterDateRange } from '../../../domain/future-letter';
import { addDays, DEFAULT_TIME_ZONE, isLocalDate, todayIn } from '../../../domain/local-date';
import { saveFutureLetter } from '../../../persistence/plan-upgrade-store';
import { planPagesCopy } from '../../../i18n/features/plan-upgrade/pages';
import { fill } from '../../../i18n/features/onboarding/entry';
import { FieldIssue } from '../../components/common/FieldIssue';
import { ChoiceChip, PrimaryButton } from '../../components/kit';
import { OnboardingFrame } from './OnboardingFrame';
import '../plan-upgrade/plan-upgrade.css';

/** 给未来的自己 (Bo 2026-10-22): optional last step after a plan is confirmed, in onboarding and when making a new plan. Kept on this device.
 * 几天后打开 (Bo 2026-10-23): the letter opens on 今天 after 3, 7 (default) or 30 days, or on a picked date within a year. */
export function LetterStep({
  locale,
  timeZone = DEFAULT_TIME_ZONE,
  onDone,
}: {
  locale: 'zh' | 'en';
  timeZone?: string;
  onDone: () => void;
}) {
  const c = planPagesCopy[locale];
  const today = todayIn(timeZone),
    range = letterDateRange(today);
  const [text, setText] = useState('');
  const [wait, setWait] = useState<number | 'date'>(DEFAULT_LETTER_WAIT_DAYS);
  const [picked, setPicked] = useState(addDays(today, DEFAULT_LETTER_WAIT_DAYS));
  const [saving, setSaving] = useState(false);
  const openId = useId();
  const issue = textIssue(text, TEXT_LIMITS.long);
  const openOn = wait === 'date' ? picked : addDays(today, wait);
  // Input values compare as YYYY-MM-DD strings; an emptied or out-of-range picker keeps 收好 disabled.
  const dateValid = isLocalDate(openOn) && openOn >= range.min && openOn <= range.max;
  const save = async () => {
    setSaving(true);
    try {
      await saveFutureLetter(text.trim(), undefined, openOn);
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
          <PrimaryButton disabled={saving || !text.trim() || !!issue || !dateValid} onClick={() => void save()}>
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
      <div className="pu-field" role="group" aria-labelledby={openId}>
        <span id={openId}>{c.letterOpenIn}</span>
        <div className="pu-row">
          {LETTER_WAIT_DAYS.map(days => (
            <ChoiceChip key={days} size="sm" selected={wait === days} onClick={() => setWait(days)}>
              {fill(c.letterDays, { days })}
            </ChoiceChip>
          ))}
          <ChoiceChip size="sm" selected={wait === 'date'} onClick={() => setWait('date')}>
            {c.letterPickDate}
          </ChoiceChip>
        </div>
        {wait === 'date' && (
          <input
            type="date"
            aria-label={c.letterPickDate}
            min={range.min}
            max={range.max}
            value={picked}
            aria-invalid={dateValid ? undefined : true}
            onChange={event => setPicked(event.currentTarget.value)}
          />
        )}
      </div>
    </OnboardingFrame>
  );
}
