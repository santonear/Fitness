import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getThemeSlots, themes } from '../../src/themes/registry';
import { baseSlots } from '../../src/themes/base/slots';

describe('V9 signature slots', () => {
  it('resolves nine frozen signatures for every registered theme, each overridden by the theme folder', () => {
    for (const theme of themes) {
      expect(Object.keys(getThemeSlots(theme.id)).sort()).toEqual(Object.keys(baseSlots).sort());
      for (const key of Object.keys(baseSlots) as (keyof typeof baseSlots)[]) expect(getThemeSlots(theme.id)[key]).not.toBe(baseSlots[key]);
    }
  });
  it('renders elapsed rest without announcing each second or counting down', () => {
    for (const theme of themes) {
      const html = renderToStaticMarkup(createElement(getThemeSlots(theme.id).RestClock, { elapsedSeconds: 125, label: '已歇' }));
      expect(html).toContain('2:05'); expect(html).not.toContain('aria-live'); expect(html).not.toContain('role="timer"');
    }
  });
  it('retains separate partial markers and accessible progress wording', () => {
    const html = renderToStaticMarkup(createElement(baseSlots.WeekProgress, { complete: 1, partial: 1, target: 3, label: '完成一回，部分一回' }));
    expect(html).toContain('aria-label="完成一回，部分一回"');
    for (const state of ['complete', 'partial', 'empty']) expect(html).toContain(`data-state="${state}"`);
    for (const theme of themes) expect(renderToStaticMarkup(createElement(getThemeSlots(theme.id).WeekProgress, { complete: 1, partial: 1, target: 3, label: '本周' }))).toContain('aria-label="本周"');
  });
  it.each([{ trainingActive: true, motionReduced: false }, { trainingActive: false, motionReduced: true }])('disables continuous card motion for %o', props => {
    for (const theme of themes) {
      const html = renderToStaticMarkup(createElement(getThemeSlots(theme.id).FeatureCard, { ...props, context: 'finish', children: '完成' }));
      expect(html).toContain('data-motion="off"');
    }
  });
  it('provides non-submit disabled controls and decorative-free icons', () => {
    for (const theme of themes) {
      const slots = getThemeSlots(theme.id);
      const button = renderToStaticMarkup(createElement(slots.SetValue, { label: '修改本组', loadText: '12 kg', targetText: '8', disabled: true, onEdit() {} }));
      expect(button).toContain('type="button"'); expect(button).toContain('disabled=""');
      const start = renderToStaticMarkup(createElement(slots.StartHero, { name: 'A', templateId: 'a', estimatedMinutes: 30, startLabel: '开始训练', disabled: true, onStart() {} }));
      expect(start).toContain('type="button"'); expect(start).toContain('class="v9-btn');
      const icons = renderToStaticMarkup(createElement('div', null, ...(['training', 'plan', 'review', 'me'] as const).map(kind => createElement(slots.NavIcon, { kind, selected: kind === 'plan', label: kind }))));
      expect(icons).toContain('aria-label="me"'); expect(icons).not.toContain('<button'); expect(icons).not.toContain('<a ');
    }
  });
});
