/* ==========================================================================
   SIAKAD SURAT — 03 DASHBOARD MAHASISWA
   Seluruh menu dimuat sekali; perpindahan menu murni tampil/sembunyi (0 ms).
   ========================================================================== */

(function (S) {
  'use strict';
  var API = S.API, UI = S.UI, F = S.F, ik = S.ikon, Simpan = S.Simpan, St = S.State;

  /* Definisi menu — dipakai untuk sidebar, grid layanan, dan router. */
  /* v3.3 (Revisi 5): nama & deskripsi layanan diperbarui, Skripsi (3 bidang),
     Formulir Siap Cetak berdiri sendiri, view "layanan" untuk tombol Pengajuan di HP. */
  var MENU = [
    { k: 'beranda', n: 'Beranda', i: 'home', d: 'Ringkasan status & layanan', g: 'utama' },
    { k: 'surat_aktif', n: 'Surat Keterangan Aktif', i: 'doc', d: 'BPJS, beasiswa & tunjangan orang tua', g: 'layanan' },
    { k: 'magang', n: 'Magang / PKL', i: 'briefcase', d: 'Surat permohonan magang ke instansi', g: 'layanan' },
    { k: 'konfirmasi_magang', n: 'Konfirmasi Tempat Magang', i: 'checkCircle', d: 'Laporkan instansi yang menerima Anda', g: 'layanan' },
    { k: 'penelitian', n: 'Izin Penelitian', i: 'flask', d: 'Surat pengantar riset skripsi', g: 'layanan' },
    { k: 'sempro', n: 'Seminar Proposal', i: 'presentation', d: 'Pendaftaran, revisi & SK Pembimbing', g: 'layanan' },
    { k: 'sidang', n: 'Skripsi', i: 'graduation', d: 'Pendaftaran sidang, unduh SKL & revisi skripsi', g: 'layanan' },
    { k: 'kelulusan', n: 'Administrasi Kelulusan', i: 'award', d: 'Syarat pengambilan ijazah & wisuda', g: 'layanan' },
    { k: 'perbaikan_nilai', n: 'Perbaikan Nilai', i: 'edit', d: 'Pengajuan ujian remedial mata kuliah', g: 'layanan' },
    { k: 'formulir', n: 'Formulir Siap Cetak', i: 'printer', d: 'Blanko seminar proposal & skripsi', g: 'layanan' },
    { k: 'riwayat', n: 'Riwayat Pengajuan', i: 'list', d: 'Pantau status & unduh dokumen ber-QR', g: 'akun' },
    { k: 'profil', n: 'Profil Saya', i: 'user', d: 'Data kontak & informasi akademik', g: 'akun' },
    { k: 'layanan', n: 'Layanan Akademik', i: 'grid', d: 'Pilih layanan yang ingin diajukan', g: 'x' }
  ];

  var GRUP = { utama: 'Menu Utama', layanan: 'Layanan Akademik', akun: 'Akun & Riwayat' };
  var STATUS_AKTIF = { MENUNGGU: 1, DISETUJUI: 1 };

  var M = {

    siap: false,
    aktif: 'beranda',
    kotor: {},   // penanda view yang perlu digambar ulang
    D: null,     // payload bootstrap

    /* ==================================================================
       PEMBUKAAN & PEMUATAN DATA
       ================================================================== */

    buka: function () {
      UI.layar('mhs');
      document.getElementById('boot').classList.add('hide');
      if (!M.siap) { M.bangunKerangka(); M.siap = true; }

      // 1) Tampilkan data cache seketika (stale-while-revalidate).
      var cache = Simpan.get('mhs_boot');
      if (cache && cache.profil && (!St.profil || cache.profil.nim === St.profil.nim)) {
        M.D = cache;
        M._tanda = JSON.stringify(cache, function (k, v) { return (k === 'server' || k === 'cache') ? undefined : v; });
        M.renderSemua();
      } else {
        document.getElementById('mhsview-beranda').innerHTML = UI.skeleton(4, 86);
      }

      // 2) Segarkan dari server di latar belakang.
      M.muat(!cache);
    },

    muat: function (tampilkanLoading, segar) {
      UI.penandaSinkron(true);

      // Permintaan pertama sudah dikirim skrip pra-ambil di index.html.
      var janji;
      if (segar) {
        janji = API.kirim('bootstrapMahasiswa', { _fresh: true });   // tombol Segarkan
      } else if (St.prefetchBoot) {
        janji = St.prefetchBoot.then(function (x) { return x || API.kirim('bootstrapMahasiswa'); });
        St.prefetchBoot = null;
      } else {
        janji = API.kirim('bootstrapMahasiswa');
      }

      return janji.then(function (r) {
        r = r || { success: false, message: 'Tidak dapat terhubung ke server.' };
        UI.penandaSinkron(false);
        if (!r.success) {
          if (r.code !== 'UNAUTHORIZED') UI.toast(r.message, 'error');
          return;
        }
        var tandaLama = M._tanda;
        M._tanda = JSON.stringify(r.data, function (k, v) { return (k === 'server' || k === 'cache') ? undefined : v; });
        M.D = r.data;
        St.profil = r.data.profil;
        Simpan.set('mhs_boot', r.data);
        // Render hanya bila data berubah (gas-instant-ux-pro · Prinsip 2).
        if (M._tanda !== tandaLama) M.renderSemua();
        if (tampilkanLoading) M.tampilkanPengumuman();
        M.pantauAntrean();
      });
    },

    /** Dokumen masih dibuat di server → segarkan otomatis beberapa kali (tanpa klik). */
    pantauAntrean: function () {
      var ant = (M.D && M.D.antreanDokumen) || {};
      var ada = Object.keys(ant).some(function (k) { return ant[k] > 0; });
      clearTimeout(M._tAntre);
      if (!ada) { M._nAntre = 0; return; }
      M._nAntre = (M._nAntre || 0) + 1;
      if (M._nAntre > 12) return;
      // Polling adaptif: lebih jarang bila mahasiswa tidak sedang memakai layar.
      var Akt = S.Aktivitas, idle = Akt && Akt.idle();
      M._tAntre = setTimeout(function () {
        if (Akt ? Akt.tampil() : !document.hidden) M.muat(false);
      }, idle ? 30000 : (M._nAntre < 4 ? 6000 : 15000));
    },

    /* ==================================================================
       KERANGKA: SIDEBAR, VIEWS, BOTTOM NAV
       ================================================================== */

    bangunKerangka: function () {
      // --- Sidebar ---
      var nav = document.getElementById('mhs-nav');
      var html = '';
      var grupTerakhir = '';
      MENU.forEach(function (m) {
        if (m.g === 'x') return;   // view khusus HP (tombol "Pengajuan" di navigasi bawah)
        if (m.g !== grupTerakhir) { html += '<div class="nav-group">' + GRUP[m.g] + '</div>'; grupTerakhir = m.g; }
        html += '<button class="nav-item" data-nav="mhsview" data-view="' + m.k + '">' +
          '<span class="ic">' + ik(m.i, 18) + '</span>' +
          '<span class="lbl-txt">' + F.esc(m.n) + '</span>' +
          '<span class="cnt zero" data-cnt="' + m.k + '">0</span></button>';
      });
      nav.innerHTML = html;

      // --- Kontainer view ---
      document.getElementById('mhsview').innerHTML = MENU.map(function (m) {
        return '<section class="view' + (m.k === 'beranda' ? ' active' : '') + '" id="mhsview-' + m.k + '"></section>';
      }).join('');

      // --- Bottom nav (mobile) ---
      var bn = [['beranda', 'Beranda', 'home'], ['layanan', 'Pengajuan', 'grid'],
      ['riwayat', 'Riwayat', 'list'], ['profil', 'Profil', 'user']];
      document.getElementById('mhs-bottomnav').innerHTML = bn.map(function (x) {
        return '<button class="bn-item" data-nav="mhsview" data-view="' + x[0] + '">' +
          '<span class="bn-ic">' + ik(x[2], 20) + '</span><span>' + x[1] + '</span></button>';
      }).join('');

      // --- Peristiwa navigasi ---
      document.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-nav="mhsview"]') : null;
        if (b) { e.preventDefault(); M.pergi(b.getAttribute('data-view')); }
      });

      var sb = document.getElementById('mhs-sidebar');
      var bd = document.getElementById('mhs-backdrop');
      document.getElementById('mhs-hamb').onclick = function () {
        sb.classList.toggle('open'); bd.classList.toggle('show', sb.classList.contains('open'));
      };
      // v3.3 (HP): tombol kembali & menu lainnya pada app bar halaman layanan
      var kembali = document.getElementById('mhs-kembali');
      if (kembali) kembali.onclick = function () { M.pergi(M._asal && M._asal !== M.aktif ? M._asal : 'beranda'); };
      var lain = document.getElementById('mhs-menu-lain');
      if (lain) lain.onclick = function () { sb.classList.add('open'); bd.classList.add('show'); };
      bd.onclick = function () { sb.classList.remove('open'); bd.classList.remove('show'); };
      document.getElementById('mhs-keluar').onclick = S.App.keluar;
      document.getElementById('mhs-segarkan').onclick = function () {
        M.muat(false, true).then(function () { UI.toast('Data diperbarui.', 'ok'); });
      };
    },

    /** Navigasi instan: cukup tukar kelas .active — tanpa permintaan jaringan. */
    pergi: function (kunci) {
      var m = null;
      for (var i = 0; i < MENU.length; i++) if (MENU[i].k === kunci) m = MENU[i];
      if (!m) return;

      M.render(kunci);              // gambar hanya bila datanya berubah
      // HP: tombol kembali menuju halaman asal (Beranda / Pengajuan)
      if (kunci === 'beranda' || kunci === 'layanan') M._asal = kunci;
      UI.view('mhsview', kunci);
      M.aktif = kunci;
      document.getElementById('mhs-judul').textContent = m.n;
      document.getElementById('mhs-sub').textContent = m.d;
      var shell = document.getElementById('mhs-shell');
      if (shell) shell.classList.toggle('di-sub', kunci !== 'beranda');

      Array.prototype.forEach.call(document.querySelectorAll('#mhs-bottomnav .bn-item'), function (b) {
        var v = b.getAttribute('data-view');
        b.classList.toggle('active', v === kunci || (v === 'layanan' && m.g === 'layanan'));
      });

      var sb = document.getElementById('mhs-sidebar');
      sb.classList.remove('open');
      document.getElementById('mhs-backdrop').classList.remove('show');
    },

    /* ==================================================================
       RENDER SELURUH VIEW (dipanggil ulang setiap data berubah)
       ================================================================== */

    renderSemua: function () {
      var d = M.D;
      if (!d) return;

      document.getElementById('mhs-ava').textContent = F.inisial(d.profil.nama);
      document.getElementById('mhs-nama-side').textContent = d.profil.nama;
      document.getElementById('mhs-nim-side').textContent = 'NIM ' + d.profil.nim;

      // Badge jumlah pada sidebar
      var menunggu = {};
      (d.riwayat || []).forEach(function (r) {
        if (r.status !== 'MENUNGGU') return;
        var k = M.menuDariJenis(r.jenis);
        menunggu[k] = (menunggu[k] || 0) + 1;
      });
      Array.prototype.forEach.call(document.querySelectorAll('[data-cnt]'), function (el) {
        var n = menunggu[el.getAttribute('data-cnt')] || 0;
        el.textContent = n;
        el.classList.toggle('zero', n === 0);
      });

      // Tandai semua view perlu digambar ulang, tetapi GAMBAR hanya yang
      // sedang dilihat. View lain digambar saat pertama kali dibuka →
      // sinkronisasi latar belakang tidak lagi menahan antarmuka.
      MENU.forEach(function (m) { M.kotor[m.k] = true; });
      M.render(M.aktif || 'beranda');
      if ((M.aktif || 'beranda') !== 'beranda') M.render('beranda');
    },

    /** Gambar satu view bila datanya memang berubah. */
    render: function (kunci) {
      if (!M.D || !M.kotor[kunci]) return;
      var fn = {
        beranda: M.renderBeranda, surat_aktif: M.renderSuratAktif, magang: M.renderMagang,
        konfirmasi_magang: M.renderKonfirmasiMagang, penelitian: M.renderPenelitian,
        sempro: M.renderSempro, sidang: M.renderSidang, kelulusan: M.renderKelulusan,
        perbaikan_nilai: M.renderPerbaikanNilai, riwayat: M.renderRiwayat, profil: M.renderProfil,
        formulir: M.renderFormulir, layanan: M.renderLayanan
      }[kunci];
      if (!fn) return;
      var t0 = (window.performance && performance.now) ? performance.now() : 0;
      fn();
      M.kotor[kunci] = false;
      if (t0 && window.console && console.debug) {
        console.debug('[SIAKAD] render ' + kunci + ' ' + Math.round(performance.now() - t0) + ' ms');
      }
    },

    /* ---------------------------------------- Kolom dinamis dari template */

    /** Definisi kolom dinamis sebuah alur, tanpa kolom yang sudah ada di form. */
    defDinamis: function (jenis, sudahAda) {
      return S.Form.saring(((M.D && M.D.fieldDinamis) || {})[jenis] || [], sudahAda || []);
    },

    /** HTML blok kolom dinamis (kosong bila template tidak menambah kolom). */
    blokDinamis: function (jenis, sudahAda) {
      var def = M.defDinamis(jenis, sudahAda);
      if (!def.length) return '';
      return S.Form.render(def, { prefix: 'dyn-' + jenis, dosen: (M.D && M.D.dosen) || [] });
    },

    /** Ambil + validasi nilai kolom dinamis. */
    ambilDinamis: function (el, jenis, sudahAda) {
      var def = M.defDinamis(jenis, sudahAda);
      var nilai = S.Form.ambil(el);
      return { nilai: nilai, error: S.Form.periksa(def, nilai) };
    },

    menuDariJenis: function (j) {
      var p = {
        SURAT_AKTIF: 'surat_aktif', MAGANG: 'magang', KONFIRMASI_MAGANG: 'konfirmasi_magang',
        PENELITIAN: 'penelitian', SEMPRO: 'sempro', REVISI_SEMPRO: 'sempro',
        SIDANG: 'sidang', REVISI_SIDANG: 'sidang', PERBAIKAN_NILAI: 'perbaikan_nilai'
      };
      return p[j] || 'riwayat';
    },

    /* ==================================================================
       BERANDA
       ================================================================== */

    renderBeranda: function () {
      var d = M.D, p = d.profil, ak = d.akses;
      var terakhir = (d.riwayat || [])[0];

      var html = '';

      // Kartu profil
      html +=
        '<div class="profile-card mb2">' +
        '<div class="row" style="align-items:center;position:relative;z-index:1">' +
        '<div class="ava2">' + F.inisial(p.nama) + '</div>' +
        '<div class="grow" style="min-width:0">' +
        '<div class="nm2 truncate">' + F.esc(p.nama) + '</div>' +
        '<div class="nim2">NIM ' + F.esc(p.nim) + '</div></div></div>' +
        '<div class="row-wrap mt2" style="position:relative;z-index:1">' +
        '<span class="pchip">' + ik('book', 13) + F.esc(p.prodi) + '</span>' +
        '<span class="pchip">Semester ' + p.semester + ' • ' + F.esc(p.semesterTipe) + '</span>' +
        '<span class="pchip">Angkatan ' + F.esc(p.tahunMasuk) + '</span>' +
        '<span class="pchip">TA ' + F.esc(p.tahunAkademik) + '</span>' +
        '</div></div>';

      // Peringatan batas magang
      if (d.konfigurasi.batasMagang && ak.magang && ak.magang.buka) {
        html += '<div class="notice mb2">' + ik('clock', 17) +
          '<span><b>Batas Waktu Magang / PKL.</b> Pengajuan & konfirmasi tempat magang ditutup otomatis pada ' +
          F.tgl(d.konfigurasi.batasMagang) + '. Lengkapi data PJ Magang sebelum akses ditutup.</span></div>';
      }

      // Status pengajuan terakhir
      if (terakhir) {
        var langkah = M.langkahStatus(terakhir);
        html +=
          '<div class="card mb2">' +
          '<div class="card-head"><div><h3>Status Pengajuan Terakhir</h3>' +
          '<div class="sub">' + F.esc(terakhir.jenisLabel) + '</div></div>' +
          F.statusBadge(terakhir.status) + '</div>' +
          '<div class="card-body">' +
          (terakhir.nomorSurat ? '<div class="small muted mb1">Nomor dokumen: <span class="mono bold">' + F.esc(terakhir.nomorSurat) + '</span></div>' : '') +
          '<div class="steps">' + langkah + '</div>' +
          (terakhir.status === 'DITOLAK' && terakhir.alasanTolak
            ? '<div class="notice danger mt2">' + ik('alert', 17) + '<span><b>Catatan BAAK:</b> ' + F.esc(terakhir.alasanTolak) + '</span></div>' : '') +
          '<div class="row-wrap mt2">' +
          '<button class="btn btn-ghost btn-sm" data-nav="mhsview" data-view="riwayat">Lihat Semua Riwayat (' + (d.riwayat || []).length + ')</button>' +
          (terakhir.dokumen && terakhir.dokumen.length
            ? '<button class="btn btn-ghost btn-sm" data-dokpv="' + F.esc(terakhir.id) + '">' + ik('eye', 15) + 'Pratinjau</button>' +
              '<button class="btn btn-primary btn-sm" data-dokdl="' + F.esc(terakhir.id) + '">' + ik('download', 15) + 'Unduh Dokumen</button>'
            : '') +
          '</div></div></div>';
      }

      // Grid layanan (v3.3: kartu 3D berwarna)
      html += M.gridLayanan();

      // Bantuan
      if (d.konfigurasi.wa) {
        html += '<div class="card mt3"><div class="card-body between" style="flex-wrap:wrap">' +
          '<div><div class="bold">Butuh bantuan persuratan?</div>' +
          '<div class="small muted">Tim BAAK STIS Al Wafa siap melayani pada jam kerja.</div></div>' +
          '<a class="btn btn-success btn-sm" target="_blank" rel="noopener" href="https://wa.me/' + F.esc(d.konfigurasi.wa) + '">' +
          ik('phone', 15) + 'Konsultasi via WhatsApp</a></div></div>';
      }

      var el = document.getElementById('mhsview-beranda');
      el.innerHTML = html;
      M.pasangGrid(el);
      M.pasangAksiUmum(el);
    },

    /* ---------------------------------------------- v3.3 Layanan Akademik */

    /** Kartu layanan 3D berwarna (beranda & menu Pengajuan di HP). */
    gridLayanan: function () {
      var d = M.D, ak = d.akses || {};
      var menunggu = {};
      (d.riwayat || []).forEach(function (r) {
        if (r.status === 'MENUNGGU') { var k = M.menuDariJenis(r.jenis); menunggu[k] = (menunggu[k] || 0) + 1; }
      });
      var nBlanko = (d.blanko || []).length;
      var daftar = MENU.filter(function (m) { return m.g === 'layanan'; });
      return '<div class="sec-head"><div><h3>Layanan Akademik</h3>' +
        '<div class="s">Pilih layanan sesuai kebutuhan Anda</div></div>' +
        '<span class="badge badge-gray">' + daftar.length + ' layanan</span></div>' +
        '<div class="svc3-grid">' + daftar.map(function (m) {
          var a = ak[m.k] || { buka: true, badge: '' };
          if (m.k === 'formulir') a = { buka: true, badge: '' };
          var g = (S.GAYA_LAYANAN || {})[m.k] || { i: m.i, t: 'tone-orange' };
          var terkunci = !a.buka;
          var batas = !terkunci && a.badge && /^Batas /.test(a.badge) ? a.badge : '';
          var foot = terkunci
            ? ik('lock', 12) + ' ' + F.esc(a.badge || 'Terkunci')
            : (m.k === 'formulir' ? (nBlanko ? nBlanko + ' formulir siap' : 'Lihat formulir') + ' ' + ik('arrowRight', 12)
              : 'Buka layanan ' + ik('arrowRight', 12));
          return '<button class="svc3 ' + g.t + (terkunci ? ' locked' : '') + '" type="button" ' +
            (terkunci ? 'data-locked="' + F.esc(a.alasan || '') + '"' : 'data-nav="mhsview" data-view="' + m.k + '"') + '>' +
            (menunggu[m.k] ? '<span class="n" title="Menunggu verifikasi">' + menunggu[m.k] + '</span>' : '') +
            '<span class="ic3d">' + ik(g.i, 26) + '</span>' +
            '<span class="t">' + F.esc(m.n) + '</span>' +
            '<span class="d">' + F.esc(m.d) + '</span>' +
            (batas ? '<span class="bt">' + ik('clock', 11) + ' ' + F.esc(batas) + '</span>' : '') +
            '<span class="f">' + foot + '</span></button>';
        }).join('') + '</div>';
    },

    pasangGrid: function (el) {
      Array.prototype.forEach.call(el.querySelectorAll('[data-locked]'), function (b) {
        b.onclick = function () { UI.toast(b.getAttribute('data-locked') || 'Menu terkunci.', 'warn', 'Layanan Terkunci'); };
      });
    },

    /** View "Pengajuan" (navigasi bawah HP): seluruh layanan dalam satu layar. */
    renderLayanan: function () {
      var el = document.getElementById('mhsview-layanan');
      el.innerHTML = '<div class="page-head"><div>' +
        '<div class="crumb">' + ik('home', 12) + ' Beranda <span class="sep">/</span> <span class="cur">Layanan Akademik</span></div>' +
        '<h2>Ajukan Layanan</h2><div class="desc">Pilih layanan akademik yang ingin Anda ajukan.</div></div></div>' +
        M.gridLayanan().replace('<div class="sec-head">', '<div class="sec-head" style="margin-top:0">');
      M.pasangGrid(el);
    },

    /* ----------------------------------------------- v3.3 helper formulir */

    /** Pengajuan terbaru yang masih berlaku (menunggu / disetujui) — batal & tolak diabaikan. */
    aktifTerbaru: function (jenis) {
      return (M.D.riwayat || []).filter(function (r) { return r.jenis === jenis && STATUS_AKTIF[r.status]; })[0] || null;
    },

    /** Pengajuan terakhir yang ditolak (untuk catatan perbaikan saat mengajukan ulang). */
    tolakTerakhir: function (jenis) {
      var r = (M.D.riwayat || []).filter(function (x) { return x.jenis === jenis; })[0];
      return r && r.status === 'DITOLAK' ? r : null;
    },

    catatanTolak: function (jenis) {
      var r = M.tolakTerakhir(jenis);
      if (!r) return '';
      return '<div class="notice danger mb2">' + ik('alert', 17) + '<span><b>Pengajuan sebelumnya ditolak BAAK.</b> ' +
        (r.alasanTolak ? 'Catatan: ' + F.esc(r.alasanTolak) + '. ' : '') + 'Silakan perbaiki lalu ajukan ulang.</span></div>';
    },

    /** Kartu identitas pemohon di atas formulir. */
    kartuPemohon: function (peran) {
      var p = M.D.profil;
      return '<div class="pemohon"><div class="av">' + F.inisial(p.nama) + '</div>' +
        '<div class="grow"><div class="nm">' + F.esc(p.nama) + '</div>' +
        '<div class="mt">NIM ' + F.esc(p.nim) + ' • ' + F.esc(p.prodiNama || p.prodi) + ' • Smt ' + p.semester + '</div></div>' +
        '<span class="badge badge-orange">' + F.esc(peran || 'Pemohon') + '</span></div>';
    },

    judulBagian: function (no, teks) {
      return '<div class="form-sec"><span class="nf">' + no + '</span>' + F.esc(teks) + '</div>';
    },

    /** Kotak unggah berkas (dipakai banyak formulir). */
    kotakUnggah: function (id, judul, ket, wajib) {
      return '<div class="field"><label>' + judul + (wajib ? ' <span class="req">*</span>' : ' <span class="muted">(opsional)</span>') + '</label>' +
        '<div class="upload" id="' + id + '"><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp">' +
        '<div data-info><div style="color:var(--orange-600);line-height:0;margin-bottom:6px">' + ik('upload', 24) + '</div>' +
        '<div class="upload-name">' + F.esc(ket || 'Pilih berkas') + '</div>' +
        '<div class="tiny muted">PDF, JPG, atau PNG • maksimal ' + S.CFG.MAKS_UNGGAH_MB + ' MB</div></div></div></div>';
    },

    /** Label kolom dinamis wajib yang masih kosong. */
    kurangDinamis: function (el, jenis, sudahAda) {
      var def = M.defDinamis(jenis, sudahAda), nilai = S.Form.ambil(el);
      return def.filter(function (f) { return f.wajib && !nilai[f.nama]; }).map(function (f) { return f.label; });
    },

    /** Status unggahan → teks kekurangan ('' bila sudah terunggah). */
    kurangUnggah: function (u, label) {
      if (!u) return '';
      if (u.sedang) return label + ' (sedang diunggah)';
      return u.fileId ? '' : label;
    },

    /**
     * v3.3 (Revisi 5): tombol kirim nonaktif sampai seluruh isian wajib lengkap.
     * syarat() mengembalikan daftar isian yang belum lengkap; kosong = siap dikirim.
     */
    kunciKirim: function (el, btn, syarat) {
      if (!el || !btn) return function () { };
      var hint = document.createElement('div');
      hint.className = 'kirim-hint';
      btn.insertAdjacentElement('afterend', hint);
      function cek() {
        if (!btn.isConnected || btn.querySelector('.spinner')) return;   // sedang mengirim
        var kurang = (syarat() || []).filter(Boolean);
        btn.disabled = kurang.length > 0;
        hint.className = 'kirim-hint' + (kurang.length ? '' : ' ok');
        hint.innerHTML = kurang.length
          ? ik('info', 13) + '<span>Lengkapi dulu: ' + F.esc(kurang.slice(0, 4).join(', ') + (kurang.length > 4 ? ', dan ' + (kurang.length - 4) + ' lainnya' : '')) + '</span>'
          : ik('checkCircle', 13) + '<span>Semua isian wajib sudah lengkap</span>';
      }
      // Satu set pendengar per view (bukan per render) — pemeriksa tombol yang sudah
      // tidak ada di halaman dibuang otomatis, jadi render ulang tidak menumpuk pendengar.
      cek.btn = btn;
      el._cekKirim = (el._cekKirim || []).filter(function (f) { return f.btn.isConnected; });
      el._cekKirim.push(cek);
      if (!el._kkPasang) {
        el._kkPasang = true;
        var tunda = S.debounce(function () {
          (el._cekKirim || []).forEach(function (f) { if (f.btn.isConnected) f(); });
        }, 50);
        ['input', 'change', 'unggah-selesai', 'click'].forEach(function (ev) { el.addEventListener(ev, tunda); });
      }
      cek();
      return cek;
    },

    langkahStatus: function (r) {
      var tahap = [
        { t: 'Diajukan', d: F.tgl(r.tanggalAjukan, true), s: 'done' },
        {
          t: 'Verifikasi BAAK',
          d: r.status === 'MENUNGGU' ? 'Dalam proses' : (r.status === 'DITOLAK' ? 'Ditolak' : F.tgl(r.tanggalProses, true)),
          s: r.status === 'MENUNGGU' ? 'now' : (r.status === 'DITOLAK' ? 'now' : 'done')
        },
        {
          t: 'Terbit PDF',
          d: r.nomorSurat || 'Auto nomor',
          s: r.status === 'DISETUJUI' ? 'done' : ''
        }
      ];
      return tahap.map(function (x, i) {
        return '<div class="step ' + x.s + '"><div class="cir">' +
          (x.s === 'done' ? ik('check', 14, 2.6) : (i + 1)) + '</div>' +
          '<div class="st">' + F.esc(x.t) + '</div><div class="sd">' + F.esc(x.d) + '</div></div>';
      }).join('');
    },

    /**
     * Saat jadwal berakhir (tanggal + jam selesai; bila tidak ada, jam mulai; bila
     * tidak ada jam, akhir hari H). Dipakai agar pop-up tidak muncul lagi setelah lewat.
     */
    akhirJadwal: function (x) {
      var s = String((x && x.tanggal) || ''), d;
      var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) d = new Date(+m[1], +m[2] - 1, +m[3]);
      else {
        d = new Date(s);
        if (isNaN(d.getTime())) return 0;
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }
      var jam = String(x.jamSelesai || x.jam || '').match(/\d{1,2}[:.]\d{2}/g);
      if (jam && jam.length) {
        var t = jam[jam.length - 1].split(/[:.]/);
        d.setHours(+t[0], +t[1], 0, 0);
      } else d.setHours(23, 59, 59, 0);
      return d.getTime();
    },

    tampilkanPengumuman: function () {
      var p = (M.D && M.D.pengumuman) || [];
      var kini = Date.now();
      // Revisi 4: hanya jadwal yang belum lewat (sejak dijadwalkan s.d. hari H), yang terdekat lebih dulu.
      var jadwal = p.filter(function (x) {
        return (x.tipe === 'SEMPRO' || x.tipe === 'SIDANG') && M.akhirJadwal(x) > kini;
      }).sort(function (a, b) { return M.akhirJadwal(a) - M.akhirJadwal(b); })[0];
      if (!jadwal || Simpan.get('pengumuman_' + jadwal.tanggal + jadwal.tipe)) return;
      Simpan.set('pengumuman_' + jadwal.tanggal + jadwal.tipe, 1);

      UI.modal({
        judul: jadwal.judul,
        sub: 'Informasi resmi dari BAAK STIS Al Wafa',
        isi:
          '<div id="kartu-jadwal" style="background:linear-gradient(135deg,#0D1B33,#1B2A4A);color:#fff;border-radius:16px;padding:22px">' +
          '<div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.6)">' +
          (jadwal.tipe === 'SIDANG' ? 'Sidang Skripsi' : 'Seminar Proposal') + '</div>' +
          '<div style="font-size:22px;font-weight:800;margin:8px 0 14px;letter-spacing:-.02em">' +
          F.hari(jadwal.tanggal) + ', ' + F.tgl(jadwal.tanggal) + '</div>' +
          '<div style="display:grid;gap:7px;font-size:13.5px">' +
          '<div>' + ik('clock', 15) + ' Pukul ' + F.esc(jadwal.jam || '-') + ' WIB</div>' +
          '<div>' + ik('building', 15) + ' ' + F.esc(jadwal.ruang || '-') + '</div>' +
          (jadwal.penguji.length ? '<div>' + ik('users', 15) + ' ' + F.esc(jadwal.penguji.join(' • ')) + '</div>' : '') +
          '</div></div>' +
          '<div class="notice mt2">' + ik('info', 16) +
          '<span>Hadir 15–30 menit sebelum ujian dimulai dengan pakaian sesuai ketentuan akademik.</span></div>',
        kaki: '<button class="btn btn-ghost" data-tutup>Tutup</button>' +
          '<button class="btn btn-primary" id="unduh-jadwal">' + ik('download', 15) + 'Simpan sebagai Gambar</button>',
        siap: function (box) {
          box.querySelector('#unduh-jadwal').onclick = function () {
            M.unduhKartuJadwal(box.querySelector('#kartu-jadwal'), jadwal);
          };
        }
      });
    },

    /** Render kartu jadwal ke <canvas> lalu unduh sebagai JPG — tanpa pustaka eksternal. */
    unduhKartuJadwal: function (el, jadwal) {
      try {
        var c = document.createElement('canvas');
        var W = 900, H = 500;
        c.width = W; c.height = H;
        var g = c.getContext('2d');
        var grad = g.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, '#0D1B33'); grad.addColorStop(1, '#26406E');
        g.fillStyle = grad; g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(232,89,12,.25)';
        g.beginPath(); g.arc(W - 40, -30, 190, 0, Math.PI * 2); g.fill();

        g.fillStyle = '#F97316'; g.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
        g.fillText((jadwal.tipe === 'SIDANG' ? 'SIDANG SKRIPSI' : 'SEMINAR PROPOSAL'), 56, 88);
        g.fillStyle = '#fff'; g.font = 'bold 46px "Plus Jakarta Sans", sans-serif';
        g.fillText(F.hari(jadwal.tanggal) + ', ' + F.tgl(jadwal.tanggal), 56, 156);

        g.font = '500 24px "Plus Jakarta Sans", sans-serif';
        g.fillStyle = 'rgba(255,255,255,.88)';
        g.fillText('Pukul ' + (jadwal.jam || '-') + ' WIB', 56, 216);
        g.fillText('Tempat: ' + (jadwal.ruang || '-'), 56, 258);
        var pg = (jadwal.penguji || []).join(' • ');
        if (pg) {
          g.font = '500 19px "Plus Jakarta Sans", sans-serif';
          g.fillText('Penguji: ' + (pg.length > 62 ? pg.substring(0, 62) + '…' : pg), 56, 300);
        }
        g.font = 'bold 20px "Plus Jakarta Sans", sans-serif'; g.fillStyle = '#fff';
        g.fillText(M.D.profil.nama, 56, 384);
        g.font = '500 17px "Plus Jakarta Sans", sans-serif'; g.fillStyle = 'rgba(255,255,255,.7)';
        g.fillText('NIM ' + M.D.profil.nim + ' • ' + M.D.profil.prodi, 56, 414);
        g.font = '500 15px "Plus Jakarta Sans", sans-serif'; g.fillStyle = 'rgba(255,255,255,.55)';
        g.fillText('BAAK ' + (M.D.konfigurasi.institusi || 'STIS Al Wafa'), 56, 456);

        var a = document.createElement('a');
        a.download = 'Jadwal-' + jadwal.tipe + '-' + M.D.profil.nim + '.jpg';
        a.href = c.toDataURL('image/jpeg', 0.92);
        a.click();
        UI.toast('Kartu jadwal tersimpan.', 'ok');
      } catch (e) {
        UI.toast('Gagal membuat gambar. Silakan tangkap layar sebagai alternatif.', 'error');
      }
    },

    /* ==================================================================
       HELPER FORM
       ================================================================== */

    /** Bungkus isi menu: judul, deskripsi, dan penjaga hak akses. */
    kerangka: function (kunci, judul, deskripsi, isiHtml, ekstra) {
      var a = (M.D.akses || {})[kunci] || { buka: true };
      var head =
        '<div class="page-head"><div>' +
        '<div class="crumb">' + ik('home', 12) + ' Beranda <span class="sep">/</span> Layanan ' +
        '<span class="sep">/</span> <span class="cur">' + F.esc(judul) + '</span></div>' +
        '<h2>' + F.esc(judul) + '</h2>' +
        '<div class="desc">' + F.esc(deskripsi) + '</div></div>' +
        (ekstra || '') + '</div>';

      if (!a.buka) {
        return head +
          '<div class="card"><div class="card-body">' +
          '<div class="empty"><div class="ic">' + ik('lock', 26) + '</div>' +
          '<div class="t">Layanan Belum Dapat Diakses</div>' +
          '<div class="d" style="max-width:460px;margin:6px auto 0">' + F.esc(a.alasan || 'Menu ini sedang ditutup oleh BAAK.') + '</div>' +
          '<button class="btn btn-ghost mt2" data-nav="mhsview" data-view="beranda">Kembali ke Beranda</button>' +
          '</div></div></div>';
      }
      return head + isiHtml;
    },

    /** Daftar pengajuan sebelumnya untuk satu jenis. */
    daftarSebelumnya: function (jenis, judul) {
      var list = (M.D.riwayat || []).filter(function (r) { return r.jenis === jenis; });
      if (!list.length) return '';
      return '<div class="card mt2"><div class="card-head"><h3>' + F.esc(judul || 'Pengajuan Sebelumnya') + '</h3>' +
        '<span class="badge badge-gray">' + list.length + '</span></div>' +
        '<div class="table-wrap"><table class="tbl"><thead><tr>' +
        '<th>Tanggal</th><th>Rincian</th><th>Status</th><th>Dokumen</th></tr></thead><tbody>' +
        list.map(function (r) {
          return '<tr><td class="nowrap">' + F.tgl(r.tanggalAjukan, true) + '</td>' +
            '<td>' + F.esc(M.ringkasData(r)) + (r.nomorSurat ? '<div class="tiny mono muted">' + F.esc(r.nomorSurat) + '</div>' : '') + '</td>' +
            '<td>' + F.statusBadge(r.status) +
            (r.alasanTolak ? '<div class="tiny" style="color:var(--red-600);margin-top:3px;max-width:260px">' + F.esc(r.alasanTolak) + '</div>' : '') + '</td>' +
            '<td class="nowrap">' + (r.dokumen && r.dokumen.length
              ? '<button class="btn btn-ghost btn-sm" data-dokpv="' + F.esc(r.id) + '" title="Pratinjau">' + ik('eye', 14) + '</button> ' +
                '<button class="btn btn-soft btn-sm" data-dokdl="' + F.esc(r.id) + '">' + ik('download', 14) +
                (r.dokumen.length > 1 ? r.dokumen.length + ' Berkas' : 'Unduh') + '</button>'
              : (r.status === 'MENUNGGU'
                ? '<button class="btn btn-danger btn-sm" data-batal="' + F.esc(r.id) + '">Batalkan</button>'
                : (M.sedangDibuat(r) ? '<span class="badge badge-amber"><span class="spinner dark" style="width:10px;height:10px"></span> Dibuat…</span>'
                  : '<span class="muted small">—</span>'))) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    },

    /** Pengajuan disetujui yang PDF-nya masih di antrean server. */
    sedangDibuat: function (r) {
      return r.status === 'DISETUJUI' && ((M.D.antreanDokumen || {})[r.id] || 0) > 0;
    },

    ringkasData: function (r) {
      var d = r.data || {};
      return d.judulFinal || d.judul || d.instansi || d.mataKuliah || r.jenisLabel || '-';
    },

    /** Pasang tombol batal + unggah pada sebuah view. */
    pasangAksiUmum: function (el) {
      function cariPengajuan(id) {
        var hit = null;
        (M.D.riwayat || []).forEach(function (x) { if (x.id === id) hit = x; });
        return hit;
      }
      Array.prototype.forEach.call(el.querySelectorAll('[data-dokpv]'), function (b) {
        b.onclick = function () {
          var r = cariPengajuan(b.getAttribute('data-dokpv'));
          if (r) M.dialogDokumen(r);
        };
      });
      Array.prototype.forEach.call(el.querySelectorAll('[data-dokdl]'), function (b) {
        b.onclick = function () {
          var r = cariPengajuan(b.getAttribute('data-dokdl'));
          if (!r || !r.dokumen.length) return;
          if (r.dokumen.length === 1) S.Dok.unduh(r.dokumen[0]);
          else M.dialogDokumen(r);
        };
      });
      Array.prototype.forEach.call(el.querySelectorAll('[data-batal]'), function (b) {
        b.onclick = function () {
          UI.konfirmasi({
            judul: 'Batalkan Pengajuan?',
            isi: 'Pengajuan akan dihapus dari antrean verifikasi BAAK. Anda dapat mengajukan ulang setelahnya.',
            tombol: 'Ya, Batalkan', bahaya: true
          }).then(function (ya) {
            if (!ya) return;
            var id = b.getAttribute('data-batal');
            // Optimistic: ubah status di state lokal lebih dulu.
            (M.D.riwayat || []).forEach(function (r) { if (r.id === id) r.status = 'DIBATALKAN'; });
            M.renderSemua();
            API.kirim('batalkanPengajuan', { id: id }).then(function (r) {
              if (!r.success) { UI.toast(r.message, 'error'); M.muat(false); return; }
              UI.toast('Pengajuan dibatalkan.', 'ok');
              M.muat(false);
            });
          });
        };
      });
    },

    /**
     * Kirim pengajuan dengan Optimistic UI:
     * baris "Menunggu Verifikasi" langsung muncul, sinkronisasi berjalan di belakang.
     */
    ajukan: function (jenis, data, btn, opsi) {
      opsi = opsi || {};
      UI.sibuk(btn, true, 'Mengirim…');

      var sementara = {
        id: 'TMP-' + Date.now(), jenis: jenis, jenisLabel: jenis,
        status: 'MENUNGGU', tanggalAjukan: new Date().toISOString(), data: data, _sementara: true
      };
      M.D.riwayat = [sementara].concat(M.D.riwayat || []);
      M.renderSemua();
      M.pergi(M.menuDariJenis(jenis));

      return API.kirim('ajukanSurat', { jenis: jenis, data: data }).then(function (r) {
        UI.sibuk(btn, false);
        // Buang baris sementara apa pun hasilnya.
        M.D.riwayat = (M.D.riwayat || []).filter(function (x) { return x.id !== sementara.id; });

        if (!r.success) {
          M.renderSemua();
          UI.toast(r.message, 'error', 'Pengajuan Gagal');
          return r;
        }
        UI.toast(r.message || 'Pengajuan terkirim.', 'ok', 'Berhasil');
        if (opsi.setelah) opsi.setelah();
        M.muat(false);
        return r;
      });
    },

    /**
     * Pop-up isian blanko → PDF siap cetak (base64, tanpa berkas Drive).
     * Isian diingat di perangkat ini saja agar tidak perlu mengetik ulang.
     */
    cetakBlanko: function (kode) {
      var def = null;
      ((M.D && M.D.blanko) || []).forEach(function (x) { if (x.kode === kode) def = x; });
      if (!def) return UI.toast('Formulir tidak tersedia.', 'error');
      var ingat = Simpan.get('blanko_' + M.D.profil.nim + '_' + kode) || {};
      var field = def.field.map(function (f) {
        var o = {}; for (var k in f) o[k] = f[k];
        if (ingat[f.nama] !== undefined && ingat[f.nama] !== '') o.nilai = ingat[f.nama];
        return o;
      });
      UI.modal({
        judul: def.nama,
        sub: 'Nama, NIM, dan prodi terisi otomatis',
        lebar: field.length > 6,
        isi:
          '<dl class="kv mb2" style="background:var(--surface-2);padding:12px 14px;border-radius:12px">' +
          '<dt>Nama / NIM</dt><dd>' + F.esc(M.D.profil.nama) + ' • ' + F.esc(M.D.profil.nim) + '</dd>' +
          '<dt>Program Studi</dt><dd>' + F.esc(M.D.profil.prodiNama || M.D.profil.prodi) + '</dd></dl>' +
          (field.length
            ? S.Form.render(field, { prefix: 'bl', dosen: M.D.dosen || [], tanpaKotak: true })
            : '<div class="notice">' + ik('info', 16) + '<span>Formulir ini tidak memerlukan isian tambahan.</span></div>') +
          '<div class="tiny muted mt1">' + ik('lock', 12) + ' Isian tidak dikirim ke BAAK — hanya untuk dokumen siap cetak.</div>',
        kaki: '<button class="btn btn-ghost" data-tutup>Batal</button>' +
          '<button class="btn btn-primary" id="bl-buat">' + ik('printer', 15) + 'Buat PDF</button>',
        siap: function (box) {
          box.querySelector('#bl-buat').onclick = function (ev) {
            var nilai = S.Form.ambil(box);
            Simpan.set('blanko_' + M.D.profil.nim + '_' + kode, nilai);
            var btn = ev.currentTarget;
            UI.sibuk(btn, true, 'Menyusun PDF…');
            API.kirim('cetakBlanko', { kode: kode, nilai: nilai }).then(function (r) {
              UI.sibuk(btn, false);
              if (!r.success) return UI.toast(r.message, 'error');
              S.Dok.pratinjau(r.data, {
                sub: 'Siap dicetak',
                catatan: 'Dokumen disusun langsung dari isian Anda — tidak disimpan di server.'
              });
            });
          };
        }
      });
    },

    /** Modal berisi seluruh dokumen yang terbit dari satu pengajuan. */
    dialogDokumen: function (r) {
      UI.modal({
        judul: 'Dokumen Terbit',
        sub: r.jenisLabel + ' • ' + F.tgl(r.tanggalProses || r.tanggalAjukan),
        isi: r.dokumen && r.dokumen.length
          ? '<div class="small muted mb2">' + r.dokumen.length + ' dokumen diterbitkan BAAK untuk pengajuan ini. ' +
            'Klik ikon mata untuk melihat isi dokumen tanpa meninggalkan halaman.</div>' +
            S.Dok.daftar(r.dokumen)
          : UI.kosong('Belum Ada Dokumen', 'Dokumen terbit setelah pengajuan disetujui BAAK.', 'file'),
        kaki: '<button class="btn btn-ghost" data-tutup>Tutup</button>' +
          (r.dokumen && r.dokumen.length > 1
            ? '<button class="btn btn-primary" id="dl-semua">' + ik('download', 15) + 'Unduh Semua</button>' : ''),
        siap: function (box) {
          S.Dok.pasang(box, r.dokumen || []);
          var all = box.querySelector('#dl-semua');
          if (all) all.onclick = function () {
            (r.dokumen || []).forEach(function (d, i) { setTimeout(function () { S.Dok.unduh(d); }, i * 900); });
          };
        }
      });
    },

    /* ==================================================================
       1. SURAT KETERANGAN AKTIF
       ================================================================== */

    renderSuratAktif: function () {
      var d = M.D;
      var SUDAH = ['nik', 'tempat_lahir', 'tanggal_lahir', 'alamat', 'instansi', 'keperluan', 'keterangan'];

      var isi =
        '<div class="notice mb2">' + ik('info', 17) +
        '<span><b>Masa Berlaku Dokumen.</b> Surat Keterangan Aktif berlaku ' +
        F.esc(d.konfigurasi.masaBerlakuSuratAktif) + ' (tiga) bulan sejak tanggal diterbitkan BAAK.</span></div>' +
        M.catatanTolak('SURAT_AKTIF') +

        '<div class="card card-accent"><div class="card-head"><div><h3>Formulir Surat Aktif Kuliah</h3>' +
        '<div class="sub">Data akademik terisi otomatis dari basis data kampus</div></div>' +
        '<span class="badge badge-green">' + ik('checkCircle', 12) + ' Terverifikasi</span></div>' +
        '<div class="card-body">' +

        M.kartuPemohon('Pemohon') +

        M.judulBagian(1, 'Data Pemohon') +
        '<div class="field"><label for="sa-nik">Nomor Induk Kependudukan (NIK) <span class="req">*</span>' +
        '<span class="muted" style="float:right;font-weight:600" id="sa-nik-cnt">0/16</span></label>' +
        '<input class="input mono" id="sa-nik" inputmode="numeric" maxlength="16" placeholder="3201xxxxxxxxxxxx">' +
        '<div class="hint">Wajib 16 digit sesuai identitas resmi KTP atau Kartu Keluarga.</div></div>' +

        '<div class="grid-2">' +
        '<div class="field"><label for="sa-tl">Tempat Lahir <span class="req">*</span></label>' +
        '<input class="input" id="sa-tl" placeholder="Contoh: Bogor" maxlength="60"></div>' +
        '<div class="field"><label for="sa-tgl">Tanggal Lahir <span class="req">*</span></label>' +
        '<input class="input" id="sa-tgl" type="date"></div>' +
        '</div>' +

        '<div class="field"><label for="sa-alamat">Alamat Tinggal <span class="muted">(opsional)</span></label>' +
        '<input class="input" id="sa-alamat" placeholder="Jalan, RT/RW, Kelurahan, Kecamatan, Kota" maxlength="250"></div>' +

        M.judulBagian(2, 'Tujuan & Keperluan Surat') +
        '<div class="field"><label for="sa-instansi">Instansi / Pihak Tujuan <span class="req">*</span></label>' +
        '<input class="input" id="sa-instansi" placeholder="Contoh: PT Taspen (Persero) KCU Bogor" maxlength="150"></div>' +

        '<div class="field"><label for="sa-keperluan">Keperluan Surat <span class="req">*</span></label>' +
        '<input class="input" id="sa-keperluan" maxlength="200" ' +
        'placeholder="Contoh: Tunjangan gaji orang tua PNS / Syarat beasiswa Baznas / Klaim BPJS">' +
        '<div class="hint">Tuliskan keperluan dengan kalimat Anda sendiri — teks ini dicetak persis pada surat.</div></div>' +

        '<div class="field"><label for="sa-ket">Keterangan Tambahan / Format Khusus <span class="muted">(opsional)</span></label>' +
        '<textarea class="textarea" id="sa-ket" maxlength="400" placeholder="Tuliskan keterangan bila instansi meminta format nomor induk orang tua atau format khusus lainnya…"></textarea></div>' +

        M.judulBagian(3, 'Berkas Pendukung') +
        M.kotakUnggah('sa-khs', 'Kartu Hasil Studi (KHS) Terakhir', 'Unggah KHS semester terakhir', true) +

        M.blokDinamis('SURAT_AKTIF', SUDAH) +

        '<div class="notice mt2 mb2">' + ik('send', 17) +
        '<span><b>Proses Kilat BAAK:</b> Kirim → Verifikasi → Terbit PDF ber-QR. Surat diverifikasi maksimal 1×24 jam kerja.</span></div>' +

        '<button class="btn btn-primary btn-block btn-lg" id="sa-kirim">Kirim Permohonan Surat ' + ik('arrowRight', 16) + '</button>' +
        '</div></div>' +

        M.daftarSebelumnya('SURAT_AKTIF', 'Riwayat Surat Aktif Kuliah');

      var el = document.getElementById('mhsview-surat_aktif');
      el.innerHTML = M.kerangka('surat_aktif', 'Surat Keterangan Aktif Kuliah',
        'Untuk keperluan BPJS, beasiswa, tunjangan gaji orang tua, dan administrasi eksternal lainnya.', isi);
      M.pasangAksiUmum(el);
      if (!el.querySelector('#sa-kirim')) return;

      var nik = el.querySelector('#sa-nik');
      nik.addEventListener('input', function () {
        nik.value = nik.value.replace(/[^\d]/g, '');
        el.querySelector('#sa-nik-cnt').textContent = nik.value.length + '/16';
      });
      var khs = S.pasangUnggah(el.querySelector('#sa-khs'), { kategori: 'khs' });
      var nilai = function (id) { return el.querySelector(id).value.trim(); };

      M.kunciKirim(el, el.querySelector('#sa-kirim'), function () {
        return [
          nik.value.length !== 16 ? 'NIK 16 digit' : '',
          !nilai('#sa-tl') ? 'Tempat lahir' : '',
          !nilai('#sa-tgl') ? 'Tanggal lahir' : '',
          !nilai('#sa-instansi') ? 'Instansi tujuan' : '',
          nilai('#sa-keperluan').length < 3 ? 'Keperluan surat' : '',
          M.kurangUnggah(khs, 'KHS')
        ].concat(M.kurangDinamis(el, 'SURAT_AKTIF', SUDAH));
      });

      el.querySelector('#sa-kirim').onclick = function (ev) {
        var dyn = M.ambilDinamis(el, 'SURAT_AKTIF', SUDAH);
        if (dyn.error) return UI.toast(dyn.error, 'error');

        var data = {
          nik: nik.value.trim(),
          tempatLahir: el.querySelector('#sa-tl').value.trim(),
          tanggalLahir: el.querySelector('#sa-tgl').value,
          alamat: el.querySelector('#sa-alamat').value.trim(),
          instansi: el.querySelector('#sa-instansi').value.trim(),
          keperluan: el.querySelector('#sa-keperluan').value.trim(),
          keterangan: el.querySelector('#sa-ket').value.trim(),
          khsFileId: khs.fileId, khsUrl: khs.url,
          _dinamis: dyn.nilai
        };
        if (data.nik.length !== 16) return UI.toast('NIK harus tepat 16 digit.', 'error');
        if (!data.tempatLahir) return UI.toast('Tempat lahir wajib diisi.', 'error');
        if (!data.tanggalLahir) return UI.toast('Tanggal lahir wajib diisi.', 'error');
        if (!data.instansi) return UI.toast('Instansi tujuan wajib diisi.', 'error');
        if (data.keperluan.length < 3) return UI.toast('Keperluan surat wajib diisi.', 'error');
        if (khs.sedang) return UI.toast('Tunggu proses unggah KHS selesai.', 'warn');
        if (!khs.fileId) return UI.toast('Unggah Kartu Hasil Studi (KHS) terlebih dahulu.', 'error');
        M.ajukan('SURAT_AKTIF', data, ev.currentTarget);
      };
    },

    /* ==================================================================
       2. PENGAJUAN MAGANG
       ================================================================== */

    renderMagang: function () {
      var isi =
        M.catatanTolak('MAGANG') +
        '<div class="card card-accent"><div class="card-head"><div><h3>Pengajuan Surat Permohonan Magang</h3>' +
        '<div class="sub">Dapat diajukan berkali-kali hingga memperoleh surat balasan ACC dari instansi</div></div></div>' +
        '<div class="card-body">' +

        M.kartuPemohon('Ketua Kelompok') +

        M.judulBagian(1, 'Instansi Tujuan Magang') +
        '<div class="field"><label for="mg-instansi">Nama Instansi / Perusahaan <span class="req">*</span></label>' +
        '<input class="input" id="mg-instansi" placeholder="Contoh: Bank Syariah Indonesia KCP Cibubur" maxlength="150"></div>' +
        '<div class="field"><label for="mg-yth">Ditujukan Kepada (Yth.) <span class="req">*</span></label>' +
        '<input class="input" id="mg-yth" placeholder="Contoh: Pimpinan Cabang / HRD Manager" maxlength="120"></div>' +
        '<div class="field"><label for="mg-alamat">Alamat Lengkap Instansi <span class="req">*</span></label>' +
        '<textarea class="textarea" id="mg-alamat" maxlength="250" placeholder="Jalan, nomor, kelurahan, kecamatan, kota/kabupaten, provinsi"></textarea></div>' +

        M.judulBagian(2, 'Anggota Kelompok') +
        '<div class="between" style="margin:0 0 10px">' +
        '<div><h4 style="font-size:14px">Anggota Kelompok Magang <span class="muted" style="font-weight:600">(opsional)</span></h4>' +
        '<div class="tiny muted">Dapat diajukan individu atau kelompok (maksimal 4 mahasiswa satu instansi)</div></div>' +
        '<span class="badge badge-gray" id="mg-jml">1 / 4</span></div>' +
        '<div id="mg-anggota" class="checkgrid"></div>' +
        '<button class="btn btn-ghost btn-block mt1" id="mg-tambah">' + ik('plus', 15) + 'Tambah Anggota Magang</button>' +

        M.blokDinamis('MAGANG', ['instansi', 'yth', 'alamat_instansi', 'anggota']) +

        '<button class="btn btn-primary btn-block btn-lg mt3" id="mg-kirim">' + ik('send', 16) + 'Simpan &amp; Ajukan Magang</button>' +
        '<div class="tiny muted center mt1">Bisa diajukan berkali-kali hingga mendapatkan surat balasan ACC dari instansi.</div>' +
        '</div></div>' +

        M.daftarSebelumnya('MAGANG', 'Riwayat Pengajuan Magang');

      var el = document.getElementById('mhsview-magang');
      el.innerHTML = M.kerangka('magang', 'Pengajuan Magang / PKL',
        'Surat permohonan resmi dari BAAK untuk magang atau praktik kerja lapangan.', isi);
      M.pasangAksiUmum(el);
      if (!el.querySelector('#mg-kirim')) return;
      M.kunciKirim(el, el.querySelector('#mg-kirim'), function () {
        var v = function (id) { return el.querySelector(id).value.trim(); };
        return [!v('#mg-instansi') ? 'Nama instansi' : '', !v('#mg-yth') ? 'Ditujukan kepada' : '',
          !v('#mg-alamat') ? 'Alamat instansi' : ''].concat(M.kurangDinamis(el, 'MAGANG', ['instansi', 'yth', 'alamat_instansi', 'anggota']));
      });

      var anggota = [];
      var wrap = el.querySelector('#mg-anggota');

      function gambarAnggota() {
        el.querySelector('#mg-jml').textContent = (anggota.length + 1) + ' / 4';
        wrap.innerHTML = anggota.map(function (a, i) {
          return '<div class="checkrow"><span class="badge badge-gray">' + (i + 2) + '</span>' +
            '<div class="grow"><div class="bold">' + F.esc(a.nama || 'NIM ' + a.nim) + '</div>' +
            '<div class="tiny muted mono">NIM ' + F.esc(a.nim) + '</div></div>' +
            '<button class="x-btn" data-hapus="' + i + '" style="color:var(--red-600)">' + ik('trash', 16) + '</button></div>';
        }).join('');
        Array.prototype.forEach.call(wrap.querySelectorAll('[data-hapus]'), function (b) {
          b.onclick = function () { anggota.splice(parseInt(b.getAttribute('data-hapus'), 10), 1); gambarAnggota(); };
        });
        el.querySelector('#mg-tambah').disabled = anggota.length >= 3;
      }
      gambarAnggota();

      el.querySelector('#mg-tambah').onclick = function () {
        UI.modal({
          judul: 'Tambah Anggota Magang',
          sub: 'Masukkan NIM mahasiswa yang akan bergabung dalam kelompok.',
          isi: '<div class="field"><label for="ta-nim">NIM Anggota</label>' +
            '<input class="input mono" id="ta-nim" inputmode="numeric" placeholder="Contoh: 20210801015" maxlength="20">' +
            '<div class="hint">Nama akan diambil otomatis dari basis data kampus saat pengajuan diproses.</div></div>',
          kaki: '<button class="btn btn-ghost" data-tutup>Batal</button><button class="btn btn-primary" id="ta-ok">Tambahkan</button>',
          siap: function (box) {
            box.querySelector('#ta-ok').onclick = function () {
              var nim = box.querySelector('#ta-nim').value.trim();
              if (!nim) return UI.toast('NIM wajib diisi.', 'error');
              if (nim === M.D.profil.nim) return UI.toast('NIM Anda sudah otomatis tercatat sebagai ketua.', 'error');
              if (anggota.some(function (a) { return a.nim === nim; })) return UI.toast('NIM tersebut sudah ditambahkan.', 'error');
              anggota.push({ nim: nim });
              gambarAnggota();
              UI.tutupModal();
            };
          }
        });
      };

      el.querySelector('#mg-kirim').onclick = function (ev) {
        var dyn = M.ambilDinamis(el, 'MAGANG', ['instansi', 'yth', 'alamat_instansi', 'anggota']);
        if (dyn.error) return UI.toast(dyn.error, 'error');
        var data = {
          instansi: el.querySelector('#mg-instansi').value.trim(),
          yth: el.querySelector('#mg-yth').value.trim(),
          alamatInstansi: el.querySelector('#mg-alamat').value.trim(),
          anggota: anggota,
          _dinamis: dyn.nilai
        };
        if (!data.instansi) return UI.toast('Nama instansi wajib diisi.', 'error');
        if (!data.yth) return UI.toast('Kolom "Ditujukan Kepada Yth." wajib diisi.', 'error');
        if (!data.alamatInstansi) return UI.toast('Alamat instansi wajib diisi.', 'error');
        M.ajukan('MAGANG', data, ev.currentTarget);
      };
    },

    /* ==================================================================
       3. KONFIRMASI TEMPAT MAGANG
       ================================================================== */

    renderKonfirmasiMagang: function () {
      var sumber = M.D.magangDisetujui || [];
      var DIN = ['pj_nama', 'pj_jabatan', 'pj_hp', 'instansi', 'yth', 'alamat_instansi', 'anggota'];
      var isi;

      if (!sumber.length) {
        isi = '<div class="card"><div class="card-body">' +
          UI.kosong('Belum Ada Pengajuan Magang yang Disetujui',
            'Ajukan Surat Permohonan Magang terlebih dahulu dan tunggu persetujuan BAAK.', 'briefcase') +
          '<div class="center"><button class="btn btn-primary" data-nav="mhsview" data-view="magang">Ajukan Magang Sekarang</button></div>' +
          '</div></div>';
      } else {
        isi =
          M.catatanTolak('KONFIRMASI_MAGANG') +
          '<div class="notice mb2">' + ik('info', 17) +
          '<span><b>Hanya dapat diisi satu kali.</b> Centang hanya anggota yang benar-benar diterima instansi. ' +
          'Anggota yang tidak dicentang tetap dapat mengajukan magang ke instansi lain.</span></div>' +

          '<div class="card card-accent"><div class="card-head"><div><h3>Konfirmasi Tempat Magang (ACC Instansi)</h3>' +
          '<div class="sub">Data instansi terisi otomatis dari pengajuan yang Anda pilih</div></div></div>' +
          '<div class="card-body">' +
          M.kartuPemohon('Pelapor') +

          M.judulBagian(1, 'Pilih Pengajuan Magang yang Diterima') +
          '<div class="pilih-kartu" id="km-pilih">' +
          sumber.map(function (r) {
            var dd = r.data || {};
            return '<button type="button" class="pk" data-km="' + F.esc(r.id) + '"><span class="rd"></span>' +
              '<span class="grow"><span class="nm" style="display:block">' + F.esc(dd.instansi || '-') + '</span>' +
              '<span class="mt" style="display:block">' + F.esc(r.nomorSurat || r.id) + ' • ' + ((dd.anggota || []).length || 1) + ' mahasiswa' +
              (dd.alamatInstansi ? ' • ' + F.esc(dd.alamatInstansi) : '') + '</span></span></button>';
          }).join('') + '</div>' +

          '<div id="km-detail" class="mt2"></div>' +

          '<div id="km-form" class="hidden">' +
          M.judulBagian(2, 'Penanggung Jawab (PJ) Lapangan') +
          '<div class="grid-2">' +
          '<div class="field"><label for="km-pj">Nama Lengkap PJ <span class="req">*</span></label>' +
          '<input class="input" id="km-pj" placeholder="Contoh: Rina Kusuma Dewi, S.E." maxlength="100"></div>' +
          '<div class="field"><label for="km-jab">Jabatan PJ di Instansi <span class="req">*</span></label>' +
          '<input class="input" id="km-jab" placeholder="Contoh: Supervisor Layanan Operasional" maxlength="100"></div>' +
          '</div>' +
          '<div class="field"><label for="km-hp">Nomor WhatsApp PJ <span class="req">*</span></label>' +
          '<input class="input mono" id="km-hp" inputmode="numeric" placeholder="08xxxxxxxxxx" maxlength="15"></div>' +

          M.judulBagian(3, 'Bukti Penerimaan') +
          M.kotakUnggah('km-upload', 'Bukti Surat Balasan / Penerimaan', 'Unggah Surat Balasan Instansi', true) +

          M.blokDinamis('KONFIRMASI_MAGANG', DIN) +
          '</div>' +
          '<button class="btn btn-primary btn-block btn-lg mt2" id="km-kirim">' + ik('checkCircle', 16) + 'Kirim Konfirmasi Tempat Magang</button>' +
          '</div></div>' +

          M.daftarSebelumnya('KONFIRMASI_MAGANG', 'Riwayat Konfirmasi Magang');
      }

      var el = document.getElementById('mhsview-konfirmasi_magang');
      el.innerHTML = M.kerangka('konfirmasi_magang', 'Konfirmasi Tempat Magang',
        'Laporkan instansi yang menerima Anda beserta data penanggung jawab lapangan untuk penerbitan Surat Pengantar.', isi);
      M.pasangAksiUmum(el);
      if (!el.querySelector('#km-pilih')) return;

      var unggah = S.pasangUnggah(el.querySelector('#km-upload'), { kategori: 'magang' });
      var terpilih = null;

      function pilih(id) {
        terpilih = null;
        for (var i = 0; i < sumber.length; i++) if (sumber[i].id === id) terpilih = sumber[i];
        Array.prototype.forEach.call(el.querySelectorAll('[data-km]'), function (b) {
          b.classList.toggle('on', b.getAttribute('data-km') === id);
        });
        var box = el.querySelector('#km-detail');
        if (!terpilih) { box.innerHTML = ''; el.querySelector('#km-form').classList.add('hidden'); return; }

        var d = terpilih.data || {};
        var ang = d.anggota || [];
        box.innerHTML =
          '<dl class="kv mb2" style="background:var(--surface-2);padding:14px;border-radius:12px">' +
          '<dt>Instansi</dt><dd>' + F.esc(d.instansi || '-') + '</dd>' +
          '<dt>Ditujukan Kepada</dt><dd>' + F.esc(d.yth || '-') + '</dd>' +
          '<dt>Alamat</dt><dd>' + F.esc(d.alamatInstansi || '-') + '</dd>' +
          '<dt>Nomor Surat</dt><dd class="mono">' + F.esc(terpilih.nomorSurat || '-') + '</dd>' +
          '</dl>' +
          '<div class="field"><label>Anggota yang Diterima (ACC) Instansi <span class="req">*</span></label>' +
          '<div class="checkgrid" id="km-anggota">' +
          ang.map(function (a, i) {
            return '<label class="checkrow"><input type="checkbox" value="' + F.esc(a.nim) + '" checked>' +
              '<div class="grow"><div class="bold">' + F.esc(a.nama) + '</div>' +
              '<div class="tiny muted mono">NIM ' + F.esc(a.nim) + ' • ' + F.esc(a.peran || '-') + '</div></div>' +
              '<span class="badge badge-green" data-tanda="' + i + '">Di-ACC</span></label>';
          }).join('') + '</div>' +
          '<div class="hint">Hilangkan centang bila instansi hanya menerima sebagian anggota. ' +
          'Anggota yang tidak dicentang otomatis tetap dapat mengajukan magang ke instansi lain.</div></div>';

        Array.prototype.forEach.call(box.querySelectorAll('#km-anggota input'), function (c) {
          c.onchange = function () {
            var row = c.closest('.checkrow');
            var tanda = row.querySelector('[data-tanda]');
            row.classList.toggle('off', !c.checked);
            tanda.className = 'badge ' + (c.checked ? 'badge-green' : 'badge-gray');
            tanda.textContent = c.checked ? 'Di-ACC' : 'Tidak Diterima';
          };
        });
        el.querySelector('#km-form').classList.remove('hidden');
      }
      Array.prototype.forEach.call(el.querySelectorAll('[data-km]'), function (b) {
        b.onclick = function () { pilih(b.getAttribute('data-km')); };
      });
      if (sumber.length === 1) pilih(sumber[0].id);

      var nilai = function (id) { return el.querySelector(id).value.trim(); };
      M.kunciKirim(el, el.querySelector('#km-kirim'), function () {
        if (!terpilih) return ['Pilih pengajuan magang'];
        return [
          el.querySelectorAll('#km-anggota input:checked').length ? '' : 'Anggota yang di-ACC',
          !nilai('#km-pj') ? 'Nama PJ' : '', !nilai('#km-jab') ? 'Jabatan PJ' : '',
          nilai('#km-hp').replace(/\D/g, '').length < 9 ? 'WhatsApp PJ' : '',
          M.kurangUnggah(unggah, 'Bukti surat balasan')
        ].concat(M.kurangDinamis(el, 'KONFIRMASI_MAGANG', DIN));
      });

      el.querySelector('#km-kirim').onclick = function (ev) {
        if (!terpilih) return UI.toast('Pilih pengajuan magang terlebih dahulu.', 'error');
        var acc = [];
        Array.prototype.forEach.call(el.querySelectorAll('#km-anggota input:checked'), function (c) { acc.push({ nim: c.value }); });
        if (!acc.length) return UI.toast('Centang minimal satu anggota yang diterima instansi.', 'error');
        if (unggah.sedang) return UI.toast('Tunggu proses unggah berkas selesai.', 'warn');
        if (!unggah.fileId) return UI.toast('Unggah bukti surat balasan instansi.', 'error');

        var dynK = M.ambilDinamis(el, 'KONFIRMASI_MAGANG', DIN);
        if (dynK.error) return UI.toast(dynK.error, 'error');
        var data = {
          idPengajuanMagang: terpilih.id,
          anggotaAcc: acc,
          _dinamis: dynK.nilai,
          pjNama: nilai('#km-pj'),
          pjJabatan: nilai('#km-jab'),
          pjHp: nilai('#km-hp'),
          buktiFileId: unggah.fileId,
          buktiUrl: unggah.url
        };
        if (!data.pjNama) return UI.toast('Nama PJ magang wajib diisi.', 'error');
        if (!data.pjJabatan) return UI.toast('Jabatan PJ magang wajib diisi.', 'error');
        if (!data.pjHp) return UI.toast('Nomor WhatsApp PJ wajib diisi.', 'error');
        M.ajukan('KONFIRMASI_MAGANG', data, ev.currentTarget);
      };
    },

    /* ==================================================================
       4. IZIN PENELITIAN
       ================================================================== */

    renderPenelitian: function () {
      var isi =
        M.catatanTolak('PENELITIAN') +
        '<div class="card card-accent"><div class="card-head"><div><h3>Formulir Izin Penelitian / Riset</h3>' +
        '<div class="sub">Surat pengantar resmi ke instansi atau lokasi penelitian skripsi</div></div></div>' +
        '<div class="card-body">' +
        M.kartuPemohon('Peneliti') +
        '<div class="field"><label for="pn-judul">Judul Skripsi / Penelitian <span class="req">*</span></label>' +
        '<textarea class="textarea" id="pn-judul" maxlength="300" placeholder="Tuliskan judul lengkap sesuai persetujuan dosen pembimbing"></textarea>' +
        '<div class="hint">Judul akan dicetak persis seperti yang Anda tulis — periksa ejaan dengan teliti.</div></div>' +
        '<div class="field"><label for="pn-instansi">Nama Instansi / Lokasi Penelitian <span class="req">*</span></label>' +
        '<input class="input" id="pn-instansi" maxlength="150" placeholder="Contoh: Baznas Kota Bogor"></div>' +
        '<div class="field"><label for="pn-yth">Ditujukan Kepada (Yth.) <span class="req">*</span></label>' +
        '<input class="input" id="pn-yth" maxlength="120" placeholder="Contoh: Ketua Baznas Kota Bogor"></div>' +
        '<div class="field"><label for="pn-alamat">Alamat Lengkap Instansi <span class="req">*</span></label>' +
        '<textarea class="textarea" id="pn-alamat" maxlength="250" placeholder="Jalan, nomor, kelurahan, kecamatan, kota/kabupaten"></textarea></div>' +
        M.blokDinamis('PENELITIAN', ['judul', 'instansi', 'yth', 'alamat_instansi']) +
        '<button class="btn btn-primary btn-block btn-lg mt2" id="pn-kirim">' + ik('send', 16) + 'Ajukan Surat Izin Penelitian</button>' +
        '</div></div>' +
        M.daftarSebelumnya('PENELITIAN', 'Riwayat Izin Penelitian');

      var el = document.getElementById('mhsview-penelitian');
      el.innerHTML = M.kerangka('penelitian', 'Izin Penelitian / Riset',
        'Penerbitan surat pengantar penelitian untuk instansi atau lokasi riset skripsi.', isi);
      M.pasangAksiUmum(el);
      if (!el.querySelector('#pn-kirim')) return;
      M.kunciKirim(el, el.querySelector('#pn-kirim'), function () {
        var v = function (id) { return el.querySelector(id).value.trim(); };
        return [v('#pn-judul').length < 10 ? 'Judul (min. 10 karakter)' : '', !v('#pn-instansi') ? 'Nama instansi' : '',
          !v('#pn-yth') ? 'Ditujukan kepada' : '', !v('#pn-alamat') ? 'Alamat instansi' : '']
          .concat(M.kurangDinamis(el, 'PENELITIAN', ['judul', 'instansi', 'yth', 'alamat_instansi']));
      });

      el.querySelector('#pn-kirim').onclick = function (ev) {
        var dynP = M.ambilDinamis(el, 'PENELITIAN', ['judul', 'instansi', 'yth', 'alamat_instansi']);
        if (dynP.error) return UI.toast(dynP.error, 'error');
        var data = {
          judul: el.querySelector('#pn-judul').value.trim(),
          instansi: el.querySelector('#pn-instansi').value.trim(),
          yth: el.querySelector('#pn-yth').value.trim(),
          alamatInstansi: el.querySelector('#pn-alamat').value.trim(),
          _dinamis: dynP.nilai
        };
        if (data.judul.length < 10) return UI.toast('Judul penelitian minimal 10 karakter.', 'error');
        if (!data.instansi) return UI.toast('Nama instansi wajib diisi.', 'error');
        if (!data.yth) return UI.toast('Kolom "Ditujukan Kepada" wajib diisi.', 'error');
        if (!data.alamatInstansi) return UI.toast('Alamat instansi wajib diisi.', 'error');
        M.ajukan('PENELITIAN', data, ev.currentTarget);
      };
    },

    /* ==================================================================
       5. SEMINAR PROPOSAL
       ================================================================== */

    renderSempro: function () {
      var d = M.D;
      var dosenNidn = (d.dosen || []).filter(function (x) { return String(x.kategori).toUpperCase() === 'NIDN'; });
      // v3.3: pengajuan yang dibatalkan / ditolak tidak menghalangi pendaftaran ulang.
      var daftar = M.aktifTerbaru('SEMPRO');
      var revisi = M.aktifTerbaru('REVISI_SEMPRO');
      var jadwal = (d.penguji || []).filter(function (x) { return x.jenis === 'SEMPRO' && (!daftar || x.idPengajuan === daftar.id); })[0];

      var isi =
        '<div class="tabs mb2" style="background:var(--surface);border:1px solid var(--line);border-radius:12px" id="sp-tabs">' +
        '<button class="tab active" data-tab="daftar">' + ik('file', 14) + ' Pendaftaran</button>' +
        '<button class="tab" data-tab="revisi">' + ik('edit', 14) + ' Pernyataan Revisi</button>' +
        '<button class="tab" data-tab="sk">' + ik('award', 14) + ' SK Pembimbing</button>' +
        '</div>';

      /* --- Tab 1: pendaftaran --- */
      isi += '<div data-panel="daftar">';
      if (daftar) {
        isi += '<div class="card"><div class="card-head"><div><h3>Pendaftaran Seminar Proposal</h3>' +
          '<div class="sub">Diajukan ' + F.tgl(daftar.tanggalAjukan) + '</div></div>' + F.statusBadge(daftar.status) + '</div>' +
          '<div class="card-body">' +
          '<dl class="kv"><dt>Judul Proposal</dt><dd>' + F.esc(daftar.data.judul || '-') + '</dd>' +
          '<dt>No. WhatsApp</dt><dd class="mono">' + F.esc(daftar.data.noWa || '-') + '</dd>' +
          (daftar.nomorSurat ? '<dt>Nomor Dokumen</dt><dd class="mono">' + F.esc(daftar.nomorSurat) + '</dd>' : '') +
          '</dl>' +
          (jadwal && jadwal.tanggalJadwal
            ? '<div class="notice ok mt2">' + ik('calendar', 17) + '<span><b>Jadwal ditetapkan:</b> ' +
            F.hari(jadwal.tanggalJadwal) + ', ' + F.tgl(jadwal.tanggalJadwal) + ' pukul ' + F.esc(jadwal.jamJadwal) +
            ' WIB di ' + F.esc(jadwal.ruang) + '.<br>Penguji: ' + F.esc(jadwal.penguji1 || '-') + '</span></div>'
            : '<div class="notice mt2">' + ik('clock', 17) + '<span>Menunggu BAAK menetapkan dosen penguji dan jadwal ujian.</span></div>') +
          '<div class="tiny muted mt2">' + ik('printer', 12) + ' Formulir pendaftaran seminar proposal tersedia di menu ' +
          '<a href="#" data-nav="mhsview" data-view="formulir">Formulir Siap Cetak</a>.</div>' +
          '<div class="row-wrap mt2">' +
          (daftar.dokumen && daftar.dokumen.length
            ? '<button class="btn btn-ghost btn-sm" data-dokpv="' + F.esc(daftar.id) + '">' + ik('eye', 15) + 'Pratinjau</button>' +
              '<button class="btn btn-primary btn-sm" data-dokdl="' + F.esc(daftar.id) + '">' + ik('download', 15) +
              'Unduh Formulir (' + daftar.dokumen.length + ')</button>' : '') +
          (daftar.status === 'MENUNGGU' ? '<button class="btn btn-danger btn-sm" data-batal="' + F.esc(daftar.id) + '">Batalkan Pendaftaran</button>' : '') +
          '</div></div></div>';
      } else {
        isi += M.catatanTolak('SEMPRO') +
          '<div class="card card-accent"><div class="card-head"><div><h3>Pendaftaran Seminar Proposal</h3>' +
          '<div class="sub">Data NIM, nama, dan prodi terisi otomatis</div></div></div><div class="card-body">' +
          M.kartuPemohon('Pendaftar') +
          '<div class="field"><label for="sp-judul">Judul Proposal Skripsi <span class="req">*</span></label>' +
          '<textarea class="textarea" id="sp-judul" maxlength="300" placeholder="Tuliskan judul proposal sesuai arahan calon dosen pembimbing"></textarea></div>' +
          '<div class="field"><label for="sp-wa">No. WhatsApp Aktif <span class="req">*</span></label>' +
          '<input class="input mono" id="sp-wa" inputmode="numeric" maxlength="15" placeholder="08xxxxxxxxxx" value="' + F.esc(d.profil.noWa || '') + '"></div>' +
          M.blokDinamis('SEMPRO', ['judul', 'no_wa']) +
          '<button class="btn btn-primary btn-block btn-lg mt2" id="sp-kirim">' + ik('send', 16) + 'Daftar Seminar Proposal</button>' +
          '</div></div>';
      }
      isi += '</div>';

      /* --- Tab 2: pernyataan revisi --- */
      isi += '<div data-panel="revisi" class="hidden">';
      if (!daftar || daftar.status !== 'DISETUJUI') {
        isi += '<div class="card"><div class="card-body">' +
          UI.kosong('Belum Dapat Diisi', 'Formulir Pernyataan Revisi terbuka setelah pendaftaran sempro disetujui dan ujian terlaksana.', 'lock') +
          '</div></div>';
      } else if (revisi) {
        isi += '<div class="card"><div class="card-head"><div><h3>Pernyataan Revisi Seminar Proposal</h3>' +
          '<div class="sub">Diajukan ' + F.tgl(revisi.tanggalAjukan) + '</div></div>' + F.statusBadge(revisi.status) + '</div>' +
          '<div class="card-body"><dl class="kv">' +
          '<dt>Judul Final</dt><dd>' + F.esc(revisi.data.judulFinal || '-') + '</dd>' +
          '<dt>Penguji Sempro</dt><dd>' + F.esc(revisi.data.pengujiNama || '-') + '</dd>' +
          (revisi.data.pembimbing ? '<dt>Pembimbing Ditetapkan</dt><dd>' + F.esc(revisi.data.pembimbing) + '</dd>' : '') +
          '</dl>' +
          (revisi.status === 'DITOLAK' && revisi.alasanTolak
            ? '<div class="notice danger mt2">' + ik('alert', 17) + '<span>' + F.esc(revisi.alasanTolak) + '</span></div>' : '') +
          '</div></div>';
      } else {
        isi += M.catatanTolak('REVISI_SEMPRO') +
          '<div class="card card-accent"><div class="card-head"><div><h3>Pernyataan Revisi Seminar Proposal</h3>' +
          '<div class="sub">Pengesahan hasil perbaikan dari dewan penguji</div></div>' +
          '<span class="badge badge-green">Lulus Sempro</span></div><div class="card-body">' +
          '<div class="field"><label for="rs-judul">Judul Proposal Final (Pasca-Revisi) <span class="req">*</span></label>' +
          '<textarea class="textarea" id="rs-judul" maxlength="300">' + F.esc(daftar.data.judul || '') + '</textarea>' +
          '<div class="hint">Pastikan judul sudah disetujui dosen penguji — judul ini yang tercetak pada SK Pembimbing.</div></div>' +
          '<div class="field"><label for="rs-penguji">Dosen Penguji Sempro (khusus NIDN) <span class="req">*</span></label>' +
          '<select class="select" id="rs-penguji"><option value="">— Pilih dosen penguji —</option>' +
          dosenNidn.map(function (x) {
            var pilih = jadwal && jadwal.penguji1 && String(jadwal.penguji1).indexOf(x.nama) === 0 ? ' selected' : '';
            return '<option value="' + F.esc(x.id) + '"' + pilih + '>' + F.esc(x.nama) + (x.nidn ? ' (NIDN: ' + F.esc(x.nidn) + ')' : '') + '</option>';
          }).join('') +
          '</select><div class="hint">Hanya dosen berstatus NIDN aktif sesuai ketentuan PRD 5.B.</div></div>' +
          '<div class="field"><label>Lembar Pengesahan Revisi (PDF) <span class="muted">(opsional)</span></label>' +
          '<div class="upload" id="rs-upload"><input type="file" accept=".pdf,.jpg,.jpeg,.png">' +
          '<div data-info><div style="color:var(--orange-600);line-height:0;margin-bottom:6px">' + ik('upload', 24) + '</div>' +
          '<div class="upload-name">Unggah Lembar Pengesahan</div>' +
          '<div class="tiny muted">PDF atau gambar hasil pindai, maksimal ' + S.CFG.MAKS_UNGGAH_MB + ' MB</div></div></div></div>' +
          '<button class="btn btn-primary btn-block btn-lg mt2" id="rs-kirim">' + ik('send', 16) + 'Kirim Pernyataan Revisi</button>' +
          '</div></div>';
      }
      isi += '</div>';

      /* --- Tab 3: SK Pembimbing — mahasiswa hanya melihat SK Pembimbing & Kartu Kontrol Bimbingan --- */
      isi += '<div data-panel="sk" class="hidden">';
      var dokSk = M.dokumenSk(revisi);
      var skSiap = revisi && revisi.status === 'DISETUJUI' && dokSk.length > 0;
      var skDibuat = revisi && revisi.status === 'DISETUJUI' && !skSiap && ((d.antreanDokumen || {})[revisi.id] || 0) > 0;
      // v3.3: SK & Kartu tampil setelah BAAK menekan "Kirim ke Mahasiswa".
      var skMenunggu = revisi && revisi.status === 'DISETUJUI' && !skSiap && !skDibuat;
      var adaSk = dokSk.some(function (x) { return x.kode === 'SK_PEMBIMBING'; });
      isi += '<div class="card"><div class="card-head"><div><h3>SK Pembimbing Skripsi &amp; Kartu Kontrol Bimbingan</h3>' +
        '<div class="sub">Dikirim BAAK ke akun Anda setelah Revisi Seminar Proposal diverifikasi</div></div>' +
        (skSiap ? '<span class="badge badge-green">Siap Diunduh</span>'
          : (skDibuat ? '<span class="badge badge-amber">Sedang Dibuat</span>'
            : (skMenunggu ? '<span class="badge badge-blue">Menunggu Dikirim</span>' : '<span class="badge badge-gray">Belum Terbit</span>'))) + '</div>' +
        '<div class="card-body">' +
        (skSiap
          ? '<dl class="kv mb2"><dt>Nomor SK</dt><dd class="mono">' + F.esc(revisi.nomorSurat || (dokSk[0] && dokSk[0].nomor) || '-') + '</dd>' +
          '<dt>Dosen Pembimbing</dt><dd>' + F.esc(revisi.data.pembimbing || '-') + '</dd>' +
          '<dt>Judul Disetujui</dt><dd>' + F.esc(revisi.data.judulFinal || '-') + '</dd>' +
          '<dt>Tanggal Terbit</dt><dd>' + F.tgl(revisi.tanggalProses) + '</dd></dl>' +
          (adaSk ? '<div class="notice ok mb2">' + ik('checkCircle', 17) +
            '<span>SK Pembimbing sudah diterima. Menu <b>Skripsi</b> kini terbuka untuk Anda.</span></div>'
            : '<div class="notice mb2">' + ik('clock', 17) + '<span>SK Pembimbing akan dikirim BAAK ke akun Anda.</span></div>') +
          S.Dok.daftar(dokSk)
          : (skDibuat
            ? '<div class="notice warn">' + ik('clock', 17) + '<span>SK Pembimbing &amp; Kartu Kontrol Bimbingan sedang dibuat sistem. Muat ulang dalam beberapa saat.</span></div>'
            : (skMenunggu
              ? '<div class="notice info">' + ik('send', 17) + '<span><b>Revisi terverifikasi.</b> SK Pembimbing Skripsi &amp; Kartu Kontrol Bimbingan ' +
                'sedang disiapkan dan akan tampil di sini setelah dikirim BAAK ke akun Anda.</span></div>'
              : UI.kosong('SK Pembimbing Belum Diterbitkan',
                'SK baru dapat diterbitkan setelah Anda mengisi Pernyataan Revisi dan BAAK menetapkan dosen pembimbing.', 'award')))) +
        '</div></div>';
      isi += '</div>';

      var el = document.getElementById('mhsview-sempro');
      el.innerHTML = M.kerangka('sempro', 'Seminar Proposal',
        'Pendaftaran seminar proposal, pernyataan revisi, hingga SK Pembimbing Skripsi.', isi);
      M.pasangAksiUmum(el);
      S.Dok.pasang(el.querySelector('[data-panel="sk"]'), M.dokumenSk(revisi));
      if (!el.querySelector('#sp-tabs')) return;

      M.pasangTab(el, 'sp-tabs');

      var btnDaftar = el.querySelector('#sp-kirim');
      if (btnDaftar) {
        M.kunciKirim(el, btnDaftar, function () {
          return [el.querySelector('#sp-judul').value.trim().length < 10 ? 'Judul proposal (min. 10 karakter)' : '',
            el.querySelector('#sp-wa').value.replace(/\D/g, '').length < 9 ? 'No. WhatsApp' : '']
            .concat(M.kurangDinamis(el, 'SEMPRO', ['judul', 'no_wa']));
        });
        btnDaftar.onclick = function (ev) {
          var dynS = M.ambilDinamis(el, 'SEMPRO', ['judul', 'no_wa']);
          if (dynS.error) return UI.toast(dynS.error, 'error');
          var data = {
            judul: el.querySelector('#sp-judul').value.trim(),
            noWa: el.querySelector('#sp-wa').value.trim(),
            _dinamis: dynS.nilai
          };
          if (data.judul.length < 10) return UI.toast('Judul proposal minimal 10 karakter.', 'error');
          if (!data.noWa) return UI.toast('Nomor WhatsApp aktif wajib diisi.', 'error');
          M.ajukan('SEMPRO', data, ev.currentTarget);
        };
      }

      var btnRevisi = el.querySelector('#rs-kirim');
      if (btnRevisi) {
        var ung = S.pasangUnggah(el.querySelector('#rs-upload'), { kategori: 'sempro' });
        M.kunciKirim(el, btnRevisi, function () {
          return [el.querySelector('#rs-judul').value.trim().length < 10 ? 'Judul final (min. 10 karakter)' : '',
            !el.querySelector('#rs-penguji').value ? 'Dosen penguji sempro' : '',
            ung.sedang ? 'Lembar pengesahan (sedang diunggah)' : ''];
        });
        btnRevisi.onclick = function (ev) {
          var data = {
            judulFinal: el.querySelector('#rs-judul').value.trim(),
            pengujiId: el.querySelector('#rs-penguji').value,
            lembarFileId: ung.fileId, lembarUrl: ung.url
          };
          if (data.judulFinal.length < 10) return UI.toast('Judul final minimal 10 karakter.', 'error');
          if (!data.pengujiId) return UI.toast('Pilih dosen penguji sempro.', 'error');
          M.ajukan('REVISI_SEMPRO', data, ev.currentTarget);
        };
      }
    },

    /** Dokumen SK yang boleh dilihat mahasiswa: SK Pembimbing + Kartu Kontrol Bimbingan saja. */
    dokumenSk: function (revisi) {
      return ((revisi && revisi.dokumen) || []).filter(function (x) {
        return x.kode === 'SK_PEMBIMBING' || x.kode === 'F_KARTU_BIMBINGAN';
      });
    },

    pasangTab: function (el, idTabs) {
      var tabs = el.querySelector('#' + idTabs);
      Array.prototype.forEach.call(tabs.querySelectorAll('.tab'), function (t) {
        t.onclick = function () {
          Array.prototype.forEach.call(tabs.querySelectorAll('.tab'), function (x) { x.classList.remove('active'); });
          t.classList.add('active');
          var target = t.getAttribute('data-tab');
          Array.prototype.forEach.call(el.querySelectorAll('[data-panel]'), function (p) {
            p.classList.toggle('hidden', p.getAttribute('data-panel') !== target);
          });
        };
      });
    },

    /* ==================================================================
       6. SIDANG SKRIPSI
       ================================================================== */

    renderSidang: function () {
      var d = M.D;
      var dosenNidn = (d.dosen || []).filter(function (x) { return String(x.kategori).toUpperCase() === 'NIDN'; });
      // v3.3: pengajuan yang dibatalkan / ditolak tidak menghalangi pengajuan ulang.
      var daftar = M.aktifTerbaru('SIDANG');
      var revisi = M.aktifTerbaru('REVISI_SIDANG');
      var jadwal = (d.penguji || []).filter(function (x) { return x.jenis === 'SIDANG' && (!daftar || x.idPengajuan === daftar.id); })[0];
      var KODE_SKL = ['SKL', 'LEMBAR_PENGESAHAN'];
      var dokDaftar = ((daftar && daftar.dokumen) || []).filter(function (x) { return KODE_SKL.indexOf(x.kode) < 0; });

      /** Penguji sidang sudah ditetapkan BAAK → pilih otomatis berdasarkan nama. */
      function idDariNama(nama) {
        var n = String(nama || '').toLowerCase(), hit = '';
        if (!n) return '';
        dosenNidn.forEach(function (x) { if (!hit && n.indexOf(String(x.nama).toLowerCase()) === 0) hit = x.id; });
        return hit;
      }
      function opsiDosen(terpilih) {
        return '<option value="">— Pilih dosen —</option>' + dosenNidn.map(function (x) {
          return '<option value="' + F.esc(x.id) + '"' + (terpilih === x.id ? ' selected' : '') + '>' +
            F.esc(x.nama) + (x.nidn ? ' (NIDN: ' + F.esc(x.nidn) + ')' : '') + '</option>';
        }).join('');
      }

      var isi =
        '<div class="tabs mb2" style="background:var(--surface);border:1px solid var(--line);border-radius:12px" id="sd-tabs">' +
        '<button class="tab active" data-tab="daftar">' + ik('file', 14) + ' Pendaftaran</button>' +
        '<button class="tab" data-tab="skl">' + ik('award', 14) + ' Unduh SKL</button>' +
        '<button class="tab" data-tab="revisi">' + ik('edit', 14) + ' Revisi Skripsi</button>' +
        '</div>';

      /* Tab pendaftaran */
      isi += '<div data-panel="daftar">';
      if (jadwal && jadwal.tanggalJadwal) {
        isi += '<div style="background:linear-gradient(135deg,#0D1B33,#1B2A4A);color:#fff;border-radius:16px;padding:18px" class="mb2">' +
          '<span class="badge badge-orange mb1">Terjadwal • TA ' + F.esc(d.profil.tahunAkademik) + '</span>' +
          '<div style="font-size:18px;font-weight:800;margin:6px 0 10px">Jadwal Sidang Skripsi Telah Ditetapkan</div>' +
          '<div style="display:grid;gap:6px;font-size:13.5px">' +
          '<div>' + ik('calendar', 15) + ' ' + F.hari(jadwal.tanggalJadwal) + ', ' + F.tgl(jadwal.tanggalJadwal) + '</div>' +
          '<div>' + ik('clock', 15) + ' Pukul ' + F.esc(jadwal.jamJadwal + (jadwal.jamSelesai ? ' – ' + jadwal.jamSelesai : '')) + ' WIB</div>' +
          '<div>' + ik('building', 15) + ' ' + F.esc(jadwal.ruang) + '</div>' +
          (jadwal.penguji1 ? '<div>' + ik('users', 15) + ' Penguji: ' + F.esc([jadwal.penguji1, jadwal.penguji2, jadwal.penguji3].filter(Boolean).join(' • ')) + '</div>' : '') +
          '</div></div>';
      }
      if (daftar) {
        isi += '<div class="card"><div class="card-head"><div><h3>Pendaftaran Sidang Skripsi</h3>' +
          '<div class="sub">Diajukan ' + F.tgl(daftar.tanggalAjukan) + '</div></div>' + F.statusBadge(daftar.status) + '</div>' +
          '<div class="card-body"><dl class="kv">' +
          '<dt>Judul Skripsi</dt><dd>' + F.esc(daftar.data.judul || '-') + '</dd>' +
          '<dt>Tempat, Tgl. Lahir</dt><dd>' + F.esc(daftar.data.tempatLahir || '-') + ', ' + F.tgl(daftar.data.tanggalLahir) + '</dd>' +
          '<dt>No. WhatsApp</dt><dd class="mono">' + F.esc(daftar.data.noWa || '-') + '</dd>' +
          (jadwal && jadwal.penguji1 ? '<dt>Penguji 1</dt><dd>' + F.esc(jadwal.penguji1) + '</dd>' +
            '<dt>Penguji 2</dt><dd>' + F.esc(jadwal.penguji2 || '-') + '</dd>' +
            '<dt>Penguji 3</dt><dd>' + F.esc(jadwal.penguji3 || '-') + '</dd>' : '') +
          (daftar.status === 'DISETUJUI' && !(jadwal && jadwal.tanggalJadwal)
            ? '<div class="notice mt2">' + ik('clock', 17) + '<span>Menunggu BAAK menetapkan jadwal &amp; penguji sidang.</span></div>' : '') +
          '</dl>' +
          '<div class="tiny muted mt2">' + ik('printer', 12) + ' Formulir pendaftaran sidang skripsi tersedia di menu ' +
          '<a href="#" data-nav="mhsview" data-view="formulir">Formulir Siap Cetak</a>.</div>' +
          (dokDaftar.length ? '<div class="mt2" data-dok-daftar>' + S.Dok.daftar(dokDaftar, true) + '</div>' : '') +
          '<div class="row-wrap mt2">' +
          (daftar.status === 'MENUNGGU' ? '<button class="btn btn-danger btn-sm" data-batal="' + F.esc(daftar.id) + '">Batalkan</button>' : '') +
          '</div></div></div>';
      } else {
        isi += M.catatanTolak('SIDANG') +
          '<div class="card card-accent"><div class="card-head"><div><h3>Pendaftaran Sidang Skripsi</h3>' +
          '<div class="sub">Pastikan naskah telah disetujui dosen pembimbing</div></div></div><div class="card-body">' +
          M.kartuPemohon('Pendaftar') +
          '<div class="field"><label for="sd-judul">Judul Skripsi <span class="req">*</span></label>' +
          '<textarea class="textarea" id="sd-judul" maxlength="300" placeholder="Judul skripsi sesuai naskah yang disetujui pembimbing"></textarea></div>' +
          '<div class="grid-2">' +
          '<div class="field"><label for="sd-tl">Tempat Lahir <span class="req">*</span></label>' +
          '<input class="input" id="sd-tl" maxlength="60" placeholder="Contoh: Bogor"></div>' +
          '<div class="field"><label for="sd-tgl">Tanggal Lahir <span class="req">*</span></label>' +
          '<input class="input" id="sd-tgl" type="date"></div></div>' +
          '<div class="grid-2">' +
          '<div class="field"><label for="sd-wa">No. WhatsApp Aktif <span class="req">*</span></label>' +
          '<input class="input mono" id="sd-wa" inputmode="numeric" maxlength="15" placeholder="08xxxxxxxxxx" value="' + F.esc(d.profil.noWa || '') + '"></div>' +
          '<div class="field"><label for="sd-ipk">IPK Sementara <span class="muted">(opsional)</span></label>' +
          '<input class="input mono" id="sd-ipk" maxlength="5" placeholder="Contoh: 3.82"></div></div>' +
          '<div class="notice mt1 mb2">' + ik('info', 17) +
          '<span>Data tempat &amp; tanggal lahir dipakai untuk penerbitan Surat Keterangan Lulus (SKL) — isi sesuai akta/KTP.</span></div>' +
          M.blokDinamis('SIDANG', ['judul', 'no_wa', 'tempat_lahir', 'tanggal_lahir', 'ipk']) +
          '<button class="btn btn-primary btn-block btn-lg" id="sd-kirim">' + ik('send', 16) + 'Daftar Sidang Skripsi</button>' +
          '</div></div>';
      }
      isi += '</div>';

      /* Tab revisi skripsi */
      isi += '<div data-panel="revisi" class="hidden">';
      if (!daftar || daftar.status !== 'DISETUJUI') {
        isi += '<div class="card"><div class="card-body">' +
          UI.kosong('Belum Dapat Diisi', 'Formulir Pernyataan Revisi Skripsi terbuka setelah pendaftaran sidang disetujui BAAK.', 'lock') +
          '</div></div>';
      } else if (revisi) {
        isi += '<div class="card"><div class="card-head"><div><h3>Pernyataan Revisi Skripsi</h3>' +
          '<div class="sub">Diajukan ' + F.tgl(revisi.tanggalAjukan) + '</div></div>' + F.statusBadge(revisi.status) + '</div>' +
          '<div class="card-body"><dl class="kv">' +
          '<dt>Judul Final</dt><dd>' + F.esc(revisi.data.judulFinal || '-') + '</dd>' +
          '<dt>Tanggal ACC</dt><dd>' + F.tgl(revisi.data.tanggalAcc) + '</dd>' +
          '<dt>Penguji 1</dt><dd>' + F.esc(revisi.data.penguji1 || '-') + '</dd>' +
          '<dt>Penguji 2</dt><dd>' + F.esc(revisi.data.penguji2 || '-') + '</dd>' +
          '<dt>Penguji 3</dt><dd>' + F.esc(revisi.data.penguji3 || '-') + '</dd></dl>' +
          (revisi.status === 'DISETUJUI'
            ? '<div class="notice ok mt2">' + ik('checkCircle', 17) + '<span>Formulir Pernyataan Penyerahan Skripsi dan Bebas Perpustakaan telah terbit. ' +
              'Menu <b>Administrasi Kelulusan</b> kini terbuka.</span></div>' +
              (revisi.dokumen && revisi.dokumen.length ? '<div class="mt2" data-dok-revisi>' + S.Dok.daftar(revisi.dokumen) + '</div>' : '')
            : '') +
          '</div></div>';
      } else {
        isi += M.catatanTolak('REVISI_SIDANG') +
          '<div class="card card-accent"><div class="card-head"><div><h3>Revisi Skripsi</h3>' +
          '<div class="sub">Finalisasi naskah pasca-sidang — lengkapi seluruh isian &amp; berkas</div></div></div><div class="card-body">' +
          M.judulBagian(1, 'Data Skripsi Final') +
          '<div class="field"><label for="rk-judul">Judul Skripsi Final <span class="req">*</span></label>' +
          '<textarea class="textarea" id="rk-judul" maxlength="300">' + F.esc(daftar.data.judul || '') + '</textarea></div>' +
          '<div class="field"><label for="rk-acc">Tanggal ACC Pengesahan Skripsi <span class="req">*</span></label>' +
          '<input class="input" id="rk-acc" type="date"></div>' +
          M.judulBagian(2, 'Dewan Penguji Sidang Skripsi') +
          '<div class="field"><label for="rk-p1">Penguji 1 <span class="req">*</span></label>' +
          '<select class="select" id="rk-p1">' + opsiDosen(idDariNama(jadwal && jadwal.penguji1)) + '</select></div>' +
          '<div class="field"><label for="rk-p2">Penguji 2 <span class="req">*</span></label>' +
          '<select class="select" id="rk-p2">' + opsiDosen(idDariNama(jadwal && jadwal.penguji2)) + '</select></div>' +
          '<div class="field"><label for="rk-p3">Penguji 3 <span class="req">*</span></label>' +
          '<select class="select" id="rk-p3">' + opsiDosen(idDariNama(jadwal && jadwal.penguji3)) + '</select></div>' +
          M.judulBagian(3, 'Berkas Revisi') +
          M.kotakUnggah('rk-skripsi', 'Skripsi Final', 'Unggah naskah Skripsi Final (PDF)', true) +
          M.kotakUnggah('rk-upload', 'Lembar Revisi Skripsi', 'Unggah Lembar Revisi yang sudah ditandatangani penguji', true) +
          '<button class="btn btn-primary btn-block btn-lg mt2" id="rk-kirim">' + ik('send', 16) + 'Kirim Revisi Skripsi</button>' +
          '</div></div>';
      }
      isi += '</div>';

      /* Tab SKL — tampil setelah BAAK menekan "Kirim ke akun mahasiswa" */
      isi += '<div data-panel="skl" class="hidden">';
      // v3.3: SKL & Lembar Pengesahan Skripsi — tampil setelah BAAK menekan "Kirim ke Mahasiswa".
      var dokSkl = ((daftar && daftar.dokumen) || []).filter(function (x) { return KODE_SKL.indexOf(x.kode) >= 0; })
        .sort(function (a, b) { return KODE_SKL.indexOf(a.kode) - KODE_SKL.indexOf(b.kode); });
      var sklSiap = dokSkl.length > 0;
      isi += '<div class="card"><div class="card-head"><div><h3>Surat Keterangan Lulus &amp; Lembar Pengesahan</h3>' +
        '<div class="sub">Dokumen resmi pengganti ijazah sementara</div></div>' +
        (sklSiap ? '<span class="badge badge-green">Sah &amp; Dapat Dicetak</span>' : '<span class="badge badge-gray">Belum Terbit</span>') + '</div>' +
        '<div class="card-body">' +
        (sklSiap
          ? '<dl class="kv mb2">' + (dokSkl[0].kode === 'SKL' ? '<dt>Nomor SKL</dt><dd class="mono">' + F.esc(dokSkl[0].nomor || '-') + '</dd>' : '') +
          '<dt>Judul Skripsi</dt><dd>' + F.esc((revisi && revisi.data.judulFinal) || daftar.data.judul || '-') + '</dd>' +
          (jadwal && jadwal.ipk ? '<dt>IPK / Predikat</dt><dd>' + F.esc(jadwal.ipk) + (jadwal.predikat ? ' — ' + F.esc(jadwal.predikat) : '') + '</dd>' : '') +
          '<dt>Tanggal Terbit</dt><dd>' + F.tgl(dokSkl[0].tanggal) + '</dd>' +
          '<dt>Verifikasi</dt><dd><span class="badge badge-green">' + ik('qr', 12) + ' QR-Code Aktif</span></dd></dl>' +
          '<div data-dok-skl>' + S.Dok.daftar(dokSkl) + '</div>' +
          '<div class="tiny muted center mt1">Keaslian dokumen dapat diperiksa siapa pun melalui menu Cek Keaslian Dokumen di halaman depan.</div>'
          : UI.kosong('SKL Belum Terbit',
            'SKL & Lembar Pengesahan Skripsi dikirim BAAK ke akun Anda setelah IPK & predikat kelulusan ditetapkan.', 'award')) +
        '</div></div>';
      isi += '</div>';

      var el = document.getElementById('mhsview-sidang');
      el.innerHTML = M.kerangka('sidang', 'Skripsi',
        'Pendaftaran sidang skripsi, unduh SKL, dan revisi skripsi.', isi);
      M.pasangAksiUmum(el);
      S.Dok.pasang(el.querySelector('[data-dok-skl]'), dokSkl);
      S.Dok.pasang(el.querySelector('[data-dok-daftar]'), dokDaftar);
      S.Dok.pasang(el.querySelector('[data-dok-revisi]'), (revisi && revisi.dokumen) || []);
      if (!el.querySelector('#sd-tabs')) return;

      M.pasangTab(el, 'sd-tabs');

      var bd = el.querySelector('#sd-kirim');
      if (bd) {
        M.kunciKirim(el, bd, function () {
          var v = function (id) { return el.querySelector(id).value.trim(); };
          return [v('#sd-judul').length < 10 ? 'Judul skripsi (min. 10 karakter)' : '', !v('#sd-tl') ? 'Tempat lahir' : '',
            !v('#sd-tgl') ? 'Tanggal lahir' : '', v('#sd-wa').replace(/\D/g, '').length < 9 ? 'No. WhatsApp' : '']
            .concat(M.kurangDinamis(el, 'SIDANG', ['judul', 'no_wa', 'tempat_lahir', 'tanggal_lahir', 'ipk']));
        });
        bd.onclick = function (ev) {
          var dynD = M.ambilDinamis(el, 'SIDANG', ['judul', 'no_wa', 'tempat_lahir', 'tanggal_lahir', 'ipk']);
          if (dynD.error) return UI.toast(dynD.error, 'error');
          var data = {
            judul: el.querySelector('#sd-judul').value.trim(),
            tempatLahir: el.querySelector('#sd-tl').value.trim(),
            tanggalLahir: el.querySelector('#sd-tgl').value,
            noWa: el.querySelector('#sd-wa').value.trim(),
            ipk: el.querySelector('#sd-ipk').value.trim(),
            _dinamis: dynD.nilai
          };
          if (data.judul.length < 10) return UI.toast('Judul skripsi minimal 10 karakter.', 'error');
          if (!data.tempatLahir) return UI.toast('Tempat lahir wajib diisi.', 'error');
          if (!data.tanggalLahir) return UI.toast('Tanggal lahir wajib diisi.', 'error');
          if (!data.noWa) return UI.toast('Nomor WhatsApp wajib diisi.', 'error');
          M.ajukan('SIDANG', data, ev.currentTarget);
        };
      }

      var br = el.querySelector('#rk-kirim');
      if (br) {
        var ung = S.pasangUnggah(el.querySelector('#rk-upload'), { kategori: 'sidang' });
        var ungSk = S.pasangUnggah(el.querySelector('#rk-skripsi'), { kategori: 'skripsi' });
        M.kunciKirim(el, br, function () {
          var v = function (id) { return el.querySelector(id).value.trim(); };
          var p = [v('#rk-p1'), v('#rk-p2'), v('#rk-p3')];
          return [v('#rk-judul').length < 10 ? 'Judul final (min. 10 karakter)' : '', !v('#rk-acc') ? 'Tanggal ACC' : '',
            !p[0] ? 'Penguji 1' : '', !p[1] ? 'Penguji 2' : '', !p[2] ? 'Penguji 3' : '',
            (p[0] && p[1] && p[2] && (p[0] === p[1] || p[0] === p[2] || p[1] === p[2])) ? 'Tiga penguji yang berbeda' : '',
            M.kurangUnggah(ungSk, 'Skripsi Final'), M.kurangUnggah(ung, 'Lembar Revisi Skripsi')];
        });
        br.onclick = function (ev) {
          var data = {
            judulFinal: el.querySelector('#rk-judul').value.trim(),
            tanggalAcc: el.querySelector('#rk-acc').value,
            penguji1Id: el.querySelector('#rk-p1').value,
            penguji2Id: el.querySelector('#rk-p2').value,
            penguji3Id: el.querySelector('#rk-p3').value,
            lembarFileId: ung.fileId, lembarUrl: ung.url,
            skripsiFileId: ungSk.fileId, skripsiUrl: ungSk.url
          };
          if (ung.sedang || ungSk.sedang) return UI.toast('Tunggu proses unggah berkas selesai.', 'warn');
          if (!ungSk.fileId) return UI.toast('Unggah berkas Skripsi Final terlebih dahulu.', 'error');
          if (!ung.fileId) return UI.toast('Unggah Lembar Revisi Skripsi terlebih dahulu.', 'error');
          if (data.judulFinal.length < 10) return UI.toast('Judul skripsi final minimal 10 karakter.', 'error');
          if (!data.tanggalAcc) return UI.toast('Tanggal ACC pengesahan wajib diisi.', 'error');
          if (!data.penguji1Id || !data.penguji2Id || !data.penguji3Id) return UI.toast('Penguji 1, 2, dan 3 wajib dipilih.', 'error');
          M.ajukan('REVISI_SIDANG', data, ev.currentTarget);
        };
      }
    },

    /* ==================================================================
       7. ADMINISTRASI KELULUSAN (3 TAHAP)
       ================================================================== */

    renderKelulusan: function () {
      var k = M.D.kelulusan;
      var isi;
      var dokKl = M.D.dokumenKelulusan || [];
      var dokPenyerahan = dokKl.filter(function (x) { return x.kode === 'F_PENYERAHAN_SKRIPSI'; });
      var dokKartu = dokKl.filter(function (x) { return x.kode === 'F_PENGAMBILAN_IJAZAH'; });

      if (!k) {
        isi = '<div class="card"><div class="card-body">' +
          UI.kosong('Menu Terkunci',
            'Isi terlebih dahulu formulir Pernyataan Revisi Skripsi pada menu Sidang Skripsi.', 'lock') +
          '<div class="center"><button class="btn btn-primary" data-nav="mhsview" data-view="sidang">Buka Menu Sidang Skripsi</button></div>' +
          '</div></div>';
      } else {
        var t1 = k.tahap1Status || 'BELUM';
        var t2 = (!k.tahap2Status || k.tahap2Status === 'TERKUNCI') ? 'BELUM' : k.tahap2Status;
        var t3 = k.tahap3Status || 'BELUM';
        var bisa1 = t1 === 'BELUM' || t1 === 'REVISI';
        var bisa2 = t2 === 'BELUM' || t2 === 'REVISI';
        var selesai = t3 === 'SIAP';

        function labelSt(st) {
          return st === 'DISETUJUI' ? 'Selesai' : (st === 'MENUNGGU' ? 'Terkirim' : (st === 'REVISI' ? 'Perlu revisi' : (st === 'SIAP' ? 'Siap' : 'Perlu diisi')));
        }
        function badgeKirim(st) {
          if (st === 'MENUNGGU') return '<span class="badge badge-blue"><span class="dot"></span>Terkirim</span>';
          return F.statusBadge(st);
        }

        isi =
          '<div class="steps mb3">' +
          [['Tahap 1', t1], ['Tahap 2', t2], ['Tahap 3 · ACC BAAK', selesai ? 'SIAP' : (t3 === 'MENUNGGU' ? 'MENUNGGU' : 'BELUM')]].map(function (x, i) {
            var st = x[1];
            var cls = (st === 'DISETUJUI' || st === 'SIAP') ? 'done' : ((st === 'MENUNGGU' && i < 2) ? 'done' : 'now');
            if (i === 2 && st === 'BELUM') cls = '';
            return '<div class="step ' + cls + '"><div class="cir">' + (cls === 'done' ? ik('check', 14, 2.6) : (i + 1)) + '</div>' +
              '<div class="st">' + x[0] + '</div><div class="sd">' +
              (i === 2 ? (st === 'SIAP' ? 'Di-ACC' : (st === 'MENUNGGU' ? 'Menunggu ACC' : 'Setelah tahap 1 & 2')) : labelSt(st)) + '</div></div>';
          }).join('') + '</div>' +

          (!selesai && (bisa1 || bisa2)
            ? '<div class="notice mb2">' + ik('info', 17) + '<span>Isi <b>Tahap 1 dan Tahap 2 sekaligus</b>, lalu kirim. ' +
              'BAAK cukup melakukan ACC satu kali pada Tahap 3.</span></div>' : '') +

          /* Tahap 1 */
          '<div class="tahap ' + (bisa1 ? 'now' : 'done') + '"><div class="tahap-h">' +
          '<div class="tahap-n">' + (bisa1 ? '1' : ik('check', 14, 2.6)) + '</div>' +
          '<div class="grow"><div class="bold">Penyerahan Skripsi &amp; Bebas Perpustakaan</div>' +
          '<div class="tiny muted">Bukti penyerahan naskah hardcover &amp; surat bebas pinjaman perpustakaan</div></div>' +
          badgeKirim(t1) + '</div>' +
          '<div class="tahap-b">' +
          '<dl class="kv mb2"><dt>Judul Naskah</dt><dd>' + F.esc(k.judulFinal || '-') + '</dd></dl>' +
          (dokPenyerahan.length
            ? '<div class="mb2" data-dok-penyerahan><div class="tiny muted mb1">Formulir untuk ditandatangani perpustakaan:</div>' + S.Dok.daftar(dokPenyerahan, true) + '</div>' : '') +
          (t1 === 'REVISI' ? '<div class="notice danger mb2">' + ik('alert', 17) + '<span><b>Catatan BAAK:</b> ' + F.esc(k.tahap1Catatan || '-') + '</span></div>' : '') +
          (bisa1 && !selesai
            ? M.kotakUnggahTahap(1)
            : '<div class="notice ok">' + ik('checkCircle', 17) + '<span>Berkas Tahap 1 ' + (t1 === 'DISETUJUI' ? 'disetujui BAAK' : 'terkirim') +
              (k.tahap1Url ? ' — <a href="#" data-berkas="' + F.esc(k.tahap1Url) + '" data-berkas-nama="Berkas Tahap 1">lihat berkas</a>' : '') + '.</span></div>') +
          '</div></div>' +

          /* Tahap 2 */
          '<div class="tahap ' + (bisa2 ? 'now' : 'done') + '"><div class="tahap-h">' +
          '<div class="tahap-n">' + (bisa2 ? '2' : ik('check', 14, 2.6)) + '</div>' +
          '<div class="grow"><div class="bold">Publikasi Jurnal Ilmiah / LOA</div>' +
          '<div class="tiny muted">Wajib SINTA 1–6 atau prosiding nasional terindeks</div></div>' +
          badgeKirim(t2) + '</div>' +
          '<div class="tahap-b">' +
          (t2 === 'REVISI' ? '<div class="notice danger mb2">' + ik('alert', 17) + '<span><b>Catatan BAAK:</b> ' + F.esc(k.tahap2Catatan || '-') + '</span></div>' : '') +
          (bisa2 && !selesai
            ? M.kotakUnggahTahap(2)
            : '<dl class="kv"><dt>Jurnal / Penerbit</dt><dd>' + F.esc(k.tahap2Jurnal || '-') + '</dd>' +
              (k.tahap2Link ? '<dt>Tautan Publikasi</dt><dd><a href="' + F.esc(k.tahap2Link) + '" target="_blank" rel="noopener">' + F.esc(k.tahap2Link) + '</a></dd>' : '') +
              '</dl>') +
          '</div></div>' +

          (!selesai && (bisa1 || bisa2)
            ? '<button class="btn btn-primary btn-block btn-lg mb3" id="kl-kirim">' + ik('send', 16) +
              (bisa1 && bisa2 ? 'Kirim Berkas Tahap 1 &amp; 2' : 'Kirim Perbaikan Tahap ' + (bisa1 ? '1' : '2')) + '</button>' : '') +

          /* Tahap 3 */
          '<div class="tahap ' + (selesai ? 'done' : (t3 === 'MENUNGGU' ? 'now' : 'locked')) + '"><div class="tahap-h">' +
          '<div class="tahap-n">' + (selesai ? ik('check', 14, 2.6) : '3') + '</div>' +
          '<div class="grow"><div class="bold">ACC BAAK &amp; Lembar Pengambilan Ijazah</div>' +
          '<div class="tiny muted">Satu kali verifikasi BAAK atas berkas Tahap 1 &amp; 2</div></div>' +
          (selesai ? F.statusBadge('SIAP') : (t3 === 'MENUNGGU' ? F.statusBadge('MENUNGGU') : F.statusBadge('TERKUNCI'))) + '</div>' +
          '<div class="tahap-b">' +
          (selesai
            ? '<div class="notice ok mb2">' + ik('award', 17) + '<span>Selamat! Seluruh persyaratan administrasi kelulusan Anda telah lengkap.</span></div>' +
              (dokKartu.length
                ? '<div data-dok-kartu>' + S.Dok.daftar(dokKartu) + '</div>'
                : (k.kartuFileId
                  ? '<div class="row-wrap"><button class="btn btn-ghost grow" id="kl-pv-kartu">' + ik('eye', 16) + 'Pratinjau</button>' +
                    '<button class="btn btn-primary grow" id="kl-dl-kartu">' + ik('download', 16) + 'Unduh Lembar Pengambilan Ijazah</button></div>'
                  : '<div class="notice warn">' + ik('clock', 17) + '<span>Lembar Pengambilan Ijazah sedang dibuat sistem. Muat ulang dalam beberapa saat.</span></div>'))
            : (t3 === 'MENUNGGU'
              ? '<div class="notice warn">' + ik('clock', 17) + '<span>Berkas Tahap 1 &amp; 2 sedang diperiksa BAAK. Estimasi 1–2 hari kerja.</span></div>'
              : '<div class="notice">' + ik('lock', 17) + '<span>Terbuka setelah berkas Tahap 1 dan Tahap 2 dikirim.</span></div>')) +
          '</div></div>';
      }

      var el = document.getElementById('mhsview-kelulusan');
      el.innerHTML = M.kerangka('kelulusan', 'Administrasi Kelulusan',
        'Kirim berkas Tahap 1 & 2 sekaligus, lalu BAAK melakukan ACC pada Tahap 3 untuk penerbitan Lembar Pengambilan Ijazah.', isi);
      M.pasangAksiUmum(el);
      S.Dok.pasang(el.querySelector('[data-dok-penyerahan]'), dokPenyerahan);
      S.Dok.pasang(el.querySelector('[data-dok-kartu]'), dokKartu);
      if (!k) return;

      var pvKartu = el.querySelector('#kl-pv-kartu');
      var dlKartu = el.querySelector('#kl-dl-kartu');
      if (pvKartu || dlKartu) {
        var dk = {
          nama: 'Lembar Pengambilan Ijazah', fileId: k.kartuFileId, url: k.kartuUrl,
          pratinjau: 'https://drive.google.com/file/d/' + k.kartuFileId + '/preview',
          unduh: 'https://drive.google.com/uc?export=download&id=' + k.kartuFileId
        };
        if (pvKartu) pvKartu.onclick = function () { S.Dok.pratinjau(dk); };
        if (dlKartu) dlKartu.onclick = function () { S.Dok.unduh(dk); };
      }

      var ung = {};
      [1, 2].forEach(function (n) {
        var box = el.querySelector('#kl-upload-' + n);
        if (box) ung[n] = S.pasangUnggah(box, { kategori: 'kelulusan' });
      });
      var kirim = el.querySelector('#kl-kirim');
      if (!kirim) return;
      M.kunciKirim(el, kirim, function () {
        var j = el.querySelector('#kl-jurnal');
        return [ung[1] ? M.kurangUnggah(ung[1], 'Berkas Tahap 1') : '',
          ung[2] && j && !j.value.trim() ? 'Nama jurnal' : '',
          ung[2] ? M.kurangUnggah(ung[2], 'LOA / bukti publikasi') : ''];
      });
      kirim.onclick = function (ev) {
        var data = {};
        if (ung[1]) {
          if (ung[1].sedang) return UI.toast('Tunggu proses unggah Tahap 1 selesai.', 'warn');
          if (!ung[1].fileId) return UI.toast('Tahap 1: unggah bukti penyerahan skripsi & bebas perpustakaan.', 'error');
          data.tahap1 = { fileId: ung[1].fileId, fileUrl: ung[1].url };
        }
        if (ung[2]) {
          var jurnal = el.querySelector('#kl-jurnal').value.trim();
          if (!jurnal) return UI.toast('Tahap 2: nama jurnal / lembaga penerbit wajib diisi.', 'error');
          if (ung[2].sedang) return UI.toast('Tunggu proses unggah Tahap 2 selesai.', 'warn');
          if (!ung[2].fileId) return UI.toast('Tahap 2: unggah LOA atau bukti publikasi.', 'error');
          data.tahap2 = { jurnal: jurnal, link: el.querySelector('#kl-link').value.trim(), fileId: ung[2].fileId, fileUrl: ung[2].url };
        }
        var btn = ev.currentTarget;
        UI.sibuk(btn, true, 'Mengirim…');
        API.kirim('simpanKelulusan', data).then(function (r) {
          UI.sibuk(btn, false);
          if (!r.success) return UI.toast(r.message, 'error');
          // Optimistic: status lokal langsung berubah tanpa menunggu muat ulang.
          for (var key in r.data) if (key !== 'nim') M.D.kelulusan[key] = r.data[key];
          M.kotor.kelulusan = true; M.render('kelulusan');
          UI.toast(r.message, 'ok');
          M.muat(false);
        });
      };
    },

    kotakUnggahTahap: function (n) {
      var judul = n === 1 ? 'Unggah Bukti Penyerahan Skripsi &amp; Bebas Perpustakaan' : 'Unggah Letter of Acceptance (LOA) / Bukti Publikasi';
      return (n === 2
        ? '<div class="grid-2"><div class="field"><label for="kl-jurnal">Nama Jurnal / Lembaga Penerbit <span class="req">*</span></label>' +
        '<input class="input" id="kl-jurnal" maxlength="150" placeholder="Contoh: Jurnal Ekonomi & Perbankan Syariah (JEPS) — Sinta 3"></div>' +
        '<div class="field"><label for="kl-link">Tautan Publikasi / DOI <span class="muted">(opsional)</span></label>' +
        '<input class="input" id="kl-link" maxlength="300" placeholder="https://doi.org/..."></div></div>'
        : '') +
        '<div class="upload" id="kl-upload-' + n + '"><input type="file" accept=".pdf,.jpg,.jpeg,.png">' +
        '<div data-info><div style="color:var(--orange-600);line-height:0;margin-bottom:6px">' + ik('upload', 24) + '</div>' +
        '<div class="upload-name">' + judul + '</div>' +
        '<div class="tiny muted">PDF atau gambar hasil pindai • maksimal ' + S.CFG.MAKS_UNGGAH_MB + ' MB</div></div></div>';
    },

    /* ==================================================================
       8. PERBAIKAN NILAI
       ================================================================== */

    renderPerbaikanNilai: function () {
      var d = M.D;
      var A = d.aturan || { nilaiMin: 50, nilaiMaks: 69.99, pengecualian: [], biaya: 100000, rekening: '', butir: [], maksMk: 0 };
      var batas = A.nilaiMin;
      var batasAtas = A.nilaiMaks;
      var kecuali = A.pengecualian || [];
      var ikonButir = ['checkCircle', 'xCircle', 'info', 'alert', 'shield', 'file'];
      var warnaButir = ['var(--green-600)', 'var(--red-600)', 'var(--blue-600)', 'var(--amber-600)', 'var(--navy-600)', 'var(--text-3)'];

      var isi =
        '<div class="card mb2" style="border-left:3px solid var(--orange-500)"><div class="card-body">' +
        '<div class="between mb1"><h3 style="font-size:15px">Aturan Akademik Remedial</h3>' +
        '<span class="badge badge-orange">Wajib Dipahami</span></div>' +
        '<div style="display:grid;gap:8px;font-size:13.3px;color:var(--text-2)">' +
        (A.butir && A.butir.length
          ? A.butir.map(function (b, i) {
            return '<div class="row"><span style="color:' + warnaButir[i % warnaButir.length] + ';line-height:0">' +
              ik(ikonButir[i % ikonButir.length], 17) + '</span><span>' + F.esc(b) + '</span></div>';
          }).join('')
          : '<div class="row"><span style="color:var(--green-600);line-height:0">' + ik('checkCircle', 17) + '</span>' +
          '<span>Nilai yang dapat diperbaiki berada pada rentang <b>' + batas + ' – ' + batasAtas + '</b>.</span></div>') +
        '</div>' +
        '<label class="check mt2" style="background:var(--orange-50);border:1px solid #FBD9C0;padding:12px;border-radius:10px">' +
        '<input type="checkbox" id="pv-setuju">' +
        '<span>' + F.esc(A.pernyataan || 'Saya menyetujui tata tertib perbaikan nilai.') + '</span></label>' +
        '<div class="tiny muted mt1">' + ik('settings', 12) +
        ' Seluruh butir aturan di atas dikelola BAAK dari menu Pengaturan — tidak ditanam di dalam kode.</div>' +
        '</div></div>' +

        '<div class="card card-accent" id="pv-form" style="opacity:.5;pointer-events:none">' +
        '<div class="card-head"><div><h3>Detail Mata Kuliah Remedial</h3>' +
        '<div class="sub">Lengkapi setelah mencentang pernyataan di atas</div></div></div><div class="card-body">' +

        '<div class="grid-2">' +
        '<div class="field"><label for="pv-mk">Mata Kuliah yang Diperbaiki <span class="req">*</span></label>' +
        '<input class="input" id="pv-mk" maxlength="120" placeholder="Contoh: Fiqh Muamalah Kontemporer"></div>' +
        '<div class="field"><label for="pv-sks">Jumlah SKS <span class="muted">(opsional)</span></label>' +
        '<input class="input" id="pv-sks" inputmode="numeric" maxlength="2" placeholder="3"></div></div>' +

        '<div class="field"><label for="pv-dosen">Dosen Pengampu Terkait <span class="req">*</span></label>' +
        '<select class="select" id="pv-dosen"><option value="">— Pilih dosen pengampu —</option>' +
        (d.dosen || []).map(function (x) {
          return '<option value="' + F.esc(x.id) + '">' + F.esc(x.nama) +
            (x.kategori === 'NIDN' && x.nidn ? ' (NIDN: ' + F.esc(x.nidn) + ')' : ' (Dosen Umum)') + '</option>';
        }).join('') + '</select>' +
        '<div class="hint">Seluruh dosen — NIDN maupun Umum — dapat dipilih pada formulir ini.</div></div>' +

        '<div class="field"><label for="pv-nilai">Nilai Angka Saat Ini <span class="req">*</span>' +
        '<span class="muted" style="float:right;font-weight:600">Skala 0–100</span></label>' +
        '<input class="input mono" id="pv-nilai" inputmode="decimal" maxlength="6" placeholder="Contoh: 58">' +
        '<div id="pv-cek"></div></div>' +

        '<h4 style="font-size:14px;margin:20px 0 10px">Biaya &amp; Administrasi</h4>' +
        '<div class="mini-stat mb2">' +
        '<div class="ms"><div class="l">Biaya per Mata Kuliah</div><div class="v">' + F.rupiah(A.biaya) + '</div></div>' +
        '<div class="ms"><div class="l">Rekening Tujuan</div><div class="v" style="font-size:12.5px">' + F.esc(A.rekening || '-') + '</div></div>' +
        (A.maksMk ? '<div class="ms"><div class="l">Batas per Semester</div><div class="v">' + A.maksMk + ' mata kuliah</div></div>' : '') +
        '<div class="ms"><div class="l">Rentang Nilai</div><div class="v">' + batas + ' – ' + batasAtas + '</div></div>' +
        '</div>' +

        '<div class="field"><label>Bukti Pembayaran / Transfer <span class="req">*</span></label>' +
        '<div class="upload" id="pv-upload"><input type="file" accept=".pdf,.jpg,.jpeg,.png">' +
        '<div data-info><div style="color:var(--orange-600);line-height:0;margin-bottom:6px">' + ik('upload', 24) + '</div>' +
        '<div class="upload-name">Unggah Bukti Transfer</div>' +
        '<div class="tiny muted">JPG, PNG, atau PDF • maksimal ' + S.CFG.MAKS_UNGGAH_MB + ' MB</div></div></div></div>' +

        '<div class="field"><label for="pv-catatan">Catatan / Keterangan Tambahan <span class="muted">(opsional)</span></label>' +
        '<textarea class="textarea" id="pv-catatan" maxlength="500" placeholder="Tuliskan kendala akademik atau jadwal remedial yang diajukan bersama dosen pengampu…"></textarea></div>' +

        '<button class="btn btn-primary btn-block btn-lg mt1" id="pv-kirim">' + ik('send', 16) + 'Kirim Permohonan Perbaikan Nilai</button>' +
        '<div class="tiny muted center mt1">Formulir resmi diterbitkan BAAK dan dapat diunduh pada menu Riwayat Pengajuan.</div>' +
        '</div></div>' +

        M.daftarSebelumnya('PERBAIKAN_NILAI', 'Riwayat Perbaikan Nilai');

      var el = document.getElementById('mhsview-perbaikan_nilai');
      el.innerHTML = M.kerangka('perbaikan_nilai', 'Formulir Perbaikan Nilai (Remedial)',
        'Pengajuan ujian perbaikan nilai mata kuliah sesuai ketentuan akademik PRD Bab 5.A.7.', isi);
      M.pasangAksiUmum(el);
      if (!el.querySelector('#pv-kirim')) return;

      var form = el.querySelector('#pv-form');
      el.querySelector('#pv-setuju').onchange = function () {
        form.style.opacity = this.checked ? '1' : '.5';
        form.style.pointerEvents = this.checked ? 'auto' : 'none';
      };

      var nilaiEl = el.querySelector('#pv-nilai');
      var cekEl = el.querySelector('#pv-cek');
      var mkEl = el.querySelector('#pv-mk');

      function periksaNilai() {
        var teks = nilaiEl.value.trim();
        if (!teks) { cekEl.innerHTML = ''; return; }
        if (!/^\d+([.,]\d+)?$/.test(teks)) {
          cekEl.innerHTML = '<div class="err">' + ik('xCircle', 13) + ' Nilai harus berupa angka, bukan huruf.</div>';
          nilaiEl.classList.add('is-error');
          return;
        }
        nilaiEl.classList.remove('is-error');
        var n = parseFloat(teks.replace(',', '.'));
        var mk = mkEl.value.toLowerCase();
        var dikecualikan = kecuali.some(function (x) { return x && mk.indexOf(String(x).toLowerCase()) >= 0; });

        if (n > 100) {
          cekEl.innerHTML = '<div class="err">' + ik('xCircle', 13) + ' Nilai maksimal 100.</div>';
        } else if (n < batas && !dikecualikan) {
          cekEl.innerHTML = '<div class="notice danger mt1" style="font-size:12.5px">' + ik('alert', 16) +
            '<span><b>Ditolak otomatis oleh sistem.</b> Nilai ' + n + ' berada di bawah ' + batas +
            ' (Grade E) sehingga Anda <b>wajib mengulang mata kuliah</b> secara penuh pada semester berikutnya.</span></div>';
        } else if (n > batasAtas && !dikecualikan) {
          cekEl.innerHTML = '<div class="notice danger mt1" style="font-size:12.5px">' + ik('alert', 16) +
            '<span><b>Di atas batas perbaikan.</b> Nilai ' + n + ' melebihi ' + batasAtas +
            ' sehingga mata kuliah ini tidak memenuhi syarat remedial.</span></div>';
        } else {
          cekEl.innerHTML = '<div class="notice ok mt1" style="font-size:12.5px">' + ik('checkCircle', 16) +
            '<span>Nilai memenuhi syarat pengajuan perbaikan (rentang ' + batas + ' – ' + batasAtas + ')' +
            (dikecualikan ? ' — mata kuliah pengecualian.' : '.') + '</span></div>';
        }
      }
      nilaiEl.addEventListener('input', S.debounce(periksaNilai, 180));
      mkEl.addEventListener('input', S.debounce(periksaNilai, 260));

      var unggah = S.pasangUnggah(el.querySelector('#pv-upload'), { kategori: 'remedial' });
      M.kunciKirim(el, el.querySelector('#pv-kirim'), function () {
        var teks = nilaiEl.value.trim(), n = parseFloat(teks.replace(',', '.'));
        var mk = mkEl.value.trim();
        var dikecualikan = kecuali.some(function (x) { return x && mk.toLowerCase().indexOf(String(x).toLowerCase()) >= 0; });
        var nilaiOk = /^\d+([.,]\d+)?$/.test(teks) && n <= 100 && ((n >= batas && n <= batasAtas) || dikecualikan);
        return [!el.querySelector('#pv-setuju').checked ? 'Centang pernyataan tata tertib' : '',
          !mk ? 'Mata kuliah' : '', !el.querySelector('#pv-dosen').value ? 'Dosen pengampu' : '',
          !teks ? 'Nilai' : (nilaiOk ? '' : 'Nilai dalam rentang ' + batas + '–' + batasAtas),
          M.kurangUnggah(unggah, 'Bukti transfer')];
      });

      el.querySelector('#pv-kirim').onclick = function (ev) {
        var teks = nilaiEl.value.trim();
        if (!/^\d+([.,]\d+)?$/.test(teks)) return UI.toast('Nilai harus berupa angka (contoh: 58 atau 58.5).', 'error');
        var n = parseFloat(teks.replace(',', '.'));
        var mk = mkEl.value.trim();
        var dikecualikan = kecuali.some(function (x) { return x && mk.toLowerCase().indexOf(String(x).toLowerCase()) >= 0; });

        if (!mk) return UI.toast('Mata kuliah wajib diisi.', 'error');
        if (n < batas && !dikecualikan) {
          return UI.toast('Nilai di bawah ' + batas + ' — Anda wajib mengulang mata kuliah ini.', 'error', 'Tidak Memenuhi Syarat');
        }
        if (n > batasAtas && !dikecualikan) {
          return UI.toast('Nilai di atas ' + batasAtas + ' — di luar rentang perbaikan nilai.', 'error', 'Tidak Memenuhi Syarat');
        }
        if (!el.querySelector('#pv-dosen').value) return UI.toast('Dosen pengampu wajib dipilih.', 'error');
        if (unggah.sedang) return UI.toast('Tunggu proses unggah selesai.', 'warn');
        if (!unggah.fileId) return UI.toast('Unggah bukti transfer terlebih dahulu.', 'error');

        M.ajukan('PERBAIKAN_NILAI', {
          mataKuliah: mk,
          sks: el.querySelector('#pv-sks').value.trim(),
          dosenId: el.querySelector('#pv-dosen').value,
          nilai: n,
          setuju: true,
          buktiFileId: unggah.fileId,
          buktiUrl: unggah.url,
          catatan: el.querySelector('#pv-catatan').value.trim()
        }, ev.currentTarget);
      };
    },

    /* ==================================================================
       FORMULIR SIAP CETAK (v3.3 — berdiri sendiri, sesuai semester)
       ================================================================== */

    renderFormulir: function () {
      var d = M.D;
      var buka = d.blanko || [], kunci = d.blankoTerkunci || [];
      var GRUP_B = [['SEMPRO', 'Seminar Proposal', 'tone-cyan', 'presentation'], ['SKRIPSI', 'Skripsi', 'tone-indigo', 'graduation'],
        ['UMUM', 'Formulir Lainnya', 'tone-slate', 'printer']];
      function kelompok(x) {
        if (x.kelompok) return x.kelompok;
        return /SEMPRO/.test(x.alur || '') ? 'SEMPRO' : (/SIDANG/.test(x.alur || '') ? 'SKRIPSI' : 'UMUM');
      }
      var isi = '<div class="notice mb2">' + ik('info', 17) + '<span>Formulir siap cetak dapat diunduh kapan saja tanpa menunggu pengajuan. ' +
        'Formulir Seminar Proposal terbuka mulai semester 6, formulir Skripsi mulai semester 7. ' +
        'Nama, NIM &amp; prodi terisi otomatis; isian tambahan tidak dikirim ke BAAK.</span></div>';
      var ada = false;
      GRUP_B.forEach(function (g) {
        var b1 = buka.filter(function (x) { return kelompok(x) === g[0]; });
        var b2 = kunci.filter(function (x) { return kelompok(x) === g[0]; });
        if (!b1.length && !b2.length) return;
        ada = true;
        isi += '<div class="blk-grup"><h4>' + ik(g[3], 14) + ' ' + g[1] + '</h4><div class="blk-list">' +
          b1.map(function (x) {
            return '<div class="blk ' + g[2] + '"><span class="ic3d">' + ik('printer', 19) + '</span>' +
              '<div class="grow"><div class="nm">' + F.esc(x.nama) + '</div>' +
              '<div class="mt">' + (x.field.length ? x.field.length + ' isian • ' : '') + 'identitas terisi otomatis</div></div>' +
              '<button class="btn btn-soft btn-sm" data-cetak="' + F.esc(x.kode) + '">' + ik('edit', 14) + 'Isi &amp; Cetak</button></div>';
          }).join('') +
          b2.map(function (x) {
            return '<div class="blk off ' + g[2] + '"><span class="ic3d">' + ik('lock', 18) + '</span>' +
              '<div class="grow"><div class="nm">' + F.esc(x.nama) + '</div>' +
              '<div class="mt">Terbuka mulai semester ' + x.semesterMin + '</div></div>' +
              '<span class="badge badge-gray">' + ik('lock', 11) + ' Smt ' + x.semesterMin + '+</span></div>';
          }).join('') + '</div></div>';
      });
      if (!ada) isi += '<div class="card"><div class="card-body">' + UI.kosong('Belum Ada Formulir', 'Formulir siap cetak belum tersedia untuk semester Anda.', 'printer') + '</div></div>';

      var el = document.getElementById('mhsview-formulir');
      el.innerHTML = '<div class="page-head"><div>' +
        '<div class="crumb">' + ik('home', 12) + ' Beranda <span class="sep">/</span> Layanan <span class="sep">/</span> <span class="cur">Formulir Siap Cetak</span></div>' +
        '<h2>Formulir Siap Cetak</h2><div class="desc">Blanko resmi Seminar Proposal &amp; Skripsi — isi seperlunya lalu cetak.</div></div></div>' + isi;
      Array.prototype.forEach.call(el.querySelectorAll('[data-cetak]'), function (b) {
        b.onclick = function () { M.cetakBlanko(b.getAttribute('data-cetak')); };
      });
    },

    /* ==================================================================
       9. RIWAYAT PENGAJUAN
       ================================================================== */

    renderRiwayat: function () {
      var list = M.D.riwayat || [];
      var hitung = { Semua: list.length, Diproses: 0, Selesai: 0, 'Perlu Tindakan': 0 };
      list.forEach(function (r) {
        if (r.status === 'MENUNGGU') hitung.Diproses++;
        else if (r.status === 'DISETUJUI') hitung.Selesai++;
        else if (r.status === 'DITOLAK') hitung['Perlu Tindakan']++;
      });

      var isi =
        '<div class="card mb2"><div class="card-body" style="padding:14px">' +
        '<div class="input-icon mb2">' + ik('search', 16) +
        '<input class="input" id="rw-cari" placeholder="Cari jenis surat, nomor dokumen, atau instansi…"></div>' +
        '<div class="row-wrap" id="rw-filter">' +
        Object.keys(hitung).map(function (k, i) {
          return '<button class="btn btn-sm ' + (i === 0 ? 'btn-primary' : 'btn-ghost') + '" data-f="' + k + '">' +
            k + ' <span class="badge badge-gray" style="margin-left:4px">' + hitung[k] + '</span></button>';
        }).join('') + '</div></div></div>' +
        '<div id="rw-hasil"></div>';

      var el = document.getElementById('mhsview-riwayat');
      el.innerHTML = M.kerangka('riwayat', 'Riwayat &amp; Status Surat',
        'Pantau proses verifikasi dokumen dan unduh berkas digital resmi ber-QR Code kampus.', isi);

      var filter = 'Semua', kueri = '';

      function gambar() {
        var f = list.filter(function (r) {
          if (filter === 'Diproses' && r.status !== 'MENUNGGU') return false;
          if (filter === 'Selesai' && r.status !== 'DISETUJUI') return false;
          if (filter === 'Perlu Tindakan' && r.status !== 'DITOLAK') return false;
          if (!kueri) return true;
          var gabung = [r.jenisLabel, r.nomorSurat, M.ringkasData(r)].join(' ').toLowerCase();
          return gabung.indexOf(kueri.toLowerCase()) >= 0;
        });

        var box = el.querySelector('#rw-hasil');
        if (!f.length) { box.innerHTML = '<div class="card"><div class="card-body">' + UI.kosong('Tidak Ada Data', 'Belum ada pengajuan yang cocok dengan filter Anda.', 'inbox') + '</div></div>'; return; }

        box.innerHTML = f.map(function (r) {
          var warna = r.status === 'DISETUJUI' ? 'var(--green-600)' : (r.status === 'DITOLAK' ? 'var(--red-600)' : 'var(--orange-500)');
          return '<div class="card mb2" style="border-top:3px solid ' + warna + '">' +
            '<div class="card-body">' +
            '<div class="between mb1" style="align-items:flex-start">' +
            '<div><div class="tiny muted">' + (r.nomorSurat ? 'No. Dokumen' : 'ID Pengajuan') + '</div>' +
            '<div class="mono bold" style="font-size:13px">' + F.esc(r.nomorSurat || r.id) + '</div></div>' +
            F.statusBadge(r.status) + '</div>' +
            '<div class="bold" style="font-size:15px">' + F.esc(r.jenisLabel) + '</div>' +
            '<div class="small muted mb1">' + ik('calendar', 12) + ' ' + F.tgl(r.tanggalAjukan) +
            ' • ' + F.esc(M.ringkasData(r)) + '</div>' +
            (r.status === 'DITOLAK' && r.alasanTolak
              ? '<div class="notice danger mt1" style="font-size:12.5px">' + ik('alert', 16) +
              '<span><b>Catatan BAAK:</b> ' + F.esc(r.alasanTolak) + '</span></div>' : '') +
            (r.status === 'MENUNGGU'
              ? '<div class="notice mt1" style="font-size:12.5px">' + ik('clock', 16) +
              '<span>Sedang ditinjau Tim Akademik BAAK. Estimasi selesai 1–2 hari kerja.</span></div>' : '') +
            (r.dokumen && r.dokumen.length
              ? '<div class="mt2">' + S.Dok.daftar(r.dokumen, true) + '</div>'
              : (M.sedangDibuat(r) ? '<div class="notice warn mt2">' + ik('clock', 16) + '<span>Dokumen sedang dibuat sistem…</span></div>' : '')) +
            '<div class="row-wrap mt2">' +
            (r.status === 'MENUNGGU' && !r._sementara ? '<button class="btn btn-danger btn-sm" data-batal="' + F.esc(r.id) + '">Batalkan</button>' : '') +
            '<button class="btn btn-ghost btn-sm" data-detail="' + F.esc(r.id) + '">' + ik('list', 14) + 'Lihat Detail</button>' +
            '</div></div></div>';
        }).join('');

        M.pasangAksiUmum(box);
        // Pasang pratinjau & unduh per kartu (indeks dokumen bersifat lokal per kartu).
        Array.prototype.forEach.call(box.querySelectorAll('.card'), function (kartu, i) {
          if (f[i]) S.Dok.pasang(kartu, f[i].dokumen || []);
        });
        Array.prototype.forEach.call(box.querySelectorAll('[data-detail]'), function (b) {
          b.onclick = function () { M.detailPengajuan(b.getAttribute('data-detail')); };
        });
      }

      el.querySelector('#rw-cari').addEventListener('input', S.debounce(function (e) {
        kueri = e.target.value; gambar();
      }, 200));

      Array.prototype.forEach.call(el.querySelectorAll('#rw-filter [data-f]'), function (b) {
        b.onclick = function () {
          filter = b.getAttribute('data-f');
          Array.prototype.forEach.call(el.querySelectorAll('#rw-filter [data-f]'), function (x) {
            x.className = 'btn btn-sm ' + (x === b ? 'btn-primary' : 'btn-ghost');
          });
          gambar();
        };
      });

      gambar();
    },

    detailPengajuan: function (id) {
      var r = null;
      (M.D.riwayat || []).forEach(function (x) { if (x.id === id) r = x; });
      if (!r) return;
      var d = r.data || {};
      var baris = Object.keys(d).filter(function (k) {
        return d[k] !== '' && d[k] !== null && typeof d[k] !== 'object' && !/FileId$|Id$|^skKirim$/.test(k);
      });

      UI.modal({
        judul: r.jenisLabel,
        sub: 'ID ' + r.id + ' • ' + F.tglJam(r.tanggalAjukan),
        isi:
          '<div class="mb2">' + F.statusBadge(r.status) +
          (r.nomorSurat ? ' <span class="badge badge-navy mono">' + F.esc(r.nomorSurat) + '</span>' : '') + '</div>' +
          '<dl class="kv">' + baris.map(function (k) {
            return '<dt>' + F.esc(M.labelField(k)) + '</dt><dd>' + F.esc(d[k]) + '</dd>';
          }).join('') +
          (r.tanggalProses ? '<dt>Diproses</dt><dd>' + F.tglJam(r.tanggalProses) + '</dd>' : '') +
          (r.prosesOleh ? '<dt>Verifikator</dt><dd>' + F.esc(r.prosesOleh) + '</dd>' : '') +
          '</dl>' +
          (Array.isArray(d.anggota) && d.anggota.length
            ? '<h4 style="font-size:13px;margin:16px 0 8px">Anggota Kelompok</h4>' +
            '<div class="checkgrid">' + d.anggota.map(function (a) {
              return '<div class="checkrow"><div class="grow"><div class="bold">' + F.esc(a.nama) + '</div>' +
                '<div class="tiny muted mono">' + F.esc(a.nim) + '</div></div>' +
                '<span class="badge badge-gray">' + F.esc(a.peran || '-') + '</span></div>';
            }).join('') + '</div>' : '') +
          (r.alasanTolak ? '<div class="notice danger mt2">' + ik('alert', 17) + '<span>' + F.esc(r.alasanTolak) + '</span></div>' : ''),
        kaki: '<button class="btn btn-ghost" data-tutup>Tutup</button>' +
          (r.dokumen && r.dokumen.length ? '<button class="btn btn-primary" id="dt-dok">' + ik('file', 15) + 'Dokumen Terbit (' + r.dokumen.length + ')</button>' : ''),
        siap: function (box) {
          var b = box.querySelector('#dt-dok');
          if (b) b.onclick = function () { UI.tutupModal(); setTimeout(function () { M.dialogDokumen(r); }, 180); };
        }
      });
    },

    labelField: function (k) {
      var p = {
        nik: 'NIK', tempatLahir: 'Tempat Lahir', tanggalLahir: 'Tanggal Lahir', alamat: 'Alamat',
        instansi: 'Instansi', keperluan: 'Keperluan', keterangan: 'Keterangan', yth: 'Ditujukan Kepada',
        alamatInstansi: 'Alamat Instansi', judul: 'Judul', judulFinal: 'Judul Final', noWa: 'No. WhatsApp',
        mataKuliah: 'Mata Kuliah', nilai: 'Nilai', dosen: 'Dosen Pengampu', sks: 'SKS',
        pjNama: 'Nama PJ', pjJabatan: 'Jabatan PJ', pjHp: 'Kontak PJ', catatan: 'Catatan',
        pengujiNama: 'Penguji Sempro', pembimbing: 'Dosen Pembimbing', tanggalAcc: 'Tanggal ACC',
        penguji1: 'Penguji 1', penguji2: 'Penguji 2', penguji3: 'Penguji 3', ipk: 'IPK',
        catatanRevisi: 'Catatan Revisi', calonPembimbing: 'Calon Pembimbing',
        khsUrl: 'Berkas KHS', skripsiUrl: 'Skripsi Final', lembarUrl: 'Lembar Revisi / Pengesahan',
        buktiUrl: 'Bukti Berkas'
      };
      return p[k] || k.replace(/([A-Z])/g, ' $1').replace(/^./, function (c) { return c.toUpperCase(); });
    },

    /* ==================================================================
       10. PROFIL
       ================================================================== */

    renderProfil: function () {
      var p = M.D.profil;
      var isi =
        '<div class="card"><div class="card-head"><h3>Data Akademik</h3>' +
        '<span class="badge badge-green">' + ik('checkCircle', 12) + ' Tersinkron SIAKAD</span></div>' +
        '<div class="card-body"><dl class="kv">' +
        '<dt>Nama Lengkap</dt><dd>' + F.esc(p.nama) + '</dd>' +
        '<dt>NIM</dt><dd class="mono">' + F.esc(p.nim) + '</dd>' +
        '<dt>Program Studi</dt><dd>' + F.esc(p.prodi) + '</dd>' +
        '<dt>Tahun Masuk</dt><dd>' + F.esc(p.tahunMasuk) + '</dd>' +
        '<dt>Semester Berjalan</dt><dd>Semester ' + p.semester + ' • Tingkat ' + p.tingkat + '</dd>' +
        '<dt>Tahun Akademik</dt><dd>' + F.esc(p.tahunAkademik) + ' ' + F.esc(p.semesterTipe) + '</dd>' +
        '</dl>' +
        '<div class="notice mt2" style="font-size:12.5px">' + ik('info', 16) +
        '<span>Perubahan nama, NIM, atau program studi hanya dapat dilakukan oleh BAAK melalui data induk kampus.</span></div>' +
        '</div></div>' +

        '<div class="card mt2"><div class="card-head"><h3>Data Kontak</h3></div><div class="card-body">' +
        '<div class="grid-2">' +
        '<div class="field"><label for="pr-wa">Nomor WhatsApp Aktif</label>' +
        '<input class="input mono" id="pr-wa" inputmode="numeric" maxlength="15" value="' + F.esc(p.noWa || '') + '" placeholder="08xxxxxxxxxx"></div>' +
        '<div class="field"><label for="pr-email">Email</label>' +
        '<input class="input" id="pr-email" type="email" maxlength="120" value="' + F.esc(p.email || '') + '" placeholder="nama@email.com"></div>' +
        '</div>' +
        '<button class="btn btn-primary" id="pr-simpan">' + ik('check', 15) + 'Simpan Perubahan</button>' +
        '</div></div>' +

        '<div class="card mt2"><div class="card-body between" style="flex-wrap:wrap">' +
        '<div><div class="bold">Keluar dari Akun</div>' +
        '<div class="small muted">Sesi tersimpan selama 6 jam. Keluar bila memakai perangkat bersama.</div></div>' +
        '<button class="btn btn-danger" id="pr-keluar">' + ik('logout', 15) + 'Keluar</button></div></div>';

      var el = document.getElementById('mhsview-profil');
      el.innerHTML =
        '<div class="page-head"><div><div class="crumb">' + ik('home', 12) + ' Beranda <span class="sep">/</span> <span class="cur">Profil Saya</span></div>' +
        '<h2>Profil Saya</h2><div class="desc">Data akademik dan kontak yang dipakai pada seluruh dokumen persuratan.</div></div></div>' + isi;

      el.querySelector('#pr-simpan').onclick = function (ev) {
        UI.sibuk(ev.currentTarget, true, 'Menyimpan…');
        API.kirim('perbaruiProfil', {
          noWa: el.querySelector('#pr-wa').value.trim(),
          email: el.querySelector('#pr-email').value.trim()
        }).then(function (r) {
          UI.sibuk(ev.currentTarget, false);
          if (!r.success) return UI.toast(r.message, 'error');
          UI.toast('Profil diperbarui.', 'ok');
          M.muat(false);
        });
      };
      el.querySelector('#pr-keluar').onclick = S.App.keluar;
    }
  };

  S.Mahasiswa = M;

})(window.SIAKAD);
