import { useEffect, useId, useState } from 'react';

interface BirthMonthFieldProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  locale: 'zh' | 'en';
  disabled?: boolean;
}

const pad = (month: number) => String(month).padStart(2, '0');

/** Year typed as four digits plus a month list, so an older birth year needs no long scrolling. */
export function BirthMonthField({ value, onChange, locale, disabled }: BirthMonthFieldProps) {
  const zh = locale === 'zh', id = useId();
  const [year, setYear] = useState(value?.slice(0, 4) ?? '');
  const [month, setMonth] = useState(value?.slice(5, 7) ?? '');
  // Only follow outside values; a half-typed year emits undefined and must not be wiped.
  useEffect(() => { if (value) { setYear(value.slice(0, 4)); setMonth(value.slice(5, 7)); } }, [value]);
  const maxYear = new Date().getFullYear(), minYear = maxYear - 110;
  const emit = (nextYear: string, nextMonth: string) => {
    const y = Number(nextYear);
    onChange(/^\d{4}$/.test(nextYear) && y >= minYear && y <= maxYear && nextMonth ? `${nextYear}-${nextMonth}` : undefined);
  };
  return <span className="v9-birth-month">
    <span className="v9-birth-part">
      <label htmlFor={`${id}-year`}>{zh ? '出生年份' : 'Birth year'}</label>
      <input id={`${id}-year`} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete="bday-year"
        placeholder={zh ? '例如 1990' : 'e.g. 1990'} value={year} disabled={disabled}
        onChange={event => { const next = event.target.value.replace(/\D/g, '').slice(0, 4); setYear(next); emit(next, month); }} />
    </span>
    <span className="v9-birth-part">
      <label htmlFor={`${id}-month`}>{zh ? '月份' : 'Month'}</label>
      <select id={`${id}-month`} value={month} disabled={disabled} autoComplete="bday-month"
        onChange={event => { setMonth(event.target.value); emit(year, event.target.value); }}>
        <option value="">{zh ? '选择月份' : 'Choose month'}</option>
        {Array.from({ length: 12 }, (_, index) => <option key={index} value={pad(index + 1)}>{zh ? `${index + 1} 月` : new Date(2000, index, 1).toLocaleString('en', { month: 'long' })}</option>)}
      </select>
    </span>
  </span>;
}
