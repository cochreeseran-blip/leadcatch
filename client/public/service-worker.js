// KnockTrakr service worker — network-first, version-gated cache bust

const CACHE = "knocktrakr-v4";
const SHELL = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.matchAll({ includeUncontrolled: true, type: "window" }))
      .then((clients) => clients.forEach((client) => client.postMessage({ type: "SW_UPDATED" })))
  );
  self.clients.claim();
});

// Network-first for everything — always try fresh, fall back to cache offline.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Skip non-http(s) requests
  if (!req.url.startsWith("http")) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Cache successful responses for offline fallback
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, clone));
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match("/index.html")))
  );
});
