import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { PainBodyPicker } from '../../src/ui/components/kit';
import { painSpotLabel } from '../../src/ui/pages/training/PainCheckinPanel';

const render = (sex: 'male' | 'female', value?: Parameters<typeof PainBodyPicker>[0]['value']) =>
  renderToStaticMarkup(
    createElement(PainBodyPicker, {
      sex,
      value,
      onChange: () => {},
      label: 'figure',
      spotLabel: spot => painSpotLabel('zh', spot),
      viewLabels: { front: '正面', back: '背面' },
    }),
  );

it('offers both sides of five joints on the front and the neck and low back on the back', () => {
  const html = render('female');
  const labels = [...html.matchAll(/class="v9-pain-hit"[^>]*aria-label="([^"]+)"/g)].map(match => match[1]);
  expect(labels).toEqual([
    '右肩',
    '左肩',
    '右腕',
    '左腕',
    '右髋',
    '左髋',
    '右膝',
    '左膝',
    '右踝',
    '左踝',
    '颈',
    '腰背',
  ]);
  expect(html).not.toContain('aria-pressed="true"');
  // The user's right knee sits on the screen's left: female knee x = 76 → (76 + 6) / 432.
  expect(html).toMatch(/left:18\.98\d*%;top:72\.45\d*%" aria-label="右膝"/);
});

it('marks the picked spot with its tag and names sides in both languages', () => {
  const html = render('male', { area: 'knee', side: 'left' });
  expect(html).toMatch(/aria-label="左膝" aria-pressed="true"/);
  expect(html).toContain('>左膝</span>');
  expect(painSpotLabel('en', { area: 'knee', side: 'right' })).toBe('Right knee');
  expect(painSpotLabel('en', { area: 'neck' })).toBe('Neck');
  expect(painSpotLabel('zh', { area: 'back' })).toBe('腰背');
});
