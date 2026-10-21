// Component line owns this file (UIUX20261008 V9.14). Port of docs/design/plan-upgrade/AnatomyMap.dc.html:
// geometry, morph and label layout follow the approved canvas; colors come only from --map-* tokens.
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { MUSCLE_GROUP_NAMES, type AnatomyMapProps, type FigureShape, type MuscleGroup } from '../../../domain/plan-upgrade';
import './kit.css';

export type KitLocale = 'zh' | 'en';
/** Kit components follow the app language (react-i18next); an explicit locale wins. Unknown → zh (design language). */
export function useKitLocale(locale?: KitLocale): KitLocale {
  const { i18n } = useTranslation();
  if (locale) return locale;
  const language = i18n?.language;
  return language && language.startsWith('en') ? 'en' : 'zh';
}

type View = 'front' | 'back';
type Cat = 'torso' | 'shoulder' | 'arm' | 'leg' | 'hip' | 'none';
type Rule = 'arm' | 'leg' | 'torso';

const OUT_M = 'M100 12 C90 12 83 20 83 32 C83 36 82 38 81 40 C79 40 78 44 80 48 C81 50 83 50 84 49 C85 54 89 58 91 60 L91 68 C84 74 68 78 56 82 C44 85 36 94 35 108 C34 124 32 150 28 170 C26 180 24 188 22 196 C17 220 12 244 9 266 C6 272 4 282 6 292 C8 300 14 302 16 296 C18 288 18 280 19 274 C24 250 32 226 38 204 C42 186 46 166 50 148 C52 140 54 134 56 128 C58 150 62 175 68 198 C68 212 66 226 66 238 C64 272 64 304 68 326 C66 340 64 352 64 362 C64 380 68 398 70 410 C66 416 62 422 66 426 L88 426 C88 418 86 412 85 408 C88 390 90 368 88 348 C88 340 90 334 90 328 C94 302 97 270 98 252 C99 246 99 242 100 240';
const OUT_F = 'M100 12 C90 12 84 20 84 32 C84 36 83 38 82 40 C80 41 79 44 81 47 C82 49 84 49 85 48 C86 53 90 57 92 59 L92 68 C86 73 74 77 62 80 C50 83 44 92 43 106 C42 122 40 148 36 168 C34 178 32 186 30 194 C25 218 20 242 17 264 C14 270 12 280 14 290 C16 298 22 300 24 294 C26 286 26 278 27 272 C32 248 40 224 46 202 C50 184 54 164 58 146 C59 138 60 132 61 126 C60 140 62 150 64 158 C66 172 72 186 74 194 C72 208 62 222 58 240 C56 270 60 304 66 328 C64 342 64 352 64 362 C64 380 68 398 70 410 C66 416 62 422 66 426 L88 426 C88 418 86 412 85 408 C88 390 90 368 88 348 C88 340 90 334 90 328 C94 302 97 270 98 252 C99 246 99 242 100 240';

export const FIGURE_OUTLINES = { male: OUT_M, female: OUT_F } as const;

/** Left half of each region (x ≤ 100); the right half is the mirror. */
const MUS: Record<View, readonly (readonly [MuscleGroup, Cat, string])[]> = {
  front: [
    ['traps', 'torso', 'M91 66 C86 72 74 77 60 81 C72 84 84 82 90 78 C93 75 93 70 93 66 Z'],
    ['delts', 'shoulder', 'M58 82 C46 84 36 94 35 108 C35 120 38 126 42 128 C46 112 52 98 66 88 C64 85 61 83 58 82 Z'],
    ['chest', 'torso', 'M99 88 L72 86 C62 92 56 108 58 124 C68 136 88 140 99 134 Z'],
    ['biceps', 'arm', 'M44 130 C38 144 34 162 32 180 C35 188 42 188 46 180 C50 164 53 148 54 134 Z'],
    ['forearms', 'arm', 'M30 198 C22 220 16 242 12 262 L19 266 C26 246 34 224 40 204 C37 198 33 196 30 198 Z'],
    ['abs', 'torso', 'M98 140 L82 140 C80 166 81 196 85 220 C91 228 96 230 98 230 Z'],
    ['obliques', 'torso', 'M78 138 C68 146 64 170 68 200 C71 212 77 220 84 222 C80 196 78 166 80 140 Z'],
    ['quads', 'leg', 'M68 240 C62 270 62 304 72 324 C80 330 89 328 92 320 C95 292 94 268 90 248 C84 238 76 234 68 240 Z'],
    ['adductors', 'leg', 'M92 248 C96 258 98 270 98 282 C97 294 95 302 93 310 C95 288 94 266 92 248 Z'],
    ['calves', 'none', 'M68 340 C63 358 65 382 71 400 L84 400 C88 382 90 360 87 340 C82 334 73 334 68 340 Z'],
  ],
  back: [
    ['traps', 'torso', 'M99 62 L91 66 C85 74 74 79 60 82 C74 90 86 108 99 146 Z'],
    ['delts', 'shoulder', 'M58 82 C46 84 36 94 35 108 C35 120 38 126 42 128 C46 112 52 98 66 88 C64 85 61 83 58 82 Z'],
    ['triceps', 'arm', 'M43 130 C37 144 33 162 31 182 C34 190 41 190 45 182 C49 166 52 150 54 134 Z'],
    ['forearms', 'arm', 'M30 198 C22 220 16 242 12 262 L19 266 C26 246 34 224 40 204 C37 198 33 196 30 198 Z'],
    ['lats', 'torso', 'M58 104 C58 132 62 162 72 192 C82 190 91 180 97 168 C90 146 80 120 68 100 Z'],
    ['lowerback', 'torso', 'M97 172 C90 182 84 198 82 214 C88 218 94 218 99 218 L99 172 Z'],
    ['glutes', 'hip', 'M66 222 C62 244 68 266 84 270 C94 270 99 262 99 250 L99 220 C88 215 74 215 66 222 Z'],
    ['hamstrings', 'leg', 'M66 276 C62 300 66 320 74 330 L90 330 C95 308 95 290 93 274 C83 271 73 271 66 276 Z'],
    ['calves', 'none', 'M66 340 C60 356 62 378 70 390 C76 394 85 392 87 382 C89 366 88 348 85 340 C80 335 71 335 66 340 Z'],
  ],
};
const HAIR = {
  female: { front: 'M100 7 C83 7 75 19 75 36 C75 54 73 72 68 88 C75 91 82 89 87 84 C84 70 84 54 86 40 C88 30 94 24 100 24 Z', back: 'M100 7 C83 7 75 19 75 36 C75 54 73 72 68 88 C80 93 92 93 100 93 Z' },
  male: { front: 'M100 9 C89 9 81 16 82 30 C85 23 91 20 100 20 Z', back: 'M100 9 C89 9 81 16 82 30 C82 40 85 48 90 52 L100 52 Z' },
} as const;
/** Label anchor on the muscle: view, x, y, category. */
const ANCH: Record<MuscleGroup, readonly [View, number, number, Cat]> = {
  lats: ['back', 76, 146, 'torso'], calves: ['back', 77, 364, 'none'], traps: ['back', 88, 100, 'torso'], lowerback: ['back', 92, 196, 'torso'],
  glutes: ['back', 82, 244, 'hip'], hamstrings: ['back', 80, 300, 'leg'], triceps: ['back', 43, 158, 'arm'], biceps: ['front', 44, 158, 'arm'],
  abs: ['front', 90, 186, 'torso'], chest: ['front', 80, 112, 'torso'], delts: ['front', 46, 104, 'shoulder'], quads: ['front', 78, 284, 'leg'],
  obliques: ['front', 72, 180, 'torso'], forearms: ['front', 26, 230, 'arm'], adductors: ['front', 95, 280, 'leg'],
};
const SLOTS: Record<View, readonly (readonly [number, number])[]> = { back: [[456, 34], [456, 414]], front: [[14, 34], [14, 414]] };
const OX: Record<View, number> = { front: 30, back: 240 };
const CAT_RULE: Record<Cat, Rule> = { arm: 'arm', leg: 'leg', none: 'leg', torso: 'torso', shoulder: 'torso', hip: 'torso' };
const YB: readonly (readonly [number, number])[] = [[0, 0], [12, 12], [60, 66], [84, 86], [128, 120], [200, 172], [240, 222], [330, 308], [410, 406], [430, 428]];
const YA: readonly (readonly [number, number])[] = [[0, 0], [84, 86], [128, 120], [196, 168], [266, 226], [302, 262], [330, 290]];

const G = (y: number, c: number, sd: number) => Math.exp(-((y - c) * (y - c)) / (2 * sd * sd));
const lerpMap = (y: number, pts: readonly (readonly [number, number])[]) => {
  for (let i = 1; i < pts.length; i++) if (y <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; return a[1] + (y - a[0]) * (b[1] - a[1]) / (b[0] - a[0]); }
  const last = pts[pts.length - 1];
  return last[1] + (y - last[0]);
};

/** Body-fat factor from BMI (−0.5 … 1.6); 0 when height or weight is missing, which draws the standard figure. */
export function fatOf(heightCm: number | undefined, weightKg: number | undefined) {
  if (!heightCm || !weightKg || !Number.isFinite(heightCm) || !Number.isFinite(weightKg)) return 0;
  const bmi = weightKg / ((heightCm / 100) ** 2);
  return Math.max(-0.5, Math.min(1.6, (bmi - 22) / 8));
}

function makeMorph(fem: boolean) {
  const fx = (x: number, cat: string) => {
    if (!fem) return x;
    if (cat === 'torso') return 0.86 * x + 14;
    if (cat === 'shoulder') return 0.88 * x + 12;
    if (cat === 'arm') return x + 8;
    if (cat === 'leg' || cat === 'hip') return 1.1 * x - 10;
    return x;
  };
  const fy = (y: number, cat: string) => (fem && cat === 'arm') ? y - 2 : y;
  // Fat distribution: male mostly belly/waist, then chest, nape, upper back; female hips, outer thighs, upper arms.
  const D = (y: number, f: number) => {
    if (f === 0 || y < 30) return 0;
    let v: number;
    if (y < 66) v = 2 * G(y, 52, 8);
    else if (fem) v = (y < 84 ? 2 : 2.5 + 3 * G(y, 135, 15) + 5 * G(y, 195, 25) + 7 * G(y, 240, 25) + 5 * G(y, 285, 30) + (y > 330 ? -1 : 0));
    else v = (y < 84 ? 3 : 3 + 4 * G(y, 120, 22) + 12 * G(y, 195, 32) + 3 * G(y, 240, 20) + 3 * G(y, 275, 30) + (y > 330 ? -1.5 : 0));
    return v * f;
  };
  const AP = fem ? [61, 126, 34 / 146] : [56, 128, 37 / 146];
  const xin = (y: number) => AP[0] - (y - AP[1]) * AP[2];
  // Proportion shaping (≈8 heads, elbow at navel, fingertips at mid-thigh, chest / waist / knee / calf curves).
  const SH = (y: number) => fem
    ? { t: 2 * G(y, 118, 14) - 5 * G(y, 192, 18) + 2 * G(y, 236, 18), l: 3 * G(y, 262, 22) - 3 * G(y, 330, 8) + 3 * G(y, 358, 16) - 2 * G(y, 406, 8), a: 1.5 * G(y, 150, 16) - 1.5 * G(y, 196, 6) + 1.5 * G(y, 214, 12) - 1.5 * G(y, 262, 6) }
    : { t: 3 * G(y, 112, 18) - 4 * G(y, 205, 18), l: 4 * G(y, 262, 22) - 3.5 * G(y, 330, 8) + 4.5 * G(y, 358, 16) - 2.5 * G(y, 406, 8), a: 3 * G(y, 150, 16) - 2 * G(y, 196, 6) + 2.5 * G(y, 214, 12) - 2 * G(y, 262, 6) };
  const warp = (x: number, y: number, rule: Rule, f: number): [number, number] => {
    const sh = SH(y);
    if (rule === 'arm') {
      const shift = D(AP[1], f);
      const thick = f * (y < 200 ? (fem ? 6 : 4) : (fem ? 2.5 : 2));
      const outer = x < xin(y) - 10;
      return [outer ? x - shift - thick - sh.a : x - shift + sh.a * 0.5, lerpMap(y, YA)];
    }
    if (rule === 'leg') {
      const d = D(y, f), c = 81;
      return [x < c ? x - d - sh.l : Math.min(99.6, x + 0.35 * d + sh.l * 0.6), lerpMap(y, YB)];
    }
    const k = Math.min(1, Math.max(0, (100 - x) / 32));
    return [x - (D(y, f) + sh.t) * k, lerpMap(y, YB)];
  };
  const outRule = (x: number, y: number): Rule => (y >= 84 && y >= AP[1] && y <= 305 && x < xin(y) + 0.5) ? 'arm' : (y >= 240 ? 'leg' : 'torso');
  const morph = (d: string, cat: Cat | 'outline' | 'hair', f: number) => {
    const tokens = d.match(/[MLCZ]|-?\d*\.?\d+/g) ?? [];
    let out = '';
    let nums: number[] = [];
    const flush = () => {
      for (let i = 0; i + 1 < nums.length; i += 2) {
        const x = fx(nums[i], cat), y = fy(nums[i + 1], cat);
        const rule = cat === 'outline' ? outRule(x, y) : cat === 'hair' ? 'torso' : CAT_RULE[cat];
        const q = warp(x, y, rule, f);
        out += `${q[0].toFixed(1)} ${q[1].toFixed(1)} `;
      }
      nums = [];
    };
    for (const t of tokens) { if (/[MLCZ]/.test(t)) { flush(); out += `${t} `; } else nums.push(parseFloat(t)); }
    flush();
    return out.trim();
  };
  return { fx, fy, warp, morph };
}

export interface AnatomyRegion { group: MuscleGroup; view: View; mirror: boolean; d: string; transform: string; role: 'primary' | 'secondary' | 'none'; delay: number }
export interface AnatomyTag { n: number; group: MuscleGroup; primary: boolean; name: string; bx: number; by: number; ax: number; ay: number; tx: number; anchor: 'start' | 'end'; path: string; delay: number }
export interface AnatomyLayer { d: string; transform: string }
export interface AnatomyModel {
  sex: 'male' | 'female';
  viewBox: string; vbw: number; vbh: number;
  outline: AnatomyLayer[]; ghost: AnatomyLayer[]; hair: AnatomyLayer[]; details: AnatomyLayer[];
  regions: AnatomyRegion[]; tags: AnatomyTag[];
  primary: MuscleGroup[]; secondary: MuscleGroup[];
}

const transformOf = (view: View, mirror: boolean) => `translate(${OX[view]} 0)${mirror ? ' matrix(-1 0 0 1 200 0)' : ''}`;

/** Pure geometry for the figure (exported for tests and previews). */
export function buildAnatomy(input: { primary: readonly MuscleGroup[]; secondary: readonly MuscleGroup[]; shape?: FigureShape; labels?: boolean; ghostWeightKg?: number; locale?: KitLocale }): AnatomyModel {
  const sex = input.shape?.sex === 'female' ? 'female' : 'male';
  const fem = sex === 'female';
  const lang = input.locale === 'en' ? 1 : 0;
  const labels = input.labels ?? false;
  const { fx, fy, warp, morph } = makeMorph(fem);
  const primary = [...new Set(input.primary)];
  const secondary = [...new Set(input.secondary)].filter(group => !primary.includes(group));
  const fatNow = fatOf(input.shape?.heightCm, input.shape?.weightKg);
  const ghostFat = input.ghostWeightKg ? fatOf(input.shape?.heightCm, input.ghostWeightKg) : undefined;
  const outlinePath = fem ? OUT_F : OUT_M;
  const details: Record<View, readonly (readonly [Cat, string])[]> = {
    front: [['torso', 'M83 158 L98 158 M82 176 L98 176 M83 194 L98 194'], ['none', 'M78 344 L78 396'], ...(fem ? [['torso', 'M60 120 C64 138 82 146 98 140'] as const] : [])],
    back: [['none', 'M77 342 L77 388'], ['torso', 'M99 146 L99 218']],
  };
  const model: AnatomyModel = { sex, viewBox: '', vbw: 0, vbh: 0, outline: [], ghost: [], hair: [], details: [], regions: [], tags: [], primary, secondary };
  for (const view of ['front', 'back'] as const) {
    for (const mirror of [false, true]) {
      const transform = transformOf(view, mirror);
      model.outline.push({ d: morph(outlinePath, 'outline', fatNow), transform });
      if (ghostFat !== undefined) model.ghost.push({ d: morph(outlinePath, 'outline', ghostFat), transform });
      model.hair.push({ d: morph(HAIR[sex][view], 'hair', fatNow), transform });
      for (const [group, cat, d] of MUS[view]) {
        const pi = primary.indexOf(group);
        model.regions.push({ group, view, mirror, d: morph(d, cat, fatNow), transform, role: pi >= 0 ? 'primary' : secondary.includes(group) ? 'secondary' : 'none', delay: pi >= 0 ? pi * 0.8 : 0 });
      }
      for (const [cat, d] of details[view]) model.details.push({ d: morph(d, cat, fatNow), transform });
    }
  }
  if (labels) {
    const used: Record<View, number> = { front: 0, back: 0 };
    // Primaries first, then secondaries (traps is too close to the neck to label); at most two badges per side.
    for (const group of [...primary, ...secondary.filter(k => k !== 'traps')]) {
      const [view, x0, y0, cat] = ANCH[group];
      if (used[view] >= 2) continue;
      const [bx, by] = SLOTS[view][used[view]++];
      const right = view === 'back';
      const [wx, ay] = warp(fx(x0, cat), fy(y0, cat), CAT_RULE[cat], fatNow);
      const ax = right ? OX.back + 200 - wx : OX.front + wx;
      const isPrimary = primary.includes(group);
      const elbowX = right ? Math.max(ax + 14, bx - 50) : Math.min(ax - 14, bx + 50);
      const ly = by + (by < 200 ? 14 : -14);
      model.tags.push({
        n: model.tags.length + 1, group, primary: isPrimary, name: MUSCLE_GROUP_NAMES[group][lang],
        bx, by, ax: +ax.toFixed(1), ay: +ay.toFixed(1), tx: right ? bx - 16 : bx + 16, anchor: right ? 'end' : 'start',
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
    return `${model.sex === 'female' ? 'Female' : 'Male'} full-body muscle map, front and back.`
      + (model.primary.length ? ` Main: ${names(model.primary).join(', ')}.` : '')
      + (model.secondary.length ? ` Assisting: ${names(model.secondary).join(', ')}.` : '');
  }
  return `${model.sex === 'female' ? '女性' : '男性'}全身肌群图，正面与背面。`
    + (model.primary.length ? `主练：${names(model.primary).join('、')}` : '')
    + (model.secondary.length ? `${model.primary.length ? '；' : ''}辅助：${names(model.secondary).join('、')}` : '');
}

export function AnatomyMap({ width, primary, secondary, shape, labels = false, ghostWeightKg, locale: localeProp }: AnatomyMapProps & { locale?: KitLocale }) {
  const locale = useKitLocale(localeProp);
  const filterId = `am-${useId().replace(/[^\w-]/g, '')}`;
  const model = buildAnatomy({ primary, secondary, shape, labels, ghostWeightKg, locale });
  const height = Math.round(width * model.vbh / model.vbw);
  return <div className="v9-anatomy" data-sex={model.sex} data-labels={labels ? 'on' : 'off'} style={{ inlineSize: width, blockSize: height }}>
    <svg className="v9-anatomy-svg" width={width} height={height} viewBox={model.viewBox} role="img" aria-label={anatomyLabel(model, locale)}>
      <defs><filter id={filterId} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" /></filter></defs>
      {model.outline.map((s, i) => <path key={`b${i}`} className="v9-am-base" d={s.d} transform={s.transform} />)}
      {model.regions.map((m, i) => <path key={`m${i}`} className="v9-am-muscle" data-group={m.group} data-view={m.view} data-role={m.role} d={m.d} transform={m.transform} />)}
      {model.regions.filter(m => m.role === 'primary').map((m, i) => <path key={`g${i}`} className="v9-am-glow" data-group={m.group} d={m.d} transform={m.transform} filter={`url(#${filterId})`} style={{ animationDelay: `${m.delay}s` }} />)}
      {model.details.map((l, i) => <path key={`d${i}`} className="v9-am-detail" d={l.d} transform={l.transform} />)}
      {model.hair.map((r, i) => <path key={`h${i}`} className="v9-am-hair" d={r.d} transform={r.transform} />)}
      {model.outline.map((s, i) => <path key={`o${i}`} className="v9-am-outline" d={s.d} transform={s.transform} />)}
      {model.ghost.map((o, i) => <path key={`x${i}`} className="v9-am-ghost" d={o.d} transform={o.transform} />)}
      {model.tags.map(t => <g key={t.group} className="v9-am-tag" data-group={t.group} data-role={t.primary ? 'primary' : 'secondary'}>
        <path className="v9-am-leader" d={t.path} />
        <circle className="v9-am-anchor" cx={t.ax} cy={t.ay} r="3.5" />
        <circle className="v9-am-badge" cx={t.bx} cy={t.by} r="10" style={{ animationDelay: `${t.delay}s` }} />
        <text className="v9-am-num" x={t.bx} y={t.by + 4.5} textAnchor="middle">{t.n}</text>
        <text className="v9-am-name" x={t.tx} y={t.by + 4.5} textAnchor={t.anchor}>{t.name}</text>
      </g>)}
    </svg>
    <div className="v9-anatomy-scan-clip" aria-hidden="true"><div className="v9-anatomy-scan" /></div>
  </div>;
}
