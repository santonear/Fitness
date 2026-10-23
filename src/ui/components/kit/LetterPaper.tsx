import { useEffect, useId, useRef, useState } from 'react';
// Handwriting faces for the letter only: this module is loaded lazily (kit/index LetterDialog), so the
// font CSS and its unicode-range chunks never reach the first load; browsers fetch only chunks they use.
import 'lxgw-wenkai-webfont/lxgwwenkai-light.css';
import '@fontsource/dancing-script/400.css';
import type { FutureLetter } from '../../../domain/plan-upgrade';
import { letterDateParts, letterWritten } from '../../../domain/future-letter';
import { planPagesCopy } from '../../../i18n/features/plan-upgrade/pages';
import { fill } from '../../../i18n/features/onboarding/entry';
import { corner, side } from './letter-ornaments';
import { PrimaryButton } from './primitives';
import './letter.css';

type Locale = 'zh' | 'en';
/** Chinese text (and any CJK) is written in 霞鹜文楷; other text in Dancing Script. */
const script = (text: string) => (/[\u2e80-\u9fff\uf900-\ufaff]/.test(text) ? 'zh' : 'en');

const positions = ['tl', 'tr', 'bl', 'br'] as const;
/** Parchment sheet with double border, scroll ornaments and dashed ruled lines; every value comes from --letter-* tokens. */
export function LetterPaper({ text, sign, textId }: { text: string; sign: string; textId?: string }) {
  // Plain characters only: the ids are referenced from <use href="#…">.
  const id = `v9-letter${useId().replace(/[^\w-]/g, '')}`,
    cornerId = `${id}-corner`,
    sideId = `${id}-side`;
  return (
    <div className="v9-letter-paper">
      <svg className="v9-letter-defs" aria-hidden="true" focusable="false">
        <defs>
          {(
            [
              [cornerId, corner],
              [sideId, side],
            ] as const
          ).map(([key, shape]) => (
            <symbol key={key} id={key} viewBox={shape.viewBox}>
              <path d={shape.d} />
              {shape.circles.map(([cx, cy, r]) => (
                <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
              ))}
            </symbol>
          ))}
        </defs>
      </svg>
      <div className="v9-letter-border" data-line="outer" aria-hidden="true" />
      <div className="v9-letter-border" data-line="inner" aria-hidden="true" />
      {positions.map(position => (
        <svg
          key={position}
          className="v9-letter-corner"
          data-at={position}
          viewBox={corner.viewBox}
          aria-hidden="true"
          focusable="false"
        >
          <use href={`#${cornerId}`} />
        </svg>
      ))}
      {(['l', 'r'] as const).map(position => (
        <svg
          key={position}
          className="v9-letter-side"
          data-at={position}
          viewBox={side.viewBox}
          aria-hidden="true"
          focusable="false"
        >
          <use href={`#${sideId}`} />
        </svg>
      ))}
      <div className="v9-letter-scroll" tabIndex={0}>
        <div className="v9-letter-sheet">
          <p id={textId} className="v9-letter-text v9-hand" data-script={script(text)}>
            {text}
          </p>
          <p className="v9-letter-sign v9-hand" data-script={script(sign)}>
            {sign}
          </p>
        </div>
      </div>
    </div>
  );
}

export interface LetterDialogProps {
  letter: FutureLetter;
  locale: Locale;
  /** Local date in the profile time zone, and that zone (for the day the letter was written). */
  today: string;
  timeZone: string;
  /** open: 收好这封信 / 稍后再看 (Escape = later). read: a single 关上 (Escape = close). */
  mode: 'open' | 'read';
  onKeep?: () => void;
  onClose: () => void;
  busy?: boolean;
}

/** 未来来信 (Bo 2026-10-23): full-screen letter as a native modal dialog (background inert, focus kept inside, returned on close). */
export default function LetterDialog({
  letter,
  locale,
  today,
  timeZone,
  mode,
  onKeep,
  onClose,
  busy,
}: LetterDialogProps) {
  const c = planPagesCopy[locale];
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId(),
    textId = useId();
  const [ready, setReady] = useState(false);
  const written = letterWritten(letter, today, timeZone);
  const eyebrow = fill(locale === 'en' && written.daysAgo === 1 ? c.letterEyebrowOne : c.letterEyebrow, {
    days: written.daysAgo,
  });
  const sign = fill(c.letterSign, letterDateParts(written.date, locale));
  useEffect(() => {
    const panel = dialog.current;
    if (!panel) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!panel.open) panel.showModal();
    panel.focus({ preventScroll: true });
    // Reveal once the handwriting chunks have arrived (or after a short wait) so the text does not jump fonts.
    let live = true;
    const reveal = () => live && setReady(true);
    const timer = setTimeout(reveal, 1200);
    void document.fonts?.ready.then(reveal, reveal);
    return () => {
      live = false;
      clearTimeout(timer);
      if (panel.open) panel.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="v9-letter-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={textId}
      tabIndex={-1}
      data-ready={ready}
      onCancel={event => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="v9-letter-frame">
        <h2 id={titleId} className="v9-letter-eyebrow">
          {eyebrow}
        </h2>
        <LetterPaper text={letter.text} sign={sign} textId={textId} />
        <div className="v9-letter-actions">
          {mode === 'open' ? (
            <>
              <PrimaryButton disabled={busy} onClick={onKeep}>
                {c.letterKeep}
              </PrimaryButton>
              <PrimaryButton tone="text" size="sm" disabled={busy} onClick={onClose}>
                {c.letterLater}
              </PrimaryButton>
            </>
          ) : (
            <PrimaryButton tone="quiet" onClick={onClose}>
              {c.letterClose}
            </PrimaryButton>
          )}
        </div>
      </div>
    </dialog>
  );
}
