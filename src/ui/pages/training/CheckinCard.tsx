import { useState } from 'react';
import type { WorkoutRecord } from '../../../domain/v8/contracts';
import { homeCopy } from '../../../i18n/features/home/copy';
import { Card } from '../../components/kit';
import { useMainline } from '../../mainline/context';
import { useFeature } from '../../useFeature';
import { CautionMorningControls, cautionMorningDue } from './CautionMorningControls';
import { PreTrainingCheckin } from './PreTrainingCheckin';
import './checkin.css';

/** The last finished session logged pain or discomfort. */
export function lastSessionHurt(workouts: readonly WorkoutRecord[]) {
  const last = workouts
    .filter(w => (w.status === 'complete' || w.status === 'partial') && w.endedAt)
    .sort((a, b) => Date.parse(b.endedAt!) - Date.parse(a.endedAt!))[0];
  return (
    !!last &&
    (!!last.painActions?.length ||
      !!last.setFeedbackEvents?.some(event => (event.painScore ?? 0) > 0 || event.effort === 'discomfort'))
  );
}

/**
 * 练之前，看看状态 (Bo 2026-10-26): folded and optional by default; it opens by itself when the last session
 * logged pain or a caution joint's next-morning question is due.
 */
export function CheckinCard() {
  const { data, locale } = useMainline(),
    engine = useFeature('trainingEngine');
  const due = data ? cautionMorningDue(data).length > 0 : false,
    asks = engine && !data?.active;
  const [open, setOpen] = useState(() => due || lastSessionHurt(data?.workouts ?? []));
  if (!data?.state?.coachProfile?.healthStorageConsent || !(asks || due)) return null;
  const h = homeCopy[locale];
  return (
    <Card variant="raised" padding="md" as="section" className="v9-checkin" aria-label={h.checkin}>
      <details open={open} onToggle={event => setOpen(event.currentTarget.open)}>
        <summary>
          <h2>{h.checkin}</h2>
          <span>{h.checkinSkip}</span>
        </summary>
        <CautionMorningControls />
        <PreTrainingCheckin />
      </details>
    </Card>
  );
}
