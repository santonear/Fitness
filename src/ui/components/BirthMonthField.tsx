import { useEffect, useId, useState } from 'react';
import { birthPickerCopy } from '../../i18n/features/plan/training-days';
import { fill } from '../../i18n/features/onboarding/entry';
import { ChoiceChip, PrimaryButton } from './kit';
import './training-calendar.css';

interface BirthMonthFieldProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  locale: 'zh' | 'en';
  disabled?: boolean;
}

const pad = (month: number) => String(month).padStart(2, '0');
const monthName = (month: number, locale: 'zh' | 'en', long = false) => locale === 'zh' ? `${month} 月` : new Date(2000, month - 1, 1).toLocaleString('en', { month: long ? 'long' : 'short' });

/**
 * Birth year and month, two ways (Bo 2026-10-19): tap a month on a year page (‹ › move one year, the year
 * button opens a 12-year grid to jump decades), or type the year and choose the month.
 */
export function BirthMonthField({ value, onChange, locale, disabled }: BirthMonthFieldProps) {
  const [mode, setMode] = useState<'pick' | 'manual'>('pick');
  const t = birthPickerCopy[locale];
  return <span className="v9-birth">
    <span className="v9-chip-row" role="group" aria-label={t.mode}>
      <ChoiceChip size="sm" selected={mode === 'pick'} disabled={disabled} onClick={() => setMode('pick')}>{t.pick}</ChoiceChip>
      <ChoiceChip size="sm" selected={mode === 'manual'} disabled={disabled} onClick={() => setMode('manual')}>{t.manual}</ChoiceChip>
    </span>
    {mode === 'pick' ? <BirthMonthPicker value={value} onChange={onChange} locale={locale} disabled={disabled} /> : <BirthMonthTyped value={value} onChange={onChange} locale={locale} disabled={disabled} />}
  </span>;
}

function BirthMonthPicker({ value, onChange, locale, disabled }: BirthMonthFieldProps) {
  const t = birthPickerCopy[locale], maxYear = new Date().getFullYear(), minYear = maxYear - 110;
  const valueYear = value ? Number(value.slice(0, 4)) : undefined, valueMonth = value ? Number(value.slice(5, 7)) : undefined;
  const [year, setYear] = useState(valueYear ?? maxYear - 30);
  const [yearsOpen, setYearsOpen] = useState(false);
  const [pageStart, setPageStart] = useState(() => (valueYear ?? maxYear - 30) - ((valueYear ?? maxYear - 30) % 12));
  useEffect(() => { if (valueYear) setYear(valueYear); }, [valueYear]);
  const clamp = (next: number) => Math.min(maxYear, Math.max(minYear, next));
  const years = Array.from({ length: 12 }, (_, index) => pageStart + index).filter(item => item >= minYear && item <= maxYear);
  return <span className="v9-birth-pick">
    <span className="v9-birth-head">
      <PrimaryButton tone="quiet" size="sm" aria-label={yearsOpen ? t.prevYears : t.prevYear} disabled={disabled || (yearsOpen ? pageStart <= minYear : year <= minYear)}
        onClick={() => yearsOpen ? setPageStart(pageStart - 12) : setYear(clamp(year - 1))}><span aria-hidden="true">‹</span></PrimaryButton>
      <PrimaryButton tone="text" size="sm" aria-expanded={yearsOpen} disabled={disabled} className="v9-num"
        onClick={() => { setPageStart(year - (year % 12)); setYearsOpen(!yearsOpen); }}>{yearsOpen ? `${years[0]}–${years.at(-1)}` : fill(t.yearUnit, { year })}</PrimaryButton>
      <PrimaryButton tone="quiet" size="sm" aria-label={yearsOpen ? t.nextYears : t.nextYear} disabled={disabled || (yearsOpen ? pageStart + 12 > maxYear : year >= maxYear)}
        onClick={() => yearsOpen ? setPageStart(pageStart + 12) : setYear(clamp(year + 1))}><span aria-hidden="true">›</span></PrimaryButton>
    </span>
    {yearsOpen
      ? <ul className="v9-birth-grid" aria-label={t.years}>{years.map(item => <li key={item}><ChoiceChip size="sm" className="v9-num" selected={item === year} disabled={disabled}
        onClick={() => { setYear(item); setYearsOpen(false); }}>{fill(t.yearUnit, { year: item })}</ChoiceChip></li>)}</ul>
      : <ul className="v9-birth-grid" aria-label={fill(t.yearUnit, { year })}>{Array.from({ length: 12 }, (_, index) => index + 1).map(month => <li key={month}>
        <ChoiceChip size="sm" selected={valueYear === year && valueMonth === month} disabled={disabled} aria-label={`${fill(t.yearUnit, { year })} ${monthName(month, locale, true)}`}
          onClick={() => onChange(`${year}-${pad(month)}`)}>{monthName(month, locale)}</ChoiceChip></li>)}</ul>}
    <span className="v9-birth-chosen" role="status">{valueYear && valueMonth ? fill(t.chosen, { year: valueYear, month: locale === 'zh' ? valueMonth : monthName(valueMonth, locale, true) }) : t.none}</span>
  </span>;
}

/** Year typed as four digits plus a month list, so an older birth year needs no long scrolling. */
function BirthMonthTyped({ value, onChange, locale, disabled }: BirthMonthFieldProps) {
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
