const CACHE_PREFIX = "open-physics-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const APP_ROOT = new URL("./", self.location.href);
const STATIC_FILES = [
  APP_ROOT.href,
  new URL("./manifest.webmanifest", APP_ROOT).href,
  new URL("./favicon.svg", APP_ROOT).href,
  new URL("./icons/icon-192.png", APP_ROOT).href,
  new URL("./icons/icon-512.png", APP_ROOT).href,
  new URL("./icons/icon-maskable-512.png", APP_ROOT).href,
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const response = await fetch(APP_ROOT, { cache: "reload" });
    await cache.put(APP_ROOT, response.clone());
    const html = await response.text();
    const assetUrls = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
      .map((match) => new URL(match[1], APP_ROOT))
      .filter((url) => url.origin === self.location.origin)
      .map((url) => url.href);
    await cache.addAll([...new Set([...STATIC_FILES.slice(1), ...assetUrls])]);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_ROOT.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) (await caches.open(CACHE_NAME)).put(APP_ROOT, response.clone());
        return response;
      } catch {
        return (await caches.match(request)) || (await caches.match(APP_ROOT));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    const network = fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      return response;
    });
    return cached || network;
  })());
});
