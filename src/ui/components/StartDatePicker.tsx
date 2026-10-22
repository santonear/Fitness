import { useId } from 'react';
import { startDateLabel, startDateOptions } from '../../application/plan-presentation';
import { startDateCopy } from '../../i18n/features/plan/start-date';
import { ChoiceChip } from './kit';
import './start-date.css';

/** Today plus the next two weeks as tap targets; the chosen day is the plan's start date. */
export function StartDatePicker({
  value,
  today,
  onChange,
  locale,
  disabled = false,
}: {
  value: string;
  today: string;
  onChange: (date: string) => void;
  locale: 'zh' | 'en';
  disabled?: boolean;
}) {
  const t = startDateCopy[locale],
    id = useId();
  return (
    <div className="v9-start-date" role="group" aria-labelledby={`${id}-label`} aria-describedby={`${id}-hint`}>
      <span id={`${id}-label`} className="v9-start-date-label">
        {t.label}
      </span>
      <span id={`${id}-hint`} className="v9-start-date-hint">
        {t.hint}
      </span>
      <div className="v9-start-date-row">
        {startDateOptions(today).map(date => (
          <ChoiceChip
            key={date}
            size="sm"
            selected={date === value}
            disabled={disabled}
            data-date={date}
            onClick={() => onChange(date)}
          >
            {startDateLabel(date, today, locale)}
          </ChoiceChip>
        ))}
      </div>
    </div>
  );
}
