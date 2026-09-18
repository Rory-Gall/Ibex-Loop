/* Ibex Loop service worker.
   CACHE carries the build number - bump it together with var BUILD in index.html.
   Copied from the Bush Trip Reader worker (itself from the KEI Mileage app / Field Sheet),
   with one change: activate only deletes this app's OWN old builds, never the
   "ibex-trip-data" cache that holds the private trip file loaded from the phone. */
"use strict";
var CACHE = "ibex-loop-b1";
var ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) {
        /* cache:"reload" bypasses the HTTP cache so a new build never caches the old index.html */
        return c.addAll(ASSETS.map(function (u) {
          return new Request(u, { cache: "reload" });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k.indexOf("ibex-loop-b") === 0 && k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

/* Cache-first with background refresh: offline everything serves from cache; online the
   cache quietly updates so the next launch is current. Map tiles are other origins and
   pass straight through (the app falls back to its built-in offline map). */
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  var key = e.request.mode === "navigate" ? "./index.html" : e.request;
  e.respondWith(
    caches.match(key, { cacheName: CACHE }).then(function (hit) {
      var refresh = fetch(e.request, { cache: "no-cache" }).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          return caches.has(CACHE)
            .then(function (ok) {
              return ok && caches.open(CACHE).then(function (c) { return c.put(key, copy); });
            })
            .then(function () { return res; });
        }
        return res;
      }).catch(function () {
        return hit || Response.error();
      });
      e.waitUntil(refresh.catch(function () {}));
      return hit || refresh;
    })
  );
});
