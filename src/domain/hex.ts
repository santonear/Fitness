/** Lower-case hex of raw bytes (digests, random tokens). Shared by browser and Worker code. */
export const hex = (bytes: ArrayBuffer | Uint8Array) => Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
/** SHA-256 of UTF-8 text (or raw bytes) as 64 hex characters. */
export const sha256Hex = async (value: string | Uint8Array<ArrayBuffer>) => hex(await crypto.subtle.digest('SHA-256', typeof value === 'string' ? new TextEncoder().encode(value) : value));
/** `bytes` cryptographically random bytes as hex. */
export const randomHex = (bytes = 32) => hex(crypto.getRandomValues(new Uint8Array(bytes)));
