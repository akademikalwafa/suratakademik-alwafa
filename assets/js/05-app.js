/* ==========================================================================
   SIAKAD SURAT — 05 BOOTSTRAP APLIKASI
   Memulihkan sesi, memuat modul admin secara malas, dan menyalakan aplikasi.
   ========================================================================== */

(function (S) {
  'use strict';
  var API = S.API, UI = S.UI, Simpan = S.Simpan;

  var SESI_MS = 6 * 60 * 60 * 1000; // sama dengan masa berlaku token di backend

  var App = {

    /**
     * Modul admin (±110 KB) hanya diunduh & diparsing saat benar-benar
     * dibutuhkan. Mahasiswa — mayoritas pengguna, umumnya dari HP — tidak
     * perlu menanggung beban itu sama sekali.
     */
    muatAdmin: function () {
      if (S.Admin) return Promise.resolve(S.Admin);
      if (App._janjiAdmin) return App._janjiAdmin;

      App._janjiAdmin = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = 'assets/js/04-admin.js?v=' + S.VER;
        s.async = false;
        s.onload = function () { resolve(S.Admin); };
        s.onerror = function () {
          App._janjiAdmin = null;
          reject(new Error('Modul panel admin gagal dimuat. Periksa koneksi lalu muat ulang halaman.'));
        };
        document.head.appendChild(s);
      });
      return App._janjiAdmin;
    },

    bukaAdmin: function () {
      return App.muatAdmin().then(function (A) {
        A.buka();
      }).catch(function (e) {
        UI.toast(e.message, 'error');
        document.getElementById('boot').classList.add('hide');
        UI.layar('landing');
      });
    },

    mulai: function () {
      App.pasangGlobal();
      S.Landing.init();

      var sesi = Simpan.get('token');
      var umur = Simpan.umur('token');

      if (sesi && sesi.t && umur < SESI_MS) {
        API.token = sesi.t;
        S.State.peran = sesi.peran;
        // Hasil pra-ambil dari index.html dipakai ulang bila ada & cocok.
        if (window.__PF && window.__PF.boot && window.__PF.peran === sesi.peran) {
          S.State.prefetchBoot = window.__PF.boot;
        }
        if (sesi.peran === 'ADMIN') App.bukaAdmin();
        else S.Mahasiswa.buka();
      } else {
        if (sesi) Simpan.hapus('token');
        UI.layar('landing');
        document.getElementById('boot').classList.add('hide');
        // Bangunkan server + panaskan cache selagi pengguna mengetik NIM → login terasa instan.
        API.warm('pub');
      }

      // Unduh modul admin di waktu senggang bila pengguna membuka tab Admin.
      var tabAdm = document.getElementById('tab-adm');
      if (tabAdm) tabAdm.addEventListener('mouseenter', function () { App.muatAdmin(); API.warm('admin'); }, { once: true });
      if (tabAdm) tabAdm.addEventListener('touchstart', function () { App.muatAdmin(); API.warm('admin'); }, { once: true, passive: true });
      if (tabAdm) tabAdm.addEventListener('click', function () { API.warm('admin'); });
    },

    pasangGlobal: function () {
      S.Aktivitas.init();
      var bg = document.getElementById('modal-bg');
      bg.addEventListener('click', function (e) { if (e.target === bg) UI.tutupModal(); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && bg.classList.contains('show')) UI.tutupModal();
      });

      // Setiap elemen ber-atribut data-berkas dibuka sebagai POPUP pratinjau,
      // di mana pun ia berada — tidak pernah berpindah halaman atau membuka tab.
      document.addEventListener('click', function (e) {
        var t = e.target && e.target.closest ? e.target.closest('[data-berkas]') : null;
        if (!t) return;
        e.preventDefault();
        S.Dok.pratinjau(S.Dok.dariUrl(t.getAttribute('data-berkas'), t.getAttribute('data-berkas-nama')));
      });

      window.addEventListener('offline', function () {
        UI.toast('Koneksi internet terputus. Data yang tampil berasal dari salinan lokal.', 'warn', 'Mode Luring');
      });
      window.addEventListener('online', function () {
        UI.toast('Koneksi pulih. Menyinkronkan data…', 'ok');
        App.segarkan();
      });

      var terakhirAktif = Date.now();
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) { terakhirAktif = Date.now(); return; }
        if (Date.now() - terakhirAktif < 120000) return;
        if (!S.State.peran) { API.warm('pub'); return; }
        App.segarkan();
      });

      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        var t = e.target;
        if (t && t.tagName === 'INPUT' && t.type !== 'submit' && t.closest && t.closest('.modal')) {
          var ok = t.closest('.modal').querySelector('.modal-foot .btn-primary, .modal-foot .btn-danger');
          if (ok && !ok.disabled) { e.preventDefault(); ok.click(); }
        }
      });
    },

    segarkan: function () {
      if (S.State.peran === 'ADMIN' && S.Admin) S.Admin.muat();
      else if (S.State.peran === 'MAHASISWA') S.Mahasiswa.muat(false);
    },

    keluar: function () {
      UI.konfirmasi({
        judul: 'Keluar dari Aplikasi?',
        isi: 'Sesi Anda akan diakhiri dan salinan data lokal dihapus dari perangkat ini.',
        tombol: 'Ya, Keluar', bahaya: true
      }).then(function (ya) {
        if (!ya) return;
        var nim = Simpan.get('nim_terakhir');
        Simpan.bersihkan();
        if (nim) Simpan.set('nim_terakhir', nim);
        API.token = null;
        S.State.peran = null;
        location.reload();
      });
    }
  };

  S.App = App;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', App.mulai);
  } else {
    App.mulai();
  }

})(window.SIAKAD);
