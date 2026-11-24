/* ============================================================
   sw.js — offline cache for the whole game
   Strategy
     · navigation   -> network first, fallback to the cached shell
     · assets/js/css -> stale-while-revalidate
   Bump CACHE_VERSION whenever shipped files change.
   ============================================================ */
'use strict';

var CACHE_VERSION = 'sanu-bdu-v5';

var CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/store.js',
  './js/assets.js',
  './js/audio.js',
  './js/input.js',
  './js/levels.js',
  './js/entities.js',
  './js/game.js',
  './js/main.js',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function (c) {
      // add one by one so a single 404 can't abort the whole install
      return Promise.all(CORE.map(function (url) {
        return c.add(url).catch(function (err) {
          console.warn('[sw] skip', url, err && err.message);
        });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE_VERSION ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== location.origin) return;

  // navigations: network first so updates land, offline falls back to the shell
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE_VERSION).then(function (c) { c.put('./index.html', copy); });
        }
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (r) {
          return r || caches.match('./');
        });
      })
    );
    return;
  }

  // everything else: stale-while-revalidate
  e.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE_VERSION).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
