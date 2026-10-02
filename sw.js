/* App-shell worker so Chrome can install REAP-IR-50.
   Navigations (including the 5-minute ?r= reload) are network-first.
   Icons are cache-first. Offline falls back to the last good index.html. */
var CACHE = "reap-ir-50-shell-v1";
var SHELL = [
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE) return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function iconPath(pathname) {
  return /\/(?:icon-192|icon-512|apple-touch-icon)\.png$/.test(pathname);
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;
  var url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (iconPath(url.pathname)) {
    event.respondWith(
      caches.match(request).then(function (cached) {
        if (cached) return cached;
        return fetch(request).then(function (response) {
          if (response && response.ok) {
            var copy = response.clone();
            caches.open(CACHE).then(function (cache) {
              cache.put(request, copy);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  var isDocument = request.mode === "navigate" || /\/index\.html$/.test(url.pathname);
  if (!isDocument) return;

  var shellIndex = new URL("./index.html", self.location).href;
  event.respondWith(
    fetch(request).then(function (response) {
      if (response && response.ok) {
        var copy = response.clone();
        caches.open(CACHE).then(function (cache) {
          cache.put(shellIndex, copy);
        });
      }
      return response;
    }).catch(function () {
      return caches.match(shellIndex);
    })
  );
});
