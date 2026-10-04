// CashBall service worker — offline fallback para a SPA.
// URL VERSIONADO (sw.vN.js): ao alterar este ficheiro, renomear (v8->v9)
// e atualizar o register() em main.jsx. O URL novo fura caches HTTP
// envenenadas e substitui o registo velho no próximo carregamento.
// Bump VERSION on any client change so activate() clears the stale cache
// and the user picks up new hashed bundles.
const VERSION = 'v8';
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
  // Ativa de imediato: sem isto o SW novo fica em "waiting" enquanto
  // houver uma aba aberta — e um handler de push novo nunca entra.
  self.skipWaiting();
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
      .then(() => self.clients.claim())
  );
});

// Web Push (Fase 3): mostra o aviso; ao tocar, foca a app ou abre-a.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'CashBall', {
      body: data.body || 'Há novidades na tua sala.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // tag por tipo (ex. 'waiting:ABCD'): um aviso novo da mesma sala
      // substitui o anterior em vez de empilhar no centro de notificações.
      tag: data.tag || 'cashball-ready',
      renotify: true,
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  const target = new URL(url, self.location.origin).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const c of list) {
          if (!('focus' in c)) continue;
          const focused = c.focus();
          // A janela pode estar noutro sítio (outra sala, lobby): navegar
          // para o deep link do aviso antes de a trazer à frente.
          if (c.url !== target && 'navigate' in c) {
            return c.navigate(target).then((client) => {
              const cl = client || c;
              return 'focus' in cl ? cl.focus() : focused;
            }).catch(() => focused);
          }
          return focused;
        }
        return self.clients.openWindow(target);
      })
  );
});
