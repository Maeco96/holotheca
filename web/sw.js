// Service worker for the app shell and the vendored OCR files.
// CACHE is rewritten at deploy time; VENDOR_CACHE is stable so the ~7 MB of OCR files
// are downloaded once and kept across deployments.
const CACHE = "scrinium-dev";
const VENDOR_CACHE = "scrinium-vendor-1";
const SHELL = [
  "./", "index.html", "app.js", "manifest.webmanifest",
  "icon-192.png", "icon-512.png", "apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE && k !== VENDOR_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isVendor = url.pathname.includes("/vendor/");
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        if (isVendor && response.ok) {
          const copy = response.clone();
          caches.open(VENDOR_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
