import { useTimerCue } from '../useRestVibration';
import { useState, useEffect } from 'react';
import { getExerciseGuide } from '../../../../catalog/exercise-guide';

/** Upper bounds for one logged set; larger values are typing mistakes. */
export const SET_LIMITS = { reps: 500, seconds: 7200, meters: 100000, kg: 500 } as const;
export type Panel = 'pause' | 'edit' | 'swap' | 'safety';

/** Wall clock that ticks only while a countdown is on screen; nothing else re-renders. */
export function useNow(ticking: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!ticking) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [ticking]);
  return now;
}
/** Rests the user already left stay closed after a reload in this tab (a per-tab convenience, not a fact). */
export const closedRestKey = 'fitness.v9.closed-rests';
export function readClosedRests(): string[] {
  try {
    const value = JSON.parse(sessionStorage.getItem(closedRestKey) ?? '[]');
    return Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
  } catch {
    return [];
  }
}
/** Fires the end cue for one countdown; rendered only while that countdown is on screen. */
export function CueAt({ dueAt, active }: { dueAt?: number; active: boolean }) {
  useTimerCue(dueAt, active);
  return null;
}
export const Icon = ({ d }: { d: string }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d={d} />
  </svg>
);

/** Demonstration image from the exercise library (same media as 动作库); written key points when none exists. */
export function ExerciseMediaHero({
  id,
  locale,
  label,
  noMedia,
  onOpen,
}: {
  id: string;
  locale: 'zh' | 'en';
  label: string;
  noMedia: string;
  onOpen: (trigger: HTMLElement) => void;
}) {
  const guide = getExerciseGuide(id, locale),
    [failed, setFailed] = useState<string>();
  const media =
    guide.media && guide.media.attribution !== 'Fitness original movement-pattern symbol' && failed !== guide.media.src
      ? guide.media
      : undefined;
  return (
    <button
      type="button"
      className="exercise-guide-open wk-media"
      aria-label={label}
      onClick={event => onOpen(event.currentTarget)}
    >
      {media ? (
        <img src={media.src} alt={media.alt} onError={() => setFailed(media.src)} />
      ) : (
        <span className="wk-media-empty">{noMedia}</span>
      )}
    </button>
  );
}
