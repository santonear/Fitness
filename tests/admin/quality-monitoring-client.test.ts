import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorEvent } from '../../src/backend/admin/quality/contracts';
const config = vi.hoisted(() => ({ flags: {} as Record<string, boolean> }));
vi.mock('../../src/application/feature-flags', () => ({ isFeatureEnabled: (key: string) => config.flags[key] === true }));
describe('frontend quality reporting compatibility and consent', () => {
  let send: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.resetModules(); config.flags = {}; send = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', send);
    vi.stubGlobal('location', { pathname: '/workout/PRIVATE_USER_ID', search: '?weight=PRIVATE_HEALTH', hash: '#PRIVATE_NOTE' });
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1 PRIVATE_DEVICE' });
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn() });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it('never reports by default or when only adminConsole is enabled', async () => {
    const client = await import('../../src/application/monitoring-client');
    client.reportSafeError('storage'); config.flags.adminConsole = true; client.reportSafeError('unexpected');
    expect(send).not.toHaveBeenCalled();
  });
  it('sends only the six quality metadata fields with canonical routes and environment families', async () => {
    config.flags = { adminConsole: true, errorReports: true };
    const { reportSafeError } = await import('../../src/application/monitoring-client');
    reportSafeError('storage');
    const init = send.mock.calls[0][1] as RequestInit;
    const payload = JSON.parse(String(init.body));
    expect(errorEvent.safeParse(payload).success).toBe(true);
    expect(payload).toMatchObject({ type: 'storage', route: '/workout', browser: 'Safari', os: 'iOS' });
    expect(Object.keys(payload).sort()).toEqual(['browser', 'os', 'route', 'time', 'type', 'version']);
    expect(JSON.stringify(payload)).not.toContain('PRIVATE'); expect(init.credentials).toBe('omit');
    reportSafeError('storage'); expect(send).toHaveBeenCalledTimes(1);
    config.flags.errorReports = false; reportSafeError('network'); expect(send).toHaveBeenCalledTimes(1);
  });
  it('preserves the legacy schema when adminConsole is off', async () => {
    config.flags.errorReports = true;
    const { reportSafeError } = await import('../../src/application/monitoring-client');
    reportSafeError('validation');
    expect(JSON.parse(String(send.mock.calls[0][1].body))).toEqual({ type: 'validation', page: 'training', version: 'v8', browser: 'safari' });
  });
  it('maps legacy validation into an allowed category and rejects an unsafe build version', async () => {
    config.flags = { adminConsole: true, errorReports: true };
    const { reportSafeError } = await import('../../src/application/monitoring-client');
    vi.stubEnv('VITE_APP_VERSION', 'user@example.com'); reportSafeError('validation'); expect(send).not.toHaveBeenCalled();
    vi.stubEnv('VITE_APP_VERSION', 'abcdef123'); reportSafeError('validation');
    expect(JSON.parse(String(send.mock.calls[0][1].body))).toMatchObject({ type: 'unexpected', version: 'abcdef123' });
  });
  it('counts same-origin API failures as a network category without URLs or bodies, and ignores feature-off answers', async () => {
    config.flags = { adminConsole: true, errorReports: true };
    vi.stubGlobal('location', { pathname: '/settings', origin: 'https://fitness.test', search: '', hash: '' });
    const { instrumentApiFailures } = await import('../../src/application/monitoring-client');
    const responses: Record<string, Response> = {
      '/api/v1/push/config': new Response(null, { status: 503 }),
      '/api/v1/assistant/chat': Response.json({ error: 'AI_DISABLED' }, { status: 503 }),
      '/api/v1/features': Response.json({ flags: {} }),
    };
    const network = vi.fn(async (input: RequestInfo | URL) => { const path = new URL(String(input), 'https://fitness.test').pathname; return path.startsWith('/api/v1/telemetry/') ? new Response(null, { status: 204 }) : responses[path].clone(); });
    const target = { fetch: network as unknown as typeof fetch };
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => target.fetch(input, init));
    const restore = instrumentApiFailures(target);
    await target.fetch('/api/v1/features'); await target.fetch('/api/v1/assistant/chat');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(network.mock.calls.filter(call => String(call[0]).includes('telemetry'))).toHaveLength(0);
    await target.fetch('/api/v1/push/config?private=PRIVATE_HEALTH');
    await vi.waitFor(() => expect(network.mock.calls.filter(call => String(call[0]).includes('telemetry'))).toHaveLength(1));
    const report = network.mock.calls.find(call => String(call[0]).includes('telemetry'))!;
    const payload = JSON.parse(String((report[1] as RequestInit).body));
    expect(errorEvent.safeParse(payload).success).toBe(true);
    expect(payload).toMatchObject({ type: 'network', route: '/settings' });
    expect(JSON.stringify(payload)).not.toMatch(/push|PRIVATE/);
    restore(); expect(target.fetch).toBe(network);
  });
  it('keeps anonymous usage consent independent and does not opt anyone in', async () => {
    config.flags = { adminConsole: true, errorReports: true, anonymousUsage: true };
    const { countUsage, flushUsage } = await import('../../src/application/monitoring-client');
    countUsage('workout_started'); await flushUsage();
    expect(send).not.toHaveBeenCalled(); expect(localStorage.setItem).not.toHaveBeenCalled();
  });
});
