import { yayaV5 } from '../../../i18n/features/coach/yaya-v5';
import { planPagesCopy } from '../../../i18n/features/plan-upgrade/pages';
import './plan-upgrade.css';

/** v5 §16: fixed, curated evidence notes with a strength label. Never generated. */
export const EVIDENCE = {
  strength: { key: 'evidenceStrength', level: 'strong' },
  fragment: { key: 'evidenceFragment', level: 'moderate' },
} as const;
type EvidenceId = keyof typeof EVIDENCE;

export function EvidenceFold({ locale, items }: { locale: 'zh' | 'en'; items: readonly EvidenceId[] }) {
  const c = planPagesCopy[locale];
  return (
    <details className="pu-why">
      <summary>{c.whyLabel}</summary>
      {items.map(id => (
        <p key={id}>
          {yayaV5[locale][EVIDENCE[id].key]}
          <span className="pu-tag">{c.evidence[EVIDENCE[id].level]}</span>
        </p>
      ))}
    </details>
  );
}
