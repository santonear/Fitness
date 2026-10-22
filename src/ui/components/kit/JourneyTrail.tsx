// Component line owns this file (UIUX20261008 V9.14). Milestone trail from Panel.dc.html 'body' (我的山路).
import type { JourneyTrailProps } from '../../../domain/plan-upgrade';
import { useKitLocale, type KitLocale } from './AnatomyMap';
import './kit.css';

export const journeyTrailCopy = {
  zh: { trail: '我的山路', done: '已到达', now: '现在', next: '下一站' },
  en: { trail: 'My trail', done: 'reached', now: 'you are here', next: 'next stop' },
} as const;

/** Stops in order: reached camps, the pulsing current stop and the next stop (dashed). */
export function JourneyTrail({ stops, locale: localeProp }: JourneyTrailProps & { locale?: KitLocale }) {
  const t = journeyTrailCopy[useKitLocale(localeProp)];
  return (
    <ol className="v9-trail" aria-label={t.trail}>
      {stops.map((stop, i) => (
        <li
          key={`${i}-${stop.label}`}
          className="v9-trail-stop"
          data-state={stop.state}
          aria-current={stop.state === 'now' ? 'step' : undefined}
          aria-label={`${stop.label}, ${t[stop.state]}`}
        >
          <span className="v9-trail-dot" aria-hidden="true" />
          <span className="v9-trail-label" aria-hidden="true">
            {stop.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
