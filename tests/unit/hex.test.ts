import { describe, expect, it } from 'vitest';
import { hex, randomHex, sha256Hex } from '../../src/domain/hex';

describe('hex helpers', () => {
  it('encodes bytes and SHA-256 digests as lower-case hex', async () => {
    expect(hex(new Uint8Array([0, 15, 255]))).toBe('000fff');
    expect(hex(new Uint8Array([1, 2]).buffer)).toBe('0102');
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe(await sha256Hex('abc'));
    expect(randomHex()).toMatch(/^[0-9a-f]{64}$/);
  });
});
