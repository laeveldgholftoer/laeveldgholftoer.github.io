/* Laeveld Gholftoer - service worker.
   Die blad self kom uit die kas (vinnig, en werk sonder sein); die tellings
   kom altyd eers oor die lug, met die laaste kopie as terugval. */
var KAS = "lgt-31813e6cdc";
var SKAAL = ["./", "./index.html", "./manifest.webmanifest",
             "./icon-192.png", "./icon-512.png", "./icon-180.png", "./icon-32.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(KAS)
      .then(function (k) { return k.addAll(SKAAL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (name) {
      return Promise.all(name.map(function (n) {
        return n === KAS ? null : caches.delete(n);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") { return; }
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) { return; }

  if (url.pathname.indexOf("data.json") !== -1) {
    e.respondWith(
      fetch(req).then(function (r) {
        var kopie = r.clone();
        caches.open(KAS).then(function (c) { c.put("./data.json", kopie); });
        return r;
      }).catch(function () {
        return caches.match("./data.json");
      })
    );
    return;
  }

  // Die blad self: ook eers oor die lug, sodat 'n nuwe weergawe dadelik wys
  // en niemand hoef te wonder of hy die ou een sien nie. Op 'n swak lyn wag
  // ons hoogstens 'n paar sekondes en gryp dan die kas - so bly dit vinnig
  // waar die sein sukkel, en heeltemal bruikbaar waar daar niks is nie.
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (kas) {
      var lug = fetch(req).then(function (r) {
        if (r && r.status === 200 && r.type === "basic") {
          var kopie = r.clone();
          caches.open(KAS).then(function (c) { c.put(req, kopie); });
        }
        return r;
      });
      if (!kas) { return lug; }
      var wag = new Promise(function (los) { setTimeout(function () { los(kas); }, 3000); });
      return Promise.race([lug.catch(function () { return kas; }), wag]);
    })
  );
});