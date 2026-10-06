/* ==========================================================================
   SIAKAD SURAT — 02 LANDING & OTENTIKASI
   ========================================================================== */

(function (S) {
  'use strict';
  var API = S.API, UI = S.UI, F = S.F, ik = S.ikon, Simpan = S.Simpan;

  var Landing = {

    init: function () {
      document.getElementById('lp-tahun').textContent = new Date().getFullYear();

      document.getElementById('tab-mhs').onclick = function () { Landing.tab('mhs'); };
      document.getElementById('tab-adm').onclick = function () { Landing.tab('adm'); };

      document.getElementById('login-mhs').onsubmit = Landing.masukMahasiswa;
      document.getElementById('login-adm').onsubmit = Landing.masukAdmin;
      document.getElementById('btn-cek-surat').onclick = Landing.dialogVerifikasi;

      // Hanya angka pada NIM & tahun.
      ['in-nim', 'in-tahun'].forEach(function (id) {
        var el = document.getElementById(id);
        el.addEventListener('input', function () { el.value = el.value.replace(/[^\d]/g, ''); });
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
      st.innerHTML = '<span class="dot"></span>Server Aktif • TA ' + F.esc(d.tahunAkademik) + ' ' + F.esc(d.semesterTipe);

      document.getElementById('lp-unit').textContent = d.unit || 'BAAK STIS Al Wafa';
      document.getElementById('lp-ta').textContent = 'Tahun Akademik ' + d.tahunAkademik + ' ' + d.semesterTipe;
      document.getElementById('lp-email').innerHTML = d.email
        ? ik('mail', 14) + ' <a href="mailto:' + F.esc(d.email) + '">' + F.esc(d.email) + '</a>' : '';
      document.getElementById('lp-wa').innerHTML = d.wa
        ? ik('phone', 14) + ' <a href="https://wa.me/' + F.esc(d.wa) + '" target="_blank" rel="noopener">WhatsApp Pelayanan</a>' : '';

      var aktif = (d.layanan || []).filter(function (x) { return x.aktif; }).length;
      document.getElementById('lp-jumlah').innerHTML = '<span class="dot"></span>' + aktif + ' Layanan Aktif';

      var ikonMenu = {
        surat_aktif: 'doc', magang: 'briefcase', konfirmasi_magang: 'checkCircle',
        penelitian: 'flask', sempro: 'presentation', sidang: 'graduation',
        kelulusan: 'award', perbaikan_nilai: 'edit'
      };

      var html = '';
      if (d.batasMagang) {
        html += '<div class="notice mb2">' + ik('clock', 17) +
          '<span><b>Batas Pengajuan Magang:</b> konfirmasi tempat magang ditutup ' +
          F.tgl(d.batasMagang) + '.</span></div>';
      }

      html += (d.layanan || []).map(function (x) {
        var cls = x.aktif ? 'badge-green' : 'badge-red';
        return '<div class="layanan-item">' +
          '<span style="color:' + (x.aktif ? 'var(--orange-600)' : 'var(--text-3)') + ';line-height:0">' +
          ik(ikonMenu[x.kunci] || 'doc', 19) + '</span>' +
          '<div class="grow"><div class="nm">' + F.esc(x.nama) + '</div>' +
          '<div class="ds">' + F.esc(x.alasan || ('Semester ' + x.semester)) + '</div></div>' +
          '<span class="badge ' + cls + '">' + F.esc(x.badge) + '</span></div>';
      }).join('');

      html += '<div class="tiny muted mt2">' + ik('clock', 12) + ' Diperbarui: ' + F.tglJam(d.diperbarui) + '</div>';
      document.getElementById('lp-layanan').innerHTML = html;
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
