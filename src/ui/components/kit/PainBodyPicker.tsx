import { BODY_ART, PAIN_SPOTS, type BodySex, type PainSpotArea } from './body-figure';
import './kit.css';

export type PainSide = 'left' | 'right';
export interface PainSpot {
  area: PainSpotArea;
  side?: PainSide;
}
/** Front view on the left, back view beside it (UIUX20261008 I mockup); each view is 212 wide with x centre 100. */
const BACK_X = 220,
  WIDTH = 432,
  HEIGHT = 432,
  FRONT_AREAS = ['shoulder', 'wrist', 'hip', 'knee', 'ankle'] as const,
  BACK_AREAS = ['neck', 'back'] as const;
interface Placed extends PainSpot {
  x: number;
  y: number;
  /** Tag on the outer left of the front view, or the right edge of its view. */
  tag: 'left' | 'right';
  edge: number;
}
function spotsOf(sex: BodySex): Placed[] {
  const at = PAIN_SPOTS[sex];
  return [
    // The user's right side is on the screen's left (the figure faces the user).
    ...FRONT_AREAS.flatMap(area => {
      const [x, y] = at[area];
      return [
        { area, side: 'right' as const, x, y, tag: 'left' as const, edge: -6 },
        { area, side: 'left' as const, x: 200 - x, y, tag: 'right' as const, edge: 206 },
      ];
    }),
    ...BACK_AREAS.map(area => {
      const [x, y] = at[area];
      return { area, x: x + BACK_X, y, tag: 'right' as const, edge: 206 + BACK_X };
    }),
  ];
}
const pct = (value: number, of: number) => `${(value / of) * 100}%`;
const same = (a: PainSpot | undefined, b: PainSpot) => a?.area === b.area && a.side === b.side;

/**
 * 人体图点疼痛 (UIUX20261008 I): line-art figure with tap targets at the joints. The picked spot is drawn in the
 * safety colour (--c-warn), never the training highlight, with a tag such as “右膝”. Colours are theme variables only.
 */
export function PainBodyPicker({
  sex,
  value,
  onChange,
  label,
  spotLabel,
  viewLabels,
  disabled,
}: {
  sex: BodySex;
  value?: PainSpot;
  onChange: (spot: PainSpot) => void;
  /** Accessible name of the figure, including the marked spot. */
  label: string;
  spotLabel: (spot: PainSpot) => string;
  viewLabels: { front: string; back: string };
  disabled?: boolean;
}) {
  const spots = spotsOf(sex),
    picked = spots.find(spot => same(value, spot)),
    tagY = picked && (picked.y > 340 ? picked.y - 44 : picked.y + 34);
  return (
    <div className="v9-pain-map">
      <div className="v9-pain-figure">
        <svg viewBox={`-6 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label}>
          {(['front', 'back'] as const).map(view => (
            <g key={view} transform={view === 'back' ? `translate(${BACK_X} 0)` : undefined}>
              <path className="v9-pain-body" d={BODY_ART[sex][view].outline} />
              <path className="v9-pain-lines" d={BODY_ART[sex][view].lines} />
            </g>
          ))}
          {spots.map(spot =>
            spot === picked ? null : (
              <circle key={`${spot.area}-${spot.side}`} className="v9-pain-dot" cx={spot.x} cy={spot.y} r="7" />
            ),
          )}
          {picked && tagY !== undefined && (
            <g className="v9-pain-picked">
              <circle className="v9-pain-halo" cx={picked.x} cy={picked.y} r="17" />
              <circle cx={picked.x} cy={picked.y} r="8" />
              <line x1={picked.x} y1={picked.y} x2={picked.tag === 'left' ? 14 : picked.edge - 20} y2={tagY} />
            </g>
          )}
        </svg>
        {spots.map(spot => (
          <button
            key={`${spot.area}-${spot.side}`}
            type="button"
            className="v9-pain-hit"
            style={{ left: pct(spot.x + 6, WIDTH), top: pct(spot.y, HEIGHT) }}
            aria-label={spotLabel(spot)}
            aria-pressed={spot === picked}
            disabled={disabled}
            onClick={() => onChange({ area: spot.area, ...(spot.side ? { side: spot.side } : {}) })}
          />
        ))}
        {picked && tagY !== undefined && (
          <span
            className="v9-pain-tag"
            aria-hidden="true"
            style={{
              top: pct(tagY, HEIGHT),
              ...(picked.tag === 'left' ? { left: 0 } : { right: pct(WIDTH - 6 - picked.edge, WIDTH) }),
            }}
          >
            {spotLabel(picked)}
          </span>
        )}
      </div>
      <div className="v9-pain-views" aria-hidden="true">
        <span>{viewLabels.front}</span>
        <span>{viewLabels.back}</span>
      </div>
    </div>
  );
}
