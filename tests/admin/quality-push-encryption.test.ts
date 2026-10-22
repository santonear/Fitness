import { expect, it } from 'vitest';
import { encryptPayload, notificationPayload } from '../../src/backend/admin/quality/push-payload';
it('round trips encrypted Web Push payload using receiver key and contains only event/count', async () => {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const receiver = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const payload = notificationPayload('applications', 3);
  const encrypted = await encryptPayload(
    { p256dh: Buffer.from(receiver).toString('base64url'), auth: Buffer.from(auth).toString('base64url') },
    payload,
  );
  const sender = encrypted.slice(21, 86);
  const publicKey = await crypto.subtle.importKey('raw', sender, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, pair.privateKey, 256);
  async function derive(input: ArrayBuffer, salt: Uint8Array, info: Uint8Array, length: number) {
    const key = await crypto.subtle.importKey('raw', input, 'HKDF', false, ['deriveBits']);
    return crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(salt), info: new Uint8Array(info) },
      key,
      length,
    );
  }
  const info = Buffer.concat([Buffer.from('WebPush: info\0'), receiver, sender]);
  const ikm = await derive(secret, auth, info, 256);
  const cek = await derive(ikm, encrypted.slice(0, 16), Buffer.from('Content-Encoding: aes128gcm\0'), 128);
  const nonce = await derive(ikm, encrypted.slice(0, 16), Buffer.from('Content-Encoding: nonce\0'), 96);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const clear = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, encrypted.slice(86)));
  expect(clear.at(-1)).toBe(2);
  expect(JSON.parse(new TextDecoder().decode(clear.slice(0, -1)))).toEqual(payload);
  expect(payload).toEqual({ title: 'Fitness 管理提醒', body: '申请等待超过两天：3 项', url: '/admin' });
});
