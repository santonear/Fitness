import { useId, useRef } from 'react';
import { TEXT_LIMITS, cleanText, textIssue } from '../../../domain/input-guard';
import { FieldIssue } from './FieldIssue';

export type ComposerProps = {
  value: string; onChange: (value: string) => void; onSend: (value: string) => void;
  label?: string; sendLabel?: string; disabled?: boolean; busy?: boolean; locale?: 'zh' | 'en'; maxLength?: number;
};
export function Composer({ value, onChange, onSend, label = '跟芽芽说', sendLabel = '发送', disabled = false, busy = false, locale = 'zh', maxLength = TEXT_LIMITS.chat }: ComposerProps) {
  const id = useId();
  const composing = useRef(false);
  const issue = textIssue(value, maxLength);
  return <form className="v8-composer" aria-busy={busy} onSubmit={event => {
    event.preventDefault();
    if (!disabled && !busy && !composing.current && !issue && cleanText(value)) onSend(cleanText(value));
  }}>
    <label className="v8-composer-label" htmlFor={id}>{label}</label>
    <input id={id} value={value} placeholder={label} disabled={disabled || busy} maxLength={maxLength}
      aria-invalid={issue ? true : undefined} aria-describedby={issue ? `${id}-issue` : undefined}
      onChange={event => onChange(event.target.value)}
      onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
      onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || composing.current)) event.preventDefault(); }} />
    <button className="v8-control v8-press v8-button-primary" type="submit" disabled={disabled || busy || !cleanText(value) || !!issue}>{sendLabel}</button>
    <FieldIssue id={`${id}-issue`} issue={issue} locale={locale} max={maxLength} />
  </form>;
}
