// ╔══════════════════════════════════════════╗
// ║  Belső Hold – Service Worker             ║
// ║  Teljes offline cache PWA működéshez     ║
// ╚══════════════════════════════════════════╝

const CACHE_NAME = 'belso-hold-v2';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Pro:ital,wght@0,300;0,400;1,300;1,400&display=swap'
];

// Telepítés – cache feltöltése
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Fontokat opcionálisan cache-eljük (hálózat kell az első betöltéshez)
      const criticalAssets = ['./index.html', './manifest.json'];
      const optionalAssets = [
        './icon-192.png',
        './icon-512.png',
        'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Pro:ital,wght@0,300;0,400;1,300;1,400&display=swap'
      ];
      
      return cache.addAll(criticalAssets).then(() => {
        // Opcionális fájlokat egyenként próbáljuk, hiba esetén továbblépünk
        return Promise.allSettled(
          optionalAssets.map(url => 
            cache.add(url).catch(e => console.log('Optional cache miss:', url))
          )
        );
      });
    }).then(() => self.skipWaiting())
  );
});

// Aktiválás – régi cache törlése
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch – cache-first stratégia az app fájlokhoz
// Network-first a Google Fonts-hoz
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Google Fonts – network first, cache fallback
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Minden más (index.html, ikonok) – cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
