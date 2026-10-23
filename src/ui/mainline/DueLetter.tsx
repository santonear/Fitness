import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { nextDueLetter } from '../../domain/future-letter';
import { DEFAULT_TIME_ZONE, todayIn } from '../../domain/local-date';
import type { FutureLetter } from '../../domain/plan-upgrade';
import { listFutureLetters, markLetterOpened } from '../../persistence/plan-upgrade-store';
import { LetterDialog } from '../components/kit';
import { useMainline } from './context';

/** 未来来信 (Bo 2026-10-23): on 今天, outside a workout and onboarding, the oldest due letter opens full screen.
 * 稍后再看 hides it until the app is opened again (kept in memory only). */
export function DueLetter() {
  const c = useMainline(),
    { pathname } = useLocation();
  const [letters, setLetters] = useState<FutureLetter[]>();
  const [later, setLater] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const training = c.data?.workouts.some(workout => workout.status === 'in_progress');
  const eligible = pathname === '/' && !!c.data?.version && !training && !c.coachOpen;
  useEffect(() => {
    if (!eligible) return;
    let live = true;
    listFutureLetters().then(
      rows => live && setLetters(rows),
      () => live && setLetters([]),
    );
    return () => {
      live = false;
    };
  }, [eligible]);
  if (!eligible || !letters) return null;
  const timeZone = c.data?.profile?.timeZone ?? DEFAULT_TIME_ZONE,
    today = todayIn(timeZone);
  const letter = nextDueLetter(letters, today, later);
  if (!letter) return null;
  const keep = async () => {
    setBusy(true);
    try {
      await markLetterOpened(letter.id);
      setLetters(await listFutureLetters());
    } catch {
      // Not saved: treat as 稍后再看 so the letter comes back next time instead of blocking 今天.
      setLater(new Set([...later, letter.id]));
    } finally {
      setBusy(false);
    }
  };
  return (
    <LetterDialog
      key={letter.id}
      letter={letter}
      locale={c.locale}
      today={today}
      timeZone={timeZone}
      mode="open"
      busy={busy}
      onKeep={() => void keep()}
      onClose={() => setLater(new Set([...later, letter.id]))}
    />
  );
}
