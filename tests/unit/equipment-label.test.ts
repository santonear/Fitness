import { describe, expect, it } from 'vitest';
import { EQUIPMENT, equipmentLabel } from '../../src/catalog/taxonomy';

describe('equipment labels', () => {
  it('names every equipment key in both languages without showing the key', () => {
    for (const key of EQUIPMENT)
      for (const locale of ['zh', 'en'] as const) {
        const label = equipmentLabel(key, locale);
        expect(label).not.toBe(key);
        expect(label).not.toBe(key.replaceAll('-', ' '));
        expect(/[一-鿿]/.test(label)).toBe(locale === 'zh');
      }
    expect(equipmentLabel('none', 'en')).toBe('No equipment');
    expect(equipmentLabel('backpack', 'zh')).toBe('背包');
  });
  it('keeps custom equipment text as written', () => {
    expect(equipmentLabel('custom-equipment', 'en')).toBe('custom-equipment');
    expect(equipmentLabel('custom-equipment', 'zh')).toBe('custom-equipment');
  });
});
