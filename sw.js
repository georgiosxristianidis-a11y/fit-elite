/**
 * sw.js — Minimal Service Worker for Fit Elite PWA
 *
 * Strategy:
 *   Static assets → cache-first
 *   HTML/API      → network-first, fallback to cache
 */

const CACHE_NAME = 'fit-elite-v1';

// App shell files to pre-cache
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  // CSS/JS loaded via CDN but referenced here:
  '/env.js',
];

// ── Install: build cache ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ── Activate: delete old caches ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// ── Fetch: cache-first for static, network-first for dynamic ──
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Static assets (JS, CSS, fonts, icons)
  if (/\.(css|js|woff2|png|svg|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        // Cache the fresh copy
        const toCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, toCache));
        return response;
      }))
    );
    return;
  }

  // HTML — network first, cache as backup
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request).then((response) => {
        const toCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, toCache));
        return response;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Everything else (including env.js, API) — network first, fallback to cache
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
