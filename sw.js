/* ==========================================================================
   SIAKAD SURAT — Service Worker (cangkang aplikasi)
   --------------------------------------------------------------------------
   Tujuan: kunjungan kedua dan seterusnya tampil SEKETIKA, bahkan di jaringan
   seluler lambat, karena HTML/CSS/JS diambil dari perangkat.

   Aturan:
   • Berkas cangkang (HTML/CSS/JS) → stale-while-revalidate:
     sajikan salinan lokal lebih dulu, perbarui diam-diam di latar belakang.
   • Permintaan ke Google Apps Script (/exec) → TIDAK PERNAH di-cache,
     karena data harus selalu terbaru.
   ========================================================================== */

var VERSI = 'siakad-v2.0.0';
var CANGKANG = [
  './',
  './index.html',
  './assets/css/style.css',
  './assets/js/00-config.js',
  './assets/js/01-core.js',
  './assets/js/02-landing.js',
  './assets/js/03-mahasiswa.js',
  './assets/js/04-admin.js',
  './assets/js/05-app.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSI)
      .then(function (c) { return c.addAll(CANGKANG); })
      .then(function () { return self.skipWaiting(); })
      .catch(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (kunci) {
      return Promise.all(kunci.map(function (k) {
        return (k === VERSI) ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }

  // Jangan sentuh permintaan ke backend maupun lintas-asal (Drive, Fonts, CDN).
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/exec') >= 0) return;

  e.respondWith(
    caches.open(VERSI).then(function (cache) {
      return cache.match(req).then(function (tersimpan) {
        var jaringan = fetch(req).then(function (res) {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        }).catch(function () { return tersimpan; });
        // Salinan lokal disajikan lebih dulu → render instan.
        return tersimpan || jaringan;
      });
    })
  );
});
