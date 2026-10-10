/* Build replaces these tokens. This source is not registered directly. */
const CACHE = 'fitness-pwa-__FITNESS_REVISION__';
const ASSETS = __FITNESS_ASSETS__;
const paths = new Set(ASSETS);
const mediaPath = pathname => /^\/exercise-media\/repdb\/[a-zA-Z0-9_./-]+\.(?:png|jpg|jpeg|webp)$/.test(pathname);
const appRoute = pathname => pathname === '/' || /^\/(?:onboarding|plan-draft|workout|activity|manual|plans|exercises|review|settings)(?:\/|$)/.test(pathname);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  // No skipWaiting: an active workout keeps its current application version.
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('fitness-pwa-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' && appRoute(url.pathname)) {
    event.respondWith(fetch(request).catch(async () => (await caches.open(CACHE)).match('/') .then(response => response || Response.error())));
  } else if (!url.search && paths.has(url.pathname)) {
    // Immutable same-origin build assets are identical across Origin headers.
    // Module requests include Origin while install-time addAll requests may not.
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request, { ignoreVary: true })) || fetch(request)));
  } else if (!url.search && request.destination === 'image' && mediaPath(url.pathname)) {
    // Only opened catalogue images, bounded independently of the complete shell.
    event.respondWith(caches.open(CACHE).then(async cache => {
      const saved = await cache.match(request, { ignoreVary: true }); if (saved) return saved;
      const response = await fetch(request);
      if (response.ok && response.headers.get('Content-Type')?.startsWith('image/') && (await response.clone().blob()).size <= 512000) {
        await cache.put(request, response.clone());
        const media = (await cache.keys()).filter(item => mediaPath(new URL(item.url).pathname));
        await Promise.all(media.slice(0, Math.max(0, media.length - 40)).map(item => cache.delete(item)));
      }
      return response;
    }));
  }
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    const client = clients.find(item => new URL(item.url).origin === self.location.origin && !new URL(item.url).pathname.startsWith('/admin'));
    if (client) { await client.focus(); return; }
    await self.clients.openWindow('/');
  }));
});
self.addEventListener('push', event => {
  // Server sends no body. No health data or user text reaches a push provider.
  event.waitUntil(self.registration.pushManager.getSubscription().then(subscription => {
    if (!subscription) return;
    return self.registration.showNotification('Fitness', {
      body: '只是提醒，不代表那天必须练 / A reminder does not mean you have to train that day.',
      tag: 'fitness-scheduled-reminder', icon: '/pwa/icon-192.png', silent: true,
    });
  }));
});
