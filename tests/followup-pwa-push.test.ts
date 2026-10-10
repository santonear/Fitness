import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { exportJWK, generateKeyPair, jwtVerify } from 'jose';
import { capabilityHash, duePushDay, pushSchedule, sendGenericPush, validPushEndpoint } from '../src/backend/push-service';
import { dispatchPush, pushFetch, type PushEnv } from '../src/backend/push-worker';
const schedule = { weekdays: [7], time: '09:00', timeZone: 'Asia/Shanghai', quietStart: '22:00', quietEnd: '07:00', dailyLimit: 1 };
const now = Date.parse('2026-10-11T01:00:00Z');
const token = 'a'.repeat(43);
const endpoint = 'https://fcm.googleapis.com/send/test-device';
function environment() {
  const db = new DatabaseSync(':memory:'); db.exec(readFileSync('tools/push-schema.sql','utf8'));
  const env: PushEnv = { PUSH_ENABLED:'true', APP_ORIGIN:'https://fitness.test', VAPID_PRIVATE_JWK:'', VAPID_PUBLIC_KEY:'', VAPID_SUBJECT:'mailto:test@example.com', PUSH_DB: { prepare(sql) {
    let args: any[] = []; const statement = db.prepare(sql);
    const adapter = { bind(...values: any[]) { args = values; return adapter; }, async run() { const result = statement.run(...args); return { meta: { changes: Number(result.changes) } }; }, async all<T>() { return { results: statement.all(...args) as T[] }; }, async first<T>() { return statement.get(...args) as T ?? null; } }; return adapter;
  } } };
  return { env, db };
}
function request(method = 'POST', body: unknown = { subscription: { endpoint, keys: { p256dh:'B'.repeat(87), auth:'a'.repeat(22) } }, schedule }, origin = 'https://fitness.test') {
  return new Request('https://fitness.test/api/v1/push/subscription', { method, headers: { Origin:origin, Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body: method === 'POST' ? JSON.stringify(body) : undefined });
}
describe('preview push privacy and scheduling', () => {
  it('accepts explicit schedule only and stores hashed capability, no health fields', async () => {
    const {env,db} = environment(); expect((await pushFetch(request(),env)).status).toBe(200);
    const row = db.prepare('SELECT * FROM push_subscriptions').get()!;
    expect(row.id).toBe(await capabilityHash(token)); expect(JSON.stringify(row)).not.toContain(token); expect(JSON.parse(row.schedule as string)).toEqual(schedule);
    expect((await pushFetch(request('POST',{subscription:{endpoint,keys:{p256dh:'B'.repeat(87),auth:'a'.repeat(22)}},schedule,notes:'private'}),env)).status).toBe(400);
    db.close();
  });
  it('requires origin/capability, limits body, defaults disabled and allows deletion while disabled', async () => {
    const {env,db} = environment();
    expect((await pushFetch(request('POST',undefined,'https://other.test'),env)).status).toBe(403);
    const noAuth=request(); noAuth.headers.delete('Authorization'); expect((await pushFetch(noAuth,env)).status).toBe(401);
    expect((await pushFetch(request('POST',{extra:'a'.repeat(9000)}),env)).status).toBe(413);
    await pushFetch(request(),env); env.PUSH_ENABLED=undefined;
    expect((await pushFetch(request(),env)).status).toBe(503);
    expect((await pushFetch(request('DELETE'),env)).status).toBe(200);
    expect(db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions').get()?.n).toBe(0); db.close();
  });
  it('rejects SSRF and incomplete/unknown schedule values', () => {
    for(const value of ['http://fcm.googleapis.com/send/x','https://localhost/x','https://fcm.googleapis.com.evil.test/x','https://user:pass@fcm.googleapis.com/x','https://fcm.googleapis.com:444/x']) expect(validPushEndpoint(value)).toBe(false);
    expect(pushSchedule.safeParse({...schedule,timeZone:'unknown'}).success).toBe(false);
    expect(pushSchedule.safeParse({...schedule,weekdays:[]}).success).toBe(false);
    expect(duePushDay({...schedule,dailyLimit:0},now)).toBeUndefined();
    expect(duePushDay({...schedule,quietStart:'08:00',quietEnd:'10:00'},now)).toBeUndefined();
  });
  it('claims once across concurrent schedulers and DST repeated local times', async () => {
    const {env,db}=environment(); await pushFetch(request(),env); const send=vi.fn().mockResolvedValue(201);
    await Promise.all([dispatchPush(env,now,send),dispatchPush(env,now,send)]); await dispatchPush(env,now,send); expect(send).toHaveBeenCalledTimes(1);
    const dst={...schedule,timeZone:'America/New_York',time:'01:30',quietStart:'00:00',quietEnd:'00:00'};
    expect(duePushDay(dst,Date.parse('2026-11-01T05:30Z'))).toBe(duePushDay(dst,Date.parse('2026-11-01T06:30Z'))); db.close();
  });
  it('retries explicit provider overload once, deletes expired endpoint, and does not retry unknown delivery', async () => {
    const {env,db}=environment(); await pushFetch(request(),env); const send=vi.fn().mockResolvedValueOnce(503).mockResolvedValueOnce(503);
    await dispatchPush(env,now,send); await dispatchPush(env,now+60000,send); await dispatchPush(env,now+120000,send); expect(send).toHaveBeenCalledTimes(2);
    db.exec('UPDATE push_subscriptions SET last_day=NULL, retry_at=NULL, attempts=0'); send.mockRejectedValueOnce(Error('network'));
    await dispatchPush(env,now,send); await dispatchPush(env,now,send); expect(send).toHaveBeenCalledTimes(3);
    db.exec('UPDATE push_subscriptions SET last_day=NULL'); send.mockResolvedValueOnce(410); await dispatchPush(env,now,send);
    expect(db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions').get()?.n).toBe(0); db.close();
  });
  it('sends a verifiable VAPID token with no message body and never follows redirects', async () => {
    const keys=await generateKeyPair('ES256',{extractable:true}); const privateJwk=await exportJWK(keys.privateKey); const publicJwk=await exportJWK(keys.publicKey);
    const raw=Buffer.concat([Buffer.from([4]),Buffer.from(publicJwk.x!,'base64url'),Buffer.from(publicJwk.y!,'base64url')]).toString('base64url');
    const transport=vi.fn<typeof fetch>().mockResolvedValue(new Response(null,{status:201}));
    expect(await sendGenericPush(endpoint,JSON.stringify(privateJwk),raw,'mailto:test@example.com',now,transport)).toBe(201);
    const init=transport.mock.calls[0][1]!; expect(init.redirect).toBe('error'); expect((init.body as Uint8Array).length).toBe(0);
    const header=(init.headers as Record<string,string>).Authorization;
    const jwt=header.match(/^vapid t=(.+), k=/)![1]; const verified=await jwtVerify(jwt,keys.publicKey,{audience:'https://fcm.googleapis.com',currentDate:new Date(now)});
    expect(verified.payload.sub).toBe('mailto:test@example.com'); expect(verified.payload.exp! - now/1000).toBe(3600);
  });
});
