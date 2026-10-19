/* VESPER offline cache. Increment CACHE_VERSION after future game releases. */
const CACHE_VERSION = 'vesper-cathedral-v7-abilities-1';
const APP_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './castle-view.js',
  './floors.js',
  './enemy-system.js',
  './equipment.js',
  './abilities.js',
  './abilities.css',
  './inventory-ui.js',
  './inventory.css',
  './story-content.js',
  './narrative.js',
  './narrative.css',
  './images/forgotten-knight.png',
  './vendor/three.module.min.js',
  './vendor/three.core.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await cache.addAll(APP_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('vesper-cathedral-') && k !== CACHE_VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_VERSION);
      try {
        const response = await fetch(request);
        if (response.ok) cache.put('./index.html', response.clone()).catch(() => {});
        return response;
      } catch {
        return (await cache.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      return await fetch(request);
    } catch {
      return Response.error();
    }
  })());
});
