import { useEffect, useState } from 'react';
import type { EngineProfile } from '../../engine/contracts';
import { unresolvedReview } from '../../application/training-pain';
import { engineCopy } from '../../coach/engine-copy';
import { Button } from './common';

export function PainProfessionalConfirmation({
  review,
  pauseRequiredAt,
  locale,
  busy,
  confirmLabel,
  onConfirm,
}: {
  review?: EngineProfile['screening']['redFlagReview'];
  pauseRequiredAt?: string;
  locale: 'zh' | 'en';
  busy: boolean;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => setConfirmed(false), [review?.requiredAt, review?.answeredAt, pauseRequiredAt]);
  if (
    (review && (!review.answeredAt || !review.questionKeys.every(key => typeof review.answers?.[key] === 'boolean'))) ||
    (!pauseRequiredAt && !unresolvedReview(review))
  )
    return null;
  return (
    <fieldset disabled={busy}>
      <label>
        <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
        {engineCopy('redflag.copy.confirm_professional_seen', locale)}
      </label>
      <Button
        disabled={busy || !confirmed}
        onClick={() => {
          if (confirmed) onConfirm();
        }}
      >
        {confirmLabel}
      </Button>
    </fieldset>
  );
}
