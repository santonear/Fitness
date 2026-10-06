import { useRef } from 'react';
import type { GuidedLocale } from './GuidedOnboarding';

export function adjustGuidedNumber(value: number, direction: number, min: number, max: number, step: number) {
  return Math.min(max, Math.max(min, Math.round((value + direction * step) * 10) / 10));
}
export interface NumericWheelProps {
  locale: GuidedLocale;
  label: string;
  value: number | '';
  sample: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  disabled?: boolean;
  onChange: (value: number | '') => void;
}
export function NumericWheel({ locale, label, value, sample, min, max, step, unit, disabled = false, onChange }: NumericWheelProps) {
  const drag = useRef<number | null>(null);
  const t = (zh: string, en: string) => locale === 'en' ? en : zh;
  const displayed = value === '' ? sample : value;
  const change = (direction: number) => { if (!disabled) onChange(adjustGuidedNumber(displayed, direction, min, max, step)); };
  return <>
    <div className="guided-wheel" role="spinbutton" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={displayed} aria-valuetext={`${displayed} ${unit}${value === '' ? t('，示例，未确认', ', sample, unconfirmed') : ''}`}
      onWheel={event => { if (event.deltaY) change(event.deltaY > 0 ? 1 : -1); }}
      onKeyDown={event => { if (disabled) return; if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) { event.preventDefault(); if (event.key === 'Home') onChange(min); else if (event.key === 'End') onChange(max); else change(event.key === 'ArrowUp' ? 1 : -1); } }}
      onPointerDown={event => { if (disabled || (event.target instanceof HTMLElement && event.target.closest('button'))) return; drag.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { if (drag.current !== null && Math.abs(event.clientY - drag.current) >= 20) { change(event.clientY < drag.current ? 1 : -1); drag.current = event.clientY; } }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <div className="guided-wheel-track" aria-hidden="true">{[-2,-1,0,1,2].map(offset => {
        const item = Math.round((displayed + offset * step) * 10) / 10;
        return <span key={offset} className={offset === 0 ? 'guided-wheel-value' : 'guided-wheel-neighbor'} data-distance={Math.abs(offset)}>{item >= min && item <= max ? item : '—'}{offset === 0 && <small>{unit}</small>}</span>;
      })}</div>
      <div className="guided-wheel-controls"><button type="button" disabled={disabled} aria-label={t('减小', 'decrease')} onClick={() => change(-1)}>↑</button>
      <button type="button" disabled={disabled} aria-label={t('增大', 'increase')} onClick={() => change(1)}>↓</button></div>
    </div>
    <details className="guided-number-alternative"><summary>{t('直接输入数值', 'enter a value instead')}</summary><label className="guided-number-label">{label}<input aria-label={label} type="number" min={min} max={max} step={step} value={value} disabled={disabled} placeholder={String(sample)} onChange={event => onChange(event.target.value === '' ? '' : Number(event.target.value))} /></label></details>
  </>;
}
