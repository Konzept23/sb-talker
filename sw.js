const APP_PREFIX = "sb-talker-";
const CACHE_NAME = APP_PREFIX + "v1.7.0";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png"
];

// Beim Installieren alle Basisdateien fest in den Offline-Tresor legen
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Nur veraltete Caches DIESER App löschen (andere GitHub-Apps bleiben unberührt)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(APP_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Online: Frisch laden & Cache aktualisieren (max. 2,5 Sek. Wartezeit)
// Offline / Funkloch: Sofort aus dem lokalen Tresor ausliefern
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);

      try {
        const networkResponse = await fetch(event.request, {
          signal: controller.signal,
          cache: "no-cache"
        });
        clearTimeout(timer);

        if (networkResponse && networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (err) {
        clearTimeout(timer);
        const cached = await caches.match(event.request, { ignoreSearch: true });
        if (cached) return cached;

        if (event.request.mode === "navigate") {
          const fallback = await caches.match("./index.html");
          if (fallback) return fallback;
        }

        return new Response("Offline – diese Datei ist noch nicht im lokalen Speicher.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
    })()
  );
});