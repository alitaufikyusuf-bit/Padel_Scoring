/* ============================================================================
   SERVICE WORKER

   Tujuannya satu: aplikasi tetap terbuka penuh di pinggir lapangan yang tidak
   ada sinyal. Seluruh state turnamen memang sudah ada di localStorage, jadi
   yang perlu di-cache hanya kerangka aplikasinya.

   Strategi per jenis permintaan, dan alasannya:

   navigasi   -> jaringan dulu, cache sebagai jaring
                 Versi baru harus cepat terpakai. Kalau jaringan gagal, halaman
                 terakhir yang pernah dibuka disajikan.
   /api/*     -> jaringan saja, TIDAK PERNAH di-cache
                 Ini data ruang yang berubah tiap reli. Menyajikan versi cache
                 berarti menampilkan skor lama sebagai skor sekarang - jauh
                 lebih buruk daripada gagal terang-terangan.
   aset build -> cache dulu
                 Berkas /_next/static/* namanya sudah berisi hash, jadi isinya
                 tidak mungkin berubah tanpa nama berubah.
   huruf/ikon -> cache dulu

   CACHE dinaikkan setiap kali aplikasi di-deploy ulang. Tanpa itu, perangkat
   yang sudah memasang aplikasinya bisa tertinggal di versi lama tanpa batas.
   ========================================================================== */

var CACHE = "mnpadel-next-v1";

/* Yang dipanaskan saat pemasangan. Sengaja sedikit: sisanya menyusul sendiri
   saat dipakai, dan daftar panjang yang satu berkasnya hilang akan membuat
   seluruh pemasangan gagal. */
var CORE = [
  "/bagan",
  "/klasemen",
  "/atur",
  "/live",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches
      .open(CACHE)
      .then(function (c) {
        /* addAll gagal seluruhnya kalau satu berkas gagal, jadi dipasang
           satu-satu dan yang gagal diabaikan. */
        return Promise.all(
          CORE.map(function (u) {
            return c.add(new Request(u, { cache: "reload" })).catch(function () {});
          }),
        );
      })
      .then(function () {
        return self.skipWaiting();
      }),
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (k) {
            return k === CACHE ? null : caches.delete(k);
          }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var url;
  try {
    url = new URL(req.url);
  } catch (err) {
    return;
  }
  /* Permintaan ke domain lain dilewatkan apa adanya. */
  if (url.origin !== self.location.origin) return;

  /* Data ruang tidak pernah di-cache. */
  if (url.pathname.indexOf("/api/") === 0) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) {
            c.put(req, copy).catch(function () {});
          });
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (hit) {
            return hit || caches.match("/bagan");
          });
        }),
    );
    return;
  }

  var cacheable =
    url.pathname.indexOf("/_next/static/") === 0 ||
    url.pathname.indexOf("/fonts/") === 0 ||
    url.pathname.indexOf("/icons/") === 0 ||
    url.pathname === "/manifest.webmanifest";

  if (!cacheable) return;

  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        /* Balasan yang gagal atau sebagian tidak boleh masuk cache - kalau
           tidak, kegagalan sekali jadi permanen. */
        if (!res || res.status !== 200 || res.type === "opaque") return res;
        var copy = res.clone();
        caches.open(CACHE).then(function (c) {
          c.put(req, copy).catch(function () {});
        });
        return res;
      });
    }),
  );
});
