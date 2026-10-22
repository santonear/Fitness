import type { CSSProperties, ReactNode } from 'react';
import { AppIcon, type IconName } from '../../components/AppIcon';
import { regionNames } from '../../../application/plan-presentation';
import type { RegionShare } from './visuals';

/** Compact icon tile: icon, number, short label. `dd` holds the bare number so facts stay machine-readable. */
export function FactTile({ icon, label, value }: { icon: IconName; label: string; value: ReactNode }) {
  return (
    <div className="rv-tile">
      <dt className="rv-tile-term">
        <span className="rv-tile-icon" aria-hidden="true">
          <AppIcon name={icon} ceramic />
        </span>
        <span className="rv-tile-label">{label}</span>
      </dt>
      <dd className="rv-tile-value v9-num">{value}</dd>
    </div>
  );
}

/** Horizontal bars of saved sets per body region. */
export function BodyParts({
  title,
  unit,
  shares,
  locale,
}: {
  title: string;
  unit: string;
  shares: readonly RegionShare[];
  locale: 'zh' | 'en';
}) {
  const max = Math.max(1, ...shares.map(share => share.sets));
  const summary = `${title}: ${shares.map(share => `${regionNames[share.region][locale === 'zh' ? 0 : 1]} ${share.sets} ${unit}`).join(', ')}`;
  return (
    <section className="rv-parts v9-card" data-variant="raised" data-padding="md" aria-label={title}>
      <h2 className="rv-section-title v9-body">{title}</h2>
      <ul className="rv-parts-list" role="img" aria-label={summary}>
        {shares.map((share, index) => (
          <li key={share.region} className="rv-part" data-rank={Math.min(index + 1, 4)} aria-hidden="true">
            <span className="rv-part-name">{regionNames[share.region][locale === 'zh' ? 0 : 1]}</span>
            <span className="rv-part-track">
              <span className="rv-part-fill" style={{ '--rv-level': share.sets / max } as CSSProperties} />
            </span>
            <span className="rv-part-value v9-num">{Math.round(share.share * 100)}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface TimingCell {
  day: 'weekday' | 'weekend';
  band: 'overnight' | 'morning' | 'daytime' | 'evening';
  count: number;
}
/** Weekday/weekend × time-of-day grid of unfinished sessions; sentences are the accessible description. */
export function TimingGrid({
  title,
  cells,
  labels,
  description,
}: {
  title: string;
  cells: readonly TimingCell[];
  labels: Record<TimingCell['day'] | TimingCell['band'], string>;
  description: string;
}) {
  const max = Math.max(1, ...cells.map(cell => cell.count));
  const bands = ['overnight', 'morning', 'daytime', 'evening'] as const;
  return (
    <section className="rv-patterns v9-card" data-variant="raised" data-padding="md" aria-label={title}>
      <h2 className="rv-section-title v9-body">{title}</h2>
      <div className="rv-grid" role="img" aria-label={description}>
        <span aria-hidden="true" />
        {bands.map(band => (
          <span key={band} className="rv-grid-head" aria-hidden="true">
            {labels[band]}
          </span>
        ))}
        {(['weekday', 'weekend'] as const).map(day => [
          <span key={day} className="rv-grid-head" aria-hidden="true">
            {labels[day]}
          </span>,
          ...bands.map(band => {
            const count = cells.find(cell => cell.day === day && cell.band === band)?.count ?? 0;
            return (
              <span
                key={day + band}
                className="rv-grid-cell v9-num"
                aria-hidden="true"
                data-on={count >= 2 ? 'true' : 'false'}
                style={{ '--rv-level': count / max } as CSSProperties}
              >
                {count || ''}
              </span>
            );
          }),
        ])}
      </div>
    </section>
  );
}

/** Before enough sessions are saved: a row of dots filling toward the threshold, with one short caption. */
export function PatternProgress({
  title,
  saved,
  needed,
  caption,
}: {
  title: string;
  saved: number;
  needed: number;
  caption: string;
}) {
  return (
    <section className="rv-patterns v9-card" data-variant="flat" data-padding="md" aria-label={title}>
      <div className="rv-dots" aria-hidden="true">
        {Array.from({ length: needed }, (_, index) => (
          <span key={index} className="rv-dot" data-on={index < saved ? 'true' : 'false'} />
        ))}
      </div>
      <p className="rv-caption">{caption}</p>
    </section>
  );
}
