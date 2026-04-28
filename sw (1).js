// IBAR Gyerek PWA – Service Worker
// Verzió: 1.0.0 – frissítéskor változtasd a CACHE_NAME-t!

const CACHE_NAME = 'ibar-gyerek-v1.0.0';
const OFFLINE_PAGE = './index.html';

// Ezek a fájlok offline is elérhetők lesznek
const PRECACHE_ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // Google Fonts – ha offline is kell, add hozzá a font fájlokat
];

// Külső erőforrások (CDN) – ezeket cache-ből szolgáljuk ki, ha elérhetők
const CACHE_FIRST_PATTERNS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

// ===== INSTALL =====
self.addEventListener('install', event => {
  console.log('[SW] Install – cache feltöltése:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
        console.warn('[SW] Néhány fájl nem cachelhető:', err);
      });
    }).then(() => {
      // Azonnal aktívvá teszi az új SW-t, nem vár a lapbezárásra
      return self.skipWaiting();
    })
  );
});

// ===== ACTIVATE =====
self.addEventListener('activate', event => {
  console.log('[SW] Activate – régi cache-ek törlése');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Régi cache törölve:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ===== FETCH =====
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Csak HTTP(S) kéréseket kezeljük
  if (!request.url.startsWith('http')) return;

  // POST és egyéb nem-GET kéréseket átengedjük
  if (request.method !== 'GET') return;

  // CDN betűtípusok: Cache First stratégia
  const isCacheFirst = CACHE_FIRST_PATTERNS.some(p => url.hostname.includes(p));
  if (isCacheFirst) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached || new Response('', { status: 503 }));
      })
    );
    return;
  }

  // Navigáció (HTML lapok): Network First, offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(OFFLINE_PAGE).then(cached => {
            if (cached) return cached;
            return new Response(
              '<h1>Offline</h1><p>Az alkalmazás offline módban nem érhető el. Kérjük, csatlakoztass az internethez!</p>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
          })
        )
    );
    return;
  }

  // Minden más: Stale While Revalidate – gyors, de frissít a háttérben
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(request).then(cached => {
        const fetchPromise = fetch(request).then(response => {
          if (response && response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        }).catch(() => null);
        return cached || fetchPromise;
      })
    )
  );
});

// ===== PUSH értesítések (opcionális, jövőbeli fejlesztés) =====
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'IBAR Gyerek', {
      body: data.body || 'Ideje egy rövid légzőgyakorlat?',
      icon: './icon-192.png',
      badge: './icon-96.png',
      tag: 'ibar-reminder',
      data: { url: data.url || './index.html' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || './index.html')
  );
});
