/**
 * 山野暖阳 redesign candidates (preview only). Writes src/themes/vivid-previews/vivid-{a,b,c,d}.css and
 * outputs/vivid-redesign/variants.json (names, descriptions, swatches, contrast checks for the preview page).
 *
 * Run: node tools/preview/vivid-redesign/build-variants.mjs
 *
 * Shipping the chosen variant later:
 *  1. Copy its `tokens` values into docs/handoff-v8/02-design-tokens.json → themes.vivid (color/shape/material/card/
 *     chart/meter/glass/font keys map 1:1 to the CSS names via src/themes/token-css.ts) and regenerate
 *     src/themes/vivid/tokens.css; textures (url(...)) go into color.bgGradient / a new token if approved.
 *  2. Its `scene` palette replaces shared.scene.dawn (or add a new scene variant).
 *  3. Move src/themes/vivid-previews/_relief.css rules into src/themes/vivid/slots/slots.css, re-scoping the
 *     non-vivid selectors (calendar, tab bar, cards) via new tokens (e.g. --today-bg, --grain-card) that the
 *     other themes set to their current look, because AGENTS.md §2 keeps [data-theme] selectors in tokens.css only.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

/** Procedural, tileable wood grain (original artwork): stretched fractal noise mapped to a single tinted alpha. */
function grain({ size = 360, fx = 0.004, fy = 0.11, octaves = 4, seed = 7, rgb = [80, 55, 35], gain = 1.2, cut = 0.52 }) {
  const [r, g, b] = rgb.map(v => (v / 255).toFixed(3));
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><filter id='f' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='${fx} ${fy}' numOctaves='${octaves}' seed='${seed}' stitchTiles='stitch' result='n'/><feColorMatrix values='0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} ${gain} 0 0 0 -${cut}'/></filter><rect width='100%' height='100%' filter='url(#f)'/></svg>`;
  return `url("data:image/svg+xml,${svg.replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E')}")`;
}
/** Fine isotropic paper fibre for the block-print variant. */
function fibre({ size = 220, seed = 2, rgb = [60, 50, 40], gain = 0.9, cut = 0.42 }) {
  return grain({ size, fx: 0.55, fy: 0.08, octaves: 2, seed, rgb, gain, cut });
}

const variants = [
  {
    id: 'vivid-a', name: '浅色原木', en: 'Birch',
    description: '桦木浅底配深墨描边，卡片像刻好的木牌，阴影短而实；整体降饱和、无大面积暖色。',
    scheme: 'light',
    swatches: ['#E6DCCB', '#F4EDE2', '#2B2119', '#3F5E4E', '#B0603A', '#C9A06A'],
    grainBg: grain({ rgb: [96, 66, 38], gain: 0.6, cut: 0.3, seed: 11, fy: 0.07 }),
    grainCard: grain({ size: 300, rgb: [110, 76, 44], gain: 0.45, cut: 0.24, seed: 5, fy: 0.12 }),
    grainWood: grain({ size: 300, rgb: [20, 12, 6], gain: 0.7, cut: 0.38, seed: 9, fy: 0.14 }),
    tokens: {
      '--c-bg': '#E6DCCB', '--c-surface': '#F4EDE2', '--c-surface-2': '#E2D5C1',
      '--c-ink': '#2B2119', '--c-ink-muted': '#584739', '--c-faint': '#6E5D4F', '--c-line': '#C8B79E',
      '--c-primary': '#3F5E4E', '--c-on-primary': '#F6F0E4', '--c-signature': '#B0603A', '--c-signature-2': '#5F7E6C',
      '--c-accent-text': '#93401F', '--c-done': '#9C512D', '--c-on-done': '#FFF6EC', '--c-attention': '#93401F',
      '--c-warn': '#962C18', '--c-warn-soft': '#F0DACB', '--c-ai': '#F4EDE2', '--c-inset': '#DDD0BB',
      '--c-invert-bg': '#3A2C21', '--c-invert-ink': '#F3E6D2', '--c-focus': '#1F4A3C', '--c-scrim': 'rgba(43,33,25,.38)',
      '--f-num-style': 'normal',
      '--r-control': '12px', '--r-panel': '16px', '--r-chip': '12px', '--r-hero': '150px 150px 16px 16px', '--bw': '1.5px',
      '--mat-surface': '#F4EDE2', '--mat-primary': 'linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,0) 55%), #3F5E4E',
      '--mat-hl': 'inset 0 1px 0 rgba(255,255,255,.7)',
      '--el-1': 'inset 0 1px 0 rgba(255,255,255,.65), 0 2px 0 #B9A587, 0 5px 10px rgba(60,40,20,.10)',
      '--el-2': 'inset 0 1px 0 rgba(255,255,255,.65), 0 3px 0 #B9A587, 0 10px 20px rgba(60,40,20,.12)',
      '--el-3': '0 4px 0 #A8926F, 0 16px 28px rgba(60,40,20,.18)',
      '--el-inset': 'inset 0 2px 4px rgba(60,40,20,.26), inset 0 -1px 0 rgba(255,255,255,.6)',
      '--el-primary': 'inset 0 1px 0 rgba(255,255,255,.22), inset 0 -2px 0 rgba(0,0,0,.18), 0 3px 0 #263B30, 0 8px 14px rgba(30,45,35,.24)',
      '--press-inset': 'inset 0 3px 6px rgba(20,30,25,.45), inset 0 -1px 0 rgba(255,255,255,.18)',
      '--press-shadow': 'inset 0 3px 6px rgba(20,30,25,.45), inset 0 -1px 0 rgba(255,255,255,.18)',
      '--ring': 'none', '--glow': 'rgba(0,0,0,0)', '--glow-blur': '0px', '--glow-ambient': 'none',
      '--grad-accent': 'linear-gradient(90deg, #C9A06A, #B0603A)', '--grad-hero': '#F4EDE2',
      '--glass-bg': '#EDE3D3', '--glass-border': '#4A3B2E', '--glass-shadow': '0 4px 0 #A8926F, 0 14px 26px rgba(60,40,20,.18)',
      '--card-bg': '#F4EDE2', '--card-border': 'rgba(74,59,46,.55)',
      '--card-shadow': 'inset 0 1px 0 rgba(255,255,255,.7), inset 0 -2px 0 rgba(90,60,30,.08), 0 3px 0 #BDA98B, 0 10px 18px rgba(60,40,20,.12)',
      '--meter-from': '#C9A06A', '--meter-to': '#B0603A', '--meter-glow': 'rgba(0,0,0,0)',
      '--chart-1': '#B0603A', '--chart-2': '#3F5E4E', '--chart-3': '#C9A06A', '--chart-4': '#6A7B82', '--chart-track': '#D8CAB3',
    },
    extra: {
      '--carve': '#3A2C21', '--relief-hi': 'rgba(255,255,255,.55)', '--relief-lo': 'rgba(60,40,20,.18)', '--relief-drop': '#A8926F',
      '--emboss': '0 1px 0 rgba(255,255,255,.55)', '--ai-bg': '#E3E6D6',
      '--hero-bw': '3px', '--hero-shadow': 'inset 0 0 0 3px rgba(244,237,226,.8), 0 4px 0 #8F7A5A, 0 16px 28px rgba(60,40,20,.2)',
      '--hero-inner-line': 'rgba(43,33,25,.55)', '--hero-text-shadow': '0 1px 0 rgba(255,250,240,.6)', '--hero-muted': '#3E3127',
      '--scene-line': '#2B2119', '--scene-line-w': '1.6', '--scene-blend': 'multiply',
      '--scene-hatch': `repeating-linear-gradient(-4deg, rgba(43,33,25,.07) 0 1px, transparent 1px 6px), ${grain({ size: 300, rgb: [60, 40, 20], gain: 0.6, cut: 0.3, seed: 4 })}`,
      '--r-cal': '10px', '--today-bg': '#2B2119', '--today-ink': '#F6F0E4', '--today-drop': '#0F0B08', '--today-ring': '#93401F',
      '--done-drop': '#7E4126', '--cal-partial-rest': '#EADFCE', '--cal-partial-ink': '#2B2119',
      '--cal-planned-bg': '#F4EDE2', '--cal-planned-ring': '#3F5E4E',
    },
    scene: { sky: '#E3D2B8', haze: '#ECDFC8', sun: '#F6ECDA', far: '#C3A589', mid: '#A27C62', lake: '#A7BCB2', pine: '#3B5043', hill1: '#8C9A72', hill2: '#64744E', treeA: '#B4AC78', treeB: '#B98266', trunk: '#46342A', bird: '#2B2119', flower: '#D2A07D' },
  },
  {
    id: 'vivid-b', name: '胡桃深木', en: 'Walnut',
    description: '深胡桃木底、奶油色字，像夜里的木刻；暗而不黑，低眩光，适合长时间看。',
    scheme: 'dark',
    swatches: ['#231913', '#33261D', '#EDE2CF', '#A9C2A8', '#D79E63', '#8FAE95'],
    grainBg: grain({ rgb: [8, 4, 2], gain: 0.9, cut: 0.46, seed: 21, fy: 0.07 }),
    grainCard: grain({ size: 300, rgb: [255, 228, 190], gain: 0.25, cut: 0.14, seed: 6, fy: 0.12 }),
    grainWood: grain({ size: 300, rgb: [0, 0, 0], gain: 0.6, cut: 0.34, seed: 12, fy: 0.14 }),
    tokens: {
      '--c-bg': '#231913', '--c-surface': '#33261D', '--c-surface-2': '#3D2E23',
      '--c-ink': '#EDE2CF', '--c-ink-muted': '#C9B79E', '--c-faint': '#A8957D', '--c-line': '#4E3B2D',
      '--c-primary': '#A9C2A8', '--c-on-primary': '#1C1510', '--c-signature': '#D79E63', '--c-signature-2': '#8FAE95',
      '--c-accent-text': '#E8B57E', '--c-done': '#D79E63', '--c-on-done': '#21170F', '--c-attention': '#E8B57E',
      '--c-warn': '#F0907A', '--c-warn-soft': '#4A2A22', '--c-ai': '#33261D', '--c-inset': '#1C140F',
      '--c-invert-bg': '#4A3829', '--c-invert-ink': '#F2D8B2', '--c-focus': '#F2D8B2', '--c-scrim': 'rgba(10,6,4,.6)',
      '--f-num-style': 'italic',
      '--r-control': '14px', '--r-panel': '18px', '--r-chip': '14px', '--r-hero': '150px 150px 18px 18px', '--bw': '1px',
      '--mat-surface': '#3A2B21', '--mat-primary': 'linear-gradient(180deg, rgba(255,255,255,.18), rgba(255,255,255,0) 55%), #A9C2A8',
      '--mat-hl': 'inset 0 1px 0 rgba(255,235,210,.12)',
      '--el-1': 'inset 0 1px 0 rgba(255,235,210,.10), 0 2px 0 #120C08, 0 6px 12px rgba(0,0,0,.35)',
      '--el-2': 'inset 0 1px 0 rgba(255,235,210,.10), 0 3px 0 #120C08, 0 10px 20px rgba(0,0,0,.4)',
      '--el-3': '0 4px 0 #0E0906, 0 16px 30px rgba(0,0,0,.5)',
      '--el-inset': 'inset 0 2px 5px rgba(0,0,0,.55), inset 0 -1px 0 rgba(255,235,210,.07)',
      '--el-primary': 'inset 0 1px 0 rgba(255,255,255,.35), inset 0 -2px 0 rgba(0,0,0,.18), 0 3px 0 #5E745E, 0 8px 16px rgba(0,0,0,.4)',
      '--press-inset': 'inset 0 3px 6px rgba(0,0,0,.45), inset 0 -1px 0 rgba(255,255,255,.2)',
      '--press-shadow': 'inset 0 3px 6px rgba(0,0,0,.45), inset 0 -1px 0 rgba(255,255,255,.2)',
      '--ring': 'none', '--glow': 'rgba(0,0,0,0)', '--glow-blur': '0px', '--glow-ambient': 'none',
      '--grad-accent': 'linear-gradient(90deg, #B98B5E, #D79E63)', '--grad-hero': '#33261D',
      '--glass-bg': '#2E221A', '--glass-border': '#4E3B2D', '--glass-shadow': '0 4px 0 #0E0906, 0 14px 26px rgba(0,0,0,.5)',
      '--card-bg': '#33261D', '--card-border': '#4E3B2D',
      '--card-shadow': 'inset 0 1px 0 rgba(255,235,210,.10), inset 0 -2px 0 rgba(0,0,0,.3), 0 3px 0 #120C08, 0 10px 20px rgba(0,0,0,.4)',
      '--meter-from': '#B98B5E', '--meter-to': '#D79E63', '--meter-glow': 'rgba(0,0,0,0)',
      '--chart-1': '#D79E63', '--chart-2': '#8FAE95', '--chart-3': '#B98B5E', '--chart-4': '#8E9DA3', '--chart-track': '#2A1F18',
      '--orb-glass': 'rgba(58,43,33,.92)', '--orb-border': 'rgba(255,235,210,.18)', '--orb-ink': '#EDE2CF', '--orb-sub': '#C9B79E', '--orb-action': 'rgba(255,235,210,.08)', '--orb-action-line': 'rgba(255,235,210,.12)',
    },
    extra: {
      '--carve': '#0E0906', '--relief-hi': 'rgba(255,235,210,.14)', '--relief-lo': 'rgba(0,0,0,.45)', '--relief-drop': '#0E0906',
      '--emboss': '0 -1px 0 rgba(0,0,0,.6)', '--ai-bg': '#2F3329',
      '--hero-bw': '3px', '--hero-shadow': 'inset 0 0 0 3px rgba(255,235,210,.08), 0 4px 0 #0E0906, 0 16px 30px rgba(0,0,0,.5)',
      '--hero-inner-line': 'rgba(242,216,178,.45)', '--hero-text-shadow': '0 1px 2px rgba(0,0,0,.55)', '--hero-muted': '#E2D2BA',
      '--scene-line': '#120C08', '--scene-line-w': '1.6', '--scene-blend': 'soft-light',
      '--scene-hatch': `repeating-linear-gradient(-4deg, rgba(255,235,210,.06) 0 1px, transparent 1px 6px), ${grain({ size: 300, rgb: [0, 0, 0], gain: 0.7, cut: 0.36, seed: 8 })}`,
      '--r-cal': '12px', '--today-bg': '#EDE2CF', '--today-ink': '#1C1510', '--today-drop': '#8C7A62', '--today-ring': '#E8B57E',
      '--done-drop': '#7A5532', '--cal-partial-rest': '#2A1F18', '--cal-partial-ink': '#EDE2CF',
      '--cal-planned-bg': '#2B211A', '--cal-planned-ring': '#A9C2A8',
    },
    scene: { sky: '#3B2D24', haze: '#4A3A2C', sun: '#E2BE8C', far: '#5A4535', mid: '#6E513C', lake: '#4E625C', pine: '#21302A', hill1: '#4D5A3D', hill2: '#39452E', treeA: '#7A734B', treeB: '#8E5C45', trunk: '#1C140F', bird: '#EDE2CF', flower: '#C99C73' },
  },
  {
    id: 'vivid-c', name: '雕版套色', en: 'Block print',
    description: '宣纸底、墨黑加朱砂两色套印，边框方正、带一点套色错位；木纹只用在按钮与导航这些“木块”上。',
    scheme: 'light',
    swatches: ['#EEE7D7', '#F7F2E6', '#1F1C18', '#A8341F', '#6B6258', '#3E5A73'],
    grainBg: fibre({ rgb: [70, 58, 40], gain: 0.45, cut: 0.25, seed: 3 }),
    grainCard: fibre({ size: 180, rgb: [70, 58, 40], gain: 0.35, cut: 0.2, seed: 8 }),
    grainWood: grain({ size: 300, rgb: [255, 240, 220], gain: 0.4, cut: 0.22, seed: 14, fy: 0.14 }),
    tokens: {
      '--c-bg': '#EEE7D7', '--c-surface': '#F7F2E6', '--c-surface-2': '#E6DCC8',
      '--c-ink': '#1F1C18', '--c-ink-muted': '#4F4840', '--c-faint': '#6B6258', '--c-line': '#B9AE99',
      '--c-primary': '#2A2622', '--c-on-primary': '#F7F2E6', '--c-signature': '#A8341F', '--c-signature-2': '#3E5A73',
      '--c-accent-text': '#A8341F', '--c-done': '#A8341F', '--c-on-done': '#FBF5EA', '--c-attention': '#A8341F',
      '--c-warn': '#8E2414', '--c-warn-soft': '#F2D9CC', '--c-ai': '#F7F2E6', '--c-inset': '#E4DAC5',
      '--c-invert-bg': '#2A2622', '--c-invert-ink': '#F2EADA', '--c-focus': '#3E5A73', '--c-scrim': 'rgba(31,28,24,.4)',
      '--f-num': '"Noto Serif SC", "Songti SC", "STSong", serif', '--f-num-style': 'normal', '--w-num': '700',
      '--r-control': '6px', '--r-panel': '6px', '--r-chip': '4px', '--r-hero': '8px', '--bw': '2px',
      '--mat-surface': '#F7F2E6', '--mat-primary': 'linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,0) 60%), #2A2622',
      '--mat-hl': 'inset 0 1px 0 rgba(255,255,255,.6)',
      '--el-1': '2px 2px 0 rgba(31,28,24,.22)',
      '--el-2': '3px 3px 0 rgba(31,28,24,.22)',
      '--el-3': '4px 4px 0 rgba(168,52,31,.3)',
      '--el-inset': 'inset 2px 2px 0 rgba(31,28,24,.16), inset -1px -1px 0 rgba(255,255,255,.6)',
      '--el-primary': 'inset 0 1px 0 rgba(255,255,255,.15), 3px 3px 0 rgba(168,52,31,.55)',
      '--press-inset': 'inset 2px 2px 0 rgba(0,0,0,.35)', '--press-shadow': 'inset 2px 2px 0 rgba(0,0,0,.35)',
      '--ring': 'none', '--glow': 'rgba(0,0,0,0)', '--glow-blur': '0px', '--glow-ambient': 'none',
      '--grad-accent': 'linear-gradient(90deg, #A8341F, #A8341F)', '--grad-hero': '#F7F2E6',
      '--glass-bg': '#F7F2E6', '--glass-border': '#1F1C18', '--glass-shadow': '3px 3px 0 rgba(168,52,31,.35)',
      '--card-bg': '#F7F2E6', '--card-border': '#1F1C18',
      '--card-shadow': '3px 3px 0 rgba(168,52,31,.26)',
      '--meter-from': '#A8341F', '--meter-to': '#A8341F', '--meter-glow': 'rgba(0,0,0,0)',
      '--chart-1': '#A8341F', '--chart-2': '#2A2622', '--chart-3': '#B9AE99', '--chart-4': '#3E5A73', '--chart-track': '#E0D6C1',
    },
    extra: {
      '--carve': '#1F1C18', '--relief-hi': 'rgba(255,255,255,.25)', '--relief-lo': 'rgba(31,28,24,.18)', '--relief-drop': '#1F1C18',
      '--emboss': 'none', '--ai-bg': '#F7F2E6',
      '--hero-bw': '3px', '--hero-shadow': '4px 4px 0 rgba(168,52,31,.35)',
      '--hero-inner-line': 'rgba(31,28,24,.7)', '--hero-text-shadow': 'none', '--hero-muted': '#3B352F',
      '--scene-line': '#1F1C18', '--scene-line-w': '1.8', '--scene-blend': 'multiply',
      '--scene-hatch': `repeating-linear-gradient(0deg, rgba(31,28,24,.06) 0 1px, transparent 1px 5px), ${fibre({ rgb: [40, 30, 20], gain: 0.5, cut: 0.27, seed: 5 })}`,
      '--r-cal': '4px', '--today-bg': '#1F1C18', '--today-ink': '#F7F2E6', '--today-drop': '#A8341F', '--today-ring': '#A8341F',
      '--done-drop': '#5E1A0E', '--cal-partial-rest': '#F7F2E6', '--cal-partial-ink': '#1F1C18',
      '--cal-planned-bg': '#F7F2E6', '--cal-planned-ring': '#1F1C18',
    },
    scene: { sky: '#EFE8D8', haze: '#E7DCC5', sun: '#E2A28F', far: '#B5AC9B', mid: '#8F877A', lake: '#DCD3C0', pine: '#2A2622', hill1: '#7D766A', hill2: '#5A544B', treeA: '#8E8576', treeB: '#A8341F', trunk: '#1F1C18', bird: '#1F1C18', flower: '#A8341F' },
  },
  {
    id: 'vivid-d', name: '暖阳柔木', en: 'Soft sun',
    description: '保留现在的暖杏与鼠尾草绿，但压低亮度和饱和度，加木纹、浅浮雕和清楚的描边，今日和状态一眼可辨。',
    scheme: 'light',
    swatches: ['#F0E2D0', '#F9F0E4', '#36241F', '#4C6A5B', '#C0764A', '#E2C0A2'],
    grainBg: grain({ rgb: [140, 90, 55], gain: 0.55, cut: 0.28, seed: 31, fy: 0.07 }),
    grainCard: grain({ size: 300, rgb: [150, 100, 60], gain: 0.4, cut: 0.22, seed: 33, fy: 0.12 }),
    grainWood: grain({ size: 300, rgb: [30, 20, 10], gain: 0.55, cut: 0.3, seed: 35, fy: 0.14 }),
    tokens: {
      '--c-bg': '#F0E2D0', '--c-surface': '#F9F0E4', '--c-surface-2': '#EAD8C4',
      '--c-ink': '#36241F', '--c-ink-muted': '#654A40', '--c-faint': '#765A4E', '--c-line': '#D9C0AA',
      '--c-primary': '#4C6A5B', '--c-on-primary': '#FBF6EE', '--c-signature': '#C0764A', '--c-signature-2': '#7A9888',
      '--c-accent-text': '#A0432C', '--c-done': '#A35A33', '--c-on-done': '#FFF7EF', '--c-attention': '#A0432C',
      '--c-warn': '#A0301D', '--c-warn-soft': '#F6DED3', '--c-ai': '#F9F0E4', '--c-inset': '#E8D9C6',
      '--c-invert-bg': '#E2C0A2', '--c-invert-ink': '#40211C', '--c-focus': '#2F5248', '--c-scrim': 'rgba(54,36,31,.34)',
      '--r-panel': '22px', '--bw': '1px',
      '--mat-surface': '#F9F0E4', '--mat-primary': 'linear-gradient(180deg, rgba(255,255,255,.2), rgba(255,255,255,0) 55%), #4C6A5B',
      '--el-1': 'inset 0 1px 0 rgba(255,255,255,.8), 0 2px 0 #DCC4AE, 0 6px 12px rgba(140,80,50,.10)',
      '--el-2': 'inset 0 1px 0 rgba(255,255,255,.8), 0 3px 0 #DCC4AE, 0 12px 24px rgba(140,80,50,.12)',
      '--el-3': '0 4px 0 #CDB096, 0 18px 32px rgba(140,70,45,.16)',
      '--el-inset': 'inset 0 2px 4px rgba(110,70,45,.22), inset 0 -1px 0 rgba(255,255,255,.7)',
      '--el-primary': 'inset 0 1.5px 0 rgba(255,255,255,.28), inset 0 -2px 0 rgba(0,0,0,.12), 0 3px 0 #344C40, 0 10px 18px rgba(50,70,60,.22)',
      '--press-inset': 'inset 0 3px 6px rgba(30,45,38,.38), inset 0 -1px 0 rgba(255,255,255,.3)',
      '--press-shadow': 'inset 0 3px 6px rgba(30,45,38,.38), inset 0 -1px 0 rgba(255,255,255,.3)',
      '--glow': 'rgba(0,0,0,0)', '--glow-blur': '0px',
      '--grad-accent': 'linear-gradient(90deg, #DDB28A, #C0764A)', '--grad-hero': '#F9F0E4',
      '--glass-bg': '#F6EADB', '--glass-border': 'rgba(120,80,55,.3)', '--glass-shadow': '0 3px 0 #DCC4AE, 0 14px 28px rgba(140,70,45,.16)',
      '--card-bg': '#F9F0E4', '--card-border': 'rgba(120,80,55,.26)',
      '--card-shadow': 'inset 0 1px 0 rgba(255,255,255,.85), inset 0 -2px 0 rgba(140,90,60,.07), 0 2px 0 #DFC8B2, 0 10px 22px rgba(140,80,50,.11)',
      '--meter-from': '#DDB28A', '--meter-to': '#C0764A', '--meter-glow': 'rgba(0,0,0,0)',
      '--chart-1': '#C0764A', '--chart-2': '#4C6A5B', '--chart-3': '#DDB28A', '--chart-4': '#71888A', '--chart-track': '#E6D6C3',
    },
    extra: {
      '--carve': 'rgba(91,63,51,.75)', '--relief-hi': 'rgba(255,255,255,.6)', '--relief-lo': 'rgba(140,80,50,.16)', '--relief-drop': '#CDB096',
      '--emboss': '0 1px 0 rgba(255,255,255,.7)', '--ai-bg': '#E2E8DF',
      '--hero-bw': '2px', '--hero-shadow': 'inset 0 0 0 3px rgba(249,240,228,.7), 0 4px 0 #CDB096, 0 18px 32px rgba(140,70,45,.16)',
      '--hero-inner-line': 'rgba(91,63,51,.4)', '--hero-text-shadow': '0 1px 0 rgba(255,248,238,.6)', '--hero-muted': '#4E3830',
      '--scene-line': 'rgba(70,45,36,.65)', '--scene-line-w': '1.2', '--scene-blend': 'multiply',
      '--scene-hatch': `repeating-linear-gradient(-4deg, rgba(91,63,51,.05) 0 1px, transparent 1px 7px), ${grain({ size: 300, rgb: [120, 70, 40], gain: 0.5, cut: 0.26, seed: 36 })}`,
      '--r-cal': '14px', '--today-bg': '#4C6A5B', '--today-ink': '#FBF6EE', '--today-drop': '#2F4539', '--today-ring': '#A0432C',
      '--done-drop': '#8E5130', '--cal-partial-rest': '#F3E6D6', '--cal-partial-ink': '#36241F',
      '--cal-planned-bg': '#F9F0E4', '--cal-planned-ring': '#C0764A',
    },
    scene: { sky: '#EFCFB3', haze: '#F4DEC9', sun: '#FBF0E0', far: '#D9A189', mid: '#B97A62', lake: '#A6C4BB', pine: '#3E5A4C', hill1: '#869D73', hill2: '#5F7A53', treeA: '#BFBC83', treeB: '#D08A70', trunk: '#5B3F33', bird: '#36241F', flower: '#E7B091' },
  },
];

const block = (selector, values) => `${selector} {\n${Object.entries(values).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}\n`;
mkdirSync(join(root, 'src/themes/vivid-previews'), { recursive: true });
for (const v of variants) {
  const tokens = { ...v.tokens, '--c-bg-grad': `${v.grainBg}, ${v.tokens['--c-bg']}`, '--grain-card': v.grainCard, '--grain-wood': v.grainWood, ...v.extra };
  const scene = Object.fromEntries(Object.entries(v.scene).map(([k, val]) => [`--scene-${k}`, val]));
  const css = `/* ${v.name}（${v.en}）· ${v.description}\n * Generated by tools/preview/vivid-redesign/build-variants.mjs — preview only; see _relief.css. */\n`
    + block(`html[data-vivid-variant="${v.id}"]:root`, { ...tokens, 'color-scheme': v.scheme })
    + block(`html[data-vivid-variant="${v.id}"] .v9-scene[data-scene]`, scene);
  writeFileSync(join(root, `src/themes/vivid-previews/${v.id}.css`), css);
}

/* WCAG contrast of the main text pairs, shown on the preview page. */
const lum = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return Math.round(((x + 0.05) / (y + 0.05)) * 10) / 10; };
const summary = variants.map(v => {
  const t = { ...v.tokens, ...v.extra };
  const pairs = [
    ['正文 / 卡片', t['--c-ink'], t['--c-surface']], ['次要字 / 卡片', t['--c-ink-muted'], t['--c-surface']],
    ['淡字 / 底色', t['--c-faint'], t['--c-bg']], ['强调字 / 卡片', t['--c-accent-text'], t['--c-surface']],
    ['主按钮', t['--c-on-primary'], t['--c-primary']], ['今日', t['--today-ink'], t['--today-bg']], ['已完成日', t['--c-on-done'], t['--c-done']],
  ].map(([label, fg, bg]) => ({ label, fg, bg, ratio: ratio(fg, bg) }));
  return { id: v.id, name: v.name, en: v.en, description: v.description, scheme: v.scheme, swatches: v.swatches, contrast: pairs };
});
mkdirSync(join(root, 'outputs/vivid-redesign'), { recursive: true });
writeFileSync(join(root, 'outputs/vivid-redesign/variants.json'), JSON.stringify(summary, null, 2) + '\n');
for (const s of summary) console.log(s.id, s.name, s.contrast.map(c => `${c.label} ${c.ratio}`).join(' | '));
