import { useEffect } from 'react';
export const restVibrationKey = 'fitness.rest-vibration';
export function useRestVibration(lastCompletedAt: string | undefined, active: boolean) {
 useEffect(() => {
  if (!active || !lastCompletedAt || typeof navigator.vibrate !== 'function') return;
  const due = Date.parse(lastCompletedAt) + 90_000;
  if (!Number.isFinite(due) || due <= Date.now()) return;
  const timer = window.setTimeout(() => {
   try { if (localStorage.getItem(restVibrationKey) === 'on' && document.visibilityState === 'visible' && document.hasFocus()) navigator.vibrate(30); }
   catch { /* Device preference unavailable: remain quiet. */ }
  }, due - Date.now());
  return () => window.clearTimeout(timer);
 }, [lastCompletedAt, active]);
}
