// Keep pages network-first so updates appear as soon as they're available.
// Content-fingerprinted public assets can safely use a matching cached copy.
const CACHE_NAME = "gaicani-v3";
const PRECACHE_URLS = ["/manifest.json", "/icon-192.png", "/icon-512.png"];
const STATIC_ASSET = /\.(?:js|css|png|jpe?g|svg|webp|gif|ico)$/i;

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(names => Promise.all(
    names.filter(name => /^gaicani-v\d+$/.test(name) && name !== CACHE_NAME).map(name => caches.delete(name))
  )).then(() => self.clients.claim()));
});

function shouldBypass(url) {
  return /^\/(?:socket\.io\/|api\/|private-photos\/|[fxyz])/i.test(url.pathname);
}

function isFingerprinted(url) {
  if (url.pathname === "/vendor/socket.io.min.js") return /^\?v=\d+\.\d+\.\d+$/.test(url.search);
  return STATIC_ASSET.test(url.pathname) && /^\?v=[a-f0-9]{10}$/.test(url.search);
}

function cacheable(response) {
  const policy = response.headers.get("Cache-Control") || "";
  return response.status === 200 && !response.redirected &&
    /(?:^|,)\s*public\s*(?:,|$)/i.test(policy) &&
    !/(?:^|,)\s*(?:private|no-store)\b/i.test(policy);
}

function immutable(response) {
  return /\bimmutable\b/i.test(response.headers.get("Cache-Control") || "");
}

function readCache(key) {
  return caches.match(key, { cacheName: CACHE_NAME }).catch(() => undefined);
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("Authorization") || request.headers.has("Range")) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || shouldBypass(url)) return;

  const fingerprinted = isFingerprinted(url);
  // Keep one entry per asset path. A request for a different fingerprint
  // always goes to the network instead of getting mismatched bytes.
  const key = fingerprinted ? url.origin + url.pathname : request;
  const cached = fingerprinted ? readCache(key).then(response => {
    if (response?.url === request.url && immutable(response)) return response;
  }) : Promise.resolve();
  const network = cached.then(response => response ? null : fetch(request));

  event.waitUntil(network.then(response => {
    if (!response || !cacheable(response) || (fingerprinted && !immutable(response))) return;
    const copy = response.clone();
    return caches.open(CACHE_NAME).then(cache => cache.put(key, copy));
  }).catch(() => {}));

  event.respondWith(network.then(response => response || cached).catch(async error => {
    const offline = fingerprinted ? undefined : await readCache(key);
    if (offline) return offline;
    if (request.mode === "navigate") {
      const dashboard = await readCache("/dashboard.html");
      if (dashboard) return dashboard;
    }
    throw error;
  }));
});
