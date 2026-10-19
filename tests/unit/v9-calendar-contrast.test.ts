import { describe, expect, it } from 'vitest';
import source from '../../docs/handoff-v8/02-design-tokens.json';
import type { BuiltinThemeId } from '../../src/themes/contract';
import { themeTokens } from '../../src/themes/token-css';

/**
 * Bo 2026-10-20 “月日历一目了然”: in every theme the month calendar's day states must read at a glance.
 * Text on each state ≥ 4.5:1; state shapes (today ring/badge, done fill, planned ring, missed dash) ≥ 3:1 against the card;
 * and the fills differ by lightness, not hue alone.
 */
const themes = Object.keys(source.themes) as BuiltinThemeId[];
const luminance = (hex: string) => {
  const channels = hex.replace('#', '').match(/../g)!.map(part => parseInt(part, 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};
const ratio = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const hex = /^#[0-9A-F]{6}$/i;

describe('V9 month calendar contrast', () => {
  for (const id of themes) {
    const { calendar: cal, color } = source.themes[id];
    const grounds = { bg: color.bg, surface: color.surface };

    it(`${id}: calendar colours are plain hex values exposed as --cal-* tokens`, () => {
      const colours = Object.entries(cal).filter(([key]) => !['radius', 'doneShadow'].includes(key));
      for (const [key, value] of colours) expect(value, `${id} calendar.${key}`).toMatch(hex);
      const tokens = themeTokens(id);
      expect(tokens['--cal-today-bg']).toBe(cal.todayBg);
      expect(tokens['--cal-done-bg']).toBe(cal.doneBg);
      expect(tokens['--cal-planned-ring']).toBe(cal.plannedRing);
    });

    it(`${id}: every day number is readable on its state (≥ 4.5:1)`, () => {
      const pairs: [string, string, string][] = [
        ['today badge', cal.todayInk, cal.todayBg],
        ['planned', cal.plannedInk, cal.plannedBg],
        ['done', cal.doneInk, cal.doneBg],
        ['partial', cal.partialInk, cal.partialRest],
        ['missed on bg', cal.missedInk, grounds.bg],
        ['missed on card', cal.missedInk, grounds.surface],
        ['free on bg', color.ink, grounds.bg],
        ['free on card', color.ink, grounds.surface],
      ];
      for (const [label, fg, bg] of pairs) expect(ratio(fg, bg), `${id} ${label}`).toBeGreaterThanOrEqual(4.5);
    });

    it(`${id}: today, done, planned and missed shapes stand out from the card (≥ 3:1)`, () => {
      for (const [name, ground] of Object.entries(grounds)) {
        expect(ratio(cal.todayRing, ground), `${id} today ring on ${name}`).toBeGreaterThanOrEqual(3);
        expect(ratio(cal.todayBg, ground), `${id} today badge on ${name}`).toBeGreaterThanOrEqual(3);
        expect(ratio(cal.doneBg, ground), `${id} done fill on ${name}`).toBeGreaterThanOrEqual(3);
        expect(ratio(cal.plannedRing, ground), `${id} planned ring on ${name}`).toBeGreaterThanOrEqual(3);
        expect(ratio(cal.missedLine, ground), `${id} missed dash on ${name}`).toBeGreaterThanOrEqual(3);
      }
      expect(ratio(cal.todayBg, cal.plannedBg), `${id} today badge on a planned day`).toBeGreaterThanOrEqual(3);
      expect(ratio(cal.todayRing, cal.plannedBg), `${id} today ring next to a planned day`).toBeGreaterThanOrEqual(3);
      expect(ratio(cal.doneBg, cal.partialRest), `${id} partial: filled half vs open half`).toBeGreaterThanOrEqual(3);
    });

    it(`${id}: states differ by lightness, not hue alone`, () => {
      expect(ratio(cal.doneBg, cal.plannedBg), `${id} done vs planned fill`).toBeGreaterThanOrEqual(2.5);
      expect(ratio(cal.plannedBg, grounds.surface), `${id} planned fill vs free day`).toBeGreaterThanOrEqual(1.15);
      expect(ratio(cal.doneBg, grounds.surface), `${id} done fill vs free day`).toBeGreaterThanOrEqual(3);
    });
  }
});
