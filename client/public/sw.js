// CashBall service worker — offline fallback para a SPA.
// Bump VERSION on any client change so activate() clears the stale cache
// and the user picks up new hashed bundles.
const VERSION = 'v2';
const CACHE = `cashball-${VERSION}`;
const CORE_URLS = ['/', '/index.html'];

// Navegação (HTML): network primeiro, fallback para o cache.
self.addEventListener('fetch', (event) => {
  const { request, mode } = event;
  if (request.method !== 'GET' || mode === 'navigate') {
    if (mode === 'navigate') {
      event.respondWith(
        fetch(request)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('/', copy));
            return res;
          })
          .catch(async () => {
            // Offline: serve cached root or index.html, else a minimal fallback.
            const cache = await self.caches.open(CACHE);
            return (
              (await cache.match('/')) ||
              (await cache.match('/index.html')) ||
              new Response(
                '<!doctype html><meta charset=utf-8><title>Offline</title>' +
                  '<p style="font-family:system-ui;padding:2rem">Sem ligação. Verifica a rede.</p>',
                { status: 503, statusText: 'Offline', headers: { 'Content-Type': 'text/html; charset=utf-8' } }
              )
            );
          })
      );
      return;
    }
    return;
  }

  // Ativos estáticos: cache primeiro, network depois (precache).
  const url = new URL(request.url);
  const isStatic =
    url.origin === self.location.origin &&
    (request.url.startsWith('/assets/') ||
      request.url.startsWith('/favicon') ||
      request.url.startsWith('/icon') ||
      request.url.startsWith('/manifest'));
  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const net = fetch(request)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          })
          .catch(() => cached);
        return cached || net;
      })
    );
    return;
  }
});

// Precarregar os ficheiros críticos.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE_URLS))
      .catch(() => undefined)
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
});
