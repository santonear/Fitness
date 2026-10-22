import { describe, expect, it } from 'vitest';
import { cautionFields } from '../../src/application/rules/local-profile';

describe('typed other caution area', () => {
  it('keeps an unsupported area as a note only', () => {
    expect(cautionFields(['other'], ' 脚踝 ')).toEqual({ cautions: ['other'], cautionNote: '脚踝' });
  });
  it('adds a supported joint named in the note', () => {
    expect(cautionFields(['other'], '左膝和手腕')).toEqual({
      cautions: ['other', 'knee', 'wrist'],
      cautionNote: '左膝和手腕',
    });
  });
  it('ignores a note when other is not chosen', () => {
    expect(cautionFields(['back'], '脚踝')).toEqual({ cautions: ['back'] });
  });
});
