import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
function browser(permission = 'default') {
  const values = new Map<string, string>();
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const register = vi.fn().mockResolvedValue({ active: {}, showNotification });
  const requestPermission = vi.fn().mockResolvedValue('granted');
  vi.stubGlobal('window', { isSecureContext: true, Notification: {}, matchMedia: () => ({ matches: false }) });
  vi.stubGlobal('navigator', { userAgent: 'Chrome', platform: 'Win32', serviceWorker: { register, getRegistrations: async () => [] } });
  vi.stubGlobal('Notification', { permission, requestPermission });
  vi.stubGlobal('document', { visibilityState: 'visible', hasFocus: () => true });
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
  vi.stubGlobal('caches', { keys: async () => [], delete: vi.fn() });
  return { register, requestPermission, showNotification, values };
}
describe('explicit local notification consent', () => {
  it('defaults off and never asks permission or registers without flag', async () => {
    const mocks = browser(); const pwa = await import('../src/application/pwa');
    await pwa.configurePwa({ offlineEnabled: false, notificationsEnabled: false });
    expect(await pwa.requestSystemNotifications()).toBe('disabled');
    expect(mocks.register).not.toHaveBeenCalled(); expect(mocks.requestPermission).not.toHaveBeenCalled();
  });
  it('granted browser permission alone cannot notify; explicit opt-in can, revoke stops it', async () => {
    const mocks = browser('granted'); const pwa = await import('../src/application/pwa');
    await pwa.configurePwa({ offlineEnabled: true, notificationsEnabled: true });
    expect(await pwa.showSystemReminder('one', 'zh')).toBe(false);
    await pwa.requestSystemNotifications(); expect(await pwa.showSystemReminder('one', 'zh')).toBe(true);
    expect(mocks.showNotification).toHaveBeenCalledWith('训练提醒', expect.objectContaining({ silent: true, body: '只是提醒，不代表那天必须练' }));
    pwa.setSystemNotificationsEnabled(false); expect(await pwa.showSystemReminder('two', 'en')).toBe(false);
  });
  it('requires iOS Home Screen before prompting, and suppresses hidden pages', async () => {
    const mocks = browser('granted'); const pwa = await import('../src/application/pwa');
    await pwa.configurePwa({ offlineEnabled: true, notificationsEnabled: true });
    Object.assign(navigator, { userAgent: 'iPhone' });
    expect(await pwa.requestSystemNotifications()).toBe('home-screen-required'); expect(mocks.requestPermission).not.toHaveBeenCalled();
    Object.assign(navigator, { userAgent: 'Chrome' }); await pwa.requestSystemNotifications();
    Object.assign(document, { visibilityState: 'hidden' }); expect(await pwa.showSystemReminder('one', 'en')).toBe(false);
  });
  it('kill switch removes only Fitness cache and registration, never local data', async () => {
    browser(); const unregister = vi.fn();
    Object.assign(navigator.serviceWorker, { getRegistrations: async () => [{ active: { scriptURL: 'https://fitness.test/fitness-sw.js' }, unregister }, { active: { scriptURL: 'https://fitness.test/other.js' }, unregister: () => { throw Error('unrelated'); } }] });
    const remove = vi.fn(); vi.stubGlobal('caches', { keys: async () => ['fitness-pwa-old', 'other'], delete: remove });
    const pwa = await import('../src/application/pwa'); await pwa.configurePwa({ offlineEnabled: false, notificationsEnabled: false });
    expect(unregister).toHaveBeenCalledOnce(); expect(remove).toHaveBeenCalledExactlyOnceWith('fitness-pwa-old');
  });
});
it('service worker never intercepts API/admin/cross-origin or non-GET requests', () => {
  const handlers: Record<string, (event: any) => void> = {};
  const source = readFileSync('public/pwa/sw-template.js', 'utf8').replace('__FITNESS_ASSETS__', JSON.stringify(['/', '/assets/main.js']));
  runInNewContext(source, { self: { location: { origin: 'https://fitness.test' }, addEventListener: (name: string, handler: any) => { handlers[name] = handler; } }, URL, Set });
  for (const [url, method, mode] of [['https://fitness.test/api/v1/config','GET','navigate'], ['https://fitness.test/admin','GET','navigate'], ['https://remote.test/assets/main.js','GET','cors'], ['https://fitness.test/','POST','navigate']]) {
    const respondWith = vi.fn(); handlers.fetch({ request: { url, method, mode }, respondWith }); expect(respondWith).not.toHaveBeenCalled();
  }
});
