import { sendGenericPush } from '../../push-service';
import type { Category } from './contracts';

const decode = (value: string) =>
  Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const join = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};
const bytes = (value: string) => new TextEncoder().encode(value);
async function hkdf(input: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey('raw', new Uint8Array(input), 'HKDF', false, ['deriveBits']);
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(salt), info: new Uint8Array(info) },
      key,
      length * 8,
    ),
  );
}
export function notificationPayload(category: Category, count: number) {
  const labels: Record<Category, string> = {
    ledger: '账本需要核对',
    smoke: '发布检查需要查看',
    errors: '生产错误增加',
    budget80: '预算已用到 80%',
    budget100: '预算已用到 100%',
    applications: '申请等待超过两天',
    test: '测试提醒',
  };
  return { title: 'Fitness 管理提醒', body: `${labels[category]}：${count} 项`, url: '/admin' };
}
/** RFC 8291 encryption; VAPID signing and endpoint restrictions reuse push-service. */
export async function encryptPayload(keys: { p256dh: string; auth: string }, payload: unknown): Promise<Uint8Array> {
  const receiver = decode(keys.p256dh);
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const sender = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const publicKey = await crypto.subtle.importKey('raw', receiver, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, pair.privateKey, 256),
  );
  const ikm = await hkdf(secret, decode(keys.auth), join(bytes('WebPush: info\0'), receiver, sender), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(ikm, salt, bytes('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(ikm, salt, bytes('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', new Uint8Array(cek), 'AES-GCM', false, ['encrypt']);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: new Uint8Array(nonce) },
      key,
      join(bytes(JSON.stringify(payload)), new Uint8Array([2])),
    ),
  );
  return join(salt, new Uint8Array([0, 0, 16, 0, sender.length]), sender, encrypted);
}
export async function sendAdminPush(
  endpoint: string,
  privateJwk: string,
  publicKey: string,
  subject: string,
  now: number,
  keys: { p256dh: string; auth: string },
  category: Category,
  count: number,
) {
  const body = await encryptPayload(keys, notificationPayload(category, count));
  return sendGenericPush(endpoint, privateJwk, publicKey, subject, now, (url, init) =>
    fetch(url, {
      ...init,
      headers: { ...init?.headers, 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream' },
      body: new Uint8Array(body),
    }),
  );
}
