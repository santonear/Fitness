import { describe, expect, it, vi } from 'vitest';
import { generateKeyPair, SignJWT } from 'jose';
import { createFitnessWorker } from '../../src/backend/fitness-worker';
import { verifyAdministrator } from '../../src/backend/management-auth';
import { adminBoundary } from '../../src/backend/admin/core/boundary';
import type { AdminContext, AdminDatabase } from '../../src/backend/admin/core/contracts';
import { handleUsers } from '../../src/backend/admin/users/handler';
import { initialState, type ControlStore } from '../../src/backend/store';
import { idempotentAdminStore } from '../../src/backend/admin/core/idempotent-store';
import { ControlService, testConfig } from '../../src/backend/control';

const origin = 'https://admin.example.test';
const authEnv = {
  ADMIN_ACCESS_ISSUER: 'https://test.cloudflareaccess.com',
  ADMIN_ACCESS_AUD: 'admin',
  ADMIN_EMAIL: 'admin@example.test',
  CONTROL_ADMIN_SECRET: 'test-secret',
  ADMIN_CONSOLE_ENABLED: 'true',
};
const headers = () => ({ 'Content-Type': 'application/json', Origin: origin, 'x-request-id': crypto.randomUUID() });

describe('integration security regressions', () => {
  it('rejects signed stale Access at every legacy dangerous operation before forwarding', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ email: authEnv.ADMIN_EMAIL })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(authEnv.ADMIN_ACCESS_ISSUER)
      .setAudience(authEnv.ADMIN_ACCESS_AUD)
      .setSubject('admin')
      .setIssuedAt(now - 601)
      .setExpirationTime(now + 3600)
      .sign(privateKey);
    const forward = vi.fn(async () => Response.json({ ok: true }));
    const worker = createFitnessWorker({ fetch: forward }, (request, env) =>
      verifyAdministrator(request, env, async () => publicKey),
    );
    for (const operation of ['subject-delete', 'reissue', 'application-retention']) {
      const response = await worker.fetch(
        new Request(`${origin}/api/v1/management/${operation}`, {
          method: 'POST',
          headers: { ...headers(), 'cf-access-jwt-assertion': token },
          body: '{}',
        }),
        authEnv,
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: 'FRESH_ACCESS_REQUIRED' });
    }
    expect(forward).not.toHaveBeenCalled();
  });

  it('rejects omitted and empty object IDs even when only one object exists', async () => {
    const state = initialState();
    const subjectId = '12345678-abcd-4321-abcd-123456789012';
    state.subjects[subjectId] = { expiresAt: Date.now() + 86400000, revoked: false };
    state.applications = {
      sole: {
        id: 'sole',
        ownerDigest: 'owner',
        kind: 'new',
        name: 'synthetic',
        note: 'synthetic',
        createdAt: 1,
        state: 'pending',
      },
    };
    const forward = vi.fn(async () => Response.json({ ok: true }));
    const db = { prepare: vi.fn() } as unknown as AdminDatabase;
    const context: AdminContext = {
      env: {
        ADMIN_DB: db,
        CONTROL_DB: {
          withSession: () => ({
            prepare: () => ({
              bind() {
                return this;
              },
              first: async <T>() => ({ state: JSON.stringify(state) }) as T,
              run: async () => ({ success: true, meta: { changes: 1 } }),
            }),
          }),
        },
      },
      now: Date.now(),
      actor: 'admin',
      fresh: true,
      requestId: crypto.randomUUID(),
      audit: async () => {},
    };
    for (const action of ['delete', 'reissue', 'revoke', 'quota', 'approve', 'activate', 'invite-revoke'])
      for (const id of [undefined, '']) {
        const request = new Request(`${origin}/api/v1/management/console/users/action`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ action, ...(id === undefined ? {} : { id }) }),
        });
        const response = await adminBoundary(request, context, (req, c) => handleUsers(req, { ...c, forward }));
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    expect(forward).not.toHaveBeenCalled();
  });

  it('bounds an unlabelled streaming admin body before invoking any mutation', async () => {
    let cancelled = false;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(32769));
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request(`${origin}/api/v1/management/console/templates`, {
      method: 'POST',
      headers: headers(),
      body: stream,
      duplex: 'half',
    } as RequestInit);
    const context: AdminContext = {
      env: {},
      actor: 'admin',
      now: Date.now(),
      fresh: true,
      requestId: crypto.randomUUID(),
      audit: async () => {},
    };
    const mutation = vi.fn();
    const response = await adminBoundary(request, context, mutation);
    expect(response.status).toBe(413);
    expect(cancelled).toBe(true);
    expect(mutation).not.toHaveBeenCalled();
  });

  it('does not persist error metadata when the sensitive errorReports flag is off', async () => {
    const prepare = vi.fn(() => {
      throw Error('must not write');
    });
    const response = await createFitnessWorker().fetch(
      new Request(`${origin}/api/v1/telemetry/errors`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          type: 'storage',
          route: '/workout',
          version: '1.0.0',
          browser: 'Safari',
          os: 'iOS',
          time: Date.now(),
        }),
      }),
      {
        ADMIN_CONSOLE_ENABLED: 'true',
        ADMIN_ERROR_COLLECTION_ENABLED: 'true',
        FITNESS_FEATURE_FLAGS: JSON.stringify({ errorReports: false }),
        ADMIN_DB: { prepare } as unknown as AdminDatabase,
      },
    );
    expect([204, 403, 503]).toContain(response.status);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('retains only minimal activation receipts after application retention removes health text', async () => {
    const now = Date.now();
    const applicationId = crypto.randomUUID();
    const sentinel = 'PRIVATE_HEALTH_SENTINEL knee pain and weight';
    let state = initialState();
    state.applications = {
      [applicationId]: {
        id: applicationId,
        ownerDigest: 'owner',
        kind: 'new',
        name: 'PRIVATE_NAME_SENTINEL',
        note: sentinel,
        createdAt: now,
        state: 'pending',
      },
    };
    const store: ControlStore = {
      read: async () => structuredClone(state),
      async transact(change) {
        const copy = structuredClone(state);
        const value = change(copy);
        state = copy;
        return value;
      },
    };
    const wrapped = idempotentAdminStore(store, crypto.randomUUID(), 'activation-fingerprint', 'admin', () => now);
    const service = new ControlService(
      wrapped,
      testConfig,
      {
        kind: 'local-mock',
        call: async () => {
          throw Error('No model calls expected');
        },
      },
      () => now,
    );
    await service.activateApplication(testConfig.adminSecret, applicationId);
    const receiptText = JSON.stringify(state.adminReceipts);
    expect(receiptText).not.toContain(sentinel);
    expect(receiptText).not.toContain('PRIVATE_NAME_SENTINEL');
    const replay = await service.activateApplication(testConfig.adminSecret, applicationId);
    expect(replay).toMatchObject({ id: applicationId, state: 'approved' });
    expect(Object.keys(state.subjects)).toHaveLength(1);
    const future = new ControlService(
      store,
      testConfig,
      {
        kind: 'local-mock',
        call: async () => {
          throw Error('No model calls expected');
        },
      },
      () => now + 100 * 86400000,
    );
    expect((await future.applications.retain()).removed).toBe(1);
    expect(JSON.stringify(state)).not.toContain(sentinel);
    expect(JSON.stringify(state)).not.toContain('PRIVATE_NAME_SENTINEL');
  });
});
