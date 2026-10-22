import { useId, useState } from 'react';
import { trainingDaysCopy } from '../../i18n/features/plan/training-days';
import { ChoiceChip } from './kit';
import './training-calendar.css';

/** After the days are picked: a rough start time (three common times, or any time typed). Optional. */
export function StartTimeField({
  locale,
  value,
  onChange,
  disabled = false,
}: {
  locale: 'zh' | 'en';
  value?: string;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
}) {
  const t = trainingDaysCopy[locale].time,
    id = useId();
  const preset = t.presets.some(([time]) => time === value);
  const [other, setOther] = useState(!!value && !preset);
  return (
    <div className="v9-group v9-days-time" role="group" aria-labelledby={`${id}-title`}>
      <span id={`${id}-title`} className="v9-group-label">
        {t.title}
      </span>
      <span className="v9-days-hint">{t.sub}</span>
      <div className="v9-chip-row">
        {t.presets.map(([time, label]) => (
          <ChoiceChip
            key={time}
            size="sm"
            selected={!other && value === time}
            disabled={disabled}
            onClick={() => {
              setOther(false);
              onChange(value === time ? undefined : time);
            }}
          >
            {label}
          </ChoiceChip>
        ))}
        <ChoiceChip
          size="sm"
          selected={other}
          aria-expanded={other}
          disabled={disabled}
          onClick={() => {
            setOther(!other);
            if (other || preset) onChange(undefined);
          }}
        >
          {t.other}
        </ChoiceChip>
      </div>
      {other && (
        <label className="v9-field">
          {t.label}
          <input
            type="time"
            value={value ?? ''}
            disabled={disabled}
            onChange={event => onChange(/^\d{2}:\d{2}$/.test(event.target.value) ? event.target.value : undefined)}
          />
        </label>
      )}
    </div>
  );
}
