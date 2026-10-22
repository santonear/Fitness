import { describe, expect, it } from 'vitest';
import { readBodyBytes, readJsonBody, sameOrigin, trialToken } from '../../src/backend/request';

const post = (body?: string, headers: Record<string, string> = {}) =>
  new Request('https://fit.example/api', { method: 'POST', headers, ...(body === undefined ? {} : { body }) });
const reason = (problem: string) => new Error(problem);

describe('backend request helpers', () => {
  it('reads JSON within the limit and reports each problem', async () => {
    expect(await readJsonBody(post('{"a":1}'), 7, reason)).toEqual({ a: 1 });
    await expect(readJsonBody(post('{"a":12}'), 7, reason)).rejects.toThrow('too-large');
    await expect(readJsonBody(post('{'), 7, reason)).rejects.toThrow('invalid');
    await expect(readJsonBody(post(), 7, reason)).rejects.toThrow('missing');
    const badUtf8 = new Request('https://fit.example/api', {
      method: 'POST',
      body: new Uint8Array([0x22, 0xff, 0x22]),
    });
    await expect(readJsonBody(badUtf8, 9, reason, new TextDecoder('utf-8', { fatal: true }))).rejects.toThrow(
      'invalid',
    );
    expect((await readBodyBytes(post(), 7, reason, true)).byteLength).toBe(0);
  });
  it('accepts only same-origin requests', () => {
    expect(sameOrigin(post('', { origin: 'https://fit.example' }))).toBe(true);
    expect(sameOrigin(post('', { origin: 'https://evil.example' }))).toBe(false);
    expect(sameOrigin(post('', { origin: 'https://fit.example', 'sec-fetch-site': 'cross-site' }))).toBe(false);
    expect(sameOrigin(new Request('http://fit.example/api', { headers: { origin: 'http://fit.example' } }))).toBe(
      false,
    );
    expect(
      sameOrigin(new Request('http://fit.example/api', { headers: { origin: 'http://fit.example' } }), false),
    ).toBe(true);
  });
  it('takes the trial token only from exactly one well-formed cookie', () => {
    const token = 'a'.repeat(64),
      cookie = (value: string) => new Request('https://fit.example/', { headers: { cookie: value } });
    expect(trialToken(cookie(`x=1; __Host-fitness_trial=${token}`))).toBe(token);
    expect(trialToken(cookie(`__Host-fitness_trial=${token}; __Host-fitness_trial=${token}`))).toBeUndefined();
    expect(trialToken(cookie('__Host-fitness_trial=short'))).toBeUndefined();
    expect(trialToken(cookie(''))).toBeUndefined();
  });
});
