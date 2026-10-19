import { useEffect } from 'react';
/** Device preference (Settings): one short vibration when a workout timer ends. Off by default. */
export const restVibrationKey = 'fitness.rest-vibration';
/** Device preference: a short tone when a workout timer ends. Off by default; no toggle ships yet (see pending decisions). */
export const timerSoundKey = 'fitness.timer-sound';

const enabled = (key: string) => { try { return localStorage.getItem(key) === 'on'; } catch { return false; } };
function tone() {
  const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return;
  const context = new Context(), oscillator = context.createOscillator(), gain = context.createGain();
  oscillator.frequency.value = 880; gain.gain.value = 0.08;
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(); oscillator.stop(context.currentTime + 0.18);
  oscillator.onended = () => void context.close();
}
/** End cue for a countdown: respects the device preferences and only plays while the page is in front. */
export function playTimerCue() {
  try {
    if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
    if (enabled(restVibrationKey) && typeof navigator.vibrate === 'function') navigator.vibrate(30);
    if (enabled(timerSoundKey)) tone();
  } catch { /* Device feature unavailable: remain quiet. */ }
}
/**
 * Fires the end cue once at `dueAt` (epoch ms) while `active`. A pause clears the pending cue and a
 * due time already in the past never "catches up", so returning to the page never buzzes late.
 */
export function useTimerCue(dueAt: number | undefined, active: boolean) {
  useEffect(() => {
    if (!active || dueAt === undefined || !Number.isFinite(dueAt) || dueAt <= Date.now()) return;
    const timer = window.setTimeout(playTimerCue, dueAt - Date.now());
    return () => window.clearTimeout(timer);
  }, [dueAt, active]);
}
