const CACHE_NAME = "taifa-school-report-v1";
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./favicon.svg",
  "./logo.png",
  "./site.webmanifest"
];

// Install Event - Pre-cache core shells
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Pre-caching core shell assets...");
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[Service Worker] Clearing old cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Caching strategies
self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // Skip POST, PUT, DELETE, PATCH (mutations). Only cache GET requests.
  if (event.request.method !== "GET") {
    return;
  }

  // Skip browser extensions and other non-http schemes (e.g. chrome-extension://)
  if (!event.request.url.startsWith("http")) {
    return;
  }

  // Skip API queries. The API queries are cached manually via IndexedDB inside custom-fetch.ts.
  if (requestUrl.pathname.startsWith("/api/")) {
    return;
  }

  // Caching Strategy:
  // For static assets (fonts, images), use CACHE-FIRST strategy.
  // For main HTML and JS/CSS bundles, use NETWORK-FIRST falling back to CACHE.
  const isStaticAsset = 
    requestUrl.origin.includes("fonts.gstatic.com") ||
    requestUrl.origin.includes("fonts.googleapis.com") ||
    requestUrl.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/);

  if (isStaticAsset) {
    // Cache First Strategy
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => {
          // Fallback to offline index.html if asset is missing
          if (event.request.headers.get("accept").includes("text/html")) {
            return caches.match("./index.html");
          }
        });
      })
    );
  } else {
    // Network First, falling back to cache
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // For routing navigation requests, serve the index.html shell (so client routing works)
            if (event.request.mode === "navigate" || event.request.headers.get("accept")?.includes("text/html")) {
              return caches.match("./index.html");
            }
          });
        })
    );
  }
});
