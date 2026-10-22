import { readFileSync } from 'node:fs';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_HOME_PANEL_STYLE, MUSCLE_GROUPS, type HomePanelProps, type MuscleGroup, type NowMinutes } from '../../src/domain/plan-upgrade';
import { AnatomyMap, FIGURE_OUTLINES, anatomyLabel, buildAnatomy, fatFromPercent, fatOf } from '../../src/ui/components/kit/AnatomyMap';
import { HomePanel, MinutesGroup, heroKnob, ringLevel } from '../../src/ui/components/kit/HomePanel';
import { JourneyTrail } from '../../src/ui/components/kit/JourneyTrail';
import * as kit from '../../src/ui/components/kit';

const html = (element: ReactElement) => renderToStaticMarkup(element);
const FRONT: MuscleGroup[] = ['traps', 'delts', 'chest', 'biceps', 'forearms', 'abs', 'obliques', 'quads', 'adductors', 'calves'];
const BACK: MuscleGroup[] = ['traps', 'delts', 'triceps', 'forearms', 'lats', 'lowerback', 'glutes', 'hamstrings', 'calves'];

const pairs = (d: string) => { const n = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number); return n.flatMap((_, i) => i % 2 ? [] : [[n[i], n[i + 1]] as const]); };
/** x of the morphed outline point that comes from source point (sx, sy); the left half is drawn, so wider → smaller x. */
function edgeX(sex: 'male' | 'female', d: string, sx: number, sy: number) {
  const index = pairs(FIGURE_OUTLINES[sex]).findIndex(([x, y]) => x === sx && y === sy);
  expect(index).toBeGreaterThan(0);
  return pairs(d)[index][0];
}
const leftEdge = (d: string, y: number) => y === 172 ? edgeX('male', d, 68, 198) : edgeX('female', d, 58, 240);

describe('AnatomyMap', () => {
  it('draws all 15 regions across front and back, each mirrored', () => {
    const model = buildAnatomy({ primary: [], secondary: [] });
    expect([...new Set(model.regions.map(r => r.group))].sort()).toEqual([...MUSCLE_GROUPS].sort());
    for (const [view, groups] of [['front', FRONT], ['back', BACK]] as const) {
      const drawn = model.regions.filter(r => r.view === view);
      expect([...new Set(drawn.map(r => r.group))].sort()).toEqual([...groups].sort());
      expect(drawn.filter(r => r.mirror)).toHaveLength(groups.length);
    }
    const markup = html(createElement(AnatomyMap, { width: 390, primary: [], secondary: [] }));
    for (const group of MUSCLE_GROUPS) expect(markup).toContain(`data-group="${group}"`);
    expect(markup).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(/i);
  });

  it('marks primary (glow) and secondary (pale) roles; a group in both lists stays primary', () => {
    const model = buildAnatomy({ primary: ['lats', 'calves'], secondary: ['biceps', 'calves', 'abs'] });
    expect(model.secondary).toEqual(['biceps', 'abs']);
    expect(model.regions.filter(r => r.group === 'lats').every(r => r.role === 'primary')).toBe(true);
    expect(model.regions.filter(r => r.group === 'biceps').every(r => r.role === 'secondary')).toBe(true);
    expect(model.regions.filter(r => r.group === 'chest').every(r => r.role === 'none')).toBe(true);
    const markup = html(createElement(AnatomyMap, { width: 390, primary: ['lats', 'calves'], secondary: ['biceps'] }));
    expect(markup.match(/class="v9-am-glow"/g)).toHaveLength(2 /* lats */ + 4 /* calves front+back */);
    expect(markup).toContain('role="img"');
    expect(markup).toContain('aria-label="男性全身肌群图，正面与背面。主练：背阔肌、小腿；辅助：肱二头"');
    expect(anatomyLabel(model, 'en')).toBe('Male full-body muscle map, front and back. Main: Lats, Calves. Assisting: Biceps, Abs.');
  });

  it('numbers labels primaries first, then secondaries except traps, at most two per side', () => {
    const model = buildAnatomy({ primary: ['lats', 'calves'], secondary: ['biceps', 'traps', 'abs'], labels: true });
    expect(model.tags.map(t => [t.n, t.group, t.primary])).toEqual([[1, 'lats', true], [2, 'calves', true], [3, 'biceps', false], [4, 'abs', false]]);
    expect(model.viewBox).toBe('0 0 470 440');
    expect(buildAnatomy({ primary: ['lats'], secondary: [], labels: false }).tags).toEqual([]);
    expect(buildAnatomy({ primary: ['lats'], secondary: [] }).viewBox).toBe('30 4 410 428');
    const markup = html(createElement(AnatomyMap, { width: 390, primary: ['lats', 'calves'], secondary: ['biceps', 'traps', 'abs'], labels: true }));
    expect(markup.match(/class="v9-am-leader"/g)).toHaveLength(4);
    expect(markup).toContain('>背阔肌</text>');
    expect(markup).toContain('height="365"');
  });

  it('draws the standard figure without height and weight', () => {
    expect(fatOf(undefined, 90)).toBe(0);
    expect(fatOf(180, undefined)).toBe(0);
    const plain = buildAnatomy({ primary: [], secondary: [] });
    expect(buildAnatomy({ primary: [], secondary: [], shape: { sex: 'male', weightKg: 120 } }).outline).toEqual(plain.outline);
    expect(buildAnatomy({ primary: [], secondary: [], shape: { heightCm: 180, weightKg: 71.28 } }).outline).toEqual(plain.outline);
    expect(plain.sex).toBe('male');
    expect(plain.ghost).toEqual([]);
  });

  it('a logged body fat shapes the figure instead of BMI, also without height, and draws its own ghost', () => {
    const plain = buildAnatomy({ primary: [], secondary: [] });
    expect(fatFromPercent('male', undefined)).toBeUndefined();
    expect(fatFromPercent('male', 18)).toBe(0);
    expect(fatFromPercent('female', 27)).toBe(0);
    expect(fatFromPercent('male', 90)).toBe(1.6);
    expect(buildAnatomy({ primary: [], secondary: [], shape: { sex: 'male', bodyFatPercent: 18, heightCm: 170, weightKg: 120 } }).outline).toEqual(plain.outline);
    const fuller = buildAnatomy({ primary: [], secondary: [], shape: { sex: 'male', bodyFatPercent: 30 }, ghostBodyFatPercent: 18 });
    expect(fuller.outline).not.toEqual(plain.outline);
    expect(fuller.ghost.map(part => part.d)).toEqual(plain.outline.map(part => part.d));
  });

  it('morphs monotonically: heavier men widen at the waist, heavier women at the hips', () => {
    const waist = (kg: number) => leftEdge(buildAnatomy({ primary: [], secondary: [], shape: { sex: 'male', heightCm: 180, weightKg: kg } }).outline[0].d, 172);
    const hips = (kg: number) => leftEdge(buildAnatomy({ primary: [], secondary: [], shape: { sex: 'female', heightCm: 165, weightKg: kg } }).outline[0].d, 222);
    const male = [60, 72, 90, 110].map(waist);
    const female = [48, 58, 70, 85].map(hips);
    for (let i = 1; i < 4; i++) { expect(male[i]).toBeLessThan(male[i - 1]); expect(female[i]).toBeLessThan(female[i - 1]); }
    const ghost = buildAnatomy({ primary: [], secondary: [], shape: { heightCm: 180, weightKg: 90 }, ghostWeightKg: 100 });
    expect(ghost.ghost).toHaveLength(4);
    expect(leftEdge(ghost.ghost[0].d, 172)).toBeLessThan(leftEdge(ghost.outline[0].d, 172));
  });

  it('draws the female figure with its own outline and hair', () => {
    const female = buildAnatomy({ primary: [], secondary: [], shape: { sex: 'female' } });
    const male = buildAnatomy({ primary: [], secondary: [] });
    expect(female.sex).toBe('female');
    expect(female.outline[0].d).not.toBe(male.outline[0].d);
    expect(female.hair[0].d).not.toBe(male.hair[0].d);
    expect(female.details.length).toBeGreaterThan(male.details.length);
  });

  it('stops every information animation under reduced motion', () => {
    const css = readFileSync(new URL('../../src/ui/components/kit/kit.css', import.meta.url), 'utf8');
    const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    for (const cls of ['.v9-am-glow', '.v9-am-leader', '.v9-am-badge', '.v9-badge', '.v9-trail-dot', '.v9-home-seg', '.v9-anatomy-scan']) expect(reduced).toContain(cls);
    expect(reduced).toContain('animation: none !important');
    expect(css).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(/i);
  });
});

describe('HomePanel', () => {
  const base = (over: Partial<HomePanelProps> = {}): HomePanelProps => ({
    style: DEFAULT_HOME_PANEL_STYLE, minutes: 15, onMinutes() {}, onStart() {},
    focus: { primary: ['lats', 'calves'], secondary: ['biceps'], byExercise: {} },
    weekLoads: [{ group: 'lats', sets: 2, level: 'low' }, { group: 'chest', sets: 10, level: 'ok' }], weekDone: 2, weekTarget: 3, ...over,
  });

  it('defaults to the hero style with the 5/15/30/45 radiogroup and one start button', () => {
    expect(DEFAULT_HOME_PANEL_STYLE).toBe('hero');
    const markup = html(createElement(HomePanel, base()));
    expect(markup).toContain('data-style="hero"');
    expect(markup).toContain('role="radiogroup" aria-label="现在有多少时间"');
    expect(markup.match(/role="radio"/g)).toHaveLength(4);
    expect(markup).toContain('aria-checked="true" aria-label="15 分钟"');
    expect(markup.match(/>开始</g)).toHaveLength(1);
    expect(markup).toContain('本周 2/3');
    expect(markup).toContain('class="v9-anatomy"');
    expect(markup).not.toContain('v9-am-tag');
    expect(heroKnob(15).map(v => Math.round(v))).toEqual([66, 91]);
  });

  it('renders ring and twin styles and the optional coach line', () => {
    const ring = html(createElement(HomePanel, base({ style: 'ring', coachLine: '15 分钟刚好把后背补上' })));
    expect(ring).toContain('data-style="ring"');
    expect(ring.match(/class="v9-home-seg"/g)).toHaveLength(10);
    expect(ring).toContain('15 分钟刚好把后背补上');
    expect(ring).toContain('v9-yaya');
    const twin = html(createElement(HomePanel, base({ style: 'twin' })));
    expect(twin).toContain('data-style="twin"');
    expect(twin).not.toContain('v9-yaya');
    expect(ringLevel([{ group: 'lats', sets: 9, level: 'ok' }], ['lats', 'traps'])).toBe('none');
    expect(ringLevel([{ group: 'lats', sets: 9, level: 'ok' }, { group: 'traps', sets: 3, level: 'low' }], ['lats', 'traps'])).toBe('low');
  });

  it('reports the chosen minutes through onMinutes', () => {
    const onMinutes = vi.fn<(m: NowMinutes) => void>();
    const group = MinutesGroup({ minutes: 15, onMinutes, locale: 'en' }) as ReactElement<{ 'aria-label': string; children: ReactElement<{ 'aria-label': string; 'aria-checked': boolean; onClick: () => void }>[] }>;
    expect(group.props['aria-label']).toBe('How much time do you have now');
    const buttons = group.props.children;
    expect(buttons.map(b => b.props['aria-label'])).toEqual(['5 minutes', '15 minutes', '30 minutes', '45 minutes']);
    expect(buttons.map(b => b.props['aria-checked'])).toEqual([false, true, false, false]);
    buttons[2].props.onClick();
    buttons[0].props.onClick();
    expect(onMinutes.mock.calls).toEqual([[30], [5]]);
  });
});

describe('JourneyTrail', () => {
  it('marks done, now (pulsing) and next stops', () => {
    const markup = html(createElement(JourneyTrail, { stops: [{ label: '起点', state: 'done' }, { label: '现在', state: 'now' }, { label: '下一站', state: 'next' }] }));
    expect(markup.match(/class="v9-trail-stop"/g)).toHaveLength(3);
    expect(markup).toContain('data-state="now" aria-current="step"');
    expect(markup).toContain('aria-label="下一站, 下一站"');
  });

  it('is exported from the kit entry point', () => {
    expect(kit.AnatomyMap).toBe(AnatomyMap);
    expect(kit.HomePanel).toBe(HomePanel);
    expect(kit.JourneyTrail).toBe(JourneyTrail);
  });
});
