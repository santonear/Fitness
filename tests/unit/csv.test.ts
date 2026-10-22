import { describe, expect, it } from 'vitest';
import { csvRow } from '../../src/backend/csv';

describe('csvRow', () => {
  it('quotes every cell, doubles quotes and ends with CRLF', () => {
    expect(csvRow(['a', 'say "hi"', 3, null, undefined])).toBe('"a","say ""hi""","3","",""\r\n');
  });
  it('keeps formula-like cells as text, also after spaces or control characters', () => {
    for (const cell of ['=SUM(A1)', '+1', '-1', '@cmd', '  =1', '\u0001=1', '\tx', '\rx'])
      expect(csvRow([cell])).toBe(`"'${cell}"\r\n`);
    expect(csvRow(['a=b', '1-2'])).toBe('"a=b","1-2"\r\n');
  });
});
