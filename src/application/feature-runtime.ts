import { configurePwa, suspendSystemNotifications } from './pwa';
import { configureBackgroundPush, disableBackgroundPush } from './pwa-push';
import { hasValidRemoteConfig, isFeatureEnabled, subscribeFeatureFlags } from './feature-flags';
const offlineKey = 'fitness.offline-installed';
export function startFeatureRuntime() {
  let epoch = 0;
  // An offline device cannot receive a remote kill until reconnect. Keep already-authorized
  // static assets available; no sensitive feature permissions are restored from this key.
  try { if (!navigator.onLine && localStorage.getItem(offlineKey) === 'true') void configurePwa({ offlineEnabled: true, notificationsEnabled: false }).catch(() => {}); } catch { /* optional cache */ }
  const unsubscribe = subscribeFeatureFlags(() => {
    const current = ++epoch;
    const offlineEnabled = isFeatureEnabled('pwaOffline'), notificationsEnabled = isFeatureEnabled('systemNotifications');
    configureBackgroundPush(offlineEnabled && notificationsEnabled);
    if (!hasValidRemoteConfig()) { suspendSystemNotifications(); return; }
    try { localStorage.setItem(offlineKey, String(offlineEnabled)); } catch { /* optional cache */ }
    void (async () => {
      if (!notificationsEnabled || !offlineEnabled) await disableBackgroundPush().catch(() => false);
      if (current !== epoch) return;
      await configurePwa({ offlineEnabled, notificationsEnabled });
    })().catch(() => {});
  });
  return () => { epoch++; unsubscribe(); };
}
