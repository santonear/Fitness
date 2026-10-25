// Component line owns this file (UIUX20261008 V9.14). Label layout follows docs/design/plan-upgrade/AnatomyMap.dc.html;
// the figure is Bo's licensed line art (body-figure.ts, 2026-10-25). Colors come only from --map-* tokens.
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MUSCLE_GROUP_NAMES,
  type AnatomyMapProps,
  type FigureShape,
  type MuscleGroup,
} from '../../../domain/plan-upgrade';
import { BODY_ART, MUSCLE_ANCHORS, MUSCLE_REGIONS, TORSO_HALF, type BodySex, type BodyView } from './body-figure';
import './kit.css';

export type KitLocale = 'zh' | 'en';
/** Kit components follow the app language (react-i18next); an explicit locale wins. Unknown → zh (design language). */
export function useKitLocale(locale?: KitLocale): KitLocale {
  const { i18n } = useTranslation();
  if (locale) return locale;
  const language = i18n?.language;
  return language && language.startsWith('en') ? 'en' : 'zh';
}

type View = BodyView;
type Sex = BodySex;

/** Label anchor view per group (front groups on the screen-left, back groups on the screen-right). */
const LABEL_VIEW: Record<MuscleGroup, View> = {
  lats: 'back',
  calves: 'back',
  traps: 'back',
  lowerback: 'back',
  glutes: 'back',
  hamstrings: 'back',
  triceps: 'back',
  biceps: 'front',
  abs: 'front',
  chest: 'front',
  delts: 'front',
  quads: 'front',
  obliques: 'front',
  forearms: 'front',
  adductors: 'front',
};
const SLOTS: Record<View, readonly (readonly [number, number])[]> = {
  back: [
    [456, 34],
    [456, 414],
  ],
  front: [
    [14, 34],
    [14, 414],
  ],
};
const OX: Record<View, number> = { front: 30, back: 240 };

const G = (y: number, c: number, sd: number) => Math.exp(-((y - c) * (y - c)) / (2 * sd * sd));

/** Body-fat factor from BMI (−0.5 … 1.6); 0 when height or weight is missing, which draws the standard figure. */
export function fatOf(heightCm: number | undefined, weightKg: number | undefined) {
  if (!heightCm || !weightKg || !Number.isFinite(heightCm) || !Number.isFinite(weightKg)) return 0;
  const bmi = weightKg / (heightCm / 100) ** 2;
  return Math.max(-0.5, Math.min(1.6, (bmi - 22) / 8));
}

/** Body-fat factor from a logged body-fat percentage, on the same scale as fatOf (male 18%, female 27% draw the standard figure). */
export function fatFromPercent(sex: 'male' | 'female', percent: number | undefined) {
  if (percent === undefined || !Number.isFinite(percent)) return undefined;
  return Math.max(-0.5, Math.min(1.6, (percent - (sex === 'female' ? 27 : 18)) / 10));
}

/** Share of the half width a fuller body adds at height y: men mostly belly and chest, women hips and thighs. */
function widen(sex: Sex, y: number) {
  if (y < 62 || y > 410) return 0;
  return sex === 'female'
    ? 0.03 + 0.08 * G(y, 110, 14) + 0.1 * G(y, 180, 20) + 0.24 * G(y, 235, 24) + 0.14 * G(y, 280, 28)
    : 0.03 + 0.1 * G(y, 115, 20) + 0.26 * G(y, 195, 30) + 0.1 * G(y, 262, 28);
}
function trunkHalf(sex: Sex, view: View, y: number) {
  const table = TORSO_HALF[sex][view],
    at = (i: number) => table[Math.max(0, Math.min(table.length - 1, i))],
    i = (y - 60) / 4,
    lo = Math.floor(i);
  return at(lo) + (at(lo + 1) - at(lo)) * (i - lo);
}
/** Trunk and legs widen from the centre line; arms ride on the trunk's edge instead of stretching outwards. */
export function warpPoint(sex: Sex, view: View, fat: number, x: number, y: number): [number, number] {
  const k = fat * widen(sex, y),
    dx = x - 100;
  if (!k) return [x, y];
  const half = trunkHalf(sex, view, y);
  return Math.abs(dx) <= half + 1.5 ? [100 + dx * (1 + k), y] : [x + Math.sign(dx) * half * k, y];
}
const morphCache = new Map<string, string>();
function morph(d: string, sex: Sex, view: View, fat: number) {
  if (!fat) return d;
  const key = `${sex}:${view}:${fat}:${d}`,
    hit = morphCache.get(key);
  if (hit) return hit;
  const out = d.replace(/(-?\d*\.?\d+) (-?\d*\.?\d+)/g, (_, x: string, y: string) => {
    const [mx, my] = warpPoint(sex, view, fat, parseFloat(x), parseFloat(y));
    return `${mx.toFixed(1)} ${my.toFixed(1)}`;
  });
  if (morphCache.size > 200) morphCache.clear();
  morphCache.set(key, out);
  return out;
}

export interface AnatomyRegion {
  group: MuscleGroup;
  view: View;
  /** The screen-right copy of the region. */
  mirror: boolean;
  d: string;
  transform: string;
  role: 'primary' | 'secondary' | 'none';
  delay: number;
}
export interface AnatomyTag {
  n: number;
  group: MuscleGroup;
  primary: boolean;
  name: string;
  bx: number;
  by: number;
  ax: number;
  ay: number;
  tx: number;
  anchor: 'start' | 'end';
  path: string;
  delay: number;
}
export interface AnatomyLayer {
  d: string;
  transform: string;
}
export interface AnatomyModel {
  sex: Sex;
  viewBox: string;
  vbw: number;
  vbh: number;
  /** Body silhouette per view (filled). */
  outline: AnatomyLayer[];
  /** The drawn lines per view (filled polygons, even-odd). */
  lines: AnatomyLayer[];
  ghost: AnatomyLayer[];
  regions: AnatomyRegion[];
  tags: AnatomyTag[];
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
}

const transformOf = (view: View) => `translate(${OX[view]} 0)`;

/** Pure geometry for the figure (exported for tests and previews). */
export function buildAnatomy(input: {
  primary: readonly MuscleGroup[];
  secondary: readonly MuscleGroup[];
  shape?: FigureShape;
  labels?: boolean;
  ghostWeightKg?: number;
  ghostBodyFatPercent?: number;
  locale?: KitLocale;
}): AnatomyModel {
  const sex: Sex = input.shape?.sex === 'female' ? 'female' : 'male';
  const lang = input.locale === 'en' ? 1 : 0;
  const labels = input.labels ?? false;
  const primary = [...new Set(input.primary)];
  const secondary = [...new Set(input.secondary)].filter(group => !primary.includes(group));
  const fatNow =
    fatFromPercent(sex, input.shape?.bodyFatPercent) ?? fatOf(input.shape?.heightCm, input.shape?.weightKg);
  const ghostFat =
    fatFromPercent(sex, input.ghostBodyFatPercent) ??
    (input.ghostWeightKg ? fatOf(input.shape?.heightCm, input.ghostWeightKg) : undefined);
  const model: AnatomyModel = {
    sex,
    viewBox: '',
    vbw: 0,
    vbh: 0,
    outline: [],
    lines: [],
    ghost: [],
    regions: [],
    tags: [],
    primary,
    secondary,
  };
  for (const view of ['front', 'back'] as const) {
    const transform = transformOf(view),
      art = BODY_ART[sex][view];
    model.outline.push({ d: morph(art.outline, sex, view, fatNow), transform });
    model.lines.push({ d: morph(art.lines, sex, view, fatNow), transform });
    if (ghostFat !== undefined) model.ghost.push({ d: morph(art.outline, sex, view, ghostFat), transform });
    for (const [group, sides] of Object.entries(MUSCLE_REGIONS[sex][view]) as [MuscleGroup, readonly string[]][]) {
      const pi = primary.indexOf(group);
      sides.forEach((d, side) =>
        model.regions.push({
          group,
          view,
          mirror: side === 1,
          d: morph(d, sex, view, fatNow),
          transform,
          role: pi >= 0 ? 'primary' : secondary.includes(group) ? 'secondary' : 'none',
          delay: pi >= 0 ? pi * 0.8 : 0,
        }),
      );
    }
  }
  if (labels) {
    const used: Record<View, number> = { front: 0, back: 0 };
    // Primaries first, then secondaries (traps is too close to the neck to label); at most two badges per side.
    for (const group of [...primary, ...secondary.filter(k => k !== 'traps')]) {
      const view = LABEL_VIEW[group],
        anchor = MUSCLE_ANCHORS[sex][view][group];
      if (!anchor || used[view] >= 2) continue;
      const [bx, by] = SLOTS[view][used[view]++];
      const right = view === 'back';
      // Back labels sit on the screen-right copy of the region.
      const [wx, ay] = warpPoint(sex, view, fatNow, right ? 200 - anchor[0] : anchor[0], anchor[1]);
      const ax = OX[view] + wx;
      const isPrimary = primary.includes(group);
      const elbowX = right ? Math.max(ax + 14, bx - 50) : Math.min(ax - 14, bx + 50);
      const ly = by + (by < 200 ? 14 : -14);
      model.tags.push({
        n: model.tags.length + 1,
        group,
        primary: isPrimary,
        name: MUSCLE_GROUP_NAMES[group][lang],
        bx,
        by,
        ax: +ax.toFixed(1),
        ay: +ay.toFixed(1),
        tx: right ? bx - 16 : bx + 16,
        anchor: right ? 'end' : 'start',
        path: `M${right ? bx - 12 : bx + 12} ${ly} L${elbowX.toFixed(1)} ${ly} L${ax.toFixed(1)} ${ay.toFixed(1)}`,
        delay: isPrimary ? primary.indexOf(group) * 0.8 : 0,
      });
    }
  }
  model.viewBox = labels ? '0 0 470 440' : '30 4 410 428';
  model.vbw = labels ? 470 : 410;
  model.vbh = labels ? 440 : 428;
  return model;
}

/** Screen-reader summary: sex, both views, primary and secondary groups. */
export function anatomyLabel(model: Pick<AnatomyModel, 'sex' | 'primary' | 'secondary'>, locale: KitLocale) {
  const lang = locale === 'en' ? 1 : 0;
  const names = (groups: readonly MuscleGroup[]) => groups.map(group => MUSCLE_GROUP_NAMES[group][lang]);
  if (locale === 'en') {
    return (
      `${model.sex === 'female' ? 'Female' : 'Male'} full-body muscle map, front and back.` +
      (model.primary.length ? ` Main: ${names(model.primary).join(', ')}.` : '') +
      (model.secondary.length ? ` Assisting: ${names(model.secondary).join(', ')}.` : '')
    );
  }
  return (
    `${model.sex === 'female' ? '女性' : '男性'}全身肌群图，正面与背面。` +
    (model.primary.length ? `主练：${names(model.primary).join('、')}` : '') +
    (model.secondary.length ? `${model.primary.length ? '；' : ''}辅助：${names(model.secondary).join('、')}` : '')
  );
}

export function AnatomyMap({
  width,
  primary,
  secondary,
  shape,
  labels = false,
  ghostWeightKg,
  ghostBodyFatPercent,
  locale: localeProp,
}: AnatomyMapProps & { ghostBodyFatPercent?: number; locale?: KitLocale }) {
  const locale = useKitLocale(localeProp);
  const filterId = `am-${useId().replace(/[^\w-]/g, '')}`;
  const model = buildAnatomy({ primary, secondary, shape, labels, ghostWeightKg, ghostBodyFatPercent, locale });
  const height = Math.round((width * model.vbh) / model.vbw);
  return (
    <div
      className="v9-anatomy"
      data-sex={model.sex}
      data-labels={labels ? 'on' : 'off'}
      style={{ inlineSize: width, blockSize: height }}
    >
      <svg
        className="v9-anatomy-svg"
        width={width}
        height={height}
        viewBox={model.viewBox}
        role="img"
        aria-label={anatomyLabel(model, locale)}
      >
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        {model.outline.map((s, i) => (
          <path key={`b${i}`} className="v9-am-base" d={s.d} transform={s.transform} />
        ))}
        {model.regions.map((m, i) => (
          <path
            key={`m${i}`}
            className="v9-am-muscle"
            data-group={m.group}
            data-view={m.view}
            data-role={m.role}
            d={m.d}
            transform={m.transform}
          />
        ))}
        {model.regions
          .filter(m => m.role === 'primary')
          .map((m, i) => (
            <path
              key={`g${i}`}
              className="v9-am-glow"
              data-group={m.group}
              d={m.d}
              transform={m.transform}
              filter={`url(#${filterId})`}
              style={{ animationDelay: `${m.delay}s` }}
            />
          ))}
        {model.lines.map((l, i) => (
          <path key={`l${i}`} className="v9-am-lines" d={l.d} transform={l.transform} />
        ))}
        {model.ghost.map((o, i) => (
          <path key={`x${i}`} className="v9-am-ghost" d={o.d} transform={o.transform} />
        ))}
        {model.tags.map(t => (
          <g key={t.group} className="v9-am-tag" data-group={t.group} data-role={t.primary ? 'primary' : 'secondary'}>
            <path className="v9-am-leader" d={t.path} />
            <circle className="v9-am-anchor" cx={t.ax} cy={t.ay} r="3.5" />
            <circle className="v9-am-badge" cx={t.bx} cy={t.by} r="10" style={{ animationDelay: `${t.delay}s` }} />
            <text className="v9-am-num" x={t.bx} y={t.by + 4.5} textAnchor="middle">
              {t.n}
            </text>
            <text className="v9-am-name" x={t.tx} y={t.by + 4.5} textAnchor={t.anchor}>
              {t.name}
            </text>
          </g>
        ))}
      </svg>
      <div className="v9-anatomy-scan-clip" aria-hidden="true">
        <div className="v9-anatomy-scan" />
      </div>
    </div>
  );
}
