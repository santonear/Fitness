interface PwaFlags {
  offlineEnabled: boolean;
  notificationsEnabled: boolean;
}
type NotificationStatus = NotificationPermission | 'unsupported' | 'home-screen-required' | 'disabled' | 'unavailable';
const OPT_IN = 'fitness.system-notifications';
let flags: PwaFlags = { offlineEnabled: false, notificationsEnabled: false };
let registration: ServiceWorkerRegistration | undefined;
let configuration = Promise.resolve();
const supported = () => typeof window !== 'undefined' && window.isSecureContext && 'serviceWorker' in navigator;
const optedIn = () => {
  try {
    return localStorage.getItem(OPT_IN) === 'true';
  } catch {
    return false;
  }
};
const ios = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  !!(navigator as Navigator & { standalone?: boolean }).standalone;
interface InstallPromptEvent extends Event {
  prompt(): Promise<unknown>;
}
let installPrompt: InstallPromptEvent | undefined;
// Kept from page load so the finish page can offer it later; the browser's own banner is left alone.
if (typeof window !== 'undefined') {
  window.addEventListener?.('beforeinstallprompt', event => (installPrompt = event as InstallPromptEvent));
  window.addEventListener?.('appinstalled', () => (installPrompt = undefined));
}
export type InstallRoute = 'installed' | 'prompt' | 'ios' | 'menu';
export function installRoute(): InstallRoute {
  if (standalone()) return 'installed';
  if (installPrompt) return 'prompt';
  return ios() ? 'ios' : 'menu';
}
/** Must be called from the user's tap. False when the browser no longer offers it. */
export async function promptInstall(): Promise<boolean> {
  const event = installPrompt;
  installPrompt = undefined;
  if (!event) return false;
  try {
    await event.prompt();
    return true;
  } catch {
    return false;
  }
}
const INSTALL_HINT = 'fitness.installHint';
/** The home-screen hint appears once per device; storage failures keep it hidden. */
export function installHintDue() {
  try {
    return localStorage.getItem(INSTALL_HINT) === null;
  } catch {
    return false;
  }
}
export function markInstallHintShown() {
  try {
    localStorage.setItem(INSTALL_HINT, 'shown');
  } catch {
    /* Storage may be unavailable. */
  }
}
export function pwaRegistration() {
  return registration;
}
/** Revoke notification capability immediately without touching offline registration/cache. */
export function suspendSystemNotifications() {
  flags = { ...flags, notificationsEnabled: false };
}
export function notificationStatus(): NotificationStatus {
  if (!flags.offlineEnabled || !flags.notificationsEnabled) return 'disabled';
  if (ios() && !standalone()) return 'home-screen-required';
  if (!supported() || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}
/** Root supplies central flags; no independent network or push subscription. */
export function configurePwa(next: PwaFlags): Promise<void> {
  flags = { ...next };
  configuration = configuration
    .catch(() => {})
    .then(async () => {
      if (!supported()) return;
      if (flags.offlineEnabled) {
        registration = await navigator.serviceWorker.register('/fitness-sw.js', { scope: '/', updateViaCache: 'none' });
      } else {
        registration = undefined;
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations
            .filter(item =>
              [item.active, item.waiting, item.installing].some(
                worker => worker && new URL(worker.scriptURL).pathname === '/fitness-sw.js',
              ),
            )
            .map(item => item.unregister()),
        );
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith('fitness-pwa-')).map(key => caches.delete(key)));
      }
    });
  return configuration;
}
/** Must be called synchronously from the user's enable button. */
export async function requestSystemNotifications(): Promise<NotificationStatus> {
  const status = notificationStatus();
  if (!['default', 'granted'].includes(status)) return status;
  const result = status === 'granted' ? 'granted' : await Notification.requestPermission();
  if (result === 'granted' && flags.offlineEnabled && flags.notificationsEnabled) {
    try {
      localStorage.setItem(OPT_IN, 'true');
    } catch {
      return 'unavailable';
    }
  }
  return result;
}
export function setSystemNotificationsEnabled(enabled: false) {
  try {
    localStorage.removeItem(OPT_IN);
  } catch {
    /* Storage may be unavailable. */
  }
  void registration
    ?.getNotifications?.()
    .then(items => items.forEach(item => item.close()))
    .catch(() => {});
}
/** Call only for the reminder service's newly claimed record, never on timer alone. */
export async function showSystemReminder(recordId: string, locale: 'zh' | 'en'): Promise<boolean> {
  if (
    notificationStatus() !== 'granted' ||
    !optedIn() ||
    document.visibilityState !== 'visible' ||
    !document.hasFocus()
  )
    return false;
  if (!registration?.active) return false;
  try {
    await registration.showNotification(locale === 'zh' ? '训练提醒' : 'Training reminder', {
      body: locale === 'zh' ? '只是提醒，不代表那天必须练' : 'A reminder does not mean you have to train that day.',
      tag: `fitness-reminder-${recordId}`,
      icon: '/pwa/icon-192.png',
      silent: true,
    });
    return true;
  } catch {
    return false;
  }
}
