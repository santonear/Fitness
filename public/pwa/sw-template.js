/* Build replaces these tokens. This source is not registered directly. */
const CACHE = 'fitness-pwa-__FITNESS_REVISION__';
const ASSETS = __FITNESS_ASSETS__;
const paths = new Set(ASSETS);
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
