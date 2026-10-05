/* The cache holds the generic app shell and static assets, never API responses. */
const CACHE = 'apptodo-shell-v1';
self.addEventListener('install', event => { event.waitUntil(Promise.all([self.skipWaiting(), caches.open(CACHE).then(cache => cache.add(new Request('/', { credentials: 'omit' }))).catch(() => {})])); });
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('apptodo-shell-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const navigation = request.mode === 'navigate' && url.pathname === '/' && !url.search;
  const asset = url.pathname.startsWith('/_next/static/') || /^\/(icon-192\.png|icon-512\.png|apple-touch-icon\.png|favicon\.ico)$/.test(url.pathname);
  if (!navigation && !asset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok && !response.redirected) {
        await cache.put(request, response.clone());
        const keys = await cache.keys();
        if (keys.length > 128) await cache.delete(keys.find(k => new URL(k.url).pathname !== '/') || keys[0]);
      }
      return response;
    } catch {
      const cached = await cache.match(request);
      if (cached) return cached;
      return new Response('Abra o AppToDo uma vez com conexão para disponibilizar esta tela offline.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { /* Generic reminder if data is unreadable. */ }
  event.waitUntil(self.registration.showNotification(payload.title || 'AppToDo', { body: payload.body || 'Confira suas tarefas.', icon: '/icon-192.png', badge: '/icon-192.png', tag: payload.tag || 'apptodo-reminder', data: { url: '/' } }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(w => new URL(w.url).origin === self.location.origin);
    if (existing) return existing.focus();
    return self.clients.openWindow('/');
  })());
});
