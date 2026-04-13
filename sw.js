/* Service Worker — hanterar offlinecache för appen */
const CACHE_NAME = 'fiskeapp-v2';

/* Resurser som cachas vid installation */
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/utils.js',
  './js/db.js',
  './js/router.js',
  './js/home.js',
  './js/map.js',
  './js/catch-form.js',
  './js/catches.js',
  './js/stats.js',
  './js/spots.js',
  './js/app.js',
  './manifest.json',
  './images/icon.svg',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js'
];

/* Installera — cacha app-skalet */
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

/* Aktivera — rensa gamla cacher */
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

/* Hämta — cache-first för app-skalet, network-first för allt annat */
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  /* API-anrop (väder) — network only, misslyckas tyst offline */
  if (url.includes('api.open-meteo.com')) {
    e.respondWith(
      fetch(e.request).catch(function() {
        return new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  /* Kartplattor — network-first med cache-fallback */
  if (url.includes('arcgisonline.com')) {
    e.respondWith(
      fetch(e.request).then(function(res) {
        var clone = res.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(e.request, clone);
        });
        return res;
      }).catch(function() {
        return caches.match(e.request);
      })
    );
    return;
  }

  /* App-skal — cache-first */
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request);
    })
  );
});
