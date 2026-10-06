/* ==========================================================================
   SIAKAD SURAT — 04 PANEL ADMIN BAAK
   Sidebar collapsible, antrean per jenis pengajuan, master data, statistik.
   Semua data dimuat sekali lewat bootstrapAdmin(); navigasi lokal 0 ms.
   ========================================================================== */

(function (S) {
  'use strict';
  var API = S.API, UI = S.UI, F = S.F, ik = S.ikon, Simpan = S.Simpan;

  /* Definisi antrean per jenis — dipakai untuk nav, panel, dan aksi. */
  var ANTREAN = [
    { k: 'SURAT_AKTIF', set: ['SURAT_AKTIF'], n: 'Surat Aktif', i: 'doc', d: 'Verifikasi kelayakan administrasi & penerbitan nomor surat berseri.' },
    { k: 'MAGANG', set: ['MAGANG'], n: 'Pengajuan Magang', i: 'briefcase', d: 'Surat pengantar magang / PKL ke instansi tujuan mahasiswa.' },
    { k: 'KONFIRMASI_MAGANG', set: ['KONFIRMASI_MAGANG'], n: 'Konfirmasi Magang', i: 'checkCircle', d: 'Validasi surat balasan instansi, ACC per anggota, dan data PJ lapangan.' },
    { k: 'PENELITIAN', set: ['PENELITIAN'], n: 'Izin Penelitian', i: 'flask', d: 'Penerbitan surat pengantar riset / penelitian skripsi.' },
    { k: 'SEMPRO', set: ['SEMPRO', 'REVISI_SEMPRO'], n: 'Seminar Proposal', i: 'presentation', d: 'Plotting dosen penguji ber-NIDN, jadwal ruang, dan penerbitan SK Pembimbing.' },
    { k: 'SIDANG', set: ['SIDANG', 'REVISI_SIDANG'], n: 'Sidang Skripsi', i: 'graduation', d: 'Penetapan penguji sidang skripsi, jadwal, IPK & predikat, hingga penerbitan SKL.' },
    { k: 'PERBAIKAN_NILAI', set: ['PERBAIKAN_NILAI'], n: 'Perbaikan Nilai', i: 'edit', d: 'Verifikasi bukti transfer & penerbitan formulir ujian remedial.' }
  ];

  var NAV = [
    { g: 'Menu Utama' },
    { k: 'ringkasan', n: 'Ringkasan & Statistik', i: 'grid' },
    { g: 'Antrean Persuratan' },
    { k: 'q_SURAT_AKTIF', n: 'Surat Aktif', i: 'doc', c: 'SURAT_AKTIF' },
    { k: 'q_MAGANG', n: 'Pengajuan Magang', i: 'briefcase', c: 'MAGANG' },
    { k: 'q_KONFIRMASI_MAGANG', n: 'Konfirmasi Magang', i: 'checkCircle', c: 'KONFIRMASI_MAGANG' },
    { k: 'dosen_magang', n: 'Setting Dosen Magang', i: 'users', c: 'DOSEN_MAGANG' },
    { k: 'q_PENELITIAN', n: 'Izin Penelitian', i: 'flask', c: 'PENELITIAN' },
    { g: 'Akademik & Kelulusan' },
    { k: 'q_SEMPRO', n: 'Seminar Proposal', i: 'presentation', c: 'SEMPRO' },
    { k: 'q_SIDANG', n: 'Sidang Skripsi', i: 'graduation', c: 'SIDANG' },
    { k: 'dosen_penguji', n: 'Setting Dosen Penguji', i: 'award' },
    { k: 'kelulusan', n: 'Administrasi Kelulusan', i: 'award', c: 'KELULUSAN' },
    { k: 'q_PERBAIKAN_NILAI', n: 'Formulir Perbaikan Nilai', i: 'edit', c: 'PERBAIKAN_NILAI' },
    { g: 'Master Data' },
    { k: 'dokumen', n: 'Jenis Surat & Formulir', i: 'file' },
    { k: 'mahasiswa', n: 'Data Mahasiswa', i: 'users' },
    { k: 'dosen', n: 'Data Dosen & Prodi', i: 'user' },
    { g: 'Administrasi Sistem' },
    { k: 'akses', n: 'Pengaturan Akses Menu', i: 'lock' },
    { k: 'notifikasi', n: 'WhatsApp & Notifikasi', i: 'send' },
    { k: 'crm', n: 'CRM Kontak', i: 'phone' },
    { k: 'migrasi', n: 'Migrasi Data', i: 'refresh' },
    { k: 'pengaturan', n: 'Pengaturan Aplikasi', i: 'settings' },
    { k: 'log', n: 'Log Aktivitas', i: 'list' }
  ];

  var A = {

    siap: false,
    aktif: 'ringkasan',
    kotor: {},
    D: null,
    pilih: {},   // id pengajuan terpilih per antrean
    chart: {},

    /* ==================================================================
       PEMBUKAAN
       ================================================================== */

    buka: function () {
      UI.layar('adm');
      document.getElementById('boot').classList.add('hide');
      if (!A.siap) { A.bangunKerangka(); A.siap = true; }

      var cache = Simpan.get('adm_boot');
      if (cache) {
        A.D = cache;
        A._tanda = JSON.stringify(cache, function (k, v) { return (k === 'server' || k === 'cache') ? undefined : v; });
        A.renderSemua();
      }
      else document.getElementById('admview-ringkasan').innerHTML = UI.skeleton(5, 90);

      A.muat();
    },

    muat: function () {
      UI.penandaSinkron(true);

      var janji;
      if (S.State.prefetchBoot) {
        janji = S.State.prefetchBoot.then(function (x) { return x || API.kirim('bootstrapAdmin'); });
        S.State.prefetchBoot = null;
      } else {
        janji = API.kirim('bootstrapAdmin');
      }

      return janji.then(function (r) {
        r = r || { success: false, message: 'Tidak dapat terhubung ke server.' };
        UI.penandaSinkron(false);
        if (!r.success) {
          if (r.code !== 'UNAUTHORIZED') UI.toast(r.message, 'error');
          return;
        }
        var tanda = JSON.stringify(r.data, function (k, v) { return (k === 'server' || k === 'cache') ? undefined : v; });
        var berubah = tanda !== A._tanda;
        A._tanda = tanda;
        A.D = r.data;
        S.State.profil = r.data.profil;
        Simpan.set('adm_boot', r.data);
        // Render hanya bila data berubah (gas-instant-ux-pro · Prinsip 2).
        if (berubah) A.renderSemua();
        A.pantauAntrean();
        if (!A._prefetch) { A._prefetch = true; A.prefetchModul(); }
      });
    },

    /**
     * PDF hasil approval dibuat di antrean server. Selama masih ada antrean,
     * panel memicu pemrosesan & menyegarkan sendiri — admin tidak perlu menunggu.
     */
    pantauAntrean: function () {
      var d = A.D || {}, ada = false;
      (d.antrean || []).concat(d.riwayat || []).forEach(function (r) {
        (r.antrean || []).forEach(function (j) { if (j.status !== 'GAGAL') ada = true; });
      });
      (d.kelulusan || []).forEach(function (k) { (k.antrean || []).forEach(function (j) { if (j.status !== 'GAGAL') ada = true; }); });
      clearTimeout(A._tAntre);
      if (!ada) { A._nAntre = 0; return; }
      A._nAntre = (A._nAntre || 0) + 1;
      if (A._nAntre > 10) return;
      A._tAntre = setTimeout(function () { A.prosesLatar(); }, 1500);
    },

    /** Picu pembuatan PDF di server (tanpa menahan antarmuka), lalu segarkan data. */
    prosesLatar: function (ids) {
      if (A._prosesJalan) return A._prosesJalan;
      A._prosesJalan = API.kirim('prosesDokumen', { ids: ids || [] }).then(function (r) {
        A._prosesJalan = null;
        if (r && r.success && r.data && r.data.gagal && r.data.gagal.length) {
          UI.toast(r.data.gagal.length + ' dokumen gagal dibuat: ' + r.data.gagal[0].pesan, 'warn', 'Antrean Dokumen');
        }
        return A.muat();
      });
      return A._prosesJalan;
    },

    /** Prefetch data modul tambahan saat senggang — 1 panggilan batch. */
    prefetchModul: function () {
      var jalan = function () {
        API.batch([{ action: 'notifConfig' }, { action: 'blastList' }, { action: 'crmList' }]).then(function (res) {
          Object.keys(res || {}).forEach(function (k) {
            if (res[k] && res[k].success) Simpan.set('adm_mod_' + k, res[k].data);
          });
        });
      };
      if (window.requestIdleCallback) window.requestIdleCallback(jalan, { timeout: 5000 });
      else setTimeout(jalan, 2500);
    },

    /**
     * Optimistic UI: terapkan perubahan ke salinan lokal dan gambar ulang
     * seketika; data server menyusul di latar belakang.
     */
    tambalPengajuan: function (id, ubah) {
      var d = A.D;
      if (!d) return;
      var hit = null, iAntre = -1;
      (d.antrean || []).forEach(function (x, i) { if (x.id === id) { hit = x; iAntre = i; } });
      if (!hit) (d.riwayat || []).forEach(function (x) { if (x.id === id) hit = x; });
      if (!hit) return;
      Object.keys(ubah || {}).forEach(function (k) { hit[k] = ubah[k]; });
      if (iAntre >= 0 && hit.status !== 'MENUNGGU') {
        d.antrean.splice(iAntre, 1);
        d.riwayat = [hit].concat(d.riwayat || []);
        var pj = d.ringkasan && d.ringkasan.perJenis && d.ringkasan.perJenis[hit.jenis];
        if (pj) { pj.menunggu = Math.max(0, pj.menunggu - 1); if (hit.status === 'DISETUJUI') pj.disetujui++; else if (hit.status === 'DITOLAK') pj.ditolak++; }
      }
      A.renderSemua();
    },

    bangunKerangka: function () {
      var nav = document.getElementById('adm-nav');
      nav.innerHTML = NAV.map(function (m) {
        if (m.g) return '<div class="nav-group">' + F.esc(m.g) + '</div>';
        return '<button class="nav-item" data-nav="admview" data-view="' + m.k + '" title="' + F.esc(m.n) + '">' +
          '<span class="ic">' + ik(m.i, 18) + '</span>' +
          '<span class="lbl-txt">' + F.esc(m.n) + '</span>' +
          (m.c ? '<span class="cnt zero" data-acnt="' + m.c + '">0</span>' : '') + '</button>';
      }).join('');

      document.getElementById('admview').innerHTML = NAV.filter(function (m) { return m.k; }).map(function (m) {
        return '<section class="view' + (m.k === 'ringkasan' ? ' active' : '') + '" id="admview-' + m.k + '"></section>';
      }).join('');

      document.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-nav="admview"]') : null;
        if (b) { e.preventDefault(); A.pergi(b.getAttribute('data-view')); }
      });

      var shell = document.getElementById('adm-shell');
      var sb = document.getElementById('adm-sidebar');
      var bd = document.getElementById('adm-backdrop');

      // Ingat preferensi sidebar tertutup.
      if (Simpan.get('adm_sidebar_ciut')) shell.classList.add('collapsed');

      document.getElementById('adm-hamb').onclick = function () {
        if (window.innerWidth <= 1024) {
          sb.classList.toggle('open');
          bd.classList.toggle('show', sb.classList.contains('open'));
        } else {
          shell.classList.toggle('collapsed');
          Simpan.set('adm_sidebar_ciut', shell.classList.contains('collapsed') ? 1 : 0);
        }
      };
      bd.onclick = function () { sb.classList.remove('open'); bd.classList.remove('show'); };
      document.getElementById('adm-keluar').onclick = S.App.keluar;
      document.getElementById('adm-segarkan').onclick = function () {
        A.muat().then(function () { UI.toast('Data antrean diperbarui.', 'ok'); });
      };
    },

    pergi: function (kunci) {
      var m = null;
      NAV.forEach(function (x) { if (x.k === kunci) m = x; });
      if (!m) return;
      A.render(kunci);
      A.aktif = kunci;
      UI.view('admview', kunci);
      document.getElementById('adm-judul').textContent = m.n;
      var a = null;
      ANTREAN.forEach(function (x) { if ('q_' + x.k === kunci) a = x; });
      document.getElementById('adm-sub').textContent = a ? a.d : 'Panel Biro Administrasi Akademik';
      document.getElementById('adm-sidebar').classList.remove('open');
      document.getElementById('adm-backdrop').classList.remove('show');
      if (kunci === 'ringkasan') A.gambarChart();
    },

    /* ==================================================================
       RENDER
       ================================================================== */

    renderSemua: function () {
      var d = A.D;
      if (!d) return;
      document.getElementById('adm-ava').textContent = F.inisial(d.profil.nama);
      document.getElementById('adm-nama-side').textContent = d.profil.nama;

      // Badge antrean pada sidebar (jenis turunan ikut dihitung ke antrean induk)
      var hitung = {};
      (d.antrean || []).forEach(function (r) {
        ANTREAN.forEach(function (a) {
          if (a.set.indexOf(r.jenis) >= 0) hitung[a.k] = (hitung[a.k] || 0) + 1;
        });
      });
      hitung.KELULUSAN = (d.kelulusan || []).filter(function (k) {
        return k.tahap3Status === 'MENUNGGU';
      }).length;
      hitung.DOSEN_MAGANG = (d.dosenMagang || []).filter(function (x) { return x.status !== 'FINAL'; }).length;

      Array.prototype.forEach.call(document.querySelectorAll('[data-acnt]'), function (el) {
        var n = hitung[el.getAttribute('data-acnt')] || 0;
        el.textContent = n;
        el.classList.toggle('zero', n === 0);
      });

      // Tandai semua view perlu digambar ulang; hanya view aktif yang
      // benar-benar digambar sekarang → sinkronisasi tidak menahan antarmuka.
      NAV.forEach(function (m) { if (m.k) A.kotor[m.k] = true; });
      A.render(A.aktif || 'ringkasan');
    },

    /** Gambar satu view bila datanya berubah. */
    render: function (kunci) {
      if (!A.D || !A.kotor[kunci]) return;
      var fn;
      if (kunci.indexOf('q_') === 0) {
        var cfg = null;
        ANTREAN.forEach(function (x) { if ('q_' + x.k === kunci) cfg = x; });
        if (!cfg) return;
        fn = function () { A.renderAntrean(cfg); };
      } else {
        fn = {
          ringkasan: A.renderRingkasan, kelulusan: A.renderKelulusan,
          dokumen: A.renderDokumen, mahasiswa: A.renderMahasiswa, dosen: A.renderDosen,
          akses: A.renderAkses, pengaturan: A.renderPengaturan, log: A.renderLog,
          dosen_magang: A.renderDosenMagang, dosen_penguji: A.renderDosenPenguji,
          notifikasi: function () { A.modul('notifikasi'); },
          crm: function () { A.modul('crm'); },
          migrasi: function () { A.modul('migrasi'); }
        }[kunci];
      }
      if (!fn) return;
      fn();
      A.kotor[kunci] = false;
    },

    /* ---------------------------------------------------- RINGKASAN */

    renderRingkasan: function () {
      var d = A.D, r = d.ringkasan, st = d.statistik;
      var ta = d.tahunAkademik;

      var kpi = [
        ['Total Mahasiswa', r.totalMahasiswa, 'Aktif terdaftar', 'k-navy', 'users'],
        ['Antrean Baru', r.antreanBaru, 'Perlu verifikasi hari ini', 'k-orange', 'inbox'],
        ['Disetujui Hari Ini', r.disetujuiHariIni, 'Dokumen sah ber-QR', 'k-green', 'checkCircle'],
        ['Ditolak / Revisi', r.ditolak, 'Alasan tercatat', 'k-red', 'xCircle'],
        ['Pengajuan Magang', r.magang, 'Total sepanjang periode', 'k-blue', 'briefcase'],
        ['Dokumen Terbit', r.suratTerbit, 'Total PDF ber-QR', 'k-orange', 'file']
      ];

      var html =
        '<div class="page-head"><div>' +
        '<div class="crumb">' + ik('shield', 12) + ' Panel BAAK <span class="sep">/</span> <span class="cur">Live Portal Terintegrasi</span></div>' +
        '<h2>Selamat Datang, ' + F.esc((d.profil.nama || '').split(' ')[0]) + '</h2>' +
        '<div class="desc">Sistem Informasi Administrasi Persuratan Mahasiswa ' +
        F.esc(d.konfigurasi.INSTITUSI || 'STIS Al Wafa') + ' Tahun Akademik ' + F.esc(ta.label) + ' ' + F.esc(ta.tipe) + '.</div></div>' +
        '<div class="card" style="padding:12px 16px"><div class="tiny muted">Tahun Akademik</div>' +
        '<div class="bold">' + F.esc(ta.label) + ' ' + F.esc(ta.tipe) + ' <span class="badge badge-green">Aktif</span></div></div>' +
        '</div>' +

        '<div class="kpi-grid mb3">' + kpi.map(function (x) {
          return '<div class="kpi ' + x[3] + (x[3] === 'k-navy' ? ' dark' : '') + '">' +
            '<div class="kpi-icon">' + ik(x[4], 16) + '</div>' +
            '<div class="kpi-label">' + F.esc(x[0]) + '</div>' +
            '<div class="kpi-value">' + x[1] + '</div>' +
            '<div class="kpi-note">' + F.esc(x[2]) + '</div></div>';
        }).join('') + '</div>' +

        '<div class="split">' +

        '<div class="card"><div class="card-head"><div><h3>Rekapitulasi Mahasiswa per Angkatan</h3>' +
        '<div class="sub">Distribusi persebaran mahasiswa aktif menurut program studi</div></div>' +
        '<select class="select" id="rk-angkatan" style="width:auto;min-width:150px"><option value="">Semua Angkatan</option>' +
        (st.daftarAngkatan || []).map(function (a) { return '<option>' + F.esc(a) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="card-body"><div id="rk-tabel"></div></div></div>' +

        '<div>' +
        '<div class="card mb2"><div class="card-head"><h3>Sebaran per Tingkat</h3></div>' +
        '<div class="card-body"><div class="chart-box sm"><canvas id="ch-tingkat"></canvas></div></div></div>' +
        '<div class="card"><div class="card-head"><div><h3>Statistik Dokumen Diterbitkan</h3>' +
        '<div class="sub">Tren persetujuan e-Surat 7 hari terakhir</div></div></div>' +
        '<div class="card-body"><div class="chart-box sm"><canvas id="ch-tren"></canvas></div></div></div>' +
        '</div></div>' +

        '<div class="card mt3"><div class="card-head"><h3>Tindakan Cepat</h3></div><div class="card-body">' +
        '<div class="row-wrap">' +
        '<button class="btn btn-primary" data-nav="admview" data-view="q_SURAT_AKTIF">' + ik('doc', 15) + 'Verifikasi Surat Aktif (' + (r.perJenis.SURAT_AKTIF ? r.perJenis.SURAT_AKTIF.menunggu : 0) + ')</button>' +
        '<button class="btn btn-ghost" data-nav="admview" data-view="q_SEMPRO">' + ik('presentation', 15) + 'Plotting Penguji Sempro</button>' +
        '<button class="btn btn-ghost" data-nav="admview" data-view="kelulusan">' + ik('award', 15) + 'Administrasi Kelulusan (' + r.kelulusanMenunggu + ')</button>' +
        '<button class="btn btn-ghost" id="rk-unduh">' + ik('download', 15) + 'Unduh Rekap CSV</button>' +
        (d.konfigurasi.SPREADSHEET_URL ? '<a class="btn btn-ghost" target="_blank" rel="noopener" href="' + F.esc(d.konfigurasi.SPREADSHEET_URL) + '">' + ik('grid', 15) + 'Buka Database Spreadsheet</a>' : '') +
        '</div></div></div>';

      var el = document.getElementById('admview-ringkasan');
      el.innerHTML = html;

      function gambarTabel(angkatan) {
        var s = A.statistikTerpilih || A.D.statistik;
        var head = '<tr><th>Program Studi</th>' + (s.angkatan || []).map(function (a) { return '<th class="center">' + F.esc(a) + '</th>'; }).join('') + '<th class="right">Total</th></tr>';
        var body = (s.matriks || []).map(function (m) {
          return '<tr><td><span class="dot" style="background:var(--orange-500);display:inline-block;margin-right:7px"></span>' +
            F.esc(m.nama) + '</td>' +
            m.perAngkatan.map(function (n) { return '<td class="center">' + n + '</td>'; }).join('') +
            '<td class="right bold" style="color:var(--orange-600)">' + m.total + '</td></tr>';
        }).join('');
        var total = (s.matriks || []).reduce(function (a, b) { return a + b.total; }, 0);
        el.querySelector('#rk-tabel').innerHTML =
          '<div class="table-wrap"><table class="tbl"><thead>' + head + '</thead><tbody>' + body +
          '<tr style="background:var(--surface-2)"><td class="bold">Total Keseluruhan</td>' +
          (s.angkatan || []).map(function (a, i) {
            var t = (s.matriks || []).reduce(function (x, m) { return x + (m.perAngkatan[i] || 0); }, 0);
            return '<td class="center bold">' + t + '</td>';
          }).join('') +
          '<td class="right bold" style="color:var(--orange-600)">' + total + '</td></tr>' +
          '</tbody></table></div>' +
          '<div class="mini-stat mt2">' +
          [['Sudah Magang', s.kpi.sudahMagang], ['Diterima Instansi', s.kpi.diterimaMagang],
          ['Sudah Sempro', s.kpi.sudahSempro], ['Sudah Sidang', s.kpi.sudahSidang],
          ['Sudah Lulus', s.kpi.sudahLulus], ['Siap Wisuda', s.kpi.siapWisuda]].map(function (x) {
            return '<div class="ms"><div class="l">' + x[0] + '</div><div class="v">' + x[1] + ' mhs</div></div>';
          }).join('') + '</div>';
      }
      A.statistikTerpilih = A.D.statistik;
      gambarTabel();

      el.querySelector('#rk-angkatan').onchange = function () {
        var v = this.value;
        API.kirim('rekapStatistik', { angkatan: v }).then(function (r2) {
          if (!r2.success) return UI.toast(r2.message, 'error');
          A.statistikTerpilih = r2.data;
          gambarTabel();
          A.gambarChart(true);
        });
      };

      el.querySelector('#rk-unduh').onclick = A.unduhRekapCsv;
      A.gambarChart();
    },

    /** Chart.js dimuat malas — hanya saat halaman ringkasan pertama dibuka. */
    gambarChart: function (paksa) {
      if (!document.getElementById('ch-tingkat')) return;
      if (!window.Chart) {
        if (A._muatChart) return;
        A._muatChart = true;
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
        s.onload = function () { A._muatChart = false; A.gambarChart(true); };
        s.onerror = function () { A._muatChart = false; A.grafikCadangan(); };
        document.head.appendChild(s);
        // Bila CDN diblokir jaringan kampus, tampilkan grafik batang sederhana.
        setTimeout(function () { if (!window.Chart) A.grafikCadangan(); }, 4000);
        return;
      }
      var st = A.statistikTerpilih || (A.D && A.D.statistik);
      if (!st) return;

      var fontKeluarga = 'Plus Jakarta Sans, system-ui, sans-serif';
      window.Chart.defaults.font.family = fontKeluarga;
      window.Chart.defaults.color = '#7C88A0';

      if (A.chart.tingkat) A.chart.tingkat.destroy();
      A.chart.tingkat = new window.Chart(document.getElementById('ch-tingkat'), {
        type: 'bar',
        data: {
          labels: (st.tingkat || []).map(function (x) { return x.label.replace(/\s*\(.*\)/, ''); }),
          datasets: [{
            data: (st.tingkat || []).map(function (x) { return x.jumlah; }),
            backgroundColor: ['#1B2A4A', '#2A3C63', '#E8590C', '#D9480F'],
            borderRadius: 6, borderSkipped: false, maxBarThickness: 42
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: '#EDF0F4' }, ticks: { precision: 0 } },
            x: { grid: { display: false } }
          }
        }
      });

      if (A.chart.tren) A.chart.tren.destroy();
      A.chart.tren = new window.Chart(document.getElementById('ch-tren'), {
        type: 'line',
        data: {
          labels: (st.tren || []).map(function (x) { return x.label; }),
          datasets: [{
            data: (st.tren || []).map(function (x) { return x.jumlah; }),
            borderColor: '#E8590C', backgroundColor: 'rgba(232,89,12,.12)',
            fill: true, tension: .4, borderWidth: 2.5,
            pointBackgroundColor: '#fff', pointBorderColor: '#E8590C', pointBorderWidth: 2, pointRadius: 4
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: '#EDF0F4' }, ticks: { precision: 0 } },
            x: { grid: { display: false } }
          }
        }
      });
    },

    /** Grafik pengganti berbasis CSS bila Chart.js tidak dapat dimuat. */
    grafikCadangan: function () {
      var st = A.statistikTerpilih || (A.D && A.D.statistik);
      if (!st) return;

      function batang(judul, data, warna) {
        var maks = Math.max(1, Math.max.apply(null, data.map(function (x) { return x.v; })));
        return '<div class="small muted mb1">' + F.esc(judul) + '</div>' +
          data.map(function (x) {
            return '<div style="margin-bottom:9px">' +
              '<div class="between tiny" style="margin-bottom:3px"><span>' + F.esc(x.l) + '</span><b>' + x.v + '</b></div>' +
              '<div style="height:8px;background:var(--surface-2);border-radius:99px;overflow:hidden">' +
              '<div style="height:100%;width:' + Math.round(x.v / maks * 100) + '%;background:' + warna + ';border-radius:99px"></div>' +
              '</div></div>';
          }).join('');
      }

      var t = document.getElementById('ch-tingkat');
      if (t && t.parentNode) {
        t.parentNode.style.height = 'auto';
        t.parentNode.innerHTML = batang('Jumlah mahasiswa per tingkat',
          (st.tingkat || []).map(function (x) { return { l: x.label, v: x.jumlah }; }), 'var(--navy-700)');
      }
      var r = document.getElementById('ch-tren');
      if (r && r.parentNode) {
        r.parentNode.style.height = 'auto';
        r.parentNode.innerHTML = batang('Dokumen terbit 7 hari terakhir',
          (st.tren || []).map(function (x) { return { l: x.label, v: x.jumlah }; }), 'var(--orange-500)');
      }
    },

    unduhRekapCsv: function () {
      var d = A.D;
      var baris = [['ID', 'NIM', 'Nama', 'Program Studi', 'Jenis Pengajuan', 'Status',
        'Tanggal Ajukan', 'Tanggal Proses', 'Nomor Surat', 'Diproses Oleh', 'Alasan Tolak']];
      (d.antrean || []).concat(d.riwayat || []).forEach(function (r) {
        baris.push([r.id, r.nim, r.nama, r.prodi, r.jenisLabel, r.status,
          F.tgl(r.tanggalAjukan), r.tanggalProses ? F.tgl(r.tanggalProses) : '',
          r.nomorSurat || '', r.prosesOleh || '', r.alasanTolak || '']);
      });
      var csv = '﻿' + baris.map(function (b) {
        return b.map(function (c) { return '"' + String(c === undefined ? '' : c).replace(/"/g, '""') + '"'; }).join(',');
      }).join('\n');
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'Rekap-Persuratan-' + new Date().toISOString().substring(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
      UI.toast('Rekap CSV diunduh.', 'ok');
    },

    /* ==================================================================
       ANTREAN PER JENIS
       ================================================================== */

    /** Kunci stabil sebuah isian (atribut data-* pertamanya). */
    kunciIsian: function (x) {
      for (var i = 0; i < x.attributes.length; i++) {
        var a = x.attributes[i];
        if (a.name.indexOf('data-') === 0) return a.name + '=' + a.value;
      }
      return '';
    },
    /** Simpan isian yang belum dikirim agar tidak hilang saat data latar diperbarui. */
    ambilIsian: function (root) {
      var out = {};
      if (!root) return out;
      Array.prototype.forEach.call(root.querySelectorAll('input,select,textarea'), function (x) {
        var k = A.kunciIsian(x);
        if (!k || x.readOnly) return;
        out[k] = x.type === 'checkbox' ? (x.checked ? '1' : '0') : x.value;
      });
      return out;
    },
    pulihkanIsian: function (root, isian) {
      if (!root || !isian) return;
      Array.prototype.forEach.call(root.querySelectorAll('input,select,textarea'), function (x) {
        var k = A.kunciIsian(x);
        if (!k || isian[k] === undefined || x.disabled || x.readOnly) return;
        if (x.type === 'checkbox') x.checked = isian[k] === '1';
        else x.value = isian[k];
        if (x.oninput) x.oninput();
        if (x.onchange) x.onchange();
      });
    },

    renderAntrean: function (cfg) {
      var el = document.getElementById('admview-q_' + cfg.k);
      if (!el) return;
      var d = A.D;
      var detailLama = el.querySelector('[data-detail]');
      var isianLama = detailLama && detailLama.getAttribute('data-untuk') === A.pilih[cfg.k] ? A.ambilIsian(detailLama) : null;

      var cocokJenis = function (r) { return cfg.set.indexOf(r.jenis) >= 0; };
      var menunggu = (d.antrean || []).filter(cocokJenis);
      var terproses = (d.riwayat || []).filter(cocokJenis);
      var semua = menunggu.concat(terproses);
      var counter = (d.master.counter || []).filter(function (c) { return c.jenis === cfg.k; })[0] || {};

      var nomorAktif = counter.formatNomor
        ? counter.formatNomor.replace('{no}', ('00' + ((parseInt(counter.nomorTerakhir, 10) || 0) + 1)).slice(-3))
          .replace('{bulan_romawi}', ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][new Date().getMonth() + 1])
          .replace('{bulan}', ('0' + (new Date().getMonth() + 1)).slice(-2))
          .replace('{tahun}', new Date().getFullYear())
        : '—';

      var st = { menunggu: 0, disetujui: 0, ditolak: 0, total: 0 };
      cfg.set.forEach(function (j) {
        var x = d.ringkasan.perJenis[j];
        if (!x) return;
        st.menunggu += x.menunggu; st.disetujui += x.disetujui;
        st.ditolak += x.ditolak; st.total += x.total;
      });

      el.innerHTML =
        '<div class="page-head"><div>' +
        '<div class="crumb">' + ik('shield', 12) + ' Panel BAAK <span class="sep">/</span> Persuratan <span class="sep">/</span> <span class="cur">' + F.esc(cfg.n) + '</span></div>' +
        '<h2>Approval &amp; Verifikasi ' + F.esc(cfg.n) + '</h2>' +
        '<div class="desc">' + F.esc(cfg.d) + '</div></div>' +
        '<div class="row-wrap">' +
        '<button class="btn btn-ghost btn-sm" data-nav="admview" data-view="dokumen">' + ik('file', 14) + 'Master Dokumen</button>' +
        '<button class="btn btn-dark btn-sm" data-massal="' + cfg.k + '" disabled>' + ik('check', 14) + 'Batch Approve (<span data-jml>0</span>)</button>' +
        '</div></div>' +

        '<div class="kpi-grid mb3">' +
        '<div class="kpi k-orange"><div class="kpi-icon">' + ik('inbox', 16) + '</div>' +
        '<div class="kpi-label">Menunggu Verifikasi</div><div class="kpi-value">' + st.menunggu + '</div>' +
        '<div class="kpi-note">Perlu tindakan BAAK</div></div>' +
        '<div class="kpi k-green"><div class="kpi-icon">' + ik('checkCircle', 16) + '</div>' +
        '<div class="kpi-label">Disetujui</div><div class="kpi-value">' + st.disetujui + '</div>' +
        '<div class="kpi-note">Dokumen ber-QR terbit</div></div>' +
        '<div class="kpi k-red"><div class="kpi-icon">' + ik('xCircle', 16) + '</div>' +
        '<div class="kpi-label">Ditolak / Revisi</div><div class="kpi-value">' + st.ditolak + '</div>' +
        '<div class="kpi-note">Alasan tercatat &amp; terkirim</div></div>' +
        '<div class="kpi dark"><div class="kpi-icon">' + ik('file', 16) + '</div>' +
        '<div class="kpi-label">Nomor Surat Berikutnya</div>' +
        '<div class="kpi-value" style="font-size:16px;font-family:var(--ff-mono);margin-top:10px">' + F.esc(nomorAktif) + '</div>' +
        '<div class="kpi-note">Terkunci saat approval ditekan</div></div>' +
        '</div>' +

        '<div class="split">' +
        '<div class="card">' +
        '<div class="card-head"><div><h3>Antrean Pengajuan Mahasiswa</h3>' +
        '<div class="sub"><span data-hitung>' + menunggu.length + '</span> perlu verifikasi</div></div></div>' +
        '<div class="card-body" style="padding:14px 16px;border-bottom:1px solid var(--line)">' +
        '<div class="input-icon mb1">' + ik('search', 16) +
        '<input class="input" data-cari placeholder="Cari nama mahasiswa, NIM, atau instansi…"></div>' +
        '<div class="row-wrap" data-filter>' +
        ['Menunggu', 'Semua', 'Disetujui', 'Ditolak'].map(function (x, i) {
          return '<button class="btn btn-sm ' + (i === 0 ? 'btn-primary' : 'btn-ghost') + '" data-f="' + x + '">' + x + '</button>';
        }).join('') + '</div></div>' +
        '<div class="queue-list" data-list></div></div>' +

        '<div class="detail-panel" data-detail>' +
        '<div class="card"><div class="card-body">' +
        UI.kosong('Pilih Pengajuan', 'Klik salah satu baris antrean untuk meninjau berkas dan mengambil keputusan.', 'eye') +
        '</div></div></div>' +
        '</div>';

      var filter = 'Menunggu', kueri = '', dipilih = {};
      var listEl = el.querySelector('[data-list]');
      var detailEl = el.querySelector('[data-detail]');
      var btnMassal = el.querySelector('[data-massal]');

      function terfilter() {
        return semua.filter(function (r) {
          if (filter === 'Menunggu' && r.status !== 'MENUNGGU') return false;
          if (filter === 'Disetujui' && r.status !== 'DISETUJUI') return false;
          if (filter === 'Ditolak' && r.status !== 'DITOLAK') return false;
          return S.cocok(r, kueri, ['nama', 'nim', 'prodi', 'nomorSurat']) ||
            (kueri && JSON.stringify(r.data || {}).toLowerCase().indexOf(kueri.toLowerCase()) >= 0);
        });
      }

      function gambarList() {
        var f = terfilter();
        el.querySelector('[data-hitung]').textContent = f.length;
        if (!f.length) { listEl.innerHTML = UI.kosong('Antrean Kosong', 'Tidak ada pengajuan pada filter ini.', 'inbox'); return; }

        listEl.innerHTML = f.map(function (r) {
          var d2 = r.data || {};
          var ringkas = d2.instansi || d2.judulFinal || d2.judul || d2.mataKuliah || d2.keperluan || '-';
          return '<div class="q-item' + (A.pilih[cfg.k] === r.id ? ' active' : '') + '" data-id="' + F.esc(r.id) + '">' +
            (r.status === 'MENUNGGU'
              ? '<input type="checkbox" data-pick="' + F.esc(r.id) + '" style="width:17px;height:17px;accent-color:var(--orange-600);margin-top:11px;flex:none">'
              : '<span style="width:17px;flex:none"></span>') +
            '<div class="ava">' + F.inisial(r.nama) + '</div>' +
            '<div class="grow" style="min-width:0">' +
            '<div class="nm truncate">' + F.esc(r.nama) + '</div>' +
            '<div class="meta mono">' + F.esc(r.nim) + ' • ' + F.esc(r.prodiKode) + ' • Smt ' + r.semester + '</div>' +
            (cfg.set.length > 1
              ? '<div class="tiny mt1"><span class="badge ' + (r.jenis === cfg.k ? 'badge-blue' : 'badge-orange') + '">' +
              F.esc(r.jenisLabel) + '</span></div>' : '') +
            '<div class="sub truncate">' + F.esc(ringkas) + '</div>' +
            '<div class="tiny muted mt1">' + ik('clock', 11) + ' ' + F.relatif(r.tanggalAjukan) + '</div>' +
            '</div>' +
            '<div style="flex:none;text-align:right">' + F.statusBadge(r.status) +
            (r.nomorSurat ? '<div class="tiny mono muted mt1">' + F.esc(r.nomorSurat) + '</div>' : '') + '</div>' +
            '</div>';
        }).join('');

        Array.prototype.forEach.call(listEl.querySelectorAll('.q-item'), function (it) {
          it.onclick = function (e) {
            if (e.target.getAttribute && e.target.getAttribute('data-pick')) return;
            A.pilih[cfg.k] = it.getAttribute('data-id');
            gambarList();
            gambarDetail();
          };
        });
        Array.prototype.forEach.call(listEl.querySelectorAll('[data-pick]'), function (c) {
          c.checked = !!dipilih[c.getAttribute('data-pick')];
          c.onchange = function () {
            dipilih[c.getAttribute('data-pick')] = c.checked;
            var n = Object.keys(dipilih).filter(function (k) { return dipilih[k]; }).length;
            btnMassal.querySelector('[data-jml]').textContent = n;
            btnMassal.disabled = n === 0;
          };
        });
      }

      function gambarDetail() {
        var id = A.pilih[cfg.k];
        var r = null;
        semua.forEach(function (x) { if (x.id === id) r = x; });
        if (!r) {
          detailEl.innerHTML = '<div class="card"><div class="card-body">' +
            UI.kosong('Pilih Pengajuan', 'Klik salah satu baris antrean untuk meninjau berkas.', 'eye') + '</div></div>';
          return;
        }
        detailEl.innerHTML = A.panelDetail(cfg, r);
        detailEl.setAttribute('data-untuk', r.id);
        A.pasangAksiDetail(cfg, r, detailEl);
        if (isianLama) { A.pulihkanIsian(detailEl, isianLama); isianLama = null; }
      }

      el.querySelector('[data-cari]').addEventListener('input', S.debounce(function (e) {
        kueri = e.target.value; gambarList();
      }, 200));

      Array.prototype.forEach.call(el.querySelectorAll('[data-filter] [data-f]'), function (b) {
        b.onclick = function () {
          filter = b.getAttribute('data-f');
          Array.prototype.forEach.call(el.querySelectorAll('[data-filter] [data-f]'), function (x) {
            x.className = 'btn btn-sm ' + (x === b ? 'btn-primary' : 'btn-ghost');
          });
          gambarList();
        };
      });

      btnMassal.onclick = function (ev) {
        var ids = Object.keys(dipilih).filter(function (k) { return dipilih[k]; });
        if (!ids.length) return;
        UI.konfirmasi({
          judul: 'Setujui ' + ids.length + ' Pengajuan Sekaligus?',
          isi: 'Nomor surat dikunci berurutan, lalu PDF dibuat otomatis di latar untuk setiap pengajuan. ' +
            'Tindakan ini tidak dapat dibatalkan.',
          tombol: 'Ya, Setujui Semua'
        }).then(function (ya) {
          if (!ya) return;
          UI.sibuk(ev.currentTarget, true, 'Memproses…');
          API.kirim('prosesMassal', { ids: ids, keputusan: 'SETUJU' }).then(function (res) {
            UI.sibuk(ev.currentTarget, false);
            if (!res.success) return UI.toast(res.message, 'error');
            UI.toast(res.message, res.data.gagal.length ? 'warn' : 'ok');
            dipilih = {};
            A.prosesLatar(ids);   // PDF dibuat di latar, panel segar sendiri
          });
        });
      };

      gambarList();
      gambarDetail();
    },

    /* ------------------------------------------ Helper master dokumen */

    dokumenAlur: function (alur, hanyaOtomatis) {
      return ((A.D && A.D.master.dokumen) || []).filter(function (d) {
        if (d.alur !== alur || !d.statusAktif) return false;
        return hanyaOtomatis ? d.terbitOtomatis : true;
      });
    },

    /** Kolom yang wajib dilengkapi admin, diambil dari peta placeholder. */
    fieldAdmin: function (alur, hanyaOtomatis) {
      var kode = A.dokumenAlur(alur, hanyaOtomatis).map(function (d) { return d.kode; });
      var out = [], sudah = {};
      ((A.D && A.D.master.peta) || []).forEach(function (p) {
        if (kode.indexOf(p.kodeDokumen) < 0 || p.sumber !== 'ADMIN') return;
        if (sudah[p.placeholder]) return;
        sudah[p.placeholder] = true;
        out.push({
          nama: p.placeholder, label: p.label || p.placeholder,
          tipe: p.tipeField || 'text', wajib: p.wajib === true || p.wajib === 'TRUE' || p.wajib === 'true',
          bantuan: p.bantuan || '',
          opsi: String(p.opsi || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean)
        });
      });
      return out;
    },

    fieldAdminDokumen: function (kode) {
      var out = [];
      ((A.D && A.D.master.peta) || []).forEach(function (p) {
        if (p.kodeDokumen !== kode || p.sumber !== 'ADMIN') return;
        out.push({
          nama: p.placeholder, label: p.label || p.placeholder,
          tipe: p.tipeField || 'text', wajib: p.wajib === true || p.wajib === 'TRUE' || p.wajib === 'true',
          bantuan: p.bantuan || '',
          opsi: String(p.opsi || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean)
        });
      });
      return out;
    },

    /* --------------------------------------------- PANEL DETAIL ANTREAN */

    panelDetail: function (cfg, r) {
      var d = r.data || {};
      var master = A.D.master;
      var dosenNidn = (master.dosen || []).filter(function (x) { return String(x.kategori).toUpperCase() === 'NIDN' && x.statusAktif; });

      var head =
        '<div class="card" style="overflow:hidden">' +
        '<div class="detail-head">' +
        '<div class="between"><span class="badge badge-orange">' + F.esc(r.status === 'MENUNGGU' ? 'Aktif Direview' : r.status) + '</span>' +
        '<span class="tiny mono" style="color:rgba(255,255,255,.55)">#' + F.esc(r.id) + '</span></div>' +
        '<div class="t mt1">' + F.esc(r.nama) + '</div>' +
        '<div class="s">Pengajuan masuk: ' + F.tglJam(r.tanggalAjukan) + '</div></div>' +
        '<div class="detail-body">';

      // Pemeriksaan otomatis
      var cek =
        '<div class="mini-stat mb2">' +
        '<div class="ms"><div class="l">Status Akademik</div><div class="v">Semester ' + r.semester + ' • Aktif</div></div>' +
        '<div class="ms"><div class="l">Program Studi</div><div class="v" style="font-size:12.5px">' + F.esc(r.prodi) + '</div></div>' +
        '<div class="ms"><div class="l">NIM</div><div class="v mono">' + F.esc(r.nim) + '</div></div>' +
        '<div class="ms"><div class="l">Angkatan</div><div class="v">' + F.esc(r.tahunMasuk) + '</div></div>' +
        '</div>';

      // Rincian data pengajuan
      var rincian = '<h4 style="font-size:13.5px;margin:4px 0 9px">Rincian Pengajuan</h4><dl class="kv mb2">' +
        Object.keys(d).filter(function (k) {
          return d[k] !== '' && d[k] !== null && d[k] !== undefined && typeof d[k] !== 'object' && k !== 'setuju';
        }).map(function (k) {
          return '<dt>' + F.esc(S.Mahasiswa.labelField(k)) + '</dt><dd>' + F.esc(d[k]) + '</dd>';
        }).join('') + '</dl>';

      // Anggota kelompok magang
      var anggotaHtml = '';
      if (cfg.k === 'MAGANG' && Array.isArray(d.anggota)) {
        anggotaHtml = '<h4 style="font-size:13.5px;margin:12px 0 8px">Anggota Kelompok (' + d.anggota.length + ')</h4>' +
          '<div class="checkgrid mb2">' + d.anggota.map(function (a) {
            return '<div class="checkrow"><div class="grow"><div class="bold">' + F.esc(a.nama) + '</div>' +
              '<div class="tiny muted mono">' + F.esc(a.nim) + '</div></div>' +
              '<span class="badge badge-gray">' + F.esc(a.peran) + '</span></div>';
          }).join('') + '</div>';
      }

      if (cfg.k === 'KONFIRMASI_MAGANG') {
        var gabung = (d.anggotaAcc || []).concat(d.anggotaDitolak || []);
        var accNim = (d.anggotaAcc || []).map(function (a) { return String(a.nim); });
        anggotaHtml =
          '<div class="notice warn mb2" style="font-size:12.5px">' + ik('alert', 16) +
          '<span><b>Perhatian PRD 5.B.3:</b> anggota yang dicentang ACC otomatis tuntas dan kehilangan akses pengajuan ulang. ' +
          'Centang sesuai surat balasan resmi terlampir.</span></div>' +
          '<h4 style="font-size:13.5px;margin:4px 0 8px">Validasi Anggota Kelompok</h4>' +
          '<div class="checkgrid mb2" data-accbox>' + gabung.map(function (a) {
            var on = accNim.indexOf(String(a.nim)) >= 0;
            return '<label class="checkrow' + (on ? '' : ' off') + '">' +
              '<input type="checkbox" data-acc="' + F.esc(a.nim) + '"' + (on ? ' checked' : '') +
              (r.status !== 'MENUNGGU' ? ' disabled' : '') + '>' +
              '<div class="grow"><div class="bold">' + F.esc(a.nama) + '</div>' +
              '<div class="tiny muted mono">' + F.esc(a.nim) + ' • ' + F.esc(a.peran || '-') + '</div></div>' +
              '<span class="badge ' + (on ? 'badge-green' : 'badge-red') + '">' + (on ? 'Di-ACC' : 'Ditolak Mitra') + '</span></label>';
          }).join('') + '</div>' +
          '<h4 style="font-size:13.5px;margin:12px 0 8px">Dosen Pembimbing Magang</h4>' +
          (r.dosenMagang && r.dosenMagang.nama
            ? '<div class="checkrow mb2"><div class="grow"><div class="bold">' + F.esc(r.dosenMagang.nama) + '</div>' +
              '<div class="tiny muted mono">NIDN ' + F.esc(r.dosenMagang.nidn || '-') + ' • ' + F.esc(r.dosenMagang.hp || '-') + '</div></div>' +
              '<span class="badge ' + (r.dosenMagang.status === 'FINAL' ? 'badge-green' : 'badge-amber') + '">' + F.esc(r.dosenMagang.status === 'FINAL' ? 'Final' : 'Sementara') + '</span></div>'
            : '<div class="notice mb2" style="font-size:12.5px">' + ik('info', 16) + '<span>Belum ditetapkan. Atur di menu ' +
              '<a href="#" data-nav="admview" data-view="dosen_magang">Setting Dosen Magang</a> — otomatis tampil di sini.</span></div>') +
          (d.buktiUrl
            ? '<h4 style="font-size:13.5px;margin:12px 0 8px">Bukti Surat Balasan</h4>' +
            '<button class="btn btn-ghost btn-block mb2" data-berkas="' + F.esc(d.buktiUrl) +
            '" data-berkas-nama="Surat Balasan Instansi">' +
            ik('eye', 15) + 'Pratinjau Surat Balasan Instansi</button>' : '');
      }

      // Berkas unggahan umum
      var berkas = '';
      ['buktiUrl', 'lembarUrl'].forEach(function (k) {
        if (d[k] && cfg.k !== 'KONFIRMASI_MAGANG') {
          var judulBerkas = (k === 'buktiUrl' ? 'Bukti Transfer / Berkas' : 'Lembar Pengesahan');
          berkas += '<button class="btn btn-ghost btn-block mb1" data-berkas="' + F.esc(d[k]) +
            '" data-berkas-nama="' + F.esc(judulBerkas) + '">' +
            ik('eye', 15) + 'Pratinjau ' + judulBerkas + '</button>';
        }
      });

      // Plotting penguji (Sempro & Sidang)
      var penguji = '';
      if (r.jenis === 'SEMPRO' || r.jenis === 'SIDANG') {
        var pg = r.penguji || {};
        var sidang = r.jenis === 'SIDANG';
        var auto = r.autoPenguji || {};
        function sel(idAttr, label, nilai, wajib) {
          return '<div class="field"><label>' + label + (wajib ? ' <span class="req">*</span>' : '') + '</label>' +
            '<select class="select" data-pg="' + idAttr + '">' +
            '<option value="">— Pilih dosen ber-NIDN —</option>' +
            dosenNidn.map(function (x) {
              var teks = x.nama + (x.nidn ? ' — NIDN: ' + x.nidn : '');
              return '<option value="' + F.esc(x.id) + '"' + (nilai && nilai.indexOf(x.nama) === 0 ? ' selected' : '') + '>' + F.esc(teks) + '</option>';
            }).join('') + '</select></div>';
        }
        /** Penguji otomatis (tidak perlu dipilih admin) — tampil sebagai isian terkunci. */
        function otomatis(label, nama, sumber, idAttr) {
          if (!nama) {
            return sel(idAttr, label, '', true) +
              '<div class="hint" style="margin-top:-6px;margin-bottom:10px">' + F.esc(sumber) + ' belum tercatat — pilih manual.</div>';
          }
          return '<div class="field"><label>' + label + '</label>' +
            '<div class="input" style="background:var(--surface);display:flex;align-items:center;gap:8px">' + ik('lock', 14) +
            '<span class="grow truncate">' + F.esc(nama) + '</span><span class="badge badge-blue">Otomatis</span></div>' +
            '<div class="hint">Diambil dari ' + F.esc(sumber) + '.</div></div>';
        }
        var lembar = (r.dokumen || []).filter(function (x) { return /^F_NILAI_SIDANG_/.test(x.kode); });
        var lembarDibuat = (r.antrean || []).some(function (j) { return /^F_NILAI_SIDANG_/.test(j.kode) && j.status !== 'GAGAL'; });
        penguji =
          '<div style="border:1px solid var(--line);border-radius:12px;padding:14px;margin:14px 0;background:var(--surface-2)">' +
          '<div class="between mb2"><h4 style="font-size:13.5px">' + (sidang ? 'PENETAPAN PENGUJI SIDANG SKRIPSI' : 'Penetapan Dosen Penguji Sempro') + '</h4>' +
          '<span class="badge badge-orange">Wajib NIDN</span></div>' +
          (sidang
            ? otomatis('Penguji 1', auto.p1 || pg.penguji1, 'penguji Seminar Proposal', 'penguji1Id') +
              otomatis('Penguji 2', auto.p2 || pg.penguji2, 'dosen pembimbing (SK Pembimbing)', 'penguji2Id') +
              sel('penguji3Id', 'Penguji 3', pg.penguji3, true)
            : sel('penguji1Id', 'Dosen Penguji Sempro', pg.penguji1, true)) +
          '<div class="grid-2">' +
          '<div class="field"><label>Tanggal Ujian <span class="req">*</span></label>' +
          '<input class="input" type="date" data-pg="tanggalJadwal" value="' + F.inputTgl(pg.tanggalJadwal) + '"></div>' +
          '<div class="field"><label>Jam ' + (sidang ? 'Sidang' : 'Ujian') + ' <span class="req">*</span></label>' +
          '<input class="input" type="time" data-pg="jamJadwal" value="' + F.esc(pg.jamJadwal || '09:00') + '"></div></div>' +
          '<div class="field"><label>Ruang Seminar / Media <span class="req">*</span></label>' +
          '<input class="input" data-pg="ruang" maxlength="120" placeholder="Contoh: Ruang Sidang Kampus Utama (Lt. 2)" value="' + F.esc(pg.ruang || '') + '"></div>' +
          '<button class="btn btn-dark btn-block" data-simpan-penguji>' + ik('calendar', 15) + (sidang ? 'Simpan Jadwal' : 'Simpan Jadwal &amp; Penguji') + '</button>' +
          (pg.tanggalJadwal ? '<div class="notice ok mt2" style="font-size:12.5px">' + ik('checkCircle', 16) +
            '<span>Jadwal tersimpan &amp; tampil di akun mahasiswa: ' + F.hari(pg.tanggalJadwal) + ', ' + F.tgl(pg.tanggalJadwal) + ' pukul ' + F.esc(pg.jamJadwal) + ' WIB.</span></div>' : '') +
          (sidang && pg.tanggalJadwal
            ? '<h4 style="font-size:13px;margin:14px 0 8px">Lembar Penilaian Penguji <span class="badge badge-gray" style="margin-left:4px">' + ik('lock', 10) + ' Khusus admin</span></h4>' +
              (lembar.length ? '<div data-lembar>' + S.Dok.daftar(lembar, true) + '</div>'
                : '<div class="small muted">' + (lembarDibuat ? '<span class="spinner dark" style="width:12px;height:12px"></span> Lembar penilaian Penguji 1, 2 &amp; 3 sedang dibuat…' : 'Lembar penilaian belum tersedia.') + '</div>')
            : '') +
          '</div>';

        // IPK & predikat → SK Kelulusan (Yudisium) + SKL
        if (sidang && pg.tanggalJadwal && r.status !== 'DITOLAK') {
          var dokSkl = (r.dokumen || []).filter(function (x) { return x.kode === 'SKL'; });
          var dokSkk = (r.dokumen || []).filter(function (x) { return x.kode === 'SK_KELULUSAN'; });
          var ipkDibuat = (r.antrean || []).some(function (j) { return (j.kode === 'SKL' || j.kode === 'SK_KELULUSAN') && j.status !== 'GAGAL'; });
          penguji +=
            '<div style="border:1px solid var(--line);border-radius:12px;padding:14px;margin:14px 0;background:var(--surface-2)">' +
            '<div class="between mb2"><h4 style="font-size:13.5px">IPK &amp; Predikat Kelulusan</h4>' +
            (pg.ipk ? '<span class="badge badge-green">Tersimpan</span>' : '<span class="badge badge-gray">Belum diisi</span>') + '</div>' +
            '<div class="grid-2">' +
            '<div class="field"><label>IPK <span class="req">*</span></label>' +
            '<input class="input mono" data-ipk inputmode="decimal" maxlength="4" placeholder="3.67" value="' + F.esc(pg.ipk || '') + '"></div>' +
            '<div class="field"><label>Predikat <span class="muted">(otomatis)</span></label>' +
            '<input class="input" data-predikat readonly style="background:var(--surface)" value="' + F.esc(pg.predikat || '') + '"></div></div>' +
            '<div class="row-wrap">' +
            '<button class="btn btn-ghost" data-pv-ipk>' + ik('eye', 15) + 'Pratinjau SKL</button>' +
            '<button class="btn btn-dark grow" data-simpan-ipk>' + ik('check', 15) + 'Simpan</button></div>' +
            (pg.ipk
              ? '<div class="mt2">' +
                (dokSkk.length || dokSkl.length
                  ? '<div class="dok-list">' +
                    (dokSkk.length ? '<div class="dok-item" style="flex-wrap:wrap"><span class="dok-ic">' + ik('doc', 16) + '</span>' +
                      '<div class="grow" style="min-width:170px"><div class="dok-nama">' + F.esc(dokSkk[0].nama) + '</div>' +
                      '<div class="tiny mono muted">' + F.esc(dokSkk[0].nomor || '-') + ' <span class="badge badge-gray" style="font-family:var(--ff)">' + ik('lock', 10) + ' Khusus admin</span></div></div>' +
                      '<button class="btn btn-soft btn-sm" data-cetak-skk>' + ik('printer', 14) + 'Cetak</button></div>' : '') +
                    (dokSkl.length ? '<div class="dok-item" style="flex-wrap:wrap"><span class="dok-ic">' + ik('award', 16) + '</span>' +
                      '<div class="grow" style="min-width:170px"><div class="dok-nama">' + F.esc(dokSkl[0].nama) + '</div>' +
                      '<div class="tiny mono muted">' + F.esc(dokSkl[0].nomor || '-') + '</div></div>' +
                      '<div class="row-wrap" style="gap:6px;margin-left:auto">' +
                      '<button class="btn btn-ghost btn-sm" data-pv-skl title="Pratinjau">' + ik('eye', 14) + '</button>' +
                      (pg.sklKirim
                        ? '<span class="badge badge-green">' + ik('check', 11) + ' Terkirim ke mahasiswa</span>'
                        : '<button class="btn btn-primary btn-sm" data-kirim-skl>' + ik('send', 14) + 'Kirim ke akun mahasiswa</button>') +
                      '</div></div>' : '') +
                    '</div>'
                  : '') +
                (ipkDibuat ? '<div class="small muted mt1"><span class="spinner dark" style="width:12px;height:12px"></span> SK Kelulusan &amp; SKL sedang dibuat…</div>' : '') +
                '</div>'
              : '') +
            '</div>';
        }
      }

      // Pernyataan Revisi Sempro → penetapan dosen pembimbing + penerbitan SK.
      var skBlok = '';
      if (r.jenis === 'REVISI_SEMPRO') {
        skBlok =
          '<div style="border:1px solid var(--line);border-radius:12px;padding:14px;margin:14px 0;background:var(--surface-2)">' +
          '<div class="between mb2"><h4 style="font-size:13.5px">Penerbitan SK Pembimbing Skripsi</h4>' +
          '<span class="badge badge-orange">PRD 5.A.4 &amp; 5.B</span></div>' +
          '<div class="tiny muted mb2">SK Pembimbing <b>baru dapat diterbitkan</b> setelah mahasiswa melaksanakan sempro, ' +
          'melengkapi formulir Pernyataan Revisi, dan berkas diverifikasi BAAK. Penerbitan SK otomatis membuka menu Sidang Skripsi.</div>' +
          (r.status === 'MENUNGGU'
            ? '<div class="field"><label>Dosen Pembimbing Skripsi <span class="req">*</span></label>' +
            '<select class="select" data-pembimbing><option value="">— Pilih dosen ber-NIDN —</option>' +
            dosenNidn.map(function (x) {
              return '<option value="' + F.esc(x.id) + '">' + F.esc(x.nama + (x.nidn ? ' — NIDN: ' + x.nidn : '')) + '</option>';
            }).join('') + '</select></div>' +
            '<div class="row-wrap"><button class="btn btn-ghost" data-pv-sk>' + ik('eye', 15) + 'Pratinjau SK</button>' +
            '<button class="btn btn-primary grow" data-terbit-sk>' + ik('award', 15) + 'Verifikasi Revisi &amp; Terbitkan SK Pembimbing</button></div>'
            : '<div class="notice ok" style="font-size:12.5px">' + ik('checkCircle', 16) +
            '<span>SK ' + F.esc(r.nomorSurat || '-') + ' telah diterbitkan untuk pembimbing <b>' + F.esc(d.pembimbing || '-') + '</b>.</span></div>') +
          '</div>';
      }

      // Kolom yang harus dilengkapi admin sebelum dokumen otomatis diterbitkan.
      var defAdmin = A.fieldAdmin(r.jenis, true);
      var blokAdmin = (r.status === 'MENUNGGU' && defAdmin.length)
        ? '<div style="border:1px solid var(--line);border-radius:12px;padding:14px;margin:14px 0;background:var(--surface-2)">' +
        '<div class="between mb2"><h4 style="font-size:13.5px">Data yang Dilengkapi BAAK</h4>' +
        '<span class="badge badge-blue">' + defAdmin.length + ' kolom</span></div>' +
        '<div class="tiny muted mb2">Kolom ini berasal dari placeholder bertanda “Input Admin” pada template dokumen.</div>' +
        S.Form.render(defAdmin, { prefix: 'adm', tanpaKotak: true, dosen: (A.D.master.dosen || []) }) +
        '</div>'
        : '';

      // Dokumen yang akan / sudah terbit.
      var daftarOtomatis = A.dokumenAlur(r.jenis, true);
      var blokRencana = (r.status === 'MENUNGGU' && daftarOtomatis.length)
        ? '<div class="notice mb2" style="font-size:12.5px">' + ik('file', 16) +
        '<span><b>Dokumen yang akan terbit:</b> ' +
        daftarOtomatis.map(function (d) { return F.esc(d.nama) + (d.pakaiNomor ? '' : ' (tanpa nomor)'); }).join(' • ') +
        '</span></div>'
        : '';

      var dokUmum = (r.dokumen || []).filter(function (x) { return !/^F_NILAI_SIDANG_|^SKL$|^SK_KELULUSAN$/.test(x.kode); });
      var jobAktif = (r.antrean || []).filter(function (j) { return j.status !== 'GAGAL'; });
      var jobGagal = (r.antrean || []).filter(function (j) { return j.status === 'GAGAL'; });
      var blokTerbit = (dokUmum.length
        ? '<h4 style="font-size:13.5px;margin:14px 0 8px">Dokumen Terbit (' + dokUmum.length + ')</h4>' +
        '<div data-dok-umum>' + S.Dok.daftar(dokUmum, true) + '</div>'
        : '') +
        (jobAktif.length ? '<div class="notice warn mt2" style="font-size:12.5px">' + '<span class="spinner dark" style="width:14px;height:14px"></span>' +
          '<span>' + jobAktif.length + ' dokumen sedang dibuat di server — tampil otomatis begitu selesai.</span></div>' : '') +
        (jobGagal.length ? '<div class="notice danger mt2" style="font-size:12.5px">' + ik('alert', 16) +
          '<span>' + jobGagal.length + ' dokumen gagal dibuat: ' + F.esc(jobGagal[0].pesan || '-') + '</span>' +
          '<button class="btn btn-sm btn-ghost" data-ulangi-dok>' + ik('refresh', 13) + 'Ulangi</button></div>' : '');

      // Dokumen alur ini yang belum otomatis terbit → dapat diterbitkan manual.
      var sudahTerbit = (r.dokumen || []).map(function (d) { return d.kode; });
      var manual = (r.status === 'DISETUJUI')
        ? A.dokumenAlur(r.jenis, false).filter(function (d) { return sudahTerbit.indexOf(d.kode) < 0; })
        : [];
      var blokManual = manual.length
        ? '<h4 style="font-size:13.5px;margin:14px 0 8px">Terbitkan Dokumen Tambahan</h4>' +
        '<div class="dok-list">' + manual.map(function (d) {
          return '<div class="dok-item"><span class="dok-ic">' + ik('plus', 16) + '</span>' +
            '<div class="grow" style="min-width:0"><div class="dok-nama truncate">' + F.esc(d.nama) + '</div>' +
            '<div class="tiny muted">' + (d.pakaiNomor ? 'Bernomor • ' + F.esc(d.formatNomor) : 'Tanpa nomor surat') + '</div></div>' +
            '<button class="btn btn-soft btn-sm" data-terbit="' + F.esc(d.kode) + '">' + ik('send', 14) + 'Terbitkan</button></div>';
        }).join('') + '</div>'
        : '';

      var keputusan = '';
      if (r.jenis === 'REVISI_SEMPRO' && r.status === 'MENUNGGU') {
        keputusan =
          '<button class="btn btn-danger btn-block mt1" data-tolak>' + ik('xCircle', 16) + 'Tolak / Minta Perbaikan Berkas</button>';
      } else if (r.status === 'MENUNGGU') {
        keputusan =
          '<div class="field mt2"><label>Catatan Internal BAAK <span class="muted">(opsional)</span></label>' +
          '<input class="input" data-catatan maxlength="400" placeholder="Tambah catatan internal…"></div>' +
          (daftarOtomatis.length > 1
            ? '<div class="field mt1"><label>Dokumen yang dipratinjau</label><select class="select" data-pv-kode>' +
              daftarOtomatis.map(function (x) { return '<option value="' + F.esc(x.kode) + '">' + F.esc(x.nama) + '</option>'; }).join('') + '</select></div>'
            : '') +
          '<div class="row-wrap mt1">' +
          (daftarOtomatis.length ? '<button class="btn btn-ghost" data-pratinjau>' + ik('eye', 16) + 'Pratinjau</button>' : '') +
          '<button class="btn btn-primary grow" data-setuju>' + ik('checkCircle', 16) + 'Setujui &amp; Terbitkan Dokumen</button>' +
          '<button class="btn btn-danger" data-tolak>' + ik('xCircle', 16) + 'Tolak</button>' +
          '</div>' +
          '<div class="tiny muted center mt1">Pratinjau tidak memakai nomor. Nomor surat dikunci saat "Setujui" ditekan; PDF dibuat di latar belakang.</div>';
      } else {
        keputusan =
          '<div class="notice ' + (r.status === 'DISETUJUI' ? 'ok' : 'danger') + ' mt2">' +
          ik(r.status === 'DISETUJUI' ? 'checkCircle' : 'alert', 17) +
          '<span>' + (r.status === 'DISETUJUI'
            ? 'Disetujui ' + F.tglJam(r.tanggalProses) + ' oleh ' + F.esc(r.prosesOleh || '-') + '.'
            : 'Ditolak ' + F.tglJam(r.tanggalProses) + '. Alasan: ' + F.esc(r.alasanTolak || '-')) + '</span></div>' +
          (r.dokumen && r.dokumen.length
            ? '<div class="row-wrap mt2"><button class="btn btn-ghost" data-cetak>' + ik('printer', 15) + 'Cetak Ulang</button></div>' : '');
      }

      return head + cek + rincian + anggotaHtml + berkas + penguji + skBlok +
        blokRencana + blokTerbit + blokManual + blokAdmin + keputusan + '</div></div>';
    },

    /** Predikat dari IPK mengikuti pengaturan PREDIKAT_ATURAN (sama dengan server). */
    predikat: function (ipk) {
      var n = parseFloat(String(ipk).replace(',', '.'));
      if (isNaN(n)) return '';
      var aturan = String((A.D.konfigurasi || {}).PREDIKAT_ATURAN || '3.51:Dengan Pujian (Cumlaude)|3.01:Sangat Memuaskan|2.76:Memuaskan|2.00:Cukup')
        .split('|').map(function (x) { var i = x.indexOf(':'); return [parseFloat(x.substring(0, i)), x.substring(i + 1).trim()]; })
        .filter(function (x) { return !isNaN(x[0]); }).sort(function (a, b) { return b[0] - a[0]; });
      for (var i = 0; i < aturan.length; i++) if (n >= aturan[i][0]) return aturan[i][1];
      return '-';
    },

    /** Tampilkan PDF draf dari server; opsi.tombol → aksi lanjutan (mis. Setujui). */
    pratinjauServer: function (btn, data, opsi) {
      UI.sibuk(btn, true, 'Menyusun pratinjau…');
      return API.kirim('pratinjauDraf', data).then(function (res) {
        UI.sibuk(btn, false);
        if (!res.success) return UI.toast(res.message, 'error');
        S.Dok.pratinjau(res.data, opsi || {});
      });
    },

    pasangAksiDetail: function (cfg, r, root) {
      var dokUmum = (r.dokumen || []).filter(function (x) { return !/^F_NILAI_SIDANG_|^SKL$|^SK_KELULUSAN$/.test(x.kode); });
      S.Dok.pasang(root.querySelector('[data-dok-umum]'), dokUmum);
      S.Dok.pasang(root.querySelector('[data-lembar]'), (r.dokumen || []).filter(function (x) { return /^F_NILAI_SIDANG_/.test(x.kode); }));

      var bUlang = root.querySelector('[data-ulangi-dok]');
      if (bUlang) bUlang.onclick = function (ev) {
        UI.sibuk(ev.currentTarget, true, 'Mengulang…');
        API.kirim('ulangiDokumen', { idPengajuan: r.id }).then(function (res) {
          if (!res.success) { UI.sibuk(ev.currentTarget, false); return UI.toast(res.message, 'error'); }
          UI.toast(res.message, 'ok');
          A.prosesLatar([r.id]);
        });
      };

      // IPK → predikat otomatis
      var inIpk = root.querySelector('[data-ipk]'), inPred = root.querySelector('[data-predikat]');
      if (inIpk) inIpk.oninput = function () { inPred.value = inIpk.value ? A.predikat(inIpk.value) : ''; };
      var bPvIpk = root.querySelector('[data-pv-ipk]');
      if (bPvIpk) bPvIpk.onclick = function (ev) {
        if (!inIpk.value) return UI.toast('Isi IPK terlebih dahulu.', 'error');
        A.pratinjauServer(ev.currentTarget, { jenis: 'IPK', id: r.id, kode: 'SKL', ipk: inIpk.value, predikat: inPred.value });
      };
      var bIpk = root.querySelector('[data-simpan-ipk]');
      if (bIpk) bIpk.onclick = function (ev) {
        var ipk = parseFloat(String(inIpk.value).replace(',', '.'));
        if (isNaN(ipk) || ipk < 0 || ipk > 4) return UI.toast('IPK harus angka 0.00 – 4.00 (contoh: 3.67).', 'error');
        var btn = ev.currentTarget;
        UI.sibuk(btn, true, 'Menyimpan…');
        API.kirim('simpanIpk', { idPengajuan: r.id, ipk: ipk.toFixed(2), predikat: inPred.value }).then(function (res) {
          UI.sibuk(btn, false);
          if (!res.success) return UI.toast(res.message, 'error');
          UI.toast(res.message, 'ok');
          r.penguji = Object.assign({}, r.penguji || {}, { ipk: res.data.ipk, predikat: res.data.predikat });
          r.antrean = (r.antrean || []).concat([{ kode: 'SKL', status: 'ANTRE' }, { kode: 'SK_KELULUSAN', status: 'ANTRE' }]);
          A.tambalPengajuan(r.id, {});
          A.prosesLatar([r.id]);
        });
      };
      var dokSkl = (r.dokumen || []).filter(function (x) { return x.kode === 'SKL'; })[0];
      var dokSkk = (r.dokumen || []).filter(function (x) { return x.kode === 'SK_KELULUSAN'; })[0];
      var bSkk = root.querySelector('[data-cetak-skk]');
      if (bSkk && dokSkk) bSkk.onclick = function () { S.Dok.pratinjau(dokSkk); };
      var bPvSkl = root.querySelector('[data-pv-skl]');
      if (bPvSkl && dokSkl) bPvSkl.onclick = function () { S.Dok.pratinjau(dokSkl); };
      var bKirimSkl = root.querySelector('[data-kirim-skl]');
      if (bKirimSkl) bKirimSkl.onclick = function (ev) {
        var btn = ev.currentTarget;
        UI.konfirmasi({
          judul: 'Kirim SKL ke Akun Mahasiswa?', sub: r.nama + ' • ' + r.nim,
          isi: 'SKL akan tampil di akun mahasiswa dan dapat diunduh. SK Kelulusan &amp; lembar penilaian tetap khusus admin.',
          tombol: 'Ya, Kirim SKL'
        }).then(function (ya) {
          if (!ya) return;
          UI.sibuk(btn, true, 'Mengirim…');
          API.kirim('kirimSkl', { idPengajuan: r.id }).then(function (res) {
            UI.sibuk(btn, false);
            if (!res.success) return UI.toast(res.message, 'error');
            UI.toast(res.message, 'ok');
            r.penguji = Object.assign({}, r.penguji || {}, { sklKirim: true });
            A.tambalPengajuan(r.id, {});
            A.muat();
          });
        });
      };

      var bPvSk = root.querySelector('[data-pv-sk]');
      if (bPvSk) bPvSk.onclick = function (ev) {
        var pid = (root.querySelector('[data-pembimbing]') || {}).value || '';
        if (!pid) return UI.toast('Pilih dosen pembimbing terlebih dahulu.', 'error');
        A.pratinjauServer(ev.currentTarget, { jenis: 'PENGAJUAN', id: r.id, kode: 'SK_PEMBIMBING', pembimbingId: pid }, {
          tombol: [{ id: 'pv-sk-ok', label: 'Terbitkan SK', ikon: 'award', klik: function () { UI.tutupModal(); terbitSk(root.querySelector('[data-terbit-sk]'), true); } }]
        });
      };

      // Terbitkan dokumen tambahan (yang tidak otomatis)
      Array.prototype.forEach.call(root.querySelectorAll('[data-terbit]'), function (b) {
        b.onclick = function (ev) { A.dialogTerbitManual(r, b.getAttribute('data-terbit'), ev.currentTarget); };
      });

      // Checkbox ACC per anggota (Konfirmasi Magang)
      Array.prototype.forEach.call(root.querySelectorAll('[data-acc]'), function (c) {
        c.onchange = function () {
          var row = c.closest('.checkrow');
          row.classList.toggle('off', !c.checked);
          var b = row.querySelector('.badge');
          b.className = 'badge ' + (c.checked ? 'badge-green' : 'badge-red');
          b.textContent = c.checked ? 'Di-ACC' : 'Ditolak Mitra';
        };
      });

      var btnPenguji = root.querySelector('[data-simpan-penguji]');
      if (btnPenguji) {
        btnPenguji.onclick = function (ev) {
          var v = {};
          Array.prototype.forEach.call(root.querySelectorAll('[data-pg]'), function (x) { v[x.getAttribute('data-pg')] = x.value; });
          if (r.jenis === 'SIDANG') {
            if ('penguji1Id' in v && !v.penguji1Id) return UI.toast('Penguji 1 wajib dipilih.', 'error');
            if ('penguji2Id' in v && !v.penguji2Id) return UI.toast('Penguji 2 wajib dipilih.', 'error');
            if (!v.penguji3Id) return UI.toast('Penguji 3 wajib dipilih.', 'error');
          } else if (!v.penguji1Id) return UI.toast('Dosen penguji wajib dipilih.', 'error');
          if (!v.tanggalJadwal) return UI.toast('Tanggal ujian wajib diisi.', 'error');
          if (!v.ruang) return UI.toast('Ruang / media ujian wajib diisi.', 'error');
          v.idPengajuan = r.id;
          var btn = ev.currentTarget;
          UI.sibuk(btn, true, 'Menyimpan…');
          API.kirim('simpanPenguji', v).then(function (res) {
            UI.sibuk(btn, false);
            if (!res.success) return UI.toast(res.message, 'error');
            UI.toast(res.message, 'ok');
            // Optimistic: jadwal langsung tampil; lembar penilaian dibuat di latar.
            r.penguji = Object.assign({}, r.penguji || {}, res.data.penugasan || {});
            if (res.data.antre) r.antrean = (r.antrean || []).concat([{ kode: 'F_NILAI_SIDANG_1', status: 'ANTRE' }]);
            A.tambalPengajuan(r.id, {});
            if (res.data.antre) A.prosesLatar([r.id]); else A.muat();
          });
        };
      }

      function terbitSk(btn, langsung) {
        var pid = (root.querySelector('[data-pembimbing]') || {}).value || '';
        if (!pid) return UI.toast('Pilih dosen pembimbing terlebih dahulu.', 'error');
        (langsung ? Promise.resolve(true) : UI.konfirmasi({
          judul: 'Terbitkan SK Pembimbing?',
          sub: r.nama + ' • ' + r.nim,
          isi: 'Nomor SK akan dikunci permanen dan menu <b>Sidang Skripsi</b> otomatis terbuka untuk mahasiswa ini.',
          tombol: 'Ya, Terbitkan SK'
        })).then(function (ya) {
          if (!ya) return;
          UI.sibuk(btn, true, 'Menerbitkan…');
          API.kirim('terbitkanSkPembimbing', { idPengajuan: r.id, pembimbingId: pid }).then(function (res) {
            UI.sibuk(btn, false);
            if (!res.success) return UI.toast(res.message, 'error');
            UI.toast(res.message, 'ok', 'SK Dikunci');
            var data = Object.assign({}, r.data || {}, { pembimbing: res.data.pembimbing });
            A.tambalPengajuan(r.id, {
              status: 'DISETUJUI', nomorSurat: res.data.nomorSurat, data: data, tanggalProses: new Date().toISOString(),
              antrean: [{ kode: 'SK_PEMBIMBING', status: 'ANTRE' }]
            });
            A.prosesLatar([r.id]);
          });
        });
      }
      var btnSk = root.querySelector('[data-terbit-sk]');
      if (btnSk) btnSk.onclick = function (ev) { terbitSk(ev.currentTarget, false); };

      var btnSetuju = root.querySelector('[data-setuju]');
      if (btnSetuju) {
        btnSetuju.onclick = function (ev) {
          var perubahan = {};
          var acc = root.querySelectorAll('[data-acc]');
          if (acc.length) {
            perubahan.anggotaAcc = [];
            Array.prototype.forEach.call(acc, function (c) {
              if (c.checked) perubahan.anggotaAcc.push({ nim: c.getAttribute('data-acc') });
            });
            if (!perubahan.anggotaAcc.length) return UI.toast('Centang minimal satu anggota yang diterima instansi.', 'error');
          }
          var catatan = (root.querySelector('[data-catatan]') || {}).value || '';

          var defAdm = A.fieldAdmin(r.jenis, true);
          var adminData = S.Form.ambil(root);
          var salahAdm = S.Form.periksa(defAdm, adminData);
          if (salahAdm) return UI.toast(salahAdm, 'error');

          var btn = ev.currentTarget;
          var kirim = function () {
            UI.sibuk(btn, true, 'Menyetujui…');
            API.kirim('prosesPengajuan', {
              id: r.id, keputusan: 'SETUJU', catatan: catatan,
              perubahan: perubahan, adminData: adminData
            }).then(function (res) {
              UI.sibuk(btn, false);
              if (!res.success) return UI.toast(res.message, 'error', 'Gagal Menyetujui');
              UI.toast(res.message, 'ok', 'Disetujui');
              // Optimistic: pindahkan ke riwayat seketika; PDF dibuat di latar.
              A.tambalPengajuan(r.id, {
                status: 'DISETUJUI', nomorSurat: res.data.nomorSurat, tanggalProses: res.data.tanggalProses,
                prosesOleh: res.data.prosesOleh, catatanAdmin: catatan,
                antrean: (res.data.rencana || []).map(function (x) { return { kode: x.kode, status: 'ANTRE' }; })
              });
              if (res.data.antre) A.prosesLatar([r.id]); else A.muat();
            });
          };
          if (ev.langsung) return kirim();
          UI.konfirmasi({
            judul: 'Setujui &amp; Terbitkan Dokumen?',
            sub: r.nama + ' • ' + r.nim,
            isi: 'Nomor surat berikutnya dikunci, lalu PDF ber-QR dibuat otomatis dan dikirim ke akun mahasiswa. ' +
              'Nomor surat tidak dapat dipakai ulang.',
            tombol: 'Ya, Setujui'
          }).then(function (ya) { if (ya) kirim(); });
        };
      }

      // Pratinjau sebelum disetujui — tanpa memakai nomor & tanpa membuat berkas.
      var btnPv = root.querySelector('[data-pratinjau]');
      if (btnPv) {
        btnPv.onclick = function (ev) {
          var perubahan = {};
          var acc = root.querySelectorAll('[data-acc]');
          if (acc.length) {
            perubahan.anggotaAcc = [];
            Array.prototype.forEach.call(acc, function (c) { if (c.checked) perubahan.anggotaAcc.push({ nim: c.getAttribute('data-acc') }); });
          }
          var kodePv = (root.querySelector('[data-pv-kode]') || {}).value || '';
          A.pratinjauServer(ev.currentTarget, {
            jenis: 'PENGAJUAN', id: r.id, kode: kodePv, perubahan: perubahan, adminData: S.Form.ambil(root)
          }, {
            tombol: [{
              id: 'pv-setuju', label: 'Setujui', ikon: 'checkCircle', klik: function () {
                UI.tutupModal();
                var bs = root.querySelector('[data-setuju]');
                if (bs) bs.onclick({ currentTarget: bs, langsung: true });
              }
            }]
          });
        };
      }

      var btnTolak = root.querySelector('[data-tolak]');
      if (btnTolak) {
        btnTolak.onclick = function () {
          UI.modal({
            judul: 'Tolak Pengajuan',
            sub: r.nama + ' • ' + r.nim,
            isi: '<div class="field"><label>Alasan Penolakan <span class="req">*</span></label>' +
              '<textarea class="textarea" id="tl-alasan" maxlength="500" placeholder="Contoh: NIK tidak sesuai KTP, mohon perbaiki dan ajukan ulang."></textarea>' +
              '<div class="hint">Alasan ini tampil langsung di akun mahasiswa sebagai catatan perbaikan.</div></div>' +
              '<div class="row-wrap" id="tl-cepat">' +
              ['Data tidak sesuai KTP / KK', 'Berkas tidak terbaca / buram', 'Belum memenuhi syarat SKS',
                'Bukti transfer tidak valid', 'Judul belum disetujui pembimbing'].map(function (x) {
                  return '<button class="btn btn-ghost btn-sm" data-cepat="' + F.esc(x) + '">' + F.esc(x) + '</button>';
                }).join('') + '</div>',
            kaki: '<button class="btn btn-ghost" data-tutup>Batal</button>' +
              '<button class="btn btn-danger" id="tl-ok">' + ik('xCircle', 15) + 'Tolak Pengajuan</button>',
            siap: function (box) {
              var ta = box.querySelector('#tl-alasan');
              Array.prototype.forEach.call(box.querySelectorAll('[data-cepat]'), function (b) {
                b.onclick = function () { ta.value = b.getAttribute('data-cepat'); ta.focus(); };
              });
              box.querySelector('#tl-ok').onclick = function (ev) {
                var alasan = ta.value.trim();
                if (!alasan) return UI.toast('Alasan penolakan wajib diisi.', 'error');
                UI.sibuk(ev.currentTarget, true, 'Mengirim…');
                var btn = ev.currentTarget;
                API.kirim('prosesPengajuan', { id: r.id, keputusan: 'TOLAK', alasan: alasan }).then(function (res) {
                  UI.sibuk(btn, false);
                  if (!res.success) return UI.toast(res.message, 'error');
                  UI.tutupModal();
                  UI.toast('Pengajuan ditolak dan catatan dikirim ke mahasiswa.', 'ok');
                  A.tambalPengajuan(r.id, { status: 'DITOLAK', alasanTolak: alasan, tanggalProses: res.data.tanggalProses });
                  A.muat();
                });
              };
            }
          });
        };
      }

      var btnCetak = root.querySelector('[data-cetak]');
      if (btnCetak) {
        btnCetak.onclick = function (ev) {
          UI.sibuk(ev.currentTarget, true, 'Mencetak…');
          API.kirim('cetakUlang', { id: r.id }).then(function (res) {
            UI.sibuk(ev.currentTarget, false);
            if (!res.success) return UI.toast(res.message, 'error');
            UI.toast('Dokumen dicetak ulang.', 'ok');
            S.Dok.pratinjau(res.data);
            A.muat();
          });
        };
      }
    },

    /* ==================================================================
       ADMINISTRASI KELULUSAN (ADMIN)
       ================================================================== */

    renderKelulusan: function () {
      var el = document.getElementById('admview-kelulusan');
      var list = A.D.kelulusan || [];
      var menunggu = list.filter(function (k) { return k.tahap3Status === 'MENUNGGU'; }).length;
      var revisi = list.filter(function (k) { return k.tahap1Status === 'REVISI' || k.tahap2Status === 'REVISI'; }).length;
      var siap = list.filter(function (k) { return k.tahap3Status === 'SIAP'; }).length;

      el.innerHTML =
        '<div class="page-head"><div>' +
        '<div class="crumb">' + ik('shield', 12) + ' Panel BAAK <span class="sep">/</span> Kelulusan <span class="sep">/</span> <span class="cur">Administrasi Kelulusan</span></div>' +
        '<h2>Verifikasi Kelulusan &amp; Pelepasan Ijazah</h2>' +
        '<div class="desc">Mahasiswa mengirim Tahap 1 &amp; 2 sekaligus — BAAK cukup melakukan ACC satu kali pada Tahap 3.</div></div></div>' +

        '<div class="kpi-grid mb3">' +
        '<div class="kpi k-orange"><div class="kpi-icon">' + ik('inbox', 16) + '</div><div class="kpi-label">Menunggu ACC Tahap 3</div>' +
        '<div class="kpi-value">' + menunggu + '</div><div class="kpi-note">Berkas Tahap 1 &amp; 2 lengkap</div></div>' +
        '<div class="kpi k-red"><div class="kpi-icon">' + ik('refresh', 16) + '</div><div class="kpi-label">Diminta Revisi</div>' +
        '<div class="kpi-value">' + revisi + '</div><div class="kpi-note">Menunggu perbaikan mahasiswa</div></div>' +
        '<div class="kpi k-green"><div class="kpi-icon">' + ik('award', 16) + '</div><div class="kpi-label">Siap Ambil Ijazah</div>' +
        '<div class="kpi-value">' + siap + '</div><div class="kpi-note">Tahap 3 sudah di-ACC</div></div>' +
        '<div class="kpi dark"><div class="kpi-icon">' + ik('graduation', 16) + '</div><div class="kpi-label">Total Calon Wisudawan</div>' +
        '<div class="kpi-value">' + list.length + '</div><div class="kpi-note">Terdaftar pada sistem</div></div>' +
        '</div>' +

        '<div class="split">' +
        '<div class="card"><div class="card-head"><div><h3>Daftar Antrean Verifikasi</h3>' +
        '<div class="sub">Mahasiswa yang telah menyelesaikan revisi skripsi</div></div></div>' +
        '<div class="card-body" style="padding:14px 16px;border-bottom:1px solid var(--line)">' +
        '<div class="input-icon">' + ik('search', 16) + '<input class="input" id="kl-cari" placeholder="Cari NIM atau nama…"></div></div>' +
        '<div class="queue-list" id="kl-list"></div></div>' +
        '<div class="detail-panel" id="kl-detail"></div></div>';

      var kueri = '', pilih = A.pilihKelulusan;

      function gambarList() {
        var f = list.filter(function (k) { return S.cocok(k, kueri, ['nim', 'nama', 'judulFinal']); })
          .sort(function (x, y) { return (y.tahap3Status === 'MENUNGGU') - (x.tahap3Status === 'MENUNGGU'); });
        var box = el.querySelector('#kl-list');
        if (!f.length) { box.innerHTML = UI.kosong('Belum Ada Data', 'Belum ada mahasiswa yang menyelesaikan revisi skripsi.', 'award'); return; }
        box.innerHTML = f.map(function (k) {
          return '<div class="q-item' + (pilih === k.nim ? ' active' : '') + '" data-nim="' + F.esc(k.nim) + '">' +
            '<div class="ava">' + F.inisial(k.nama) + '</div>' +
            '<div class="grow" style="min-width:0"><div class="nm truncate">' + F.esc(k.nama) + '</div>' +
            '<div class="meta mono">' + F.esc(k.nim) + ' • ' + F.esc(k.prodi) + '</div>' +
            '<div class="row-wrap mt1" style="gap:6px">' +
            '<span class="badge ' + A.badgeTahap(k.tahap1Status) + '">T1</span>' +
            '<span class="badge ' + A.badgeTahap(k.tahap2Status) + '">T2</span>' +
            '<span class="badge ' + A.badgeTahap(k.tahap3Status) + '">T3' + (k.tahap3Status === 'MENUNGGU' ? ' · ACC' : '') + '</span>' +
            '</div></div></div>';
        }).join('');
        Array.prototype.forEach.call(box.querySelectorAll('.q-item'), function (it) {
          it.onclick = function () { pilih = A.pilihKelulusan = it.getAttribute('data-nim'); gambarList(); gambarDetail(); };
        });
      }

      function gambarDetail() {
        var k = null;
        list.forEach(function (x) { if (x.nim === pilih) k = x; });
        var box = el.querySelector('#kl-detail');
        if (!k) {
          box.innerHTML = '<div class="card"><div class="card-body">' +
            UI.kosong('Pilih Mahasiswa', 'Klik salah satu baris untuk meninjau berkas Tahap 1 & 2.', 'eye') + '</div></div>';
          return;
        }
        var dokKartu = (k.dokumen || []).filter(function (x) { return x.kode === 'F_PENGAMBILAN_IJAZAH'; });
        var dibuat = (k.antrean || []).some(function (j) { return j.status !== 'GAGAL'; });

        function panelTahap(n) {
          var status = n === 1 ? k.tahap1Status : k.tahap2Status;
          var url = n === 1 ? k.tahap1Url : k.tahap2Url;
          var catatan = n === 1 ? k.tahap1Catatan : k.tahap2Catatan;
          var judul = n === 1 ? 'Tahap 1: Penyerahan Skripsi &amp; Bebas Perpustakaan' : 'Tahap 2: Publikasi Jurnal Ilmiah / LOA';
          return '<div class="tahap ' + (status === 'DISETUJUI' ? 'done' : (status === 'MENUNGGU' ? 'now' : '')) + '">' +
            '<div class="tahap-h"><div class="tahap-n">' + (status === 'DISETUJUI' ? ik('check', 14, 2.6) : n) + '</div>' +
            '<div class="grow"><div class="bold" style="font-size:13.5px">' + judul + '</div>' +
            (n === 2 && k.tahap2Jurnal ? '<div class="tiny muted">' + F.esc(k.tahap2Jurnal) + '</div>' : '') + '</div>' +
            (status === 'MENUNGGU' ? '<span class="badge badge-blue"><span class="dot"></span>Terkirim</span>' : F.statusBadge(status || 'BELUM')) + '</div>' +
            '<div class="tahap-b">' +
            (url ? '<button class="btn btn-ghost btn-block mb1" data-kl-berkas="' + n + '">' +
              ik('eye', 15) + 'Pratinjau Berkas Unggahan Mahasiswa</button>' : '<div class="small muted mb1">Belum ada berkas diunggah.</div>') +
            (n === 2 && k.tahap2Link ? '<div class="small mb1">Tautan publikasi: <a href="' + F.esc(k.tahap2Link) + '" target="_blank" rel="noopener">' + F.esc(k.tahap2Link) + '</a></div>' : '') +
            (catatan ? '<div class="notice warn" style="font-size:12.5px">' + ik('alert', 16) + '<span>Catatan revisi: ' + F.esc(catatan) + '</span></div>' : '') +
            '</div></div>';
        }

        var bisaAcc = k.tahap3Status === 'MENUNGGU';
        box.innerHTML =
          '<div class="card" style="overflow:hidden">' +
          '<div class="detail-head"><div class="between"><span class="badge badge-orange">' +
          (k.tahap3Status === 'SIAP' ? 'Tahap 3 Di-ACC' : (bisaAcc ? 'Menunggu ACC' : 'Menunggu Berkas')) + '</span>' +
          '<span class="tiny mono" style="color:rgba(255,255,255,.55)">' + F.esc(k.nim) + '</span></div>' +
          '<div class="t mt1">' + F.esc(k.nama) + '</div>' +
          '<div class="s">' + F.esc(k.prodi) + ' • Angkatan ' + F.esc(k.tahunMasuk) + '</div></div>' +
          '<div class="detail-body">' +
          '<div class="notice mb2" style="font-size:12.5px">' + ik('book', 16) +
          '<span><b>Judul Skripsi Final:</b> ' + F.esc(k.judulFinal || '-') + '</span></div>' +
          panelTahap(1) + panelTahap(2) +
          '<div class="tahap ' + (k.tahap3Status === 'SIAP' ? 'done' : (bisaAcc ? 'now' : 'locked')) + '">' +
          '<div class="tahap-h"><div class="tahap-n">' + (k.tahap3Status === 'SIAP' ? ik('check', 14, 2.6) : '3') + '</div>' +
          '<div class="grow"><div class="bold" style="font-size:13.5px">Tahap 3: ACC BAAK &amp; Lembar Pengambilan Ijazah</div>' +
          '<div class="tiny muted">Satu kali ACC atas berkas Tahap 1 &amp; 2</div></div>' +
          F.statusBadge(k.tahap3Status === 'SIAP' ? 'SIAP' : (bisaAcc ? 'MENUNGGU' : 'TERKUNCI')) + '</div>' +
          '<div class="tahap-b">' +
          (k.tahap3Status === 'SIAP'
            ? (dokKartu.length ? '<div data-kl-kartu>' + S.Dok.daftar(dokKartu) + '</div>'
              : (k.kartuUrl
                ? '<div class="row-wrap"><button class="btn btn-ghost grow" id="kl-kartu-pv">' + ik('eye', 15) + 'Pratinjau</button>' +
                  '<button class="btn btn-primary grow" id="kl-kartu-dl">' + ik('download', 15) + 'Unduh Lembar Pengambilan Ijazah</button></div>'
                : '<div class="notice warn" style="font-size:12.5px">' + ik('clock', 16) + '<span>' + (dibuat ? 'Lembar Pengambilan Ijazah sedang dibuat…' : 'Lembar belum tersedia.') + '</span></div>'))
            : (bisaAcc
              ? '<button class="btn btn-ghost btn-block mb1" data-kl-pratinjau>' + ik('eye', 15) + 'Pratinjau Lembar Pengambilan Ijazah</button>' +
                '<input class="input mb1" data-kl-cat maxlength="400" placeholder="Catatan (wajib bila minta revisi)…">' +
                '<div class="row-wrap mb1" style="gap:14px;font-size:13px">' +
                '<label class="row" style="gap:6px;align-items:center"><input type="checkbox" data-kl-rev="1" checked> Revisi Tahap 1</label>' +
                '<label class="row" style="gap:6px;align-items:center"><input type="checkbox" data-kl-rev="2" checked> Revisi Tahap 2</label></div>' +
                '<div class="row-wrap"><button class="btn btn-primary grow" data-kl-acc>' + ik('checkCircle', 15) + 'ACC Tahap 3</button>' +
                '<button class="btn btn-danger" data-kl-revisi>' + ik('refresh', 15) + 'Minta Revisi</button></div>'
              : '<div class="small muted">Tombol ACC aktif setelah mahasiswa mengirim berkas Tahap 1 &amp; 2.</div>')) +
          '</div></div>' +
          '</div></div>';

        [1, 2].forEach(function (n) {
          var bf = box.querySelector('[data-kl-berkas="' + n + '"]');
          if (bf) bf.onclick = function () {
            S.Dok.pratinjau(A.berkas(n === 1 ? k.tahap1Url : k.tahap2Url, 'Berkas Tahap ' + n + ' — ' + k.nama));
          };
        });
        S.Dok.pasang(box.querySelector('[data-kl-kartu]'), dokKartu);
        var bkp = box.querySelector('#kl-kartu-pv'), bkd = box.querySelector('#kl-kartu-dl');
        if (bkp) bkp.onclick = function () { S.Dok.pratinjau(A.berkas(k.kartuUrl, 'Lembar Pengambilan Ijazah — ' + k.nama)); };
        if (bkd) bkd.onclick = function () { S.Dok.unduh(A.berkas(k.kartuUrl, 'Lembar Pengambilan Ijazah — ' + k.nama)); };

        var bpv = box.querySelector('[data-kl-pratinjau]');
        if (bpv) bpv.onclick = function (ev) {
          var btn = ev.currentTarget;
          UI.sibuk(btn, true, 'Menyusun pratinjau…');
          API.kirim('pratinjauDraf', { jenis: 'KELULUSAN', nim: k.nim, kode: 'F_PENGAMBILAN_IJAZAH' }).then(function (res) {
            UI.sibuk(btn, false);
            if (!res.success) return UI.toast(res.message, 'error');
            S.Dok.pratinjau(res.data, {
              tombol: [{ id: 'pv-acc', label: 'ACC Tahap 3', ikon: 'checkCircle', klik: function () { UI.tutupModal(); kirim('SETUJU'); } }]
            });
          });
        };
        var bacc = box.querySelector('[data-kl-acc]'), brev = box.querySelector('[data-kl-revisi]');
        if (bacc) bacc.onclick = function () { kirim('SETUJU'); };
        if (brev) brev.onclick = function () { kirim('REVISI'); };

        function kirim(keputusan) {
          var cat = ((box.querySelector('[data-kl-cat]') || {}).value || '').trim();
          var tahapRevisi = [];
          Array.prototype.forEach.call(box.querySelectorAll('[data-kl-rev]'), function (c) { if (c.checked) tahapRevisi.push(parseInt(c.getAttribute('data-kl-rev'), 10)); });
          if (keputusan === 'REVISI' && !cat) return UI.toast('Catatan revisi wajib diisi.', 'error');
          if (keputusan === 'REVISI' && !tahapRevisi.length) return UI.toast('Pilih tahap yang perlu direvisi.', 'error');
          var btn = box.querySelector(keputusan === 'SETUJU' ? '[data-kl-acc]' : '[data-kl-revisi]');
          UI.sibuk(btn, true, 'Memproses…');
          API.kirim('prosesKelulusan', { nim: k.nim, tahap: 3, keputusan: keputusan, catatan: cat, tahapRevisi: tahapRevisi }).then(function (res) {
            UI.sibuk(btn, false);
            if (!res.success) return UI.toast(res.message, 'error');
            // Optimistic: status lokal langsung berubah.
            Object.keys(res.data || {}).forEach(function (key) { if (key !== 'nim') k[key] = res.data[key]; });
            if (keputusan === 'SETUJU') k.antrean = [{ status: 'ANTRE', kode: 'F_PENGAMBILAN_IJAZAH' }];
            UI.toast(res.message, 'ok');
            gambarList(); gambarDetail();
            if (keputusan === 'SETUJU') A.prosesLatar([k.nim]); else A.muat();
          });
        }
      }

      el.querySelector('#kl-cari').addEventListener('input', S.debounce(function (e) { kueri = e.target.value; gambarList(); }, 200));
      gambarList();
      gambarDetail();
    },

    /**
     * Ubah tautan Drive apa pun (view / uc / id mentah) menjadi objek dokumen
     * standar {pratinjau, unduh, url, nama} sehingga dapat dibuka pada modal
     * pratinjau maupun diunduh langsung tanpa berpindah halaman.
     */
    berkas: function (url, nama) { return S.Dok.dariUrl(url, nama); },

    badgeTahap: function (st) {
      if (st === 'DISETUJUI' || st === 'SIAP') return 'badge-green';
      if (st === 'MENUNGGU') return 'badge-amber';
      if (st === 'REVISI') return 'badge-red';
      return 'badge-gray';
    },

    /* ==================================================================
       SETTING DOSEN MAGANG (revisi v3)
       Kelompok dari Konfirmasi Magang → satu dosen pembimbing per kelompok.
       ================================================================== */

    renderDosenMagang: function () {
      var el = document.getElementById('admview-dosen_magang');
      var rows = A.D.dosenMagang || [];
      var dosen = (A.D.master.dosen || []).filter(function (x) { return x.statusAktif && String(x.nidn || '').trim(); });
      var petaDosen = {};
      dosen.forEach(function (x) { petaDosen[x.id] = x; });
      A.dmPilih = A.dmPilih || {};      // pilihan yang belum disimpan (bertahan saat data latar diperbarui)
      var filter = A.dmFilter || 'SEMUA', kueri = '';

      function labelDosen(x) { return x.nama + ' — ' + x.nidn + ' - ' + (x.noHp || '-'); }
      function pilihan(r) { return A.dmPilih[r.idPengajuan] !== undefined ? A.dmPilih[r.idPengajuan] : r.dosenId; }

      el.innerHTML =
        '<div class="page-head"><div>' +
        '<div class="crumb">' + ik('shield', 12) + ' Panel BAAK <span class="sep">/</span> Magang <span class="sep">/</span> <span class="cur">Setting Dosen Magang</span></div>' +
        '<h2>Setting Dosen Pembimbing Magang</h2>' +
        '<div class="desc">Data kelompok diambil otomatis dari Konfirmasi Magang. Satu dosen ber-NIDN untuk satu kelompok; ' +
        'dosen yang disimpan langsung tampil di menu Konfirmasi Magang.</div></div></div>' +

        '<div class="card mb3"><div class="card-head"><div><h3>Penetapan Dosen per Kelompok</h3>' +
        '<div class="sub">' + rows.length + ' kelompok dari Konfirmasi Magang</div></div>' +
        '<div class="row-wrap">' +
        '<button class="btn btn-ghost btn-sm" id="dm-sementara">' + ik('check', 14) + 'Simpan Sementara</button>' +
        '<button class="btn btn-primary btn-sm" id="dm-final">' + ik('lock', 14) + 'Simpan Final</button></div></div>' +
        '<div class="card-body" style="padding:12px 16px;border-bottom:1px solid var(--line)"><div class="row-wrap">' +
        '<div class="input-icon grow" style="min-width:200px">' + ik('search', 16) + '<input class="input" id="dm-cari" placeholder="Cari nama, NIM, instansi, atau dosen…"></div>' +
        '<div class="row-wrap" id="dm-filter">' + [['SEMUA', 'Semua'], ['BELUM', 'Belum'], ['SEMENTARA', 'Sementara'], ['FINAL', 'Final']].map(function (x) {
          return '<button class="btn btn-sm ' + (filter === x[0] ? 'btn-primary' : 'btn-ghost') + '" data-f="' + x[0] + '">' + x[1] + '</button>';
        }).join('') + '</div></div></div>' +
        '<div class="table-wrap"><table class="tbl"><thead><tr>' +
        '<th>No</th><th>Nama Mahasiswa</th><th>NIM</th><th>Program Studi</th><th>Instansi</th><th>Anggota Kelompok</th>' +
        '<th>Dosen Pembimbing</th><th>NIDN</th><th>Status</th></tr></thead><tbody id="dm-body"></tbody></table></div></div>' +

        '<div class="card"><div class="card-head"><div><h3>Rekap Dosen Pembimbing Magang</h3>' +
        '<div class="sub">Jumlah mahasiswa = pengaju + anggota kelompok yang dibimbing</div></div>' +
        '<button class="btn btn-ghost btn-sm" id="dm-cetak">' + ik('printer', 14) + 'Cetak</button></div>' +
        '<div class="table-wrap"><table class="tbl"><thead><tr><th>No</th><th>Nama Dosen</th><th>Jumlah Kelompok</th><th>Jumlah Mahasiswa</th>' +
        '<th>Surat Tugas</th><th style="text-align:right">Aksi</th></tr></thead><tbody id="dm-rekap"></tbody></table></div>' +
        '<div class="card-body tiny muted">' + ik('lock', 12) + ' Surat Tugas Dosen Pembimbing hanya untuk BAAK/dosen — tidak dikirim ke akun mahasiswa.</div></div>';

      function terfilter() {
        return rows.filter(function (r) {
          if (filter !== 'SEMUA' && r.status !== filter) return false;
          if (!kueri) return true;
          var teks = [r.nama, r.nim, r.instansi, r.prodi, r.dosenNama].concat(r.anggota.map(function (a) { return a.nama + ' ' + a.nim; })).join(' ').toLowerCase();
          return teks.indexOf(kueri.toLowerCase()) >= 0;
        });
      }

      function gambarTabel() {
        var f = terfilter();
        var body = el.querySelector('#dm-body');
        if (!f.length) { body.innerHTML = '<tr><td colspan="9">' + UI.kosong('Belum Ada Kelompok', 'Kelompok tampil setelah mahasiswa mengisi Konfirmasi Magang.', 'users') + '</td></tr>'; return; }
        body.innerHTML = f.map(function (r, i) {
          var pid = pilihan(r), dsn = petaDosen[pid];
          var ubah = A.dmPilih[r.idPengajuan] !== undefined && A.dmPilih[r.idPengajuan] !== r.dosenId;
          return '<tr><td>' + (i + 1) + '</td>' +
            '<td><div class="bold">' + F.esc(r.nama) + '</div>' + (r.statusPengajuan === 'MENUNGGU' ? '<div class="tiny muted">Konfirmasi belum di-ACC</div>' : '') + '</td>' +
            '<td class="mono">' + F.esc(r.nim) + '</td><td>' + F.esc(r.prodi) + '</td><td>' + F.esc(r.instansi) + '</td>' +
            '<td>' + (r.anggota.length ? r.anggota.map(function (a) { return F.esc(a.nama); }).join(',<br>') : '-') + '</td>' +
            '<td><select class="select" data-dm="' + F.esc(r.idPengajuan) + '" style="width:210px;max-width:100%"><option value="">— Pilih dosen ber-NIDN —</option>' +
            dosen.map(function (x) { return '<option value="' + F.esc(x.id) + '"' + (x.id === pid ? ' selected' : '') + '>' + F.esc(labelDosen(x)) + '</option>'; }).join('') +
            '</select></td>' +
            '<td class="mono" data-dm-nidn="' + F.esc(r.idPengajuan) + '">' + F.esc(dsn ? dsn.nidn : (r.dosenNidn || '-')) + '</td>' +
            '<td>' + (ubah ? '<span class="badge badge-amber">Belum disimpan</span>'
              : (r.status === 'FINAL' ? '<span class="badge badge-green">Final</span>'
                : (r.status === 'SEMENTARA' ? '<span class="badge badge-blue">Sementara</span>' : '<span class="badge badge-gray">Belum</span>'))) + '</td></tr>';
        }).join('');
        Array.prototype.forEach.call(body.querySelectorAll('[data-dm]'), function (sel) {
          sel.onchange = function () {
            var id = sel.getAttribute('data-dm');
            A.dmPilih[id] = sel.value;
            var dsn = petaDosen[sel.value];
            el.querySelector('[data-dm-nidn="' + id + '"]').textContent = dsn ? dsn.nidn : '-';
            gambarTabel();
          };
        });
      }

      function gambarRekap() {
        var per = {};
        rows.forEach(function (r) {
          if (!r.dosenId) return;
          var x = per[r.dosenId] || (per[r.dosenId] = { id: r.dosenId, nama: r.dosenNama, kelompok: 0, mhs: 0, final: 0 });
          x.kelompok++; x.mhs += r.jumlahMahasiswa; if (r.status === 'FINAL') x.final++;
        });
        var list = Object.keys(per).map(function (k) { return per[k]; }).sort(function (a, b) { return a.nama.localeCompare(b.nama); });
        A._dmRekap = list;
        var st = A.stTerbit || {};
        var body = el.querySelector('#dm-rekap');
        if (!list.length) { body.innerHTML = '<tr><td colspan="6" class="center muted small" style="padding:18px">Belum ada dosen yang ditetapkan.</td></tr>'; return; }
        body.innerHTML = list.map(function (x, i) {
          var ada = st[x.id];
          return '<tr><td>' + (i + 1) + '</td><td class="bold">' + F.esc(x.nama) + '</td><td>' + x.kelompok + '</td><td>' + x.mhs + '</td>' +
            '<td>' + (ada ? '<span class="tiny mono">' + F.esc(ada.nomor || '-') + '</span>' : '<span class="muted small">Belum dibuat</span>') + '</td>' +
            '<td style="text-align:right;white-space:nowrap">' +
            (ada ? '<button class="btn btn-ghost btn-sm" data-st-lihat="' + F.esc(x.id) + '" title="Lihat surat tugas">' + ik('eye', 14) + '</button> ' : '') +
            '<button class="btn btn-ghost btn-sm" data-st-pv="' + F.esc(x.id) + '" title="Pratinjau">' + ik('file', 14) + '</button> ' +
            '<button class="btn btn-soft btn-sm" data-st-buat="' + F.esc(x.id) + '"' + (x.final ? '' : ' disabled title="Simpan Final terlebih dahulu"') + '>' +
            ik('send', 14) + (ada ? 'Buat Ulang' : 'Buat Surat Tugas Dosen Pembimbing') + '</button></td></tr>';
        }).join('');
        Array.prototype.forEach.call(body.querySelectorAll('[data-st-lihat]'), function (b) {
          b.onclick = function () { S.Dok.pratinjau(st[b.getAttribute('data-st-lihat')]); };
        });
        Array.prototype.forEach.call(body.querySelectorAll('[data-st-pv]'), function (b) {
          b.onclick = function (ev) { A.pratinjauServer(ev.currentTarget, { jenis: 'DOSEN_MAGANG', dosenId: b.getAttribute('data-st-pv') }); };
        });
        Array.prototype.forEach.call(body.querySelectorAll('[data-st-buat]'), function (b) {
          b.onclick = function (ev) {
            var btn = ev.currentTarget, id = b.getAttribute('data-st-buat');
            UI.sibuk(btn, true, 'Membuat…');
            API.kirim('suratTugasDosen', { dosenId: id }).then(function (res) {
              UI.sibuk(btn, false);
              if (!res.success) return UI.toast(res.message, 'error');
              UI.toast(res.message, 'ok');
              A.stTerbit = A.stTerbit || {};
              A.stTerbit[id] = res.data;
              gambarRekap();
              S.Dok.pratinjau(res.data);
            });
          };
        });
      }

      function simpan(status, btn) {
        var items = [];
        rows.forEach(function (r) {
          var pid = pilihan(r);
          if (!pid) return;
          var berubah = pid !== r.dosenId;
          if (status === 'SEMENTARA' && !berubah) return;
          if (status === 'FINAL' && !berubah && r.status === 'FINAL') return;
          items.push({ idPengajuan: r.idPengajuan, dosenId: pid });
        });
        if (!items.length) return UI.toast(status === 'FINAL' ? 'Semua kelompok berdosen sudah Final.' : 'Belum ada perubahan untuk disimpan.', 'warn');
        UI.sibuk(btn, true, 'Menyimpan…');
        API.kirim('simpanDosenMagang', { items: items, status: status }).then(function (res) {
          UI.sibuk(btn, false);
          if (!res.success) return UI.toast(res.message, 'error');
          UI.toast(res.message, res.data.gagal && res.data.gagal.length ? 'warn' : 'ok');
          // Optimistic: terapkan ke data lokal + Konfirmasi Magang tanpa menunggu muat ulang.
          var gagal = {};
          (res.data.gagal || []).forEach(function (g) { gagal[g.idPengajuan] = true; });
          items.forEach(function (it) {
            if (gagal[it.idPengajuan]) return;
            var dsn = petaDosen[it.dosenId];
            rows.forEach(function (r) {
              if (r.idPengajuan !== it.idPengajuan) return;
              r.dosenId = it.dosenId; r.dosenNama = dsn.nama; r.dosenNidn = dsn.nidn; r.dosenHp = dsn.noHp; r.status = status;
            });
            (A.D.antrean || []).concat(A.D.riwayat || []).forEach(function (p) {
              if (p.id === it.idPengajuan) p.dosenMagang = { dosenId: dsn.id, nama: dsn.nama, nidn: dsn.nidn, hp: dsn.noHp, status: status };
            });
            delete A.dmPilih[it.idPengajuan];
          });
          A.kotor.q_KONFIRMASI_MAGANG = true;
          gambarTabel(); gambarRekap();
          A.muat();
        });
      }

      el.querySelector('#dm-cari').addEventListener('input', S.debounce(function (e) { kueri = e.target.value; gambarTabel(); }, 200));
      Array.prototype.forEach.call(el.querySelectorAll('#dm-filter [data-f]'), function (b) {
        b.onclick = function () {
          filter = A.dmFilter = b.getAttribute('data-f');
          Array.prototype.forEach.call(el.querySelectorAll('#dm-filter [data-f]'), function (x) { x.className = 'btn btn-sm ' + (x === b ? 'btn-primary' : 'btn-ghost'); });
          gambarTabel();
        };
      });
      el.querySelector('#dm-sementara').onclick = function (ev) { simpan('SEMENTARA', ev.currentTarget); };
      el.querySelector('#dm-final').onclick = function (ev) {
        var btn = ev.currentTarget;
        UI.konfirmasi({
          judul: 'Simpan Final?', tombol: 'Ya, Simpan Final',
          isi: 'Penetapan dosen yang final dipakai untuk Surat Tugas Dosen Pembimbing dan tampil di Konfirmasi Magang.'
        }).then(function (ya) { if (ya) simpan('FINAL', btn); });
      };
      el.querySelector('#dm-cetak').onclick = function (ev) {
        var list = A._dmRekap || [];
        if (!list.length) return UI.toast('Belum ada data rekap.', 'warn');
        A.cetakPdf(ev.currentTarget, 'Rekap Dosen Pembimbing Magang', ['No', 'Nama Dosen', 'Jumlah Kelompok', 'Jumlah Mahasiswa'],
          list.map(function (x, i) { return [i + 1, x.nama, x.kelompok, x.mhs]; }));
      };

      gambarTabel();
      gambarRekap();
      if (!A.stTerbit) {
        API.kirim('suratTugasTerbit', {}).then(function (res) {
          if (!res.success) return;
          A.stTerbit = res.data || {};
          if (document.getElementById('admview-dosen_magang') === el) gambarRekap();
        });
      }
    },

    /** Cetak tabel apa pun ke PDF (server, base64 — tanpa berkas Drive). */
    cetakPdf: function (btn, judul, kolom, baris, opsi) {
      opsi = opsi || {};
      UI.sibuk(btn, true, 'Menyusun PDF…');
      return API.kirim('cetakRekap', { judul: judul, sub: opsi.sub || '', kolom: kolom, baris: baris, lanskap: !!opsi.lanskap }).then(function (res) {
        UI.sibuk(btn, false);
        if (!res.success) return UI.toast(res.message, 'error');
        S.Dok.pratinjau(Object.assign({ nama: judul }, res.data), { catatan: 'Rekap disusun langsung dari data terbaru — tidak disimpan sebagai berkas.' });
      });
    },

    /* ==================================================================
       SETTING DOSEN PENGUJI (revisi v3)
       Kotak 1: beban penguji per dosen • Kotak 2: peserta sidang + IPK
       ================================================================== */

    renderDosenPenguji: function () {
      var el = document.getElementById('admview-dosen_penguji');
      var jenis = A.dpJenis || 'SIDANG';
      var pgAll = (A.D.penguji || []);
      var ta = A.D.tahunAkademik || {};

      function namaPolos(n) { return String(n || '').replace(/\s*\(NIDN[^)]*\)\s*/i, '').trim(); }

      // Kotak 1 — hitung peran penguji per dosen
      var per = {};
      pgAll.filter(function (p) { return jenis === 'SEMUA' || p.jenis === jenis; }).forEach(function (p) {
        [['p1', p.penguji1], ['p2', p.penguji2], ['p3', p.penguji3]].forEach(function (x) {
          var n = namaPolos(x[1]);
          if (!n) return;
          var o = per[n] || (per[n] = { nama: n, p1: 0, p2: 0, p3: 0, total: 0 });
          o[x[0]]++; o.total++;
        });
      });
      var beban = Object.keys(per).map(function (k) { return per[k]; }).sort(function (a, b) { return b.total - a.total || a.nama.localeCompare(b.nama); });

      // Kotak 2 — mahasiswa pendaftar sidang + IPK & predikat
      var peserta = [], sudah = {};
      pgAll.filter(function (p) { return p.jenis === 'SIDANG'; }).forEach(function (p) {
        sudah[p.idPengajuan] = true;
        peserta.push({ nama: p.nama, nim: p.nim, prodi: p.prodiNama, tanggal: p.tanggalJadwal, p1: p.penguji1, p2: p.penguji2, p3: p.penguji3, ipk: p.ipk, predikat: p.predikat });
      });
      (A.D.antrean || []).concat(A.D.riwayat || []).forEach(function (r) {
        if (r.jenis !== 'SIDANG' || sudah[r.id] || r.status === 'DITOLAK') return;
        sudah[r.id] = true;
        peserta.push({ nama: r.nama, nim: r.nim, prodi: r.prodiNama || r.prodi, tanggal: '', p1: '', p2: '', p3: '', ipk: '', predikat: '' });
      });
      peserta.sort(function (a, b) { return String(a.tanggal || '9').localeCompare(String(b.tanggal || '9')) || a.nama.localeCompare(b.nama); });

      el.innerHTML =
        '<div class="page-head"><div>' +
        '<div class="crumb">' + ik('shield', 12) + ' Panel BAAK <span class="sep">/</span> Sidang <span class="sep">/</span> <span class="cur">Setting Dosen Penguji</span></div>' +
        '<h2>Setting Dosen Penguji</h2>' +
        '<div class="desc">Rekap beban dosen penguji dan daftar peserta sidang skripsi beserta IPK &amp; predikat. Cetak sebagai PDF atau Excel.</div></div>' +
        '<div class="row-wrap" id="dp-jenis">' + [['SIDANG', 'Sidang Skripsi'], ['SEMPRO', 'Seminar Proposal'], ['SEMUA', 'Semua']].map(function (x) {
          return '<button class="btn btn-sm ' + (jenis === x[0] ? 'btn-primary' : 'btn-ghost') + '" data-j="' + x[0] + '">' + x[1] + '</button>';
        }).join('') + '</div></div>' +

        '<div class="card mb3"><div class="card-head"><div><h3>Dosen Penguji &amp; Jumlah Peran</h3>' +
        '<div class="sub">' + beban.length + ' dosen • ' + (jenis === 'SEMUA' ? 'sempro &amp; sidang' : (jenis === 'SIDANG' ? 'sidang skripsi' : 'seminar proposal')) + '</div></div>' +
        '<div class="row-wrap"><button class="btn btn-ghost btn-sm" id="dp1-pdf">' + ik('printer', 14) + 'PDF</button>' +
        '<button class="btn btn-ghost btn-sm" id="dp1-xls">' + ik('download', 14) + 'Excel</button></div></div>' +
        '<div class="table-wrap"><table class="tbl"><thead><tr><th>No</th><th>Nama Dosen</th><th>Penguji 1</th><th>Penguji 2</th><th>Penguji 3</th><th>Jumlah Peran</th></tr></thead><tbody>' +
        (beban.length ? beban.map(function (x, i) {
          return '<tr><td>' + (i + 1) + '</td><td class="bold">' + F.esc(x.nama) + '</td><td>' + x.p1 + '</td><td>' + x.p2 + '</td><td>' + x.p3 + '</td>' +
            '<td><span class="badge badge-orange">' + x.total + '</span></td></tr>';
        }).join('') : '<tr><td colspan="6" class="center muted small" style="padding:18px">Belum ada penetapan penguji.</td></tr>') +
        '</tbody></table></div></div>' +

        '<div class="card"><div class="card-head"><div><h3>Peserta Sidang Skripsi</h3>' +
        '<div class="sub">' + peserta.length + ' mahasiswa mendaftar sidang • IPK &amp; predikat dari menu Sidang Skripsi</div></div>' +
        '<div class="row-wrap"><button class="btn btn-ghost btn-sm" id="dp2-pdf">' + ik('printer', 14) + 'PDF</button>' +
        '<button class="btn btn-ghost btn-sm" id="dp2-xls">' + ik('download', 14) + 'Excel</button></div></div>' +
        '<div class="table-wrap"><table class="tbl"><thead><tr><th>No</th><th>Nama</th><th>NIM</th><th>Program Studi</th><th>Tanggal Sidang</th>' +
        '<th>Penguji 1</th><th>Penguji 2</th><th>Penguji 3</th><th>IPK</th><th>Predikat</th></tr></thead><tbody>' +
        (peserta.length ? peserta.map(function (x, i) {
          return '<tr><td>' + (i + 1) + '</td><td class="bold">' + F.esc(x.nama) + '</td><td class="mono">' + F.esc(x.nim) + '</td><td>' + F.esc(x.prodi) + '</td>' +
            '<td class="nowrap">' + (x.tanggal ? F.tgl(x.tanggal, true) : '<span class="muted">Belum dijadwalkan</span>') + '</td>' +
            '<td>' + F.esc(namaPolos(x.p1) || '-') + '</td><td>' + F.esc(namaPolos(x.p2) || '-') + '</td><td>' + F.esc(namaPolos(x.p3) || '-') + '</td>' +
            '<td class="mono">' + F.esc(x.ipk || '-') + '</td><td>' + F.esc(x.predikat || '-') + '</td></tr>';
        }).join('') : '<tr><td colspan="10" class="center muted small" style="padding:18px">Belum ada pendaftar sidang skripsi.</td></tr>') +
        '</tbody></table></div></div>';

      var judulJenis = jenis === 'SEMUA' ? 'Seminar Proposal & Sidang Skripsi' : (jenis === 'SIDANG' ? 'Sidang Skripsi' : 'Seminar Proposal');
      var sub = 'Tahun Akademik ' + (ta.label || '');
      var k1 = ['No', 'Nama Dosen', 'Penguji 1', 'Penguji 2', 'Penguji 3', 'Jumlah Peran'];
      var b1 = beban.map(function (x, i) { return [i + 1, x.nama, x.p1, x.p2, x.p3, x.total]; });
      var k2 = ['No', 'Nama', 'NIM', 'Program Studi', 'Tanggal Sidang', 'Penguji 1', 'Penguji 2', 'Penguji 3', 'IPK', 'Predikat'];
      var b2 = peserta.map(function (x, i) {
        return [i + 1, x.nama, String(x.nim), x.prodi, x.tanggal ? F.tgl(x.tanggal) : '-', namaPolos(x.p1) || '-', namaPolos(x.p2) || '-', namaPolos(x.p3) || '-',
          x.ipk ? parseFloat(x.ipk) : '-', x.predikat || '-'];
      });
      var tgl = new Date().toISOString().substring(0, 10);

      Array.prototype.forEach.call(el.querySelectorAll('#dp-jenis [data-j]'), function (b) {
        b.onclick = function () { A.dpJenis = b.getAttribute('data-j'); A.renderDosenPenguji(); };
      });
      el.querySelector('#dp1-pdf').onclick = function (ev) {
        if (!b1.length) return UI.toast('Belum ada data.', 'warn');
        A.cetakPdf(ev.currentTarget, 'Rekap Dosen Penguji ' + judulJenis, k1, b1, { sub: sub });
      };
      el.querySelector('#dp1-xls').onclick = function () {
        if (!b1.length) return UI.toast('Belum ada data.', 'warn');
        S.Xlsx.unduh('Rekap-Dosen-Penguji-' + tgl, [{ nama: 'Dosen Penguji', judul: 'Rekap Dosen Penguji ' + judulJenis, sub: sub, kolom: k1, baris: b1 }]);
        UI.toast('Berkas Excel diunduh.', 'ok');
      };
      el.querySelector('#dp2-pdf').onclick = function (ev) {
        if (!b2.length) return UI.toast('Belum ada data.', 'warn');
        A.cetakPdf(ev.currentTarget, 'Daftar Peserta Sidang Skripsi', k2, b2, { sub: sub, lanskap: true });
      };
      el.querySelector('#dp2-xls').onclick = function () {
        if (!b2.length) return UI.toast('Belum ada data.', 'warn');
        S.Xlsx.unduh('Peserta-Sidang-Skripsi-' + tgl, [{ nama: 'Peserta Sidang', judul: 'Daftar Peserta Sidang Skripsi', sub: sub, kolom: k2, baris: b2 }]);
        UI.toast('Berkas Excel diunduh.', 'ok');
      };
    },

    /* ==================================================================
       MODUL MALAS: WhatsApp & Notifikasi • CRM Kontak • Migrasi Data
       Kode modul (06-admin-modul.js) baru diunduh saat menu dibuka.
       ================================================================== */

    modul: function (nama) {
      var el = document.getElementById('admview-' + nama);
      A._modulSiap = A._modulSiap || {};
      if (A._modulSiap[nama]) return;          // modul mengurus pembaruannya sendiri
      A._modulSiap[nama] = true;
      if (!el.innerHTML) el.innerHTML = UI.skeleton(4, 80);
      A.muatModul().then(function (Mod) { Mod.render(nama, el); }).catch(function (e) {
        A._modulSiap[nama] = false;
        el.innerHTML = '<div class="card"><div class="card-body">' + UI.kosong('Modul gagal dimuat', e.message, 'alert') + '</div></div>';
      });
    },

    muatModul: function () {
      if (S.AdminModul) return Promise.resolve(S.AdminModul);
      if (A._janjiModul) return A._janjiModul;
      A._janjiModul = new Promise(function (resolve, reject) {
        var sc = document.createElement('script');
        sc.src = 'assets/js/06-admin-modul.js';
        sc.onload = function () { resolve(S.AdminModul); };
        sc.onerror = function () { A._janjiModul = null; reject(new Error('Periksa koneksi lalu buka menu ini kembali.')); };
        document.head.appendChild(sc);
      });
      return A._janjiModul;
    },

    /* ==================================================================
       MASTER: MAHASISWA
       ================================================================== */

    renderMahasiswa: function () {
      var el = document.getElementById('admview-mahasiswa');
      el.innerHTML =
        '<div class="page-head"><div><h2>Data Mahasiswa</h2>' +
        '<div class="desc">Basis data induk mahasiswa — dipakai untuk autentikasi NIM + Tahun Masuk dan pengisian otomatis dokumen.</div></div>' +
        '<div class="row-wrap">' +
        '<button class="btn btn-ghost btn-sm" id="mh-template">' + ik('download', 14) + 'Template Impor</button>' +
        '<button class="btn btn-ghost btn-sm" id="mh-impor">' + ik('upload', 14) + 'Impor CSV</button>' +
        '<button class="btn btn-primary btn-sm" id="mh-tambah">' + ik('plus', 14) + 'Tambah Mahasiswa</button></div></div>' +
        '<div class="card"><div class="card-body" style="padding:14px 16px;border-bottom:1px solid var(--line)">' +
        '<div class="input-icon">' + ik('search', 16) + '<input class="input" id="mh-cari" placeholder="Cari NIM, nama, atau program studi…"></div></div>' +
        '<div id="mh-tabel"><div class="card-body">' + UI.skeleton(4, 44) + '</div></div></div>';

      var data = [], kueri = '';

      function muat() {
        API.kirim('muatMahasiswa').then(function (r) {
          if (!r.success) return UI.toast(r.message, 'error');
          data = r.data;
          gambar();
        });
      }

      function gambar() {
        var f = data.filter(function (x) { return S.cocok(x, kueri, ['nim', 'nama', 'prodi', 'prodiKode']); });
        var box = el.querySelector('#mh-tabel');
        if (!f.length) { box.innerHTML = '<div class="card-body">' + UI.kosong('Tidak Ada Data', 'Belum ada mahasiswa yang cocok.', 'users') + '</div>'; return; }
        box.innerHTML = '<div class="table-wrap"><table class="tbl"><thead><tr>' +
          '<th>NIM</th><th>Nama</th><th>Program Studi</th><th class="center">Angkatan</th>' +
          '<th class="center">Smt</th><th>Kontak</th><th class="center">Status</th><th></th></tr></thead><tbody>' +
          f.slice(0, 400).map(function (x) {
            return '<tr><td class="mono">' + F.esc(x.nim) + '</td>' +
              '<td class="bold">' + F.esc(x.nama) + '</td>' +
              '<td>' + F.esc(x.prodi) + '</td>' +
              '<td class="center">' + F.esc(x.tahunMasuk) + '</td>' +
              '<td class="center">' + x.semester + '</td>' +
              '<td class="mono small">' + F.esc(x.noWa || '-') + '</td>' +
              '<td class="center"><span class="badge ' + (x.statusAktif ? 'badge-green' : 'badge-gray') + '">' +
              (x.statusAktif ? 'Aktif' : 'Non-aktif') + '</span></td>' +
              '<td class="right"><button class="btn btn-ghost btn-sm" data-edit="' + F.esc(x.id) + '">' + ik('edit', 13) + '</button></td></tr>';
          }).join('') + '</tbody></table></div>' +
          (f.length > 400 ? '<div class="card-body tiny muted center">Menampilkan 400 dari ' + f.length + ' data. Gunakan pencarian untuk mempersempit.</div>' : '');

        Array.prototype.forEach.call(box.querySelectorAll('[data-edit]'), function (b) {
          b.onclick = function () {
            var id = b.getAttribute('data-edit');
            var m = null;
            data.forEach(function (x) { if (x.id === id) m = x; });
            dialogMahasiswa(m);
          };
        });
      }

      function dialogMahasiswa(m) {
        m = m || {};
        var prodi = A.D.master.prodi || [];
        UI.modal({
          judul: m.id ? 'Ubah Data Mahasiswa' : 'Tambah Mahasiswa',
          isi:
            '<div class="grid-2">' +
            '<div class="field"><label>NIM <span class="req">*</span></label>' +
            '<input class="input mono" id="fm-nim" maxlength="20" value="' + F.esc(m.nim || '') + '"></div>' +
            '<div class="field"><label>Tahun Masuk <span class="req">*</span></label>' +
            '<input class="input mono" id="fm-th" maxlength="4" value="' + F.esc(m.tahunMasuk || '') + '"></div></div>' +
            '<div class="field"><label>Nama Lengkap <span class="req">*</span></label>' +
            '<input class="input" id="fm-nama" maxlength="120" value="' + F.esc(m.nama || '') + '"></div>' +
            '<div class="field"><label>Program Studi</label><select class="select" id="fm-prodi">' +
            '<option value="">— Pilih prodi —</option>' +
            prodi.map(function (p) {
              return '<option value="' + F.esc(p.id) + '"' + (m.prodiId === p.id ? ' selected' : '') + '>' +
                F.esc(p.jenjang + ' ' + p.nama) + '</option>';
            }).join('') + '</select></div>' +
            '<div class="grid-2">' +
            '<div class="field"><label>No. WhatsApp</label><input class="input mono" id="fm-wa" maxlength="15" value="' + F.esc(m.noWa || '') + '"></div>' +
            '<div class="field"><label>Email</label><input class="input" id="fm-email" maxlength="120" value="' + F.esc(m.email || '') + '"></div></div>' +
            '<label class="check"><input type="checkbox" id="fm-aktif"' + (m.statusAktif !== false ? ' checked' : '') + '>' +
            '<span>Status aktif — mahasiswa non-aktif tidak dapat masuk ke sistem.</span></label>',
          kaki: '<button class="btn btn-ghost" data-tutup>Batal</button><button class="btn btn-primary" id="fm-ok">Simpan</button>',
          siap: function (box) {
            box.querySelector('#fm-ok').onclick = function (ev) {
              UI.sibuk(ev.currentTarget, true, 'Menyimpan…');
              API.kirim('simpanMahasiswa', {
                id: m.id || '',
                nim: box.querySelector('#fm-nim').value.trim(),
                nama: box.querySelector('#fm-nama').value.trim(),
                tahunMasuk: box.querySelector('#fm-th').value.trim(),
                prodiId: box.querySelector('#fm-prodi').value,
                noWa: box.querySelector('#fm-wa').value.trim(),
                email: box.querySelector('#fm-email').value.trim(),
                statusAktif: box.querySelector('#fm-aktif').checked
              }).then(function (r) {
                UI.sibuk(ev.currentTarget, false);
                if (!r.success) return UI.toast(r.message, 'error');
                UI.tutupModal(); UI.toast(r.message, 'ok'); muat();
              });
            };
          }
        });
      }

      el.querySelector('#mh-template').onclick = function () { A.unduhTemplate('mahasiswa'); };
      el.querySelector('#mh-tambah').onclick = function () { dialogMahasiswa(null); };
      el.querySelector('#mh-cari').addEventListener('input', S.debounce(function (e) { kueri = e.target.value; gambar(); }, 200));
      el.querySelector('#mh-impor').onclick = function () { A.dialogImpor('mahasiswa', muat); };
      muat();
    },

    /* ==================================================================
       IMPOR MASSAL (MAHASISWA & DOSEN)
       ------------------------------------------------------------------
       Admin cukup mengunduh template, mengisinya di Excel / Spreadsheet,
       lalu mengunggahnya kembali. Pengurai CSV menerima pemisah koma,
       titik-koma (bawaan Excel Indonesia), maupun tab, serta mentoleransi
       nama kolom yang berbeda-beda (mis. "Angkatan" untuk tahunMasuk).
       ================================================================== */

    SKEMA_IMPOR: {
      mahasiswa: {
        judul: 'Impor Data Mahasiswa',
        aksi: 'imporMahasiswa',
        berkas: 'template-impor-mahasiswa.csv',
        kolom: ['nim', 'nama', 'tahunMasuk', 'prodi', 'noWa', 'email'],
        wajib: ['nim', 'nama', 'tahunMasuk'],
        contoh: [
          ['20240801001', 'Ahmad Zaki Mubarak', '2024', 'HES', '081234567890', 'zaki@mail.com'],
          ['20240802002', 'Siti Nurhaliza', '2024', 'HKI', '081298765432', 'siti@mail.com']
        ],
        alias: {
          nim: ['nim', 'nomorindukmahasiswa', 'no.induk', 'noinduk'],
          nama: ['nama', 'namalengkap', 'namamahasiswa'],
          tahunMasuk: ['tahunmasuk', 'angkatan', 'tahun', 'thmasuk'],
          prodi: ['prodi', 'kodeprodi', 'prodikode', 'programstudi', 'jurusan'],
          noWa: ['nowa', 'wa', 'whatsapp', 'nohp', 'hp', 'telepon', 'notelepon'],
          email: ['email', 'surel', 'e-mail', 'emailmahasiswa']
        },
        catatan: 'Kolom <b>prodi</b> boleh diisi kode (HES) maupun nama lengkap program studi. ' +
          'Baris dengan NIM yang sudah terdaftar akan <b>diperbarui</b>, bukan diduplikasi.'
      },
      dosen: {
        judul: 'Impor Data Dosen',
        aksi: 'imporDosen',
        berkas: 'template-impor-dosen.csv',
        kolom: ['nama', 'kategori', 'nidn', 'noHp', 'email'],
        wajib: ['nama', 'kategori'],
        contoh: [
          ['Dr. H. M. Ridwan, M.Ag', 'NIDN', '2107850301', '081234567890', 'ridwan@stisalwafa.ac.id'],
          ['Ustadz Hasan Basri, Lc', 'UMUM', '', '081377788899', '']
        ],
        alias: {
          nama: ['nama', 'namadosen', 'namalengkap', 'namagelar'],
          kategori: ['kategori', 'jenis', 'status', 'tipe'],
          nidn: ['nidn', 'nip', 'nidk'],
          noHp: ['nohp', 'hp', 'nowa', 'wa', 'whatsapp', 'telepon'],
          email: ['email', 'surel', 'e-mail']
        },
        catatan: 'Kolom <b>kategori</b> diisi <code>NIDN</code> (boleh menguji sidang) atau <code>UMUM</code> ' +
          '(pengampu saja). Dosen berkategori NIDN <b>wajib</b> mengisi nomor NIDN. ' +
          'Dosen dengan nama yang sama akan diperbarui datanya.'
      }
    },

    unduhTemplate: function (jenis) {
      var sk = A.SKEMA_IMPOR[jenis];
      var baris = [sk.kolom].concat(sk.contoh);
      S.Csv.unduh(sk.berkas, baris);
      UI.toast('Template terunduh. Hapus dua baris contoh sebelum mengunggah.', 'ok', 'Template Siap Diisi');
    },

    dialogImpor: function (jenis, selesai) {
      var sk = A.SKEMA_IMPOR[jenis];
      if (!sk) return;

      UI.modal({
        judul: sk.judul + ' dari Berkas CSV',
        sub: 'Kolom wajib: ' + sk.wajib.join(', ') + '. Maksimal 500 baris sekali impor.',
        isi:
          '<div class="notice mb2" style="font-size:12.5px">' + ik('download', 16) +
          '<span><b>Belum punya berkasnya?</b> Unduh template resmi di bawah, isi memakai Excel / Google Spreadsheet, ' +
          'lalu simpan sebagai CSV dan unggah kembali di sini.</span></div>' +
          '<button class="btn btn-dark btn-block mb3" id="im-template">' + ik('download', 15) +
          'Unduh Template ' + F.esc(sk.berkas) + '</button>' +

          '<div class="field"><label>Berkas CSV Hasil Isian <span class="req">*</span></label>' +
          '<input class="input" type="file" id="im-file" accept=".csv,text/csv,text/plain">' +
          '<div class="hint">Pemisah koma, titik-koma, maupun tab sama-sama diterima.</div></div>' +

          '<div class="notice mb2" style="font-size:12.5px">' + ik('info', 16) + '<span>' + sk.catatan + '</span></div>' +
          '<div id="im-pratinjau"></div>',
        kaki: '<button class="btn btn-ghost" data-tutup>Batal</button>' +
          '<button class="btn btn-primary" id="im-ok" disabled>Impor Data</button>',
        siap: function (box) {
          var baris = [];
          var pv = box.querySelector('#im-pratinjau');
          var ok = box.querySelector('#im-ok');

          box.querySelector('#im-template').onclick = function () { A.unduhTemplate(jenis); };

          box.querySelector('#im-file').onchange = function () {
            var f = this.files[0];
            baris = []; ok.disabled = true;
            if (!f) { pv.innerHTML = ''; return; }

            var fr = new FileReader();
            fr.onload = function () {
              var hasil = S.Csv.urai(fr.result);
              if (!hasil.baris.length) {
                pv.innerHTML = '<div class="notice danger" style="font-size:12.5px">' + ik('alert', 16) +
                  '<span>Berkas kosong atau hanya berisi baris header.</span></div>';
                return;
              }

              var rapi = S.Csv.petakan(hasil.baris, sk.alias);
              var hilang = sk.wajib.filter(function (w) {
                return rapi.every(function (r) { return !String(r[w] || '').trim(); });
              });
              if (hilang.length) {
                pv.innerHTML = '<div class="notice danger" style="font-size:12.5px">' + ik('alert', 16) +
                  '<span><b>Kolom wajib tidak ditemukan:</b> ' + F.esc(hilang.join(', ')) +
                  '.<br>Header terbaca: <span class="mono">' + F.esc(hasil.header.join(' | ')) +
                  '</span><br>Gunakan template resmi agar nama kolom sesuai.</span></div>';
                return;
              }

              // Buang baris yang seluruh kolom wajibnya kosong (sisa baris Excel).
              baris = rapi.filter(function (r) {
                return sk.wajib.some(function (w) { return String(r[w] || '').trim(); });
              });
              if (baris.length > 500) {
                pv.innerHTML = '<div class="notice danger" style="font-size:12.5px">' + ik('alert', 16) +
                  '<span>Berkas memuat ' + baris.length + ' baris. Maksimal 500 baris per impor — ' +
                  'silakan bagi menjadi beberapa berkas.</span></div>';
                baris = []; return;
              }

              pv.innerHTML =
                '<div class="notice ok mb2" style="font-size:12.5px">' + ik('checkCircle', 16) +
                '<span><b>' + baris.length + ' baris</b> siap diimpor (pemisah terdeteksi: ' +
                (hasil.pemisah === '\t' ? 'Tab' : hasil.pemisah) + ').</span></div>' +
                '<div class="table-wrap" style="max-height:220px;overflow:auto"><table class="tbl"><thead><tr>' +
                sk.kolom.map(function (k) { return '<th>' + F.esc(k) + '</th>'; }).join('') +
                '</tr></thead><tbody>' +
                baris.slice(0, 8).map(function (r) {
                  return '<tr>' + sk.kolom.map(function (k) {
                    return '<td class="small' + (k === 'nim' || k === 'nidn' ? ' mono' : '') + '">' +
                      F.esc(r[k] || '-') + '</td>';
                  }).join('') + '</tr>';
                }).join('') + '</tbody></table></div>' +
                (baris.length > 8 ? '<div class="tiny muted mt1">Menampilkan 8 baris pertama dari ' + baris.length + '.</div>' : '');
              ok.disabled = false;
            };
            fr.readAsText(f, 'UTF-8');
          };

          ok.onclick = function (ev) {
            UI.sibuk(ev.currentTarget, true, 'Mengimpor…');
            API.kirim(sk.aksi, { baris: baris }).then(function (r) {
              UI.sibuk(ev.currentTarget, false);
              if (!r.success) return UI.toast(r.message, 'error');
              UI.tutupModal();
              var gagal = (r.data && r.data.gagal) || [];
              UI.toast(r.message, gagal.length ? 'warn' : 'ok');
              if (gagal.length) A.dialogGagalImpor(gagal);
              if (selesai) selesai();
              A.muat();
            });
          };
        }
      });
    },

    dialogGagalImpor: function (gagal) {
      UI.modal({
        judul: gagal.length + ' Baris Dilewati',
        sub: 'Baris berikut tidak diimpor. Perbaiki lalu unggah ulang hanya baris tersebut.',
        isi: '<div class="table-wrap" style="max-height:340px;overflow:auto"><table class="tbl"><thead><tr>' +
          '<th class="center">Baris</th><th>Identitas</th><th>Alasan</th></tr></thead><tbody>' +
          gagal.map(function (g) {
            return '<tr><td class="center mono">' + F.esc(g.baris) + '</td>' +
              '<td class="small">' + F.esc(g.nim || g.nama || '-') + '</td>' +
              '<td class="small">' + F.esc(g.pesan) + '</td></tr>';
          }).join('') + '</tbody></table></div>',
        kaki: '<button class="btn btn-primary" data-tutup>Mengerti</button>'
      });
    },

    /* ==================================================================
       MASTER: DOSEN & PRODI
       ================================================================== */

    renderDosen: function () {
      var el = document.getElementById('admview-dosen');
      var dosen = A.D.master.dosen || [];
      var prodi = A.D.master.prodi || [];

      el.innerHTML =
        '<div class="page-head"><div><h2>Master Data Dosen</h2>' +
        '<div class="desc">Dosen ber-NIDN tampil pada dropdown penguji Sempro &amp; Sidang. Seluruh dosen (NIDN dan Umum) tampil pada Formulir Perbaikan Nilai.</div></div>' +
        '<div class="row-wrap">' +
        '<button class="btn btn-ghost btn-sm" id="ds-template">' + ik('download', 14) + 'Template Impor</button>' +
        '<button class="btn btn-ghost btn-sm" id="ds-impor">' + ik('upload', 14) + 'Impor CSV</button>' +
        '<button class="btn btn-primary btn-sm" id="ds-tambah">' + ik('plus', 14) + 'Tambah Dosen</button></div></div>' +

        '<div class="card mb3"><div class="card-head"><div><h3>Daftar Dosen</h3>' +
        '<div class="sub">' + dosen.filter(function (d) { return d.kategori === 'NIDN'; }).length + ' dosen NIDN • ' +
        dosen.filter(function (d) { return d.kategori !== 'NIDN'; }).length + ' dosen umum</div></div>' +
        '<div class="input-icon" style="max-width:260px">' + ik('search', 16) +
        '<input class="input" id="ds-cari" placeholder="Cari nama atau NIDN…"></div></div>' +
        '<div id="ds-tabel"></div></div>' +

        '<div class="card"><div class="card-head"><div><h3>Program Studi</h3>' +
        '<div class="sub">Dikelola dari master data — tidak ada daftar prodi yang ditanam di dalam kode.</div></div>' +
        '<button class="btn btn-ghost btn-sm" id="pr-tambah">' + ik('plus', 14) + 'Tambah Prodi</button></div>' +
        '<div class="table-wrap"><table class="tbl"><thead><tr><th>Kode</th><th>Nama Program Studi</th>' +
        '<th class="center">Jenjang</th><th class="center">Status</th><th></th></tr></thead><tbody>' +
        prodi.map(function (p) {
          return '<tr><td class="mono bold">' + F.esc(p.kode) + '</td><td>' + F.esc(p.nama) + '</td>' +
            '<td class="center">' + F.esc(p.jenjang) + '</td>' +
            '<td class="center"><span class="badge ' + (p.statusAktif ? 'badge-green' : 'badge-gray') + '">' +
            (p.statusAktif ? 'Aktif' : 'Non-aktif') + '</span></td>' +
            '<td class="right"><button class="btn btn-ghost btn-sm" data-prodi="' + F.esc(p.id) + '">' + ik('edit', 13) + '</button></td></tr>';
        }).join('') + '</tbody></table></div></div>';

      var kueri = '';
      function gambarDosen() {
        var f = dosen.filter(function (x) { return S.cocok(x, kueri, ['nama', 'nidn', 'kategori']); });
        el.querySelector('#ds-tabel').innerHTML =
          '<div class="table-wrap"><table class="tbl"><thead><tr><th>Nama Dosen</th><th class="center">Kategori</th>' +
          '<th>NIDN</th><th>No. HP</th><th class="center">Status</th><th></th></tr></thead><tbody>' +
          f.map(function (x) {
            return '<tr><td class="bold">' + F.esc(x.nama) + '</td>' +
              '<td class="center"><span class="badge ' + (x.kategori === 'NIDN' ? 'badge-orange' : 'badge-gray') + '">' + F.esc(x.kategori) + '</span></td>' +
              '<td class="mono">' + F.esc(x.nidn || '-') + '</td>' +
              '<td class="mono small">' + F.esc(x.noHp || '-') + '</td>' +
              '<td class="center"><span class="badge ' + (x.statusAktif ? 'badge-green' : 'badge-gray') + '">' +
              (x.statusAktif ? 'Aktif' : 'Non-aktif') + '</span></td>' +
              '<td class="right nowrap"><button class="btn btn-ghost btn-sm" data-dosen="' + F.esc(x.id) + '">' + ik('edit', 13) + '</button> ' +
              (x.statusAktif ? '<button class="btn btn-danger btn-sm" data-nonaktif="' + F.esc(x.id) + '">' + ik('lock', 13) + '</button>' : '') +
              '</td></tr>';
          }).join('') + '</tbody></table></div>';

        Array.prototype.forEach.call(el.querySelectorAll('[data-dosen]'), function (b) {
          b.onclick = function () {
            var id = b.getAttribute('data-dosen'), m = null;
            dosen.forEach(function (x) { if (x.id === id) m = x; });
            dialogDosen(m);
          };
        });
        Array.prototype.forEach.call(el.querySelectorAll('[data-nonaktif]'), function (b) {
          b.onclick = function () {
            UI.konfirmasi({
              judul: 'Nonaktifkan Dosen?',
              isi: 'Dosen tidak akan muncul pada dropdown, namun seluruh riwayat surat yang pernah memuat nama beliau tetap utuh.',
              tombol: 'Ya, Nonaktifkan', bahaya: true
            }).then(function (ya) {
              if (!ya) return;
              API.kirim('hapusDosen', { id: b.getAttribute('data-nonaktif') }).then(function (r) {
                if (!r.success) return UI.toast(r.message, 'error');
                UI.toast(r.message, 'ok'); A.muat();
              });
            });
          };
        });
      }

      function dialogDosen(m) {
        m = m || {};
        UI.modal({
          judul: m.id ? 'Ubah Data Dosen' : 'Tambah Dosen',
          isi:
            '<div class="field"><label>Nama Lengkap &amp; Gelar <span class="req">*</span></label>' +
            '<input class="input" id="fd-nama" maxlength="120" value="' + F.esc(m.nama || '') + '" placeholder="Contoh: Dr. H. M. Ridwan, M.Ag"></div>' +
            '<div class="grid-2">' +
            '<div class="field"><label>Kategori <span class="req">*</span></label>' +
            '<select class="select" id="fd-kat">' +
            '<option value="NIDN"' + (m.kategori === 'NIDN' ? ' selected' : '') + '>NIDN (dapat menguji)</option>' +
            '<option value="UMUM"' + (m.kategori === 'UMUM' ? ' selected' : '') + '>Umum (pengampu saja)</option>' +
            '</select></div>' +
            '<div class="field"><label>NIDN</label><input class="input mono" id="fd-nidn" maxlength="20" value="' + F.esc(m.nidn || '') + '"></div>' +
            '</div>' +
            '<div class="field"><label>No. HP <span class="muted">(opsional)</span></label>' +
            '<input class="input mono" id="fd-hp" maxlength="20" value="' + F.esc(m.noHp || '') + '"></div>' +
            '<label class="check"><input type="checkbox" id="fd-aktif"' + (m.statusAktif !== false ? ' checked' : '') + '>' +
            '<span>Status aktif — hanya dosen aktif yang muncul pada dropdown penguji &amp; pengampu.</span></label>',
          kaki: '<button class="btn btn-ghost" data-tutup>Batal</button><button class="btn btn-primary" id="fd-ok">Simpan</button>',
          siap: function (box) {
            box.querySelector('#fd-ok').onclick = function (ev) {
              UI.sibuk(ev.currentTarget, true, 'Menyimpan…');
              API.kirim('simpanDosen', {
                id: m.id || '',
                nama: box.querySelector('#fd-nama').value.trim(),
                kategori: box.querySelector('#fd-kat').value,
                nidn: box.querySelector('#fd-nidn').value.trim(),
                noHp: box.querySelector('#fd-hp').value.trim(),
                statusAktif: box.querySelector('#fd-aktif').checked
              }).then(function (r) {
                UI.sibuk(ev.currentTarget, false);
                if (!r.success) return UI.toast(r.message, 'error');
                UI.tutupModal(); UI.toast(r.message, 'ok'); A.muat();
              });
            };
          }
        });
      }

      function dialogProdi(m) {
        m = m || {};
        UI.modal({
          judul: m.id ? 'Ubah Program Studi' : 'Tambah Program Studi',
          isi:
            '<div class="grid-2">' +
            '<div class="field"><label>Kode <span class="req">*</span></label>' +
            '<input class="input mono" id="fp-kode" maxlength="10" value="' + F.esc(m.kode || '') + '" placeholder="HES"></div>' +
            '<div class="field"><label>Jenjang</label>' +
            '<select class="select" id="fp-jenjang">' +
            ['S1', 'S2', 'D3'].map(function (j) { return '<option' + (m.jenjang === j ? ' selected' : '') + '>' + j + '</option>'; }).join('') +
            '</select></div></div>' +
            '<div class="field"><label>Nama Program Studi <span class="req">*</span></label>' +
            '<input class="input" id="fp-nama" maxlength="120" value="' + F.esc(m.nama || '') + '" placeholder="Hukum Ekonomi Syariah (Muamalah)"></div>' +
            '<label class="check"><input type="checkbox" id="fp-aktif"' + (m.statusAktif !== false ? ' checked' : '') + '>' +
            '<span>Status aktif</span></label>',
          kaki: '<button class="btn btn-ghost" data-tutup>Batal</button><button class="btn btn-primary" id="fp-ok">Simpan</button>',
          siap: function (box) {
            box.querySelector('#fp-ok').onclick = function (ev) {
              UI.sibuk(ev.currentTarget, true, 'Menyimpan…');
              API.kirim('simpanProdi', {
                id: m.id || '',
                kode: box.querySelector('#fp-kode').value.trim(),
                nama: box.querySelector('#fp-nama').value.trim(),
                jenjang: box.querySelector('#fp-jenjang').value,
                statusAktif: box.querySelector('#fp-aktif').checked
              }).then(function (r) {
                UI.sibuk(ev.currentTarget, false);
                if (!r.success) return UI.toast(r.message, 'error');
                UI.tutupModal(); UI.toast(r.message, 'ok'); A.muat();
              });
            };
          }
        });
      }

      el.querySelector('#ds-template').onclick = function () { A.unduhTemplate('dosen'); };
      el.querySelector('#ds-impor').onclick = function () { A.dialogImpor('dosen'); };
      el.querySelector('#ds-tambah').onclick = function () { dialogDosen(null); };
      el.querySelector('#pr-tambah').onclick = function () { dialogProdi(null); };
      el.querySelector('#ds-cari').addEventListener('input', S.debounce(function (e) { kueri = e.target.value; gambarDosen(); }, 200));
      Array.prototype.forEach.call(el.querySelectorAll('[data-prodi]'), function (b) {
        b.onclick = function () {
          var id = b.getAttribute('data-prodi'), m = null;
          prodi.forEach(function (x) { if (x.id === id) m = x; });
          dialogProdi(m);
        };
      });
      gambarDosen();
    },

    /* ==================================================================
       PENGATURAN AKSES MENU
       ================================================================== */

    renderAkses: function () {
      var el = document.getElementById('admview-akses');
      var menus = A.D.master.aksesMenu || [];

      el.innerHTML =
        '<div class="page-head"><div><h2>Pengaturan Akses Menu</h2>' +
        '<div class="desc">Buka atau tutup layanan per menu, atur rentang semester dan tanggal batas otomatis — tanpa menyentuh kode program.</div></div></div>' +
        '<div class="notice mb3">' + ik('info', 17) +
        '<span>Menonaktifkan sebuah menu <b>wajib disertai alasan</b>. Alasan tersebut ditampilkan langsung kepada mahasiswa pada kartu layanan.</span></div>' +
        '<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr>' +
        '<th>Menu Layanan</th><th class="center">Status</th><th class="center">Semester</th>' +
        '<th>Tanggal Tutup</th><th>Alasan / Catatan</th><th></th></tr></thead><tbody>' +
        menus.map(function (m) {
          return '<tr><td><div class="bold">' + F.esc(m.namaMenu) + '</div>' +
            '<div class="tiny mono muted">' + F.esc(m.kunciMenu) + '</div></td>' +
            '<td class="center"><span class="badge ' + (m.statusAktif ? 'badge-green' : 'badge-red') + '">' +
            (m.statusAktif ? 'Aktif' : 'Nonaktif') + '</span></td>' +
            '<td class="center mono">' + F.esc(m.semesterMulai) + '–' + F.esc(m.semesterSelesai) + '</td>' +
            '<td>' + (m.tanggalTutup ? F.tgl(m.tanggalTutup) : '<span class="muted">Tanpa batas</span>') + '</td>' +
            '<td class="small" style="max-width:240px">' + F.esc(m.alasanNonaktif || '-') + '</td>' +
            '<td class="right"><button class="btn btn-ghost btn-sm" data-akses="' + F.esc(m.kunciMenu) + '">' + ik('edit', 13) + ' Atur</button></td></tr>';
        }).join('') + '</tbody></table></div></div>';

      Array.prototype.forEach.call(el.querySelectorAll('[data-akses]'), function (b) {
        b.onclick = function () {
          var k = b.getAttribute('data-akses'), m = null;
          menus.forEach(function (x) { if (x.kunciMenu === k) m = x; });
          UI.modal({
            judul: 'Atur Akses — ' + m.namaMenu,
            sub: 'Perubahan langsung berlaku untuk seluruh mahasiswa.',
            isi:
              '<label class="check mb2" style="background:var(--surface-2);padding:12px;border-radius:10px">' +
              '<input type="checkbox" id="fa-aktif"' + (m.statusAktif ? ' checked' : '') + '>' +
              '<span><b>Menu aktif</b> — mahasiswa dapat mengakses layanan ini sesuai rentang semester di bawah.</span></label>' +
              '<div class="grid-2">' +
              '<div class="field"><label>Semester Mulai</label>' +
              '<input class="input mono" id="fa-mulai" type="number" min="1" max="14" value="' + F.esc(m.semesterMulai) + '"></div>' +
              '<div class="field"><label>Semester Selesai</label>' +
              '<input class="input mono" id="fa-selesai" type="number" min="1" max="14" value="' + F.esc(m.semesterSelesai) + '"></div></div>' +
              '<div class="field"><label>Tanggal Tutup Otomatis <span class="muted">(opsional)</span></label>' +
              '<input class="input" id="fa-tutup" type="date" value="' + F.inputTgl(m.tanggalTutup) + '">' +
              '<div class="hint">Setelah tanggal ini terlewat, menu tertutup otomatis tanpa perlu tindakan admin.</div></div>' +
              '<div class="field"><label>Alasan Penonaktifan <span class="req" id="fa-req" style="display:none">*</span></label>' +
              '<textarea class="textarea" id="fa-alasan" maxlength="300" placeholder="Contoh: Ditutup sementara menunggu kalender akademik semester genap.">' + F.esc(m.alasanNonaktif || '') + '</textarea>' +
              '<div class="hint">Wajib diisi bila menu dinonaktifkan — teks ini tampil di akun mahasiswa.</div></div>',
            kaki: '<button class="btn btn-ghost" data-tutup>Batal</button><button class="btn btn-primary" id="fa-ok">Simpan Pengaturan</button>',
            siap: function (box) {
              var chk = box.querySelector('#fa-aktif');
              function sinkron() { box.querySelector('#fa-req').style.display = chk.checked ? 'none' : 'inline'; }
              chk.onchange = sinkron; sinkron();
              box.querySelector('#fa-ok').onclick = function (ev) {
                UI.sibuk(ev.currentTarget, true, 'Menyimpan…');
                API.kirim('simpanAksesMenu', {
                  kunciMenu: m.kunciMenu, namaMenu: m.namaMenu,
                  statusAktif: chk.checked,
                  semesterMulai: box.querySelector('#fa-mulai').value,
                  semesterSelesai: box.querySelector('#fa-selesai').value,
                  tanggalTutup: box.querySelector('#fa-tutup').value,
                  alasanNonaktif: box.querySelector('#fa-alasan').value.trim()
                }).then(function (r) {
                  UI.sibuk(ev.currentTarget, false);
                  if (!r.success) return UI.toast(r.message, 'error');
                  UI.tutupModal(); UI.toast(r.message, 'ok'); A.muat();
                });
              };
            }
          });
        };
      });
    },

    /* ==================================================================
       MASTER JENIS SURAT & FORMULIR (CRUD + TEMPLATE GOOGLE DOC)
       ================================================================== */

    renderDokumen: function () {
      var el = document.getElementById('admview-dokumen');
      var dok = A.D.master.dokumen || [];
      var peta = A.D.master.peta || [];
      var label = Object.assign({}, A.D.master.jenisLabel || {}, A.D.master.alurKhusus || {});

      function jumlahPeta(kode) {
        return peta.filter(function (x) { return x.kodeDokumen === kode; }).length;
      }
      function belumDipetakan(kode) {
        return peta.filter(function (x) {
          return x.kodeDokumen === kode && x.sumber === 'MAHASISWA' && !x.label;
        }).length;
      }

      var surat = dok.filter(function (d) { return d.kategori === 'SURAT'; });
      var formulir = dok.filter(function (d) { return d.kategori === 'FORMULIR'; });

      function kartu(d) {
        return '<div class="dokcard' + (d.statusAktif ? '' : ' nonaktif') + '">' +
          '<div class="dc-head">' +
          '<span class="dok-ic">' + ik(d.kategori === 'SURAT' ? 'doc' : 'file', 16) + '</span>' +
          '<div class="grow" style="min-width:0">' +
          '<div class="dc-nama">' + F.esc(d.nama) + '</div>' +
          '<div class="dc-kode">' + F.esc(d.kode) + '</div></div>' +
          '<span class="badge ' + (d.statusAktif ? (d.terbitOtomatis ? 'badge-green' : 'badge-amber') : 'badge-gray') + '">' +
          (d.statusAktif ? (d.terbitOtomatis ? 'Otomatis' : 'Manual') : 'Nonaktif') + '</span>' +
          '</div>' +
          '<div class="dc-meta">' +
          '<div>' + ik('list', 12) + ' Alur: <b>' + F.esc(label[d.alur] || d.alur) + '</b></div>' +
          '<div>' + ik('doc', 12) + ' ' + (d.pakaiNomor
            ? 'Nomor: <span class="mono">' + F.esc(d.formatNomor) + '</span> (terakhir ' + F.esc(d.nomorTerakhir) + ')'
            : 'Tanpa nomor surat') + '</div>' +
          '<div>' + ik('file', 12) + ' Template: ' + (d.docId
            ? '<span class="badge badge-green">Google Doc</span>'
            : '<span class="badge badge-gray">HTML bawaan</span>') +
          ' • ' + jumlahPeta(d.kode) + ' placeholder</div>' +
          '<div>' + ik('user', 12) + ' Mahasiswa: ' + (d.tampilMahasiswa === 'TIDAK'
            ? '<span class="badge badge-gray">' + ik('lock', 10) + ' Khusus admin</span>'
            : (d.tampilMahasiswa === 'KIRIM' ? '<span class="badge badge-amber">Setelah dikirim admin</span>' : '<span class="badge badge-green">Tampil</span>')) +
          (d.blanko ? ' <span class="badge badge-blue">' + ik('printer', 10) + ' Blanko</span>' : '') + '</div>' +
          '</div>' +
          '<div class="dc-aksi">' +
          '<button class="btn btn-ghost btn-sm" data-edit="' + F.esc(d.kode) + '">' + ik('edit', 13) + ' Ubah</button>' +
          '<button class="btn btn-ghost btn-sm" data-tmpl="' + F.esc(d.kode) + '">' + ik('file', 13) + ' Template</button>' +
          '<button class="btn btn-ghost btn-sm" data-peta="' + F.esc(d.kode) + '">' + ik('grid', 13) + ' Placeholder</button>' +
          '<button class="btn btn-ghost btn-sm" data-pv="' + F.esc(d.kode) + '">' + ik('eye', 13) + ' Pratinjau</button>' +
          (d.statusAktif
            ? '<button class="btn btn-danger btn-sm" data-off="' + F.esc(d.kode) + '">' + ik('lock', 13) + '</button>'
            : '<button class="btn btn-success btn-sm" data-on="' + F.esc(d.kode) + '">' + ik('unlock', 13) + '</button>') +
          '</div></div>';
      }

      el.innerHTML =
        '<div class="page-head"><div>' +
        '<div class="crumb">' + ik('shield', 12) + ' Panel BAAK <span class="sep">/</span> Master Data <span class="sep">/</span> <span class="cur">Jenis Surat &amp; Formulir</span></div>' +
        '<h2>Master Jenis Surat &amp; Formulir</h2>' +
        '<div class="desc">Tambah, ubah, atau nonaktifkan jenis dokumen; tautkan template Google Doc milik kampus; ' +
        'lalu petakan setiap placeholder ke sumber datanya. Kolom formulir mahasiswa mengikuti pemetaan ini secara otomatis.</div></div>' +
        '<button class="btn btn-primary btn-sm" id="dk-tambah">' + ik('plus', 14) + 'Tambah Jenis Dokumen</button></div>' +

        '<div class="notice mb3">' + ik('info', 17) +
        '<span><b>Cara memakai template Google Doc:</b> buka dokumen Anda di Google Docs, tulis penanda seperti ' +
        '<span class="mono">{{nama}}</span>, <span class="mono">{{nim}}</span>, <span class="mono">{{judul}}</span> ' +
        'pada bagian yang ingin terisi otomatis, bagikan dokumen ke akun pemilik skrip sebagai <b>Editor</b>, ' +
        'lalu tempel tautannya lewat tombol <b>Template</b>. Sistem memindai seluruh placeholder dan menampilkannya untuk dipetakan.</span></div>' +

        '<div class="kpi-grid mb3">' +
        '<div class="kpi k-navy dark"><div class="kpi-icon">' + ik('doc', 16) + '</div>' +
        '<div class="kpi-label">Surat Bernomor</div><div class="kpi-value">' + surat.filter(function (d) { return d.pakaiNomor; }).length + '</div>' +
        '<div class="kpi-note">Memakai counter otomatis</div></div>' +
        '<div class="kpi k-orange"><div class="kpi-icon">' + ik('file', 16) + '</div>' +
        '<div class="kpi-label">Formulir Tanpa Nomor</div><div class="kpi-value">' + formulir.length + '</div>' +
        '<div class="kpi-note">Blanko &amp; lembar penilaian</div></div>' +
        '<div class="kpi k-green"><div class="kpi-icon">' + ik('checkCircle', 16) + '</div>' +
        '<div class="kpi-label">Template Google Doc</div><div class="kpi-value">' + dok.filter(function (d) { return d.docId; }).length + '</div>' +
        '<div class="kpi-note">Sisanya memakai template HTML bawaan</div></div>' +
        '<div class="kpi k-blue"><div class="kpi-icon">' + ik('grid', 16) + '</div>' +
        '<div class="kpi-label">Total Placeholder</div><div class="kpi-value">' + peta.length + '</div>' +
        '<div class="kpi-note">Terpetakan di seluruh dokumen</div></div>' +
        '</div>' +

        '<div class="card mb3"><div class="card-head"><div><h3>Surat Bernomor</h3>' +
        '<div class="sub">' + surat.length + ' jenis — memakai penomoran otomatis dan QR verifikasi</div></div></div>' +
        '<div class="card-body"><div class="dokgrid">' + surat.map(kartu).join('') + '</div></div></div>' +

        '<div class="card"><div class="card-head"><div><h3>Formulir Tanpa Nomor Surat</h3>' +
        '<div class="sub">' + formulir.length + ' jenis — blanko yang dicetak mahasiswa atau dewan penguji</div></div></div>' +
        '<div class="card-body"><div class="dokgrid">' + formulir.map(kartu).join('') + '</div></div></div>';

      function cari(kode) {
        var hit = null;
        dok.forEach(function (d) { if (d.kode === kode) hit = d; });
        return hit;
      }

      el.querySelector('#dk-tambah').onclick = function () { A.dialogDokumen(null); };
      Array.prototype.forEach.call(el.querySelectorAll('[data-edit]'), function (b) {
        b.onclick = function () { A.dialogDokumen(cari(b.getAttribute('data-edit'))); };
      });
      Array.prototype.forEach.call(el.querySelectorAll('[data-tmpl]'), function (b) {
        b.onclick = function () { A.dialogTemplate(cari(b.getAttribute('data-tmpl'))); };
      });
      Array.prototype.forEach.call(el.querySelectorAll('[data-peta]'), function (b) {
        b.onclick = function () { A.dialogPeta(cari(b.getAttribute('data-peta'))); };
      });
      Array.prototype.forEach.call(el.querySelectorAll('[data-pv]'), function (b) {
        b.onclick = function (ev) {
          var kode = b.getAttribute('data-pv');
          UI.sibuk(ev.currentTarget, true, '');
          API.kirim('pratinjauDokumen', { kode: kode }).then(function (r) {
            UI.sibuk(ev.currentTarget, false);
            if (!r.success) return UI.toast(r.message, 'error');
            S.Dok.pratinjau(r.data);
          });
        };
      });
      Array.prototype.forEach.call(el.querySelectorAll('[data-off]'), function (b) {
        b.onclick = function () {
          var kode = b.getAttribute('data-off');
          UI.konfirmasi({
            judul: 'Nonaktifkan Jenis Dokumen?',
            isi: 'Dokumen tidak lagi diterbitkan untuk pengajuan baru. Arsip dokumen yang sudah terbit tetap utuh.',
            tombol: 'Ya, Nonaktifkan', bahaya: true
          }).then(function (ya) {
            if (!ya) return;
            API.kirim('hapusDokumen', { kode: kode }).then(function (r) {
              if (!r.success) return UI.toast(r.message, 'error');
              UI.toast(r.message, 'ok'); A.muat();
            });
          });
        };
      });
      Array.prototype.forEach.call(el.querySelectorAll('[data-on]'), function (b) {
        b.onclick = function () {
          API.kirim('aktifkanDokumen', { kode: b.getAttribute('data-on') }).then(function (r) {
            if (!r.success) return UI.toast(r.message, 'error');
            UI.toast(r.message, 'ok'); A.muat();
          });
        };
      });
    },

    /* ------------------------------------------------ Dialog: data dokumen */

    dialogDokumen: function (d) {
      var baru = !d;
      d = d || { kategori: 'SURAT', alur: 'SURAT_AKTIF', pakaiNomor: true, terbitOtomatis: true, statusAktif: true };
      var label = Object.assign({}, A.D.master.jenisLabel || {}, A.D.master.alurKhusus || {});
      var alurList = A.D.master.daftarAlur || Object.keys(label);
      var tampil = d.tampilMahasiswa || 'YA';

      UI.modal({
        lebar: true,
        judul: baru ? 'Tambah Jenis Dokumen' : 'Ubah Jenis Dokumen',
        sub: baru ? 'Dokumen baru langsung dapat dipakai pada alur yang Anda pilih.' : d.kode,
        isi:
          '<div class="grid-2">' +
          '<div class="field"><label>Kode Dokumen <span class="req">*</span></label>' +
          '<input class="input mono" id="dd-kode" maxlength="40" value="' + F.esc(d.kode || '') + '"' + (baru ? '' : ' disabled') + '>' +
          '<div class="hint">Huruf kapital tanpa spasi, contoh: SURAT_TUGAS_KKN.</div></div>' +
          '<div class="field"><label>Kategori <span class="req">*</span></label>' +
          '<select class="select" id="dd-kategori">' +
          '<option value="SURAT"' + (d.kategori === 'SURAT' ? ' selected' : '') + '>Surat (bernomor)</option>' +
          '<option value="FORMULIR"' + (d.kategori === 'FORMULIR' ? ' selected' : '') + '>Formulir (tanpa nomor)</option>' +
          '</select></div></div>' +
          '<div class="field"><label>Nama Dokumen <span class="req">*</span></label>' +
          '<input class="input" id="dd-nama" maxlength="150" value="' + F.esc(d.nama || '') + '">' +
          '<div class="hint">Teks ini dicetak sebagai judul dokumen.</div></div>' +
          '<div class="field"><label>Alur Pengajuan Pemicu <span class="req">*</span></label>' +
          '<select class="select" id="dd-alur">' +
          alurList.map(function (a) {
            return '<option value="' + F.esc(a) + '"' + (d.alur === a ? ' selected' : '') + '>' +
              F.esc(label[a] || a) + '</option>';
          }).join('') + '</select>' +
          '<div class="hint">Dokumen dibuat ketika pengajuan pada alur ini disetujui BAAK (atau pada peristiwa khusus yang dipilih).</div></div>' +
          '<div class="field"><label>Tampil di Akun Mahasiswa</label>' +
          '<select class="select" id="dd-tampil">' +
          [['YA', 'Ya — langsung tampil setelah terbit'], ['KIRIM', 'Setelah admin menekan "Kirim ke akun mahasiswa"'], ['TIDAK', 'Tidak — khusus admin / dosen']].map(function (x) {
            return '<option value="' + x[0] + '"' + (tampil === x[0] ? ' selected' : '') + '>' + x[1] + '</option>';
          }).join('') + '</select></div>' +
          '<div class="grid-2">' +
          '<div class="field"><label>Format Nomor Surat</label>' +
          '<input class="input mono" id="dd-format" maxlength="150" value="' + F.esc(d.formatNomor || '') + '" placeholder="{no}/KODE/STISAW/{bulan_romawi}/{tahun}">' +
          '<div class="hint">Wajib memuat {no}. Kosongkan bila kategori Formulir.</div></div>' +
          '<div class="field"><label>Urutan Tampil</label>' +
          '<input class="input mono" id="dd-urutan" type="number" value="' + F.esc(d.urutan || 900) + '"></div></div>' +
          '<div class="grid-3">' +
          '<div class="field"><label>Penandatangan</label><input class="input" id="dd-ttd-nama" maxlength="120" value="' + F.esc(d.penandatangan || '') + '"></div>' +
          '<div class="field"><label>Jabatan</label><input class="input" id="dd-ttd-jab" maxlength="120" value="' + F.esc(d.jabatan || '') + '"></div>' +
          '<div class="field"><label>NIDN</label><input class="input mono" id="dd-ttd-nidn" maxlength="30" value="' + F.esc(d.nidnPenandatangan || '') + '"></div>' +
          '</div>' +
          '<label class="sakelar"><input type="checkbox" id="dd-otomatis"' + (d.terbitOtomatis !== false ? ' checked' : '') + '>' +
          '<div class="grow"><div class="s-t">Terbit otomatis saat approval</div>' +
          '<div class="s-d">Matikan bila dokumen ini hanya diterbitkan sewaktu-waktu oleh admin (mis. SK Yudisium).</div></div></label>' +
          '<label class="sakelar"><input type="checkbox" id="dd-blanko"' + (d.blanko ? ' checked' : '') + '>' +
          '<div class="grow"><div class="s-t">Blanko siap cetak mahasiswa</div>' +
          '<div class="s-d">Tampil di kartu “Formulir &amp; Blanko Siap Cetak” dengan pop-up isian sesuai placeholder (isian tidak disimpan).</div></div></label>' +
          '<label class="sakelar"><input type="checkbox" id="dd-aktif"' + (d.statusAktif !== false ? ' checked' : '') + '>' +
          '<div class="grow"><div class="s-t">Aktif</div>' +
          '<div class="s-d">Dokumen nonaktif tidak akan diterbitkan untuk pengajuan baru.</div></div></label>' +
          '<div class="field"><label>Keterangan Internal</label>' +
          '<input class="input" id="dd-ket" maxlength="400" value="' + F.esc(d.keterangan || '') + '"></div>',
        kaki: '<button class="btn btn-ghost" data-tutup>Batal</button>' +
          '<button class="btn btn-primary" id="dd-ok">Simpan</button>',
        siap: function (box) {
          var kat = box.querySelector('#dd-kategori');
          var fmt = box.querySelector('#dd-format');
          function sinkron() {
            var surat = kat.value === 'SURAT';
            fmt.disabled = !surat;
            if (!surat) fmt.value = '';
            else if (!fmt.value) fmt.value = '{no}/KODE/STISAW/{bulan_romawi}/{tahun}';
          }
          kat.onchange = sinkron; sinkron();

          box.querySelector('#dd-ok').onclick = function (ev) {
            UI.sibuk(ev.currentTarget, true, 'Menyimpan…');
            API.kirim('simpanDokumen', {
              kode: box.querySelector('#dd-kode').value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
              nama: box.querySelector('#dd-nama').value.trim(),
              kategori: kat.value,
              alur: box.querySelector('#dd-alur').value,
              pakaiNomor: kat.value === 'SURAT',
              formatNomor: fmt.value.trim(),
              urutan: box.querySelector('#dd-urutan').value,
              penandatangan: box.querySelector('#dd-ttd-nama').value.trim(),
              jabatan: box.querySelector('#dd-ttd-jab').value.trim(),
              nidnPenandatangan: box.querySelector('#dd-ttd-nidn').value.trim(),
              isiTemplate: d.isiTemplate || '',
              docId: d.docId || '', docUrl: d.docUrl || '',
              kopUrl: d.kopUrl || '', ttdUrl: d.ttdUrl || '',
              terbitOtomatis: box.querySelector('#dd-otomatis').checked,
              statusAktif: box.querySelector('#dd-aktif').checked,
              tampilMahasiswa: box.querySelector('#dd-tampil').value,
              blanko: box.querySelector('#dd-blanko').checked,
              keterangan: box.querySelector('#dd-ket').value.trim()
            }).then(function (r) {
              UI.sibuk(ev.currentTarget, false);
              if (!r.success) return UI.toast(r.message, 'error');
              UI.tutupModal(); UI.toast(r.message, 'ok'); A.muat();
            });
          };
        }
      });
    },

    /* --------------------------------------- Dialog: template & nomor surat */

    dialogTemplate: function (d) {
      UI.modal({
        lebar: true,
        judul: 'Template — ' + d.nama,
        sub: 'Template Google Doc menjadi acuan utama; template HTML dipakai bila Doc belum ditautkan.',
        isi:
          '<div class="tabs mb2" style="background:var(--surface);border:1px solid var(--line);border-radius:12px" id="tp-tabs">' +
          '<button class="tab active" data-tab="doc">' + ik('file', 14) + ' Google Doc</button>' +
          '<button class="tab" data-tab="nomor">' + ik('settings', 14) + ' Nomor Surat</button>' +
          '<button class="tab" data-tab="html">' + ik('edit', 14) + ' Template HTML</button>' +
          '</div>' +

          '<div data-panel="doc">' +
          '<div class="field"><label>Tautan Google Doc</label>' +
          '<input class="input" id="tp-url" placeholder="https://docs.google.com/document/d/..../edit" value="' + F.esc(d.docUrl || '') + '">' +
          '<div class="hint">Tempel URL dokumen dari browser. Pastikan dokumen dibagikan sebagai <b>Editor</b> ke akun pemilik skrip.</div></div>' +
          (d.docId
            ? '<div class="notice ok mb2" style="font-size:12.5px">' + ik('checkCircle', 16) +
            '<span>Template sudah tertaut. <a href="' + F.esc(d.docUrl) + '" target="_blank" rel="noopener">Buka di Google Docs</a></span></div>'
            : '<div class="notice mb2" style="font-size:12.5px">' + ik('info', 16) +
            '<span>Belum ada template Google Doc — dokumen dibuat dari template HTML bawaan.</span></div>') +
          '<button class="btn btn-primary btn-block" id="tp-scan">' + ik('search', 15) + 'Tautkan &amp; Pindai Placeholder</button>' +
          '<div id="tp-hasil" class="mt2"></div>' +
          '</div>' +

          '<div data-panel="nomor" class="hidden">' +
          '<div class="field"><label>Format Nomor Surat</label>' +
          '<input class="input mono" id="tp-format" maxlength="150" value="' + F.esc(d.formatNomor || '') + '"></div>' +
          '<div class="field"><label>Nomor Terakhir Terpakai</label>' +
          '<input class="input mono" id="tp-nomor" type="number" min="0" value="' + F.esc(d.nomorTerakhir || 0) + '">' +
          '<div class="hint">Pengajuan berikutnya memakai nomor ini + 1. Counter otomatis kembali ke 1 saat tahun berganti.</div></div>' +
          '<label class="check"><input type="checkbox" id="tp-reset">' +
          '<span>Reset seri ke <b>1</b> untuk tahun berjalan (' + new Date().getFullYear() + ').</span></label>' +
          '<div class="notice mt2" style="font-size:12.5px">' + ik('info', 16) +
          '<span>Penanda: <span class="mono">{no}</span> (3 digit) · <span class="mono">{no_polos}</span> · ' +
          '<span class="mono">{bulan_romawi}</span> · <span class="mono">{bulan}</span> · ' +
          '<span class="mono">{tahun}</span> · <span class="mono">{tahun2}</span> · <span class="mono">{kode}</span></span></div>' +
          '<button class="btn btn-primary btn-block mt2" id="tp-simpan-nomor">Simpan Format Nomor</button>' +
          '</div>' +

          '<div data-panel="html" class="hidden">' +
          '<div class="tiny muted mb2">Dipakai hanya bila template Google Doc belum ditautkan. Placeholder ditulis {{nama_field}}.</div>' +
          '<div class="grid-2">' +
          '<div class="field"><label>Kop Surat (gambar)</label>' +
          '<div class="upload" id="tp-kop" style="padding:12px"><input type="file" accept="image/*">' +
          '<div data-info>' + (d.kopUrl
            ? '<img src="' + F.esc(d.kopUrl) + '" style="max-height:48px" alt="Kop"><div class="tiny muted mt1">Klik untuk ganti</div>'
            : '<div class="tiny">' + ik('upload', 18) + ' Unggah kop surat</div>') + '</div></div></div>' +
          '<div class="field"><label>Tanda Tangan (gambar)</label>' +
          '<div class="upload" id="tp-ttd" style="padding:12px"><input type="file" accept="image/*">' +
          '<div data-info>' + (d.ttdUrl
            ? '<img src="' + F.esc(d.ttdUrl) + '" style="max-height:48px" alt="TTD"><div class="tiny muted mt1">Klik untuk ganti</div>'
            : '<div class="tiny">' + ik('upload', 18) + ' Unggah tanda tangan</div>') + '</div></div></div></div>' +
          '<div class="field"><label>Isi Template HTML</label>' +
          '<textarea class="textarea mono" id="tp-html" style="min-height:220px;font-size:12.5px">' + F.esc(d.isiTemplate || '') + '</textarea></div>' +
          '<button class="btn btn-primary btn-block" id="tp-simpan-html">Simpan Template HTML</button>' +
          '</div>',
        kaki: '<button class="btn btn-ghost" data-tutup>Tutup</button>' +
          '<button class="btn btn-dark" id="tp-pratinjau">' + ik('eye', 15) + 'Pratinjau Hasil</button>',
        siap: function (box) {
          // tab
          var tabs = box.querySelector('#tp-tabs');
          Array.prototype.forEach.call(tabs.querySelectorAll('.tab'), function (t) {
            t.onclick = function () {
              Array.prototype.forEach.call(tabs.querySelectorAll('.tab'), function (x) { x.classList.remove('active'); });
              t.classList.add('active');
              var target = t.getAttribute('data-tab');
              Array.prototype.forEach.call(box.querySelectorAll('[data-panel]'), function (pnl) {
                pnl.classList.toggle('hidden', pnl.getAttribute('data-panel') !== target);
              });
            };
          });

          box.querySelector('#tp-scan').onclick = function (ev) {
            var url = box.querySelector('#tp-url').value.trim();
            if (!url) return UI.toast('Tempel tautan Google Doc terlebih dahulu.', 'error');
            UI.sibuk(ev.currentTarget, true, 'Memindai dokumen…');
            API.kirim('tautkanTemplate', { kode: d.kode, docUrl: url }).then(function (r) {
              UI.sibuk(ev.currentTarget, false);
              if (!r.success) {
                box.querySelector('#tp-hasil').innerHTML =
                  '<div class="notice danger" style="font-size:12.5px">' + ik('alert', 16) + '<span>' + F.esc(r.message) + '</span></div>';
                return;
              }
              UI.toast(r.message, 'ok');
              box.querySelector('#tp-hasil').innerHTML =
                '<div class="notice ok" style="font-size:12.5px">' + ik('checkCircle', 16) +
                '<span><b>' + r.data.jumlah + ' placeholder terdeteksi</b>' +
                (r.data.baru ? ', ' + r.data.baru + ' baru dan perlu dipetakan.' : '.') + '</span></div>' +
                '<div class="dok-list mt2">' + r.data.peta.map(function (x) {
                  var w = x.sumber === 'AUTO' ? 'badge-green' : (x.sumber === 'ADMIN' ? 'badge-blue' : 'badge-orange');
                  return '<div class="dok-item"><span class="peta-kode" style="flex:none">{{' + F.esc(x.placeholder) + '}}</span>' +
                    '<div class="grow truncate">' + F.esc(x.label) + '</div>' +
                    '<span class="badge ' + w + '">' + F.esc(x.sumber) + '</span>' +
                    (x.baru ? '<span class="badge badge-amber">BARU</span>' : '') + '</div>';
                }).join('') + '</div>' +
                '<button class="btn btn-primary btn-block mt2" id="tp-ke-peta">' + ik('grid', 15) + 'Atur Pemetaan Placeholder</button>';
              A.muat().then(function () {
                var b = box.querySelector('#tp-ke-peta');
                if (b) b.onclick = function () {
                  UI.tutupModal();
                  var baru = null;
                  (A.D.master.dokumen || []).forEach(function (x) { if (x.kode === d.kode) baru = x; });
                  setTimeout(function () { A.dialogPeta(baru || d); }, 180);
                };
              });
            });
          };

          box.querySelector('#tp-simpan-nomor').onclick = function (ev) {
            UI.sibuk(ev.currentTarget, true, 'Menyimpan…');
            API.kirim('simpanNomorDokumen', {
              kode: d.kode,
              formatNomor: box.querySelector('#tp-format').value.trim(),
              nomorTerakhir: box.querySelector('#tp-nomor').value,
              resetNomor: box.querySelector('#tp-reset').checked
            }).then(function (r) {
              UI.sibuk(ev.currentTarget, false);
              if (!r.success) return UI.toast(r.message, 'error');
              UI.toast(r.message, 'ok'); A.muat();
            });
          };

          var uKop = S.pasangUnggah(box.querySelector('#tp-kop'), { aset: true, maksMb: 3 });
          var uTtd = S.pasangUnggah(box.querySelector('#tp-ttd'), { aset: true, maksMb: 3 });
          box.querySelector('#tp-simpan-html').onclick = function (ev) {
            if (uKop.sedang || uTtd.sedang) return UI.toast('Tunggu proses unggah gambar selesai.', 'warn');
            UI.sibuk(ev.currentTarget, true, 'Menyimpan…');
            API.kirim('simpanDokumen', {
              kode: d.kode, nama: d.nama, kategori: d.kategori, alur: d.alur,
              pakaiNomor: d.pakaiNomor, formatNomor: d.formatNomor,
              docId: d.docId, docUrl: d.docUrl,
              kopUrl: uKop.url || d.kopUrl, ttdUrl: uTtd.url || d.ttdUrl,
              penandatangan: d.penandatangan, jabatan: d.jabatan, nidnPenandatangan: d.nidnPenandatangan,
              isiTemplate: box.querySelector('#tp-html').value,
              terbitOtomatis: d.terbitOtomatis, urutan: d.urutan,
              statusAktif: d.statusAktif, keterangan: d.keterangan,
              tampilMahasiswa: d.tampilMahasiswa, blanko: d.blanko
            }).then(function (r) {
              UI.sibuk(ev.currentTarget, false);
              if (!r.success) return UI.toast(r.message, 'error');
              UI.toast(r.message, 'ok'); A.muat();
            });
          };

          box.querySelector('#tp-pratinjau').onclick = function (ev) {
            UI.sibuk(ev.currentTarget, true, 'Membuat…');
            API.kirim('pratinjauDokumen', { kode: d.kode }).then(function (r) {
              UI.sibuk(ev.currentTarget, false);
              if (!r.success) return UI.toast(r.message, 'error');
              S.Dok.pratinjau(r.data);
            });
          };
        }
      });
    },

    /* -------------------------------------- Dialog: pemetaan placeholder */

    dialogPeta: function (d) {
      var peta = (A.D.master.peta || []).filter(function (x) { return x.kodeDokumen === d.kode; })
        .sort(function (a, b) { return (parseInt(a.urutan, 10) || 999) - (parseInt(b.urutan, 10) || 999); });

      var TIPE = [['text', 'Teks singkat'], ['textarea', 'Teks panjang'], ['number', 'Angka'],
      ['date', 'Tanggal'], ['tel', 'Nomor HP'], ['nik', 'NIK (16 digit)'],
      ['email', 'Email'], ['select', 'Pilihan'], ['dosen', 'Pilih dosen (semua)'],
      ['dosen_nidn', 'Pilih dosen NIDN']];

      function baris(x, i) {
        return '<div class="peta-row" data-id="' + F.esc(x.id) + '">' +
          '<div><div class="lbl">Placeholder</div><span class="peta-kode">{{' + F.esc(x.placeholder) + '}}</span></div>' +
          '<div class="field"><div class="lbl">Label yang dilihat pengisi</div>' +
          '<input class="input" data-f="label" value="' + F.esc(x.label || x.placeholder) + '" maxlength="120"></div>' +
          '<div class="field"><div class="lbl">Sumber nilai</div>' +
          '<select class="select" data-f="sumber">' +
          ['AUTO', 'MAHASISWA', 'ADMIN'].map(function (sm) {
            var t = { AUTO: 'Otomatis (data induk)', MAHASISWA: 'Input mahasiswa', ADMIN: 'Input admin' }[sm];
            return '<option value="' + sm + '"' + (x.sumber === sm ? ' selected' : '') + '>' + t + '</option>';
          }).join('') + '</select></div>' +
          '<div class="field"><div class="lbl">Tipe kolom</div>' +
          '<select class="select" data-f="tipeField">' +
          TIPE.map(function (t) {
            return '<option value="' + t[0] + '"' + (x.tipeField === t[0] ? ' selected' : '') + '>' + t[1] + '</option>';
          }).join('') + '</select></div>' +
          '<label class="check" style="padding-bottom:9px"><input type="checkbox" data-f="wajib"' +
          ((x.wajib === true || x.wajib === 'TRUE' || x.wajib === 'true') ? ' checked' : '') + '><span class="tiny">Wajib</span></label>' +
          '</div>';
      }

      UI.modal({
        lebar: true,
        judul: 'Pemetaan Placeholder — ' + d.nama,
        sub: peta.length + ' placeholder • kolom bertanda “Input mahasiswa” otomatis muncul di formulir pengajuan',
        isi: peta.length
          ? '<div class="notice mb2" style="font-size:12.5px">' + ik('info', 16) +
          '<span><b>Otomatis</b> = diisi sistem dari data induk (nama, NIM, prodi, nomor surat, tanggal). ' +
          '<b>Input mahasiswa</b> = muncul sebagai kolom pada formulir pengajuan. ' +
          '<b>Input admin</b> = diisi BAAK saat memproses.</span></div>' +
          '<div style="max-height:52vh;overflow:auto;padding-right:4px">' + peta.map(baris).join('') + '</div>'
          : UI.kosong('Belum Ada Placeholder', 'Tautkan template Google Doc terlebih dahulu pada tab Template.', 'grid'),
        kaki: '<button class="btn btn-ghost" data-tutup>Tutup</button>' +
          (peta.length ? '<button class="btn btn-primary" id="pt-simpan">' + ik('check', 15) + 'Simpan Pemetaan</button>' : ''),
        siap: function (box) {
          var b = box.querySelector('#pt-simpan');
          if (!b) return;
          b.onclick = function (ev) {
            var items = [];
            Array.prototype.forEach.call(box.querySelectorAll('.peta-row'), function (row, i) {
              var id = row.getAttribute('data-id');
              var asli = null;
              peta.forEach(function (x) { if (x.id === id) asli = x; });
              items.push({
                id: id, placeholder: asli.placeholder,
                label: row.querySelector('[data-f="label"]').value.trim(),
                sumber: row.querySelector('[data-f="sumber"]').value,
                fieldAuto: asli.fieldAuto || asli.placeholder,
                tipeField: row.querySelector('[data-f="tipeField"]').value,
                opsi: asli.opsi || '',
                wajib: row.querySelector('[data-f="wajib"]').checked,
                urutan: (i + 1) * 10,
                bantuan: asli.bantuan || '',
                nilaiDefault: asli.nilaiDefault || ''
              });
            });
            UI.sibuk(ev.currentTarget, true, 'Menyimpan…');
            API.kirim('simpanPeta', { kode: d.kode, items: items }).then(function (r) {
              UI.sibuk(ev.currentTarget, false);
              if (!r.success) return UI.toast(r.message, 'error');
              UI.tutupModal();
              UI.toast(r.message + ' Formulir mahasiswa ikut menyesuaikan.', 'ok');
              A.muat();
            });
          };
        }
      });
    },

    /* --------------------------------- Dialog: terbitkan dokumen manual */

    dialogTerbitManual: function (r, kode, btn) {
      var dok = null;
      (A.D.master.dokumen || []).forEach(function (x) { if (x.kode === kode) dok = x; });
      if (!dok) return;
      var def = A.fieldAdminDokumen(kode);

      function kirim(adminData, tombol) {
        UI.sibuk(tombol, true, 'Menerbitkan…');
        API.kirim('terbitkanDokumen', { idPengajuan: r.id, kode: kode, adminData: adminData }).then(function (res) {
          UI.sibuk(tombol, false);
          if (!res.success) return UI.toast(res.message, 'error');
          UI.tutupModal();
          UI.toast(res.message, 'ok', 'Dokumen Terbit');
          S.Dok.pratinjau(res.data);
          A.muat();
        });
      }

      if (!def.length) { kirim({}, btn); return; }

      UI.modal({
        judul: 'Terbitkan — ' + dok.nama,
        sub: r.nama + ' • ' + r.nim,
        isi: '<div class="tiny muted mb2">Lengkapi data berikut sebelum dokumen diterbitkan.</div>' +
          S.Form.render(def, { prefix: 'tm', tanpaKotak: true, dosen: (A.D.master.dosen || []) }),
        kaki: '<button class="btn btn-ghost" data-tutup>Batal</button>' +
          '<button class="btn btn-primary" id="tm-ok">' + ik('send', 15) + 'Terbitkan</button>',
        siap: function (box) {
          box.querySelector('#tm-ok').onclick = function (ev) {
            var nilai = S.Form.ambil(box);
            var salah = S.Form.periksa(def, nilai);
            if (salah) return UI.toast(salah, 'error');
            kirim(nilai, ev.currentTarget);
          };
        }
      });
    },

    /** Tampilkan hasil penerbitan agar admin bisa langsung memeriksa. */
    dialogHasilTerbit: function (dokumen) {
      UI.modal({
        judul: 'Dokumen Berhasil Diterbitkan',
        sub: dokumen.length + ' berkas dibuat dan dikirim ke akun mahasiswa',
        isi: S.Dok.daftar(dokumen),
        kaki: '<button class="btn btn-primary" data-tutup>Selesai</button>',
        siap: function (box) { S.Dok.pasang(box, dokumen); }
      });
    },

    /* ==================================================================
       KONTROL KONFIGURASI (dipakai bersama oleh Notifikasi & Pengaturan)
       ------------------------------------------------------------------
       Seluruh kontrol menulis nilainya pada atribut data-cfg sehingga satu
       tombol "Simpan" cukup memindai [data-cfg] di dalam halamannya.
       ================================================================== */

    Ctl: {
      teks: function (cfg, key, label, hint, tipe, ph) {
        return '<div class="field"><label>' + F.esc(label) + '</label>' +
          '<input class="input' + (tipe === 'mono' ? ' mono' : '') + '" data-cfg="' + key + '" type="' +
          (tipe && tipe !== 'mono' ? tipe : 'text') + '" maxlength="300"' +
          (ph ? ' placeholder="' + F.esc(ph) + '"' : '') +
          ' value="' + F.esc(cfg[key] === undefined ? '' : cfg[key]) + '">' +
          (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
      },

      /** Textarea biasa. Bila `pipa` true, tiap baris disimpan dipisah "|". */
      area: function (cfg, key, label, hint, baris, pipa) {
        var nilai = String(cfg[key] === undefined ? '' : cfg[key]);
        if (pipa) nilai = nilai.split('|').join('\n');
        return '<div class="field"><label>' + F.esc(label) + '</label>' +
          '<textarea class="input" data-cfg="' + key + '"' + (pipa ? ' data-pipa="1"' : '') +
          ' rows="' + (baris || 4) + '" style="resize:vertical;line-height:1.55">' +
          F.esc(nilai) + '</textarea>' +
          (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
      },

      sakelar: function (cfg, key, judul, deskripsi) {
        var on = String(cfg[key] === undefined ? '' : cfg[key]).toUpperCase();
        var aktif = (on === 'TRUE' || on === 'YA' || on === '1' || on === 'AKTIF');
        return '<label class="sakelar"><input type="checkbox" data-cfg="' + key + '" data-bool="1"' +
          (aktif ? ' checked' : '') + '>' +
          '<span class="grow"><span class="s-t">' + F.esc(judul) + '</span>' +
          '<span class="s-d">' + F.esc(deskripsi) + '</span></span></label>';
      },

      /** Kumpulkan seluruh kontrol [data-cfg] pada sebuah wadah. */
      kumpul: function (root) {
        var items = [];
        Array.prototype.forEach.call(root.querySelectorAll('[data-cfg]'), function (x) {
          var key = x.getAttribute('data-cfg'), nilai;
          if (x.getAttribute('data-bool')) nilai = x.checked ? 'TRUE' : 'FALSE';
          else if (x.getAttribute('data-pipa')) {
            nilai = String(x.value).split('\n').map(function (b) { return b.trim(); })
              .filter(function (b) { return b; }).join('|');
          } else nilai = String(x.value).trim();
          items.push({ key: key, value: nilai });
        });
        return items;
      },

      simpan: function (root, btn, sesudah) {
        var items = A.Ctl.kumpul(root);
        if (!items.length) return UI.toast('Tidak ada perubahan untuk disimpan.', 'warn');
        UI.sibuk(btn, true, 'Menyimpan…');
        API.kirim('simpanAppConfig', { items: items }).then(function (r) {
          UI.sibuk(btn, false);
          if (!r.success) return UI.toast(r.message, 'error');
          UI.toast(r.message, 'ok');
          if (sesudah) sesudah();
          A.muat();
        });
      }
    },

    /* ==================================================================
       PENGATURAN APLIKASI & AKUN ADMIN
       ================================================================== */

    renderPengaturan: function () {
      var el = document.getElementById('admview-pengaturan');
      var cfg = A.D.konfigurasi || {};
      var admins = A.D.master.admin || [];

      var C = A.Ctl;

      el.innerHTML =
        '<div class="page-head"><div>' +
        '<div class="crumb">' + ik('shield', 12) + ' Panel BAAK <span class="sep">/</span> Sistem <span class="sep">/</span> <span class="cur">Pengaturan</span></div>' +
        '<h2>Pengaturan Aplikasi</h2>' +
        '<div class="desc">Identitas institusi, ketentuan layanan, aturan akademik remedial, dan akun admin BAAK.</div></div>' +
        '<button class="btn btn-primary btn-sm" id="pg-simpan">' + ik('check', 14) + 'Simpan Perubahan</button></div>' +

        '<div class="split">' +

        /* ------------------------------------------------ kolom kiri */
        '<div>' +
        '<div class="card mb3"><div class="card-head"><h3>Identitas Institusi</h3></div><div class="card-body">' +
        C.teks(cfg, 'INSTITUSI', 'Nama Institusi', 'Tercetak pada kop surat bila gambar kop tidak diunggah.') +
        C.teks(cfg, 'UNIT', 'Unit Penerbit Surat') +
        C.teks(cfg, 'ALAMAT_KAMPUS', 'Alamat Kampus') +
        '<div class="grid-2">' + C.teks(cfg, 'KOTA', 'Kota Penanggalan Surat') +
        C.teks(cfg, 'SK_IZIN', 'Nomor SK Izin Operasional') + '</div>' +
        '<div class="grid-2">' + C.teks(cfg, 'EMAIL_BAAK', 'Email Layanan BAAK', '', 'email') +
        C.teks(cfg, 'WA_BAAK', 'WhatsApp Layanan', 'Format 62xxxxxxxxxx', 'mono') + '</div>' +
        '</div></div>' +

        '<div class="card"><div class="card-head"><h3>Ketentuan Layanan</h3></div><div class="card-body">' +
        C.teks(cfg, 'BATAS_MAGANG', 'Batas Pengajuan Magang',
          'Menu Magang &amp; Konfirmasi Magang tertutup otomatis setelah tanggal ini.', 'date') +
        C.teks(cfg, 'MASA_BERLAKU_SURAT_AKTIF', 'Masa Berlaku Surat Aktif (bulan)', '', 'number') +
        '</div></div>' +
        '</div>' +

        /* ----------------------------------------------- kolom kanan */
        '<div>' +
        '<div class="card mb3"><div class="card-head"><div><h3>Aturan Akademik Remedial</h3>' +
        '<div class="sub">Seluruh butir di bawah tampil apa adanya pada halaman mahasiswa dan dipakai sebagai validasi server.</div></div></div>' +
        '<div class="card-body">' +
        '<div class="grid-2">' +
        C.teks(cfg, 'REMEDIAL_NILAI_MIN', 'Nilai Minimum Boleh Remedial', 'Di bawah ini wajib mengulang kelas.', 'number') +
        C.teks(cfg, 'REMEDIAL_NILAI_MAKS', 'Nilai Maksimum Boleh Remedial', 'Di atas ini dianggap sudah lulus.', 'number') +
        '</div>' +
        '<div class="grid-2">' +
        C.teks(cfg, 'REMEDIAL_BIAYA', 'Biaya per Mata Kuliah (Rp)', '', 'number') +
        C.teks(cfg, 'REMEDIAL_MAKS_MK', 'Maksimal MK per Semester', 'Isi 0 untuk tanpa batas.', 'number') +
        '</div>' +
        C.teks(cfg, 'REMEDIAL_REKENING', 'Rekening Pembayaran') +
        C.teks(cfg, 'REMEDIAL_MATKUL_PENGECUALIAN', 'Mata Kuliah Pengecualian',
          'Pisahkan dengan koma. Mata kuliah ini boleh remedial walaupun nilainya di bawah batas minimum.') +
        C.area(cfg, 'REMEDIAL_TEKS_PERNYATAAN', 'Teks Pernyataan Persetujuan',
          'Wajib dicentang mahasiswa sebelum formulir dapat dikirim.', 3) +
        C.area(cfg, 'REMEDIAL_ATURAN', 'Butir Aturan yang Ditampilkan',
          '<b>Satu butir per baris.</b> Kata kunci yang diganti otomatis: ' +
          '<span class="mono">{min}</span> <span class="mono">{maks}</span> ' +
          '<span class="mono">{pengecualian}</span> <span class="mono">{maksMk}</span> ' +
          '<span class="mono">{biaya}</span>', 6, true) +
        '</div></div>' +

        '<div class="card"><div class="card-head"><div><h3>Akun Admin BAAK</h3>' +
        '<div class="sub">' + admins.length + ' akun terdaftar</div></div>' +
        '<button class="btn btn-ghost btn-sm" id="pg-tambah-admin">' + ik('plus', 14) + 'Tambah</button></div>' +
        '<div class="table-wrap"><table class="tbl"><thead><tr><th>Username</th><th>Nama</th>' +
        '<th class="center">Status</th><th></th></tr></thead><tbody>' +
        admins.map(function (a) {
          return '<tr><td class="mono bold">' + F.esc(a.username) + '</td>' +
            '<td>' + F.esc(a.nama) + '<div class="tiny muted">' + F.esc(a.jabatan || '-') + '</div></td>' +
            '<td class="center"><span class="badge ' + (a.statusAktif ? 'badge-green' : 'badge-gray') + '">' +
            (a.statusAktif ? 'Aktif' : 'Non-aktif') + '</span></td>' +
            '<td class="right"><button class="btn btn-ghost btn-sm" data-admin="' + F.esc(a.id) + '">' + ik('edit', 13) + '</button></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="card-body"><button class="btn btn-dark btn-block" id="pg-ganti-pass">' +
        ik('lock', 15) + 'Ganti Password Akun Saya</button></div></div>' +
        '</div>' +

        '</div>';

      el.querySelector('#pg-simpan').onclick = function (ev) { A.Ctl.simpan(el, ev.currentTarget); };

      el.querySelector('#pg-ganti-pass').onclick = function () {
        UI.modal({
          judul: 'Ganti Password',
          sub: 'Minimal 8 karakter, memuat huruf dan angka.',
          isi:
            '<div class="field"><label>Password Lama</label><input class="input" id="gp-lama" type="password"></div>' +
            '<div class="field"><label>Password Baru</label><input class="input" id="gp-baru" type="password"></div>' +
            '<div class="field"><label>Ulangi Password Baru</label><input class="input" id="gp-ulang" type="password"></div>',
          kaki: '<button class="btn btn-ghost" data-tutup>Batal</button><button class="btn btn-primary" id="gp-ok">Simpan</button>',
          siap: function (box) {
            box.querySelector('#gp-ok').onclick = function (ev) {
              var baru = box.querySelector('#gp-baru').value;
              if (baru !== box.querySelector('#gp-ulang').value) return UI.toast('Konfirmasi password tidak cocok.', 'error');
              UI.sibuk(ev.currentTarget, true, 'Menyimpan…');
              API.kirim('gantiPassword', { passwordLama: box.querySelector('#gp-lama').value, passwordBaru: baru })
                .then(function (r) {
                  UI.sibuk(ev.currentTarget, false);
                  if (!r.success) return UI.toast(r.message, 'error');
                  UI.tutupModal(); UI.toast(r.message, 'ok');
                });
            };
          }
        });
      };

      function dialogAdmin(m) {
        m = m || {};
        UI.modal({
          judul: m.id ? 'Ubah Akun Admin' : 'Tambah Akun Admin',
          isi:
            '<div class="grid-2">' +
            '<div class="field"><label>Username <span class="req">*</span></label>' +
            '<input class="input mono" id="fa2-user" maxlength="50" value="' + F.esc(m.username || '') + '"></div>' +
            '<div class="field"><label>Nama Lengkap <span class="req">*</span></label>' +
            '<input class="input" id="fa2-nama" maxlength="100" value="' + F.esc(m.nama || '') + '"></div></div>' +
            '<div class="field"><label>Jabatan</label>' +
            '<input class="input" id="fa2-jab" maxlength="100" value="' + F.esc(m.jabatan || '') + '"></div>' +
            '<div class="field"><label>Password ' + (m.id ? '<span class="muted">(kosongkan bila tidak diganti)</span>' : '<span class="req">*</span>') + '</label>' +
            '<input class="input" id="fa2-pass" type="password" placeholder="Minimal 8 karakter"></div>' +
            '<label class="check"><input type="checkbox" id="fa2-aktif"' + (m.statusAktif !== false ? ' checked' : '') + '>' +
            '<span>Akun aktif</span></label>',
          kaki: '<button class="btn btn-ghost" data-tutup>Batal</button><button class="btn btn-primary" id="fa2-ok">Simpan</button>',
          siap: function (box) {
            box.querySelector('#fa2-ok').onclick = function (ev) {
              UI.sibuk(ev.currentTarget, true, 'Menyimpan…');
              API.kirim('simpanAdmin', {
                id: m.id || '',
                username: box.querySelector('#fa2-user').value.trim(),
                nama: box.querySelector('#fa2-nama').value.trim(),
                jabatan: box.querySelector('#fa2-jab').value.trim(),
                password: box.querySelector('#fa2-pass').value,
                statusAktif: box.querySelector('#fa2-aktif').checked
              }).then(function (r) {
                UI.sibuk(ev.currentTarget, false);
                if (!r.success) return UI.toast(r.message, 'error');
                UI.tutupModal(); UI.toast(r.message, 'ok'); A.muat();
              });
            };
          }
        });
      }

      el.querySelector('#pg-tambah-admin').onclick = function () { dialogAdmin(null); };
      Array.prototype.forEach.call(el.querySelectorAll('[data-admin]'), function (b) {
        b.onclick = function () {
          var id = b.getAttribute('data-admin'), m = null;
          admins.forEach(function (x) { if (x.id === id) m = x; });
          dialogAdmin(m);
        };
      });
    },

    /* ==================================================================
       LOG AKTIVITAS
       ================================================================== */

    renderLog: function () {
      var el = document.getElementById('admview-log');
      el.innerHTML =
        '<div class="page-head"><div><h2>Log Aktivitas Sistem</h2>' +
        '<div class="desc">Jejak audit seluruh tindakan mahasiswa dan admin — siapa melakukan apa dan kapan.</div></div>' +
        '<button class="btn btn-ghost btn-sm" id="lg-muat">' + ik('refresh', 14) + 'Muat Ulang</button></div>' +
        '<div class="card"><div class="card-body" style="padding:14px 16px;border-bottom:1px solid var(--line)">' +
        '<div class="input-icon">' + ik('search', 16) + '<input class="input" id="lg-cari" placeholder="Cari aktor, aksi, atau target…"></div></div>' +
        '<div id="lg-tabel"><div class="card-body">' + UI.skeleton(5, 34) + '</div></div></div>';

      var data = [], kueri = '';

      function gambar() {
        var f = data.filter(function (x) { return S.cocok(x, kueri, ['aktor', 'aksi', 'target', 'keterangan', 'peran']); });
        var box = el.querySelector('#lg-tabel');
        if (!f.length) { box.innerHTML = '<div class="card-body">' + UI.kosong('Belum Ada Log', 'Aktivitas akan tercatat otomatis.', 'list') + '</div>'; return; }
        box.innerHTML = '<div class="table-wrap"><table class="tbl"><thead><tr>' +
          '<th>Waktu</th><th>Aktor</th><th class="center">Peran</th><th>Aksi</th><th>Target</th><th>Keterangan</th>' +
          '</tr></thead><tbody>' + f.map(function (x) {
            return '<tr><td class="nowrap small">' + F.tglJam(x.waktu) + '</td>' +
              '<td class="mono small">' + F.esc(x.aktor) + '</td>' +
              '<td class="center"><span class="badge ' + (x.peran === 'ADMIN' ? 'badge-navy' : 'badge-gray') + '">' + F.esc(x.peran) + '</span></td>' +
              '<td class="bold small">' + F.esc(x.aksi) + '</td>' +
              '<td class="mono small">' + F.esc(x.target) + '</td>' +
              '<td class="small muted" style="max-width:280px">' + F.esc(x.keterangan) + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      }

      function muat() {
        API.kirim('muatLog', { batas: 400 }).then(function (r) {
          if (!r.success) return UI.toast(r.message, 'error');
          data = r.data; gambar();
        });
      }

      el.querySelector('#lg-muat').onclick = muat;
      el.querySelector('#lg-cari').addEventListener('input', S.debounce(function (e) { kueri = e.target.value; gambar(); }, 200));
      muat();
    }
  };

  S.Admin = A;

})(window.SIAKAD);
