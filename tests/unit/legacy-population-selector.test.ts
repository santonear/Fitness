import { expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { legacyAgePopulation } from '../../src/application/engine-profile';
import { EngineProfileEditor } from '../../src/ui/pages/settings/EngineProfileEditor';

it('projects an old older-adult selector by birth month without rewriting the source', () => {
  const original = { kind: 'older_adult' as const, fallsAnswers: [false, false, false, false] };
  const before = JSON.stringify(original);
  expect(legacyAgePopulation(original, '1990-06', '2026-10-18')).toEqual({ kind: 'general' });
  expect(legacyAgePopulation(original, '1961-11', '2026-10-18')).toEqual({ kind: 'general' });
  expect(legacyAgePopulation(original, '1961-10', '2026-10-18')).toEqual(original);
  expect(JSON.stringify(original)).toBe(before);
  expect(legacyAgePopulation(original, undefined, '2026-10-18')).toBe(original);
});

it('shows neither-pregnant-nor-postpartum for legacy age-group records, never an age option', () => {
  const html = renderToStaticMarkup(
    createElement(EngineProfileEditor, {
      locale: 'zh',
      value: {
        healthStorageConsent: { acceptedAt: '2026-10-18T00:00:00.000Z' },
        population: { kind: 'older_adult' },
        birthYearMonth: '1956-01',
      },
      onChange: () => {},
    }),
  );
  expect(html).toContain('<option value="general" selected="">非孕期或产后</option>');
  expect(html).not.toContain('<option value="older_adult"');
});
