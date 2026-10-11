self.addEventListener('push', event => {
  let payload;
  try { payload = event.data?.json(); } catch { payload = null; }
  event.waitUntil(self.registration.showNotification('Fitness 管理提醒', {
    body: typeof payload?.body === 'string' ? payload.body : '后台有需要查看的事项。', tag: 'fitness-admin',
    data: { url: '/admin' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const existing = windows.find(client => new URL(client.url).pathname.startsWith('/admin'));
    return existing ? existing.focus() : clients.openWindow('/admin');
  }));
});
