// The page saves the console language in this cache (src/i18n/index.ts); Chinese when none is saved.
const savedLanguage = () =>
  (typeof caches === 'undefined'
    ? Promise.resolve('zh')
    : caches.open('fitness-settings').then(cache => cache.match('/__fitness-language')).then(saved => (saved ? saved.text() : 'zh'))
  ).then(value => (value === 'en' ? 'en' : 'zh'), () => 'zh');
const english = {
  ledger: 'Ledger needs reconciling', smoke: 'Release checks need a look', errors: 'Production errors increased',
  budget80: 'Budget 80% used', budget100: 'Budget 100% used', applications: 'Applications waiting over two days',
  test: 'Test alert',
};
self.addEventListener('push', event => {
  let payload;
  try { payload = event.data?.json(); } catch { payload = null; }
  event.waitUntil(savedLanguage().then(language => {
    const label = english[payload?.category], count = Number(payload?.count);
    const body = language === 'en'
      ? (label && Number.isFinite(count) ? `${label}: ${count}` : 'There is something to check in the console.')
      : typeof payload?.body === 'string' ? payload.body : '后台有需要查看的事项。';
    return self.registration.showNotification(language === 'en' ? 'Fitness console alert' : 'Fitness 管理提醒', {
      body, tag: 'fitness-admin', data: { url: '/admin' },
    });
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const existing = windows.find(client => new URL(client.url).pathname.startsWith('/admin'));
    return existing ? existing.focus() : clients.openWindow('/admin');
  }));
});
