import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getThemeSlots, themes } from '../../src/themes/registry';
import { baseSlots } from '../../src/themes/base/slots';

describe('V8 signature slots', () => {
  it('resolves nine frozen signatures for every registered theme', () => {
    for (const theme of themes) expect(Object.keys(getThemeSlots(theme.id)).sort()).toEqual(Object.keys(baseSlots).sort());
    expect(getThemeSlots('qingci').BrandMark).not.toBe(baseSlots.BrandMark);
    expect(getThemeSlots('liubai').BrandMark).toBe(baseSlots.BrandMark);
  });
  it('renders elapsed rest without announcing each second or counting down', () => {
    const html = renderToStaticMarkup(createElement(baseSlots.RestClock, { elapsedSeconds: 125, label: '已歇' }));
    expect(html).toContain('2:05'); expect(html).not.toContain('aria-live');
  });
  it('retains separate partial markers and accessible progress wording', () => {
    const html = renderToStaticMarkup(createElement(baseSlots.WeekProgress, { complete: 1, partial: 1, target: 3, label: '完成一回，部分一回' }));
    expect(html).toContain('aria-label="完成一回，部分一回"');
    for (const state of ['complete', 'partial', 'empty']) expect(html).toContain(`data-state="${state}"`);
  });
  it.each([{ trainingActive: true, motionReduced: false }, { trainingActive: false, motionReduced: true }])('disables continuous card motion for %o', props => {
    const html = renderToStaticMarkup(createElement(getThemeSlots('qingci').FeatureCard, { ...props, context: 'finish', children: '完成' }));
    expect(html).toContain('data-motion="off"');
  });
  it('provides non-submit disabled controls and unique glaze IDs without nested links', () => {
    const slots = getThemeSlots('qingci');
    const button = renderToStaticMarkup(createElement(slots.SetValue, { label: '修改本组', loadText: '12 kg', targetText: '8', disabled: true, onEdit() {} }));
    expect(button).toContain('type="button"'); expect(button).toContain('disabled=""');
    const icons = renderToStaticMarkup(createElement('div', null, ...[true, false].map(selected => createElement(slots.NavIcon, { kind: 'training', selected, label: '训练' }))));
    const ids = [...icons.matchAll(/linearGradient id="([^"]+)"/g)].map(match => match[1]);
    expect(new Set(ids).size).toBe(2); expect(icons).not.toContain('<button'); expect(icons).not.toContain('<a ');
  });
});
