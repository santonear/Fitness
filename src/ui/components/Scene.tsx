import type { SceneVariant } from '../../themes/contract';
import './scene.css';

export type { SceneVariant };
export const sceneVariantList: readonly SceneVariant[] = ['dawn', 'lake', 'dusk', 'mist', 'peak'];
const sun: Record<SceneVariant, readonly [number, number]> = {
  dawn: [246, 176],
  lake: [110, 150],
  dusk: [196, 196],
  mist: [280, 150],
  peak: [318, 118],
};
const ridge = 'M0 232L58 190L104 212L168 150L226 204L288 160L348 198L390 176V420H0Z';
const peakRidge = 'M0 240L40 214L84 228L150 120L176 150L206 96L250 186L300 160L344 196L390 180V420H0Z';
const pines =
  'M-11.0 304L-6.0 276.2L-1.0 304ZM-5.4 304L1.0 268.4L7.4 304ZM1.7 304L7.6 271.1L13.5 304ZM11.7 304L15.6 282.6L19.4 304ZM20.4 304L24.1 283.1L27.9 304ZM28.5 304L32.4 282.3L36.3 304ZM33.7 304L39.1 273.8L44.5 304ZM45.0 304L49.1 281.0L53.2 304ZM50.1 304L56.4 268.9L62.7 304ZM60.9 304L67.0 270.1L73.1 304ZM67.3 304L75.1 260.6L82.9 304ZM74.3 304L81.6 263.4L88.9 304ZM85.0 304L89.2 280.5L93.4 304ZM91.1 304L96.0 276.6L100.9 304ZM101.6 304L106.0 279.7L110.4 304ZM108.5 304L114.9 268.7L121.3 304ZM116.9 304L122.9 270.9L128.8 304ZM125.6 304L129.5 282.6L133.3 304ZM130.1 304L136.7 267.7L143.2 304ZM140.0 304L144.9 276.5L149.9 304ZM148.3 304L153.8 273.1L159.4 304ZM154.5 304L161.5 264.9L168.5 304ZM166.3 304L170.9 278.1L175.6 304ZM174.0 304L179.8 271.4L185.7 304ZM183.3 304L190.1 266.5L196.8 304ZM189.8 304L197.7 260.5L205.5 304ZM199.1 304L204.5 274.0L209.9 304ZM209.9 304L214.2 280.4L218.5 304ZM218.9 304L222.7 283.1L226.5 304ZM225.1 304L232.0 265.7L238.9 304ZM233.5 304L240.9 263.0L248.3 304ZM242.0 304L248.6 267.3L255.2 304ZM251.5 304L257.6 270.1L263.7 304ZM258.7 304L265.9 263.8L273.2 304ZM270.8 304L276.5 272.6L282.1 304ZM281.9 304L285.8 282.5L289.6 304ZM288.8 304L295.2 268.5L301.6 304ZM298.8 304L306.0 264.3L313.1 304ZM308.3 304L313.6 274.7L318.8 304ZM319.2 304L322.9 283.5L326.6 304ZM326.9 304L331.3 280.0L335.6 304ZM334.2 304L338.1 282.6L341.9 304ZM343.7 304L347.8 280.9L352.0 304ZM350.0 304L355.3 274.6L360.5 304ZM361.5 304L365.5 282.1L369.4 304ZM367.8 304L373.8 270.8L379.8 304ZM376.9 304L384.1 264.3L391.2 304ZM389.5 304L394.3 277.3L399.1 304Z';
const tallPines =
  'M-15.3 322L-6.0 270.5L3.3 322ZM-2.7 322L10.0 251.4L22.7 322ZM12.6 322L20.8 276.4L29.1 322ZM23.7 322L32.3 274.5L40.8 322ZM34.9 322L45.5 263.1L56.1 322ZM49.9 322L57.1 281.9L64.3 322ZM60.5 322L69.8 270.2L79.2 322ZM70.9 322L83.6 251.5L96.3 322ZM88.1 322L98.2 265.5L108.4 322ZM101.3 322L112.4 260.4L123.5 322ZM270.0 322L282.0 255.2L294.0 322ZM285.4 322L297.3 256.0L309.1 322ZM303.5 322L312.6 271.4L321.7 322ZM317.8 322L325.2 280.7L332.7 322ZM332.3 322L339.5 282.0L346.7 322ZM341.7 322L349.7 277.3L357.8 322ZM351.9 322L360.7 273.1L369.5 322ZM364.0 322L370.9 284.0L377.7 322ZM374.3 322L381.7 280.8L389.1 322ZM387.1 322L394.1 283.2L401.0 322Z';

/** Decorative 山野 landscape for the vivid theme (docs/design/v9/Scene.dc.html); palettes are --scene-* tokens. */
export function Scene({ variant = 'dawn', className }: { variant?: SceneVariant; className?: string }) {
  const [sx, sy] = sun[variant];
  return (
    <div className={['v9-scene', className].filter(Boolean).join(' ')} data-scene={variant} aria-hidden="true">
      <svg viewBox="0 0 390 420" preserveAspectRatio="xMidYMax slice" focusable="false">
        <rect width="390" height="420" className="v9-scene-sky" />
        <circle cx={sx} cy={sy} r="58" className="v9-scene-haze" />
        <circle cx={sx} cy={sy} r="40" className="v9-scene-sun" />
        <path
          d="M52 92q7-8 14 0q7-8 14 0M92 70q5-6 10 0q5-6 10 0M300 58q6-7 12 0q6-7 12 0M332 84q4-5 8 0q4-5 8 0"
          className="v9-scene-bird"
        />
        <path d={variant === 'peak' ? peakRidge : ridge} className="v9-scene-far" />
        <path
          d="M0 262C40 244 72 218 112 226C150 234 172 204 212 208C258 214 282 242 322 234C352 228 372 238 390 236V420H0Z"
          className="v9-scene-mid"
        />
        <rect x="0" y="262" width="390" height="46" className="v9-scene-lake" />
        <path d="M150 276h70M236 284h40M120 292h52M262 296h60" className="v9-scene-glint" />
        <path d={pines} className="v9-scene-pine" />
        <path d={tallPines} className="v9-scene-pine" />
        <path d="M0 334C60 304 122 312 172 326C230 344 282 302 390 316V420H0Z" className="v9-scene-hill1" />
        <rect x="61" y="320" width="5" height="34" rx="2" className="v9-scene-trunk" />
        <circle cx="64" cy="312" r="30" className="v9-scene-tree-b" />
        <circle cx="44" cy="324" r="18" className="v9-scene-tree-b" />
        <rect x="110" y="328" width="4" height="26" rx="2" className="v9-scene-trunk" />
        <circle cx="112" cy="326" r="19" className="v9-scene-tree-a" />
        <rect x="318" y="306" width="5" height="34" rx="2" className="v9-scene-trunk" />
        <circle cx="320" cy="300" r="28" className="v9-scene-tree-a" />
        <circle cx="342" cy="314" r="18" className="v9-scene-tree-a" />
        <circle cx="268" cy="330" r="15" className="v9-scene-tree-b" />
        <path d="M0 372C82 346 160 360 222 372C292 386 330 352 390 360V420H0Z" className="v9-scene-hill2" />
        <ellipse cx="190" cy="392" rx="64" ry="16" className="v9-scene-hill1 v9-scene-soft" />
        <path d="M30 384l3-8l3 8M150 398l3-7l3 7M248 390l3-8l3 8M352 382l3-7l3 7" className="v9-scene-grass" />
        <g className="v9-scene-flower">
          <circle cx="40" cy="398" r="3" />
          <circle cx="58" cy="404" r="2.5" />
          <circle cx="300" cy="396" r="3" />
          <circle cx="318" cy="404" r="2.5" />
          <circle cx="210" cy="410" r="2.5" />
        </g>
      </svg>
    </div>
  );
}
