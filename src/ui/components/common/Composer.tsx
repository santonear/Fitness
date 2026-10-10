import { useId, useRef } from 'react';

export type ComposerProps = {
  value: string; onChange: (value: string) => void; onSend: (value: string) => void;
  label?: string; sendLabel?: string; disabled?: boolean; busy?: boolean;
};
export function Composer({ value, onChange, onSend, label = '跟芽芽说', sendLabel = '发送', disabled = false, busy = false }: ComposerProps) {
  const id = useId();
  const composing = useRef(false);
  return <form className="v8-composer" aria-busy={busy} onSubmit={event => {
    event.preventDefault();
    if (!disabled && !busy && !composing.current && value.trim()) onSend(value.trim());
  }}>
    <label className="v8-composer-label" htmlFor={id}>{label}</label>
    <input id={id} value={value} placeholder={label} disabled={disabled || busy}
      onChange={event => onChange(event.target.value)}
      onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
      onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || composing.current)) event.preventDefault(); }} />
    <button className="v8-control v8-press v8-button-primary" type="submit" disabled={disabled || busy || !value.trim()}>{sendLabel}</button>
  </form>;
}
