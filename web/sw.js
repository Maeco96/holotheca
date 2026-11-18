// Service worker for the app shell, the vendored OCR files and the card index.
// CACHE is rewritten at deploy time; VENDOR_CACHE is stable so the ~40 MB of OCR files
// are downloaded once and kept across deployments. The card index (data/) follows CACHE,
// so a new deployment brings a fresh catalogue.
const CACHE = "holotheca-dev";
const VENDOR_CACHE = "holotheca-vendor-2";
const SHELL = [
  "./", "index.html", "styles.css", "app.js", "recognize.js", "catalogue.js", "store.js", "camera.js", "scanlog.js", "visual.js",
  "manifest.webmanifest",
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
  const isData = url.pathname.includes("/data/");
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        if (response.ok && (isVendor || isData)) {
          const copy = response.clone();
          caches.open(isVendor ? VENDOR_CACHE : CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
