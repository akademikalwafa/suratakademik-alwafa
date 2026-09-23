/* ==========================================================================
   SIAKAD SURAT — 01 CORE
   API client, penyimpanan lokal, router SPA, toast, modal, util format & ikon.
   Semua fungsi bersifat sinkron kecuali yang menyentuh jaringan.
   ========================================================================== */

(function (global) {
  'use strict';

  var CFG = global.APP_CONFIG;

  /* ======================================================================
     1. API CLIENT
     ====================================================================== */

  var API = {
    token: null,
    peran: null,

    /** POST ke GAS. Header text/plain agar tidak memicu preflight CORS. */
    kirim: function (action, data) {
      if (!CFG.GAS_URL || CFG.GAS_URL.indexOf('GANTI_DENGAN') === 0) {
        return Promise.resolve({
          success: false,
          message: 'URL backend belum diisi. Buka assets/js/00-config.js lalu tempel URL /exec milik Anda.',
          code: 'NO_URL'
        });
      }

      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, CFG.TIMEOUT_MS) : null;

      return fetch(CFG.GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: action, token: API.token || '', data: data || {} }),
        signal: ctrl ? ctrl.signal : undefined,
        redirect: 'follow'
      })
        .then(function (res) {
          if (timer) clearTimeout(timer);
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.text();
        })
        .then(function (teks) {
          try {
            return JSON.parse(teks);
          } catch (e) {
            // GAS mengembalikan halaman HTML bila URL salah atau izin belum "Anyone".
            return {
              success: false,
              code: 'BAD_RESPONSE',
              message: 'Server tidak mengembalikan JSON. Periksa kembali URL /exec dan pastikan akses deployment disetel "Anyone".'
            };
          }
        })
        .then(function (json) {
          if (json && json.code === 'UNAUTHORIZED') UI.sesiHabis();
          return json;
        })
        .catch(function (err) {
          if (timer) clearTimeout(timer);
          var pesan = (err && err.name === 'AbortError')
            ? 'Permintaan terlalu lama. Periksa koneksi internet Anda.'
            : 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
          return { success: false, message: pesan, code: 'NETWORK' };
        });
    },

    /** Kirim dan tampilkan toast otomatis bila gagal. */
    aman: function (action, data) {
      return API.kirim(action, data).then(function (r) {
        if (!r.success) UI.toast(r.message || 'Terjadi kesalahan.', 'error');
        return r;
      });
    }
  };

  /* ======================================================================
     2. PENYIMPANAN LOKAL (aman terhadap mode privat / storage diblokir)
     ====================================================================== */

  var Simpan = {
    set: function (k, v) {
      try { localStorage.setItem('siakad:' + k, JSON.stringify({ t: Date.now(), v: v })); } catch (e) { }
    },
    get: function (k, maksUmurMs) {
      try {
        var raw = localStorage.getItem('siakad:' + k);
        if (!raw) return null;
        var o = JSON.parse(raw);
        if (maksUmurMs && (Date.now() - o.t) > maksUmurMs) return null;
        return o.v;
      } catch (e) { return null; }
    },
    umur: function (k) {
      try {
        var raw = localStorage.getItem('siakad:' + k);
        if (!raw) return Infinity;
        return Date.now() - JSON.parse(raw).t;
      } catch (e) { return Infinity; }
    },
    hapus: function (k) { try { localStorage.removeItem('siakad:' + k); } catch (e) { } },
    bersihkan: function () {
      try {
        var buang = [];
        for (var i = 0; i < localStorage.length; i++) {
          var key = localStorage.key(i);
          if (key && key.indexOf('siakad:') === 0) buang.push(key);
        }
        buang.forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) { }
    }
  };

  /* ======================================================================
     3. STATE APLIKASI (sumber data tunggal di sisi klien)
     ====================================================================== */

  var State = {
    peran: null,       // 'MAHASISWA' | 'ADMIN'
    profil: null,
    mhs: null,         // payload bootstrapMahasiswa
    adm: null,         // payload bootstrapAdmin
    publik: null,
    layarAktif: 'landing',
    viewAktif: '',
    sinkron: false
  };

  /* ======================================================================
     4. UTIL FORMAT
     ====================================================================== */

  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var BULAN_S = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  var F = {
    esc: function (v) {
      return String(v === undefined || v === null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },
    tgl: function (v, pendek) {
      if (!v) return '-';
      var d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return d.getDate() + ' ' + (pendek ? BULAN_S : BULAN)[d.getMonth()] + ' ' + d.getFullYear();
    },
    tglJam: function (v) {
      if (!v) return '-';
      var d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return F.tgl(v, true) + ', ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ' WIB';
    },
    hari: function (v) {
      var d = new Date(v);
      return isNaN(d.getTime()) ? '' : HARI[d.getDay()];
    },
    relatif: function (v) {
      if (!v) return '-';
      var d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      var s = Math.floor((Date.now() - d.getTime()) / 1000);
      if (s < 60) return 'Baru saja';
      if (s < 3600) return Math.floor(s / 60) + ' menit lalu';
      if (s < 86400) return Math.floor(s / 3600) + ' jam lalu';
      if (s < 172800) return 'Kemarin, ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
      if (s < 604800) return Math.floor(s / 86400) + ' hari lalu';
      return F.tgl(v, true);
    },
    rupiah: function (v) {
      var n = parseInt(String(v).replace(/[^\d]/g, ''), 10) || 0;
      return 'Rp ' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    },
    inisial: function (nama) {
      var p = String(nama || '?').trim().split(/\s+/);
      return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
    },
    inputTgl: function (v) {
      if (!v) return '';
      var d = new Date(v);
      return isNaN(d.getTime()) ? '' : d.toISOString().substring(0, 10);
    },
    statusBadge: function (status) {
      var peta = {
        MENUNGGU: ['badge-amber', 'Menunggu Verifikasi'],
        DISETUJUI: ['badge-green', 'Disetujui / Terbit'],
        DITOLAK: ['badge-red', 'Ditolak / Revisi'],
        DIBATALKAN: ['badge-gray', 'Dibatalkan'],
        BELUM: ['badge-gray', 'Belum Diajukan'],
        REVISI: ['badge-red', 'Perlu Revisi'],
        TERKUNCI: ['badge-gray', 'Terkunci'],
        SIAP: ['badge-green', 'Siap Diambil']
      };
      var x = peta[status] || ['badge-gray', status || '-'];
      return '<span class="badge ' + x[0] + '"><span class="dot"></span>' + F.esc(x[1]) + '</span>';
    }
  };

  /* ======================================================================
     5. IKON (SVG inline — tanpa font-icon eksternal agar render instan)
     ====================================================================== */

  var PATHS = {
    home: '<path d="M3 10.2 12 3l9 7.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5L15.5 10"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    xCircle: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l3.5-4 3 2.5L20 7"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    unlock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 9l5-5 5 5M12 4v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 11l5 5 5-5M12 16V4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    graduation: '<path d="m22 9-10-5L2 9l10 5z"/><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5"/>',
    award: '<circle cx="12" cy="9" r="6"/><path d="m8.2 13.8-1.4 7.4 5.2-2.7 5.2 2.7-1.4-7.4"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    edit: '<path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 7 10-7"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    flask: '<path d="M10 2v6.5L4.5 18A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-3L14 8.5V2"/><path d="M8.5 2h7M7 14h10"/>',
    presentation: '<path d="M2 3h20v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/><path d="m9 21 3-5 3 5M12 16v0"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    filter: '<path d="M3 4h18l-7 8v6l-4 2v-8z"/>',
    qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    printer: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'
  };

  function ikon(nama, ukuran, tebal) {
    var p = PATHS[nama] || PATHS.info;
    var s = ukuran || 18;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="' + (tebal || 1.9) + '" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }

  /* ======================================================================
     6. UI — toast, modal, router, loading
     ====================================================================== */

  var UI = {

    /* --- Toast ------------------------------------------------------- */
    toast: function (pesan, tipe, judul) {
      var wrap = document.getElementById('toasts');
      if (!wrap) return;
      var el = document.createElement('div');
      el.className = 'toast ' + (tipe || 'ok');
      var ic = tipe === 'error' ? 'xCircle' : (tipe === 'warn' ? 'alert' : 'checkCircle');
      var warna = tipe === 'error' ? 'var(--red-600)' : (tipe === 'warn' ? 'var(--amber-600)' : 'var(--green-600)');
      el.innerHTML =
        '<span style="color:' + warna + ';line-height:0;margin-top:1px">' + ikon(ic, 18) + '</span>' +
        '<div class="grow">' + (judul ? '<div class="tt">' + F.esc(judul) + '</div>' : '') +
        '<div>' + F.esc(pesan) + '</div></div>' +
        '<button class="x-btn" aria-label="Tutup">' + ikon('x', 15) + '</button>';
      el.querySelector('.x-btn').onclick = function () { tutup(); };
      wrap.appendChild(el);
      var t = setTimeout(tutup, tipe === 'error' ? 6500 : 3800);
      function tutup() {
        clearTimeout(t);
        if (!el.parentNode) return;
        el.classList.add('out');
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 200);
      }
    },

    /* --- Modal ------------------------------------------------------- */
    modal: function (opsi) {
      var bg = document.getElementById('modal-bg');
      var box = document.getElementById('modal-box');
      box.className = 'modal' + (opsi.lebar ? ' wide' : '');
      box.innerHTML =
        '<div class="modal-head"><div><h3>' + F.esc(opsi.judul || '') + '</h3>' +
        (opsi.sub ? '<div class="s">' + F.esc(opsi.sub) + '</div>' : '') + '</div>' +
        '<button class="x-btn" data-tutup aria-label="Tutup">' + ikon('x', 18) + '</button></div>' +
        '<div class="modal-body" id="modal-body">' + (opsi.isi || '') + '</div>' +
        (opsi.kaki === null ? '' : '<div class="modal-foot" id="modal-foot">' + (opsi.kaki || '') + '</div>');

      bg.classList.add('show');
      document.body.style.overflow = 'hidden';

      Array.prototype.forEach.call(box.querySelectorAll('[data-tutup]'), function (b) {
        b.onclick = UI.tutupModal;
      });
      if (opsi.siap) opsi.siap(box);
      var fokus = box.querySelector('input,select,textarea,button');
      if (fokus && !opsi.tanpaFokus) setTimeout(function () { fokus.focus(); }, 60);
      return box;
    },

    tutupModal: function () {
      var bg = document.getElementById('modal-bg');
      if (!bg) return;
      bg.classList.remove('show');
      document.body.style.overflow = '';
    },

    konfirmasi: function (opsi) {
      return new Promise(function (resolve) {
        UI.modal({
          judul: opsi.judul || 'Konfirmasi',
          sub: opsi.sub,
          isi: '<div style="font-size:14px;color:var(--text-2)">' + (opsi.isi || '') + '</div>',
          kaki: '<button class="btn btn-ghost" data-tutup>Batal</button>' +
            '<button class="btn ' + (opsi.bahaya ? 'btn-danger' : 'btn-primary') + '" id="k-ya">' +
            F.esc(opsi.tombol || 'Ya, Lanjutkan') + '</button>',
          siap: function (box) {
            box.querySelector('#k-ya').onclick = function () { UI.tutupModal(); resolve(true); };
            Array.prototype.forEach.call(box.querySelectorAll('[data-tutup]'), function (b) {
              b.addEventListener('click', function () { resolve(false); });
            });
          }
        });
      });
    },

    /* --- Router SPA (0 ms, murni tampil/sembunyi) --------------------- */
    layar: function (nama) {
      Array.prototype.forEach.call(document.querySelectorAll('.screen'), function (s) {
        s.classList.toggle('active', s.id === 'screen-' + nama);
      });
      State.layarAktif = nama;
      window.scrollTo(0, 0);
    },

    view: function (induk, nama) {
      var wrap = document.getElementById(induk);
      if (!wrap) return;
      Array.prototype.forEach.call(wrap.querySelectorAll('.view'), function (v) {
        v.classList.toggle('active', v.id === induk + '-' + nama);
      });
      Array.prototype.forEach.call(document.querySelectorAll('[data-nav="' + induk + '"]'), function (b) {
        b.classList.toggle('active', b.getAttribute('data-view') === nama);
      });
      State.viewAktif = nama;
      var main = wrap.closest('.main') || wrap;
      if (main && main.scrollTo) window.scrollTo({ top: 0, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
    },

    /* --- Tombol dengan status memuat ---------------------------------- */
    sibuk: function (btn, sibuk, teksSibuk) {
      if (!btn) return;
      if (sibuk) {
        btn.dataset.teksAsli = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner' + (btn.classList.contains('btn-ghost') ? ' dark' : '') + '"></span>' +
          (teksSibuk || 'Memproses…');
      } else {
        btn.disabled = false;
        if (btn.dataset.teksAsli) btn.innerHTML = btn.dataset.teksAsli;
      }
    },

    penandaSinkron: function (aktif) {
      State.sinkron = aktif;
      Array.prototype.forEach.call(document.querySelectorAll('.sync-dot'), function (el) {
        el.classList.toggle('busy', !!aktif);
        var t = el.querySelector('.t');
        if (t) t.textContent = aktif ? 'Menyinkronkan…' : 'Tersinkron';
      });
    },

    sesiHabis: function () {
      if (UI._sesiDitangani) return;
      UI._sesiDitangani = true;
      API.token = null;
      Simpan.hapus('token');
      UI.toast('Sesi Anda berakhir. Silakan masuk kembali.', 'warn');
      setTimeout(function () { location.reload(); }, 1400);
    },

    /* --- Kosong / skeleton -------------------------------------------- */
    kosong: function (judul, deskripsi, ic) {
      return '<div class="empty"><div class="ic">' + ikon(ic || 'inbox', 26) + '</div>' +
        '<div class="t">' + F.esc(judul) + '</div>' +
        (deskripsi ? '<div class="d">' + F.esc(deskripsi) + '</div>' : '') + '</div>';
    },

    skeleton: function (n, tinggi) {
      var out = '';
      for (var i = 0; i < (n || 3); i++) {
        out += '<div class="sk" style="height:' + (tinggi || 64) + 'px;margin-bottom:10px;border-radius:12px"></div>';
      }
      return out;
    }
  };

  /* ======================================================================
     7. UTIL BERKAS
     ====================================================================== */

  function fileKeBase64(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () {
        var hasil = String(fr.result);
        resolve(hasil.substring(hasil.indexOf(',') + 1));
      };
      fr.onerror = function () { reject(new Error('Gagal membaca berkas.')); };
      fr.readAsDataURL(file);
    });
  }

  /** Pasang perilaku unggah pada elemen .upload; mengembalikan objek state. */
  function pasangUnggah(el, opsi) {
    var st = { fileId: '', url: '', nama: '', sedang: false };
    var input = el.querySelector('input[type=file]');
    var info = el.querySelector('[data-info]');
    var maks = (opsi && opsi.maksMb) || CFG.MAKS_UNGGAH_MB;

    el.onclick = function (e) { if (e.target !== input) input.click(); };

    input.onchange = function () {
      var f = input.files && input.files[0];
      if (!f) return;
      if (f.size > maks * 1024 * 1024) {
        UI.toast('Ukuran berkas maksimal ' + maks + ' MB. Kompres terlebih dahulu.', 'error');
        input.value = '';
        return;
      }
      st.sedang = true;
      info.innerHTML = '<span class="spinner dark"></span> Mengunggah ' + F.esc(f.name) + '…';

      fileKeBase64(f).then(function (b64) {
        return API.kirim((opsi && opsi.aset) ? 'unggahAset' : 'unggahBerkas', {
          base64: b64, nama: f.name, mime: f.type, kategori: (opsi && opsi.kategori) || 'umum'
        });
      }).then(function (r) {
        st.sedang = false;
        if (!r.success) {
          info.innerHTML = '<span style="color:var(--red-600)">' + F.esc(r.message) + '</span>';
          input.value = '';
          return;
        }
        st.fileId = r.data.fileId;
        st.url = r.data.url;
        st.nama = f.name;
        el.classList.add('has-file');
        info.innerHTML = '<div class="row" style="align-items:center;gap:10px">' +
          '<span style="color:var(--green-600);line-height:0">' + ikon('checkCircle', 20) + '</span>' +
          '<div class="grow"><div class="upload-name truncate">' + F.esc(f.name) + '</div>' +
          '<div class="tiny muted">Berhasil diunggah • ' + (f.size / 1024).toFixed(0) + ' KB</div></div>' +
          '<span class="btn btn-ghost btn-sm">Ganti</span></div>';
        if (opsi && opsi.selesai) opsi.selesai(st);
      });
    };
    return st;
  }

  /* ======================================================================
     8. DEBOUNCE & PENCARIAN LOKAL
     ====================================================================== */

  function debounce(fn, ms) {
    var t;
    return function () {
      var arg = arguments, ini = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ini, arg); }, ms || 220);
    };
  }

  function cocok(objek, kueri, kolom) {
    if (!kueri) return true;
    var q = String(kueri).toLowerCase();
    for (var i = 0; i < kolom.length; i++) {
      var v = objek[kolom[i]];
      if (v && String(v).toLowerCase().indexOf(q) >= 0) return true;
    }
    return false;
  }

  /* ======================================================================
     9. DOKUMEN — PRATINJAU POPUP & UNDUH LANGSUNG
     ====================================================================== */

  // Alias ringkas agar potongan markup di bawah senada dengan modul lain.
  var ik = ikon;

  var Dok = {

    /** Unduh langsung tanpa berpindah halaman. */
    unduh: function (dok) {
      var url = (typeof dok === 'string') ? dok : (dok.unduh || dok.url || '');
      if (!url) { UI.toast('Tautan dokumen belum tersedia.', 'error'); return; }
      // Drive melayani uc?export=download dengan header attachment,
      // sehingga berkas langsung terunduh tanpa membuka tab.
      var a = document.createElement('a');
      a.href = url;
      a.rel = 'noopener';
      a.download = (dok && dok.nama ? dok.nama : 'dokumen') + '.pdf';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { document.body.removeChild(a); }, 1200);
      UI.toast('Unduhan dimulai…', 'ok');
    },

    /**
     * Ubah tautan Drive apa pun (tautan /view, /uc, atau ID mentah) menjadi objek
     * dokumen standar {nama, pratinjau, unduh, url} agar dapat dibuka pada modal
     * pratinjau maupun diunduh langsung tanpa berpindah halaman.
     */
    dariUrl: function (url, nama) {
      var u = String(url || '');
      var m = u.match(/[-\w]{25,}/);
      var id = m ? m[0] : '';
      if (!id) return { nama: nama || 'Dokumen', pratinjau: '', unduh: u, url: u };
      return {
        nama: nama || 'Dokumen',
        pratinjau: 'https://drive.google.com/file/d/' + id + '/preview',
        unduh: 'https://drive.google.com/uc?export=download&id=' + id,
        url: 'https://drive.google.com/file/d/' + id + '/view'
      };
    },

    /** Pratinjau PDF di dalam modal — tanpa membuka tab baru. */
    pratinjau: function (dok) {
      var d = (typeof dok === 'string') ? { pratinjau: dok } : (dok || {});
      var src = d.pratinjau || (d.fileId ? 'https://drive.google.com/file/d/' + d.fileId + '/preview' : '');
      if (!src) { UI.toast('Pratinjau dokumen belum tersedia.', 'error'); return; }

      UI.modal({
        lebar: true,
        judul: d.nama || 'Pratinjau Dokumen',
        sub: d.nomor ? ('Nomor: ' + d.nomor) : (d.kode || ''),
        isi:
          '<div class="pratinjau-wrap">' +
          '<div class="pratinjau-load" id="pv-load"><span class="spinner dark"></span> Memuat dokumen…</div>' +
          '<iframe id="pv-frame" src="' + F.esc(src) + '" title="Pratinjau dokumen" loading="eager"></iframe>' +
          '</div>' +
          '<div class="tiny muted mt1">' + ik('info', 12) +
          ' Dokumen dimuat langsung dari Google Drive. Bila tampilan kosong, gunakan tombol Unduh.</div>',
        kaki:
          '<button class="btn btn-ghost" data-tutup>Tutup</button>' +
          (d.url ? '<a class="btn btn-ghost" href="' + F.esc(d.url) + '" target="_blank" rel="noopener">' + ik('eye', 15) + 'Buka di Drive</a>' : '') +
          '<button class="btn btn-primary" id="pv-unduh">' + ik('download', 15) + 'Unduh PDF</button>',
        siap: function (box) {
          var fr = box.querySelector('#pv-frame');
          var ld = box.querySelector('#pv-load');
          fr.onload = function () { if (ld) ld.style.display = 'none'; };
          setTimeout(function () { if (ld) ld.style.display = 'none'; }, 6000);
          box.querySelector('#pv-unduh').onclick = function () { Dok.unduh(d); };
        }
      });
    },

    /** Daftar dokumen sebuah pengajuan → tombol pratinjau + unduh. */
    daftar: function (dokumen, kecil) {
      if (!dokumen || !dokumen.length) return '';
      var k = kecil ? ' btn-sm' : '';
      return '<div class="dok-list">' + dokumen.map(function (d, i) {
        return '<div class="dok-item">' +
          '<span class="dok-ic">' + ik(d.pakaiNomor === false ? 'file' : 'doc', 16) + '</span>' +
          '<div class="grow" style="min-width:0">' +
          '<div class="dok-nama truncate">' + F.esc(d.nama) + '</div>' +
          '<div class="tiny mono muted">' + F.esc(d.nomor || 'Tanpa nomor surat') + '</div></div>' +
          '<button class="btn btn-ghost' + k + '" data-pv="' + i + '" title="Pratinjau">' + ik('eye', 14) + '</button>' +
          '<button class="btn btn-soft' + k + '" data-dl="' + i + '" title="Unduh">' + ik('download', 14) + '</button>' +
          '</div>';
      }).join('') + '</div>';
    },

    /** Pasang aksi pada hasil Dok.daftar(). */
    pasang: function (root, dokumen) {
      if (!root || !dokumen) return;
      Array.prototype.forEach.call(root.querySelectorAll('[data-pv]'), function (b) {
        b.onclick = function () { Dok.pratinjau(dokumen[parseInt(b.getAttribute('data-pv'), 10)]); };
      });
      Array.prototype.forEach.call(root.querySelectorAll('[data-dl]'), function (b) {
        b.onclick = function () { Dok.unduh(dokumen[parseInt(b.getAttribute('data-dl'), 10)]); };
      });
    }
  };

  /* ======================================================================
     10. FORMULIR DINAMIS (dibangun dari peta placeholder template)
     ====================================================================== */

  var Form = {

    /** Hasilkan HTML untuk sekumpulan definisi field. */
    render: function (def, opsi) {
      opsi = opsi || {};
      if (!def || !def.length) return '';
      var idPrefix = opsi.prefix || 'dyn';

      var isi = def.map(function (f) {
        var id = idPrefix + '-' + f.nama;
        var wajib = f.wajib ? ' <span class="req">*</span>' : ' <span class="muted">(opsional)</span>';
        var bantuan = f.bantuan ? '<div class="hint">' + F.esc(f.bantuan) + '</div>' : '';
        var kontrol;

        if (f.tipe === 'textarea') {
          kontrol = '<textarea class="textarea" id="' + id + '" data-dyn="' + F.esc(f.nama) + '" maxlength="1000"></textarea>';
        } else if (f.tipe === 'select' || (f.opsi && f.opsi.length)) {
          kontrol = '<select class="select" id="' + id + '" data-dyn="' + F.esc(f.nama) + '">' +
            '<option value="">— Pilih —</option>' +
            (f.opsi || []).map(function (o) { return '<option>' + F.esc(o) + '</option>'; }).join('') +
            '</select>';
        } else if (f.tipe === 'dosen' || f.tipe === 'dosen_nidn') {
          var daftar = (opsi.dosen || []).filter(function (d) {
            return f.tipe === 'dosen' || String(d.kategori).toUpperCase() === 'NIDN';
          });
          kontrol = '<select class="select" id="' + id + '" data-dyn="' + F.esc(f.nama) + '">' +
            '<option value="">— Pilih dosen —</option>' +
            daftar.map(function (d) {
              return '<option>' + F.esc(d.nama + (d.nidn ? ' (NIDN: ' + d.nidn + ')' : '')) + '</option>';
            }).join('') + '</select>';
        } else {
          var tipeInput = ({ date: 'date', number: 'number', tel: 'tel', nik: 'text', email: 'email' })[f.tipe] || 'text';
          var extra = f.tipe === 'nik' ? ' inputmode="numeric" maxlength="16"'
            : (f.tipe === 'tel' ? ' inputmode="numeric" maxlength="15"' : '');
          kontrol = '<input class="input' + (f.tipe === 'nik' || f.tipe === 'tel' ? ' mono' : '') + '" type="' + tipeInput +
            '" id="' + id + '" data-dyn="' + F.esc(f.nama) + '"' + extra + '>';
        }

        return '<div class="field"><label for="' + id + '">' + F.esc(f.label) + wajib + '</label>' +
          kontrol + bantuan + '</div>';
      }).join('');

      if (opsi.tanpaKotak) return isi;

      return '<div class="kotak-dinamis">' +
        '<div class="between mb1"><div class="bold" style="font-size:13.5px">' +
        ik('file', 15) + ' ' + F.esc(opsi.judul || 'Kolom Tambahan dari Template Surat') + '</div>' +
        '<span class="badge badge-blue">' + def.length + ' kolom</span></div>' +
        '<div class="tiny muted mb2">Kolom ini mengikuti placeholder yang ada di template Google Doc milik kampus. ' +
        'Bila template diubah, kolom di sini ikut menyesuaikan otomatis.</div>' +
        isi + '</div>';
    },

    /** Ambil nilai seluruh field dinamis di dalam sebuah elemen. */
    ambil: function (root) {
      var out = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-dyn]'), function (el) {
        out[el.getAttribute('data-dyn')] = String(el.value || '').trim();
      });
      return out;
    },

    /** Validasi sisi klien berdasarkan definisi. */
    periksa: function (def, nilai) {
      for (var i = 0; i < (def || []).length; i++) {
        var f = def[i];
        var v = nilai[f.nama] || '';
        if (f.wajib && !v) return 'Kolom "' + f.label + '" wajib diisi.';
        if (v && f.tipe === 'nik' && !/^\d{16}$/.test(v)) return 'Kolom "' + f.label + '" harus 16 digit angka.';
        if (v && f.tipe === 'number' && isNaN(parseFloat(v))) return 'Kolom "' + f.label + '" harus berupa angka.';
        if (v && f.tipe === 'tel' && !/^0\d{8,13}$/.test(v.replace(/\D/g, '').replace(/^62/, '0'))) {
          return 'Kolom "' + f.label + '" harus nomor HP yang valid (08xxxxxxxxxx).';
        }
      }
      return '';
    },

    /** Buang field yang sudah ditangani formulir bawaan tiap layanan. */
    saring: function (def, sudahAda) {
      return (def || []).filter(function (f) { return sudahAda.indexOf(f.nama) < 0; });
    }
  };

  /* ======================================================================
     11. CSV — PARSER TANGGUH & PEMBUAT TEMPLATE
     ====================================================================== */

  var Csv = {
    /**
     * Uraikan teks CSV dengan benar: mendukung tanda kutip, koma di dalam
     * kutip, pemisah titik-koma (umum pada Excel Indonesia), BOM, dan CRLF.
     */
    urai: function (teks) {
      var s = String(teks || '').replace(/^﻿/, '');
      if (!s.trim()) return { header: [], baris: [] };

      // Tentukan pemisah dari baris pertama.
      var baris1 = s.split(/\r?\n/)[0];
      var jumlahKoma = (baris1.match(/,/g) || []).length;
      var jumlahTitikKoma = (baris1.match(/;/g) || []).length;
      var jumlahTab = (baris1.match(/\t/g) || []).length;
      var sep = ',';
      if (jumlahTitikKoma > jumlahKoma && jumlahTitikKoma >= jumlahTab) sep = ';';
      else if (jumlahTab > jumlahKoma && jumlahTab > jumlahTitikKoma) sep = '\t';

      var rows = [], row = [], cur = '', dalamKutip = false;
      for (var i = 0; i < s.length; i++) {
        var c = s[i];
        if (dalamKutip) {
          if (c === '"') {
            if (s[i + 1] === '"') { cur += '"'; i++; }
            else dalamKutip = false;
          } else cur += c;
        } else if (c === '"') {
          dalamKutip = true;
        } else if (c === sep) {
          row.push(cur); cur = '';
        } else if (c === '\n') {
          row.push(cur); cur = '';
          if (row.some(function (x) { return String(x).trim() !== ''; })) rows.push(row);
          row = [];
        } else if (c === '\r') {
          /* abaikan */
        } else cur += c;
      }
      row.push(cur);
      if (row.some(function (x) { return String(x).trim() !== ''; })) rows.push(row);
      if (!rows.length) return { header: [], baris: [] };

      var header = rows[0].map(function (h) {
        return String(h).trim().toLowerCase().replace(/\s+/g, '');
      });
      var baris = rows.slice(1).map(function (r) {
        var o = {};
        header.forEach(function (h, i) { o[h] = String(r[i] === undefined ? '' : r[i]).trim(); });
        return o;
      });
      return { header: header, baris: baris, pemisah: sep };
    },

    /** Samakan nama kolom yang umum salah tulis ke nama baku. */
    petakan: function (baris, alias) {
      return baris.map(function (b) {
        var o = {};
        Object.keys(alias).forEach(function (baku) {
          for (var i = 0; i < alias[baku].length; i++) {
            var k = alias[baku][i];
            if (b[k] !== undefined && b[k] !== '') { o[baku] = b[k]; break; }
          }
          if (o[baku] === undefined) o[baku] = '';
        });
        return o;
      });
    },

    /** Buat & unduh berkas CSV di sisi klien (tanpa permintaan ke server). */
    unduh: function (namaFile, baris) {
      var csv = '﻿' + baris.map(function (b) {
        return b.map(function (c) {
          return '"' + String(c === undefined || c === null ? '' : c).replace(/"/g, '""') + '"';
        }).join(',');
      }).join('\r\n');
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = namaFile;
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    }
  };

  /* ======================================================================
     12. EKSPOR
     ====================================================================== */

  global.SIAKAD = {
    CFG: CFG, API: API, Simpan: Simpan, State: State,
    F: F, UI: UI, ikon: ikon, Dok: Dok, Form: Form, Csv: Csv,
    fileKeBase64: fileKeBase64, pasangUnggah: pasangUnggah,
    debounce: debounce, cocok: cocok
  };

})(window);
