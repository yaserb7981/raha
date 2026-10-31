/* رها — Service Worker: آفلاین + نوتیفیکیشن */
const CACHE = 'raha-v3';
const SHELL = [
  './', './index.html', './app.css', './app.js', './engine.js', './manifest.webmanifest',
  './fonts/Vazirmatn-Regular.woff2', './fonts/Vazirmatn-Medium.woff2',
  './fonts/Vazirmatn-Bold.woff2', './fonts/Vazirmatn-Black.woff2',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // تک‌تک کش می‌کنیم تا یک فایل ناموجود کل کش را خراب نکند
    await Promise.all(SHELL.map(u => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // API → همیشه شبکه (داده باید تازه باشه)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/share/')) return;

  // بقیه → cache-first + به‌روزرسانی در پس‌زمینه
  e.respondWith((async () => {
    const cached = await caches.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => {
      if (r && r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone())).catch(() => {});
      return r;
    }).catch(() => null);
    return cached || (await net) || new Response('آفلاین', { status: 503 });
  })());
});

/* نوتیفیکیشن: کلیک → باز کردن اپ */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window' });
    for (const c of all) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('/');
  })());
});

self.addEventListener('message', e => {
  if (e.data?.type === 'notify') {
    self.registration.showNotification(e.data.title, {
      body: e.data.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      dir: 'rtl', lang: 'fa',
      tag: 'raha-daily',
      renotify: true,
    });
  }
});
