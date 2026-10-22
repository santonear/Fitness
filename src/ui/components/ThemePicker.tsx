import { useRef, type KeyboardEvent } from 'react';
import type { ThemeManifest } from '../../themes/contract';
import { Yaya } from './Yaya';
import './theme-picker.css';

/** Live sample of a theme: the subtree is scoped with data-theme, so it renders with that theme's tokens. */
export function ThemePreview({ theme }: { theme: ThemeManifest }) {
  return (
    <span className="v9-theme-preview" data-theme={theme.id} aria-hidden="true">
      <span className="v9-theme-preview-card">
        <Yaya theme={theme.id} pose="head" size={30} mode="disc" alt="" />
        <span className="v9-theme-preview-lines">
          <i />
          <i />
        </span>
      </span>
      <span className="v9-theme-preview-button" />
    </span>
  );
}

export interface ThemePickerProps {
  themes: readonly ThemeManifest[];
  value: string;
  onChange: (id: string) => void;
  locale: 'zh' | 'en';
  label: string;
}
/** 界面风格 radio group (Pop/Vivid/Gentle/Data/Fire settings screen); switching applies live. */
export function ThemePicker({ themes, value, onChange, locale, label }: ThemePickerProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = Math.max(
    0,
    themes.findIndex(theme => theme.id === value),
  );
  function key(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + themes.length) % themes.length;
    onChange(themes[next].id);
    refs.current[next]?.focus();
  }
  return (
    <div className="v9-theme-picker" role="radiogroup" aria-label={label}>
      {themes.map((theme, index) => {
        const selected = theme.id === value;
        return (
          <button
            key={theme.id}
            ref={element => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={index === selectedIndex ? 0 : -1}
            className="v9-theme-option v8-press"
            onClick={() => onChange(theme.id)}
            onKeyDown={event => key(event, index)}
            aria-label={theme.name[locale]}
            aria-describedby={`theme-${theme.id}-description`}
          >
            <ThemePreview theme={theme} />
            <span className="v9-theme-name">{theme.name[locale]}</span>
            <span className="v9-theme-description" id={`theme-${theme.id}-description`}>
              {theme.description[locale]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
