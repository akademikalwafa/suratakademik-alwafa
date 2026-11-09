/* ==========================================================================
   SIAKAD SURAT — 02 LANDING & OTENTIKASI
   ========================================================================== */

(function (S) {
  'use strict';
  var API = S.API, UI = S.UI, F = S.F, ik = S.ikon, Simpan = S.Simpan;

  /** v3.3: ikon & warna tiap layanan — dipakai halaman masuk dan dashboard mahasiswa. */
  S.GAYA_LAYANAN = {
    surat_aktif: { i: 'doc', t: 'tone-blue' },
    magang: { i: 'briefcase', t: 'tone-orange' },
    konfirmasi_magang: { i: 'checkCircle', t: 'tone-green' },
    penelitian: { i: 'flask', t: 'tone-violet' },
    sempro: { i: 'presentation', t: 'tone-cyan' },
    sidang: { i: 'graduation', t: 'tone-indigo' },
    kelulusan: { i: 'award', t: 'tone-amber' },
    perbaikan_nilai: { i: 'edit', t: 'tone-rose' },
    formulir: { i: 'printer', t: 'tone-slate' },
    riwayat: { i: 'list', t: 'tone-slate' }
  };

  var Landing = {

    init: function () {
      document.getElementById('lp-tahun').textContent = new Date().getFullYear();

      document.getElementById('tab-mhs').onclick = function () { Landing.tab('mhs'); };
      document.getElementById('tab-adm').onclick = function () { Landing.tab('adm'); };

      document.getElementById('login-mhs').onsubmit = Landing.masukMahasiswa;
      document.getElementById('login-adm').onsubmit = Landing.masukAdmin;
      document.getElementById('btn-cek-surat').onclick = Landing.dialogVerifikasi;

      // v3.3: pencarian layanan di halaman masuk (lokal, tanpa server)
      var cari = document.getElementById('lp-cari');
      if (cari) cari.addEventListener('input', S.debounce(function () { Landing.saringLayanan(cari.value); }, 120));

      // NIM: angka, boleh bertitik (22.23.0001). Tahun: hanya angka.
      ['in-nim', 'in-tahun'].forEach(function (id) {
        var el = document.getElementById(id), pola = id === 'in-nim' ? /[^\d.\-\/]/g : /[^\d]/g;
        el.addEventListener('input', function () { var v = el.value.replace(pola, ''); if (v !== el.value) el.value = v; });
      });

      // Ingat NIM terakhir agar login berikutnya satu ketukan.
      var nimTerakhir = Simpan.get('nim_terakhir');
      if (nimTerakhir) document.getElementById('in-nim').value = nimTerakhir;

      Landing.muatInfoPublik();
    },

    tab: function (mana) {
      document.getElementById('tab-mhs').classList.toggle('active', mana === 'mhs');
      document.getElementById('tab-adm').classList.toggle('active', mana === 'adm');
      document.getElementById('form-mhs').classList.toggle('hidden', mana !== 'mhs');
      document.getElementById('form-adm').classList.toggle('hidden', mana === 'mhs');
    },

    /* ---------------------------------------------- Info publik & layanan */

    muatInfoPublik: function () {
      // Tampilkan versi cache dulu (instan), lalu segarkan di latar belakang.
      var cache = Simpan.get('publik', 30 * 60 * 1000);
      if (cache) Landing.renderInfo(cache, true);

      // Permintaan sudah dikirim oleh skrip pra-ambil di index.html —
      // pakai hasilnya agar tidak ada permintaan ganda dan tidak ada jeda.
      var pf = (window.__PF && window.__PF.info) ? window.__PF.info : null;
      var janji = pf
        ? pf.then(function (r) { return r || API.kirim('infoPublik'); })
        : API.kirim('infoPublik');

      janji.then(function (r) {
        r = r || { success: false, message: 'Tidak dapat terhubung ke server.' };
        if (!r.success) {
          var st = document.getElementById('lp-status');
          st.className = 'badge badge-red';
          st.innerHTML = '<span class="dot"></span>Server tidak terjangkau';
          var on = document.getElementById('lp-online');
          if (on) { on.textContent = 'Offline'; on.className = 'lp-online off'; }
          if (!cache) {
            document.getElementById('lp-layanan').innerHTML =
              '<div class="notice danger">' + ik('alert', 17) + '<span>' + F.esc(r.message) + '</span></div>';
          }
          return;
        }
        Simpan.set('publik', r.data);
        Landing.renderInfo(r.data, false);
      });
    },

    renderInfo: function (d, dariCache) {
      S.State.publik = d;

      var st = document.getElementById('lp-status');
      st.className = 'badge ' + (dariCache ? 'badge-gray' : 'badge-green');
      st.innerHTML = '<span class="dot"></span>Server Aktif<span class="lp-ta-sm"> • TA ' + F.esc(d.tahunAkademik) + ' ' + F.esc(d.semesterTipe) + '</span>';
      // v3.4 (Revisi 5 · gambar halaman masuk): status "Online" di samping nama aplikasi + TA pada HP
      var on = document.getElementById('lp-online');
      if (on) { on.textContent = 'Online'; on.className = 'lp-online' + (dariCache ? ' cache' : ''); }
      var taNav = document.getElementById('lp-ta-nav');
      if (taNav) taNav.textContent = 'TA ' + d.tahunAkademik + ' ' + d.semesterTipe;
      var hub = document.getElementById('lp-hubungi');
      if (hub) {
        if (d.wa) hub.href = 'https://wa.me/' + String(d.wa).replace(/[^\d]/g, '').replace(/^0/, '62') + '?text=' + encodeURIComponent('Assalamu\'alaikum, saya mengalami kendala login NIM di SIAKAD Surat.');
        else if (d.email) hub.href = 'mailto:' + d.email;
        else hub.removeAttribute('href');
      }

      document.getElementById('lp-unit').textContent = d.unit || 'BAAK STIS Al Wafa';
      document.getElementById('lp-ta').textContent = 'Tahun Akademik ' + d.tahunAkademik + ' ' + d.semesterTipe;
      document.getElementById('lp-email').innerHTML = d.email
        ? ik('mail', 14) + ' <a href="mailto:' + F.esc(d.email) + '">' + F.esc(d.email) + '</a>' : '';
      document.getElementById('lp-wa').innerHTML = d.wa
        ? ik('phone', 14) + ' <a href="https://wa.me/' + F.esc(d.wa) + '" target="_blank" rel="noopener">WhatsApp Pelayanan</a>' : '';

      var aktif = (d.layanan || []).filter(function (x) { return x.aktif; }).length;
      document.getElementById('lp-jumlah').innerHTML = '<span class="dot"></span>' + aktif + ' Layanan Aktif';

      // v3.4 (Revisi 5 · gambar halaman masuk): daftar baris — ikon lembut, keterangan & status di kanan.
      var html = '<div class="lp-rows">' + (d.layanan || []).map(function (x) {
        var g = S.GAYA_LAYANAN[x.kunci] || { i: 'doc', t: 'tone-slate' };
        var lewat = x.badge === 'Batas Terlewat';
        var ket;
        if (x.aktif) {
          ket = 'Semester ' + x.semester +
            (x.kunci === 'surat_aktif' ? ' • Instan &amp; Terverifikasi' : '') +
            ((x.kunci === 'magang' || x.kunci === 'konfirmasi_magang') && d.batasMagang ? ' • batas ' + F.esc(F.tgl(d.batasMagang)) : '');
        } else {
          ket = '<span class="' + (lewat ? 'merah' : '') + '">' + F.esc(x.alasan || (lewat ? 'Akses sudah ditutup' : 'Layanan sedang ditutup')) + '</span>';
        }
        var pill = x.aktif ? 'ok' : (lewat ? 'lewat' : 'tutup');
        return '<div class="lp-row ' + g.t + (x.aktif ? '' : ' off') + '" data-cari="' + F.esc(String(x.nama + ' ' + x.kunci).toLowerCase()) + '">' +
          '<span class="lp-ic">' + ik(g.i, 18) + '</span>' +
          '<div class="grow" style="min-width:0"><div class="nm">' + F.esc(x.nama) + '</div><div class="ds">' + ket + '</div></div>' +
          '<span class="lp-pill ' + pill + '">' + F.esc(x.badge) + (x.aktif ? '<span class="m-only">' + ik('arrowRight', 13) + '</span>' : '') + '</span></div>';
      }).join('') + '</div>' +
        '<div class="hidden" id="lp-kosong">' + UI.kosong('Layanan tidak ditemukan', 'Coba kata kunci lain.', 'search') + '</div>';

      html += '<div class="lp-kaki"><span>' + ik('clock', 13) + ' Diperbarui: ' + F.tglJam(d.diperbarui) + '</span>' +
        '<button class="btn-link" type="button" id="lp-perbarui">Perbarui status ' + ik('refresh', 13) + '</button></div>';
      document.getElementById('lp-layanan').innerHTML = html;
      var cari = document.getElementById('lp-cari');
      if (cari && cari.value) Landing.saringLayanan(cari.value);
      var bP = document.getElementById('lp-perbarui');
      if (bP) bP.onclick = function () {
        UI.sibuk(bP, true, 'Memperbarui…');
        API.kirim('infoPublik', { _fresh: true }).then(function (r) {
          UI.sibuk(bP, false);
          if (!r || !r.success) return UI.toast((r && r.message) || 'Server tidak terjangkau.', 'error');
          Simpan.set('publik', r.data);
          Landing.renderInfo(r.data, false);
        });
      };
    },

    saringLayanan: function (q) {
      q = String(q || '').trim().toLowerCase();
      var ada = 0;
      Array.prototype.forEach.call(document.querySelectorAll('#lp-layanan .lp-row'), function (el) {
        var cocok = !q || el.getAttribute('data-cari').indexOf(q) >= 0 ||
          (q === 'skripsi' && /sidang|sempro|kelulusan/.test(el.getAttribute('data-cari')));
        el.classList.toggle('hidden', !cocok);
        if (cocok) ada++;
      });
      var k = document.getElementById('lp-kosong');
      if (k) k.classList.toggle('hidden', ada > 0);
    },

    /* --------------------------------------------------------- Login */

    masukMahasiswa: function (e) {
      e.preventDefault();
      var btn = document.getElementById('btn-login-mhs');
      var nim = document.getElementById('in-nim').value.trim();
      var tahun = document.getElementById('in-tahun').value.trim();

      if (!nim || !tahun) { UI.toast('NIM dan Tahun Masuk wajib diisi.', 'error'); return; }
      if (tahun.length !== 4) { UI.toast('Tahun Masuk harus 4 digit, contoh: 2021.', 'error'); return; }

      UI.sibuk(btn, true, 'Memeriksa data…');
      API.kirim('loginMahasiswa', { nim: nim, tahunMasuk: tahun }).then(function (r) {
        UI.sibuk(btn, false);
        if (!r.success) { UI.toast(r.message, 'error'); return; }

        API.token = r.data.token;
        S.State.peran = 'MAHASISWA';
        S.State.profil = r.data.profil;
        Simpan.set('token', { t: r.data.token, peran: 'MAHASISWA' });
        Simpan.set('nim_terakhir', nim);
        // Login sudah membawa data dashboard (1 panggilan, bukan 2).
        if (r.data.boot) S.State.prefetchBoot = Promise.resolve({ success: true, data: r.data.boot });

        UI.toast('Selamat datang, ' + r.data.profil.nama.split(' ')[0] + '.', 'ok');
        S.Mahasiswa.buka();
      });
    },

    masukAdmin: function (e) {
      e.preventDefault();
      var btn = document.getElementById('btn-login-adm');
      var u = document.getElementById('in-user').value.trim();
      var p = document.getElementById('in-pass').value;

      if (!u || !p) { UI.toast('Username dan password wajib diisi.', 'error'); return; }

      UI.sibuk(btn, true, 'Memverifikasi…');
      API.kirim('loginAdmin', { username: u, password: p }).then(function (r) {
        UI.sibuk(btn, false);
        if (!r.success) { UI.toast(r.message, 'error'); return; }

        API.token = r.data.token;
        S.State.peran = 'ADMIN';
        S.State.profil = r.data.profil;
        Simpan.set('token', { t: r.data.token, peran: 'ADMIN' });
        document.getElementById('in-pass').value = '';
        if (r.data.boot) S.State.prefetchBoot = Promise.resolve({ success: true, data: r.data.boot });

        UI.toast('Selamat datang, ' + r.data.profil.nama + '.', 'ok');
        UI.sibuk(btn, true, 'Menyiapkan panel…');
        S.App.bukaAdmin().then(function () { UI.sibuk(btn, false); });
      });
    },

    /* ------------------------------------------- Verifikasi dokumen (QR) */

    dialogVerifikasi: function () {
      UI.modal({
        judul: 'Cek Keaslian Dokumen',
        sub: 'Masukkan nomor surat yang tertera pada dokumen PDF.',
        isi:
          '<div class="field"><label for="vf-nomor">Nomor Dokumen</label>' +
          '<input class="input mono" id="vf-nomor" placeholder="Contoh: 089/SA/STISAW/X/2025">' +
          '<div class="hint">Nomor dapat dilihat pada bagian atas dokumen atau hasil pindai QR.</div></div>' +
          '<div id="vf-hasil"></div>',
        kaki: '<button class="btn btn-ghost" data-tutup>Tutup</button>' +
          '<button class="btn btn-primary" id="vf-cek">Periksa Dokumen</button>',
        siap: function (box) {
          var input = box.querySelector('#vf-nomor');
          var hasil = box.querySelector('#vf-hasil');
          var btn = box.querySelector('#vf-cek');

          function cek() {
            var nomor = input.value.trim();
            if (!nomor) { UI.toast('Nomor dokumen wajib diisi.', 'error'); return; }
            UI.sibuk(btn, true, 'Memeriksa…');
            API.kirim('verifikasiDokumen', { nomor: nomor }).then(function (r) {
              UI.sibuk(btn, false);
              if (!r.success) { hasil.innerHTML = '<div class="notice danger mt2">' + ik('alert', 17) + '<span>' + F.esc(r.message) + '</span></div>'; return; }
              if (!r.data.valid) {
                hasil.innerHTML = '<div class="notice danger mt2">' + ik('xCircle', 17) +
                  '<span><b>Tidak ditemukan.</b> Nomor dokumen tidak terdaftar atau belum disahkan BAAK.</span></div>';
                return;
              }
              hasil.innerHTML =
                '<div class="notice ok mt2">' + ik('checkCircle', 17) + '<span><b>Dokumen sah &amp; terverifikasi.</b></span></div>' +
                '<dl class="kv mt2">' +
                '<dt>Nomor</dt><dd class="mono">' + F.esc(r.data.nomor) + '</dd>' +
                '<dt>Jenis Dokumen</dt><dd>' + F.esc(r.data.jenis) + '</dd>' +
                '<dt>Nama</dt><dd>' + F.esc(r.data.nama) + '</dd>' +
                '<dt>NIM</dt><dd class="mono">' + F.esc(r.data.nim) + '</dd>' +
                '<dt>Tanggal Terbit</dt><dd>' + F.tgl(r.data.tanggalTerbit) + '</dd>' +
                '</dl>';
            });
          }

          btn.onclick = cek;
          input.addEventListener('keydown', function (e) { if (e.key === 'Enter') cek(); });
        }
      });
    }
  };

  S.Landing = Landing;

})(window.SIAKAD);
