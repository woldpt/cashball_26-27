// CashBall service worker — offline fallback para a SPA.
const CACHE = 'cashball-static-v1';
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
          .catch(() => caches.match('/').then((c) => c || self.caches.match('/index.html')))
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
