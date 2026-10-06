/* ==========================================================================
   SIAKAD SURAT — 06 MODUL ADMIN TAMBAHAN (dimuat malas)
   • WhatsApp & Notifikasi  (gas-notifikasi-wa-crm): Konfigurasi · Antrean · Blast
   • CRM Kontak             : Nama · Email · WhatsApp seluruh mahasiswa & dosen
   • Migrasi Data           (gas-migrasi-database): impor dari app lama
   Berkas ini baru diunduh saat salah satu menu di atas dibuka.
   ========================================================================== */

(function (S) {
  'use strict';
  var API = S.API, UI = S.UI, F = S.F, ik = S.ikon, Simpan = S.Simpan;

  function $(root, sel) { return root.querySelector(sel); }
  function $$(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
  function kepala(crumb, judul, desk, kanan) {
    return '<div class="page-head"><div>' +
      '<div class="crumb">' + ik('shield', 12) + ' Panel BAAK <span class="sep">/</span> Sistem <span class="sep">/</span> <span class="cur">' + F.esc(crumb) + '</span></div>' +
      '<h2>' + judul + '</h2><div class="desc">' + desk + '</div></div>' + (kanan || '') + '</div>';
  }
  function tabBar(id, daftar, aktif) {
    return '<div class="tabs mb2" style="background:var(--surface);border:1px solid var(--line);border-radius:12px" id="' + id + '">' +
      daftar.map(function (t) {
        return '<button class="tab' + (t[0] === aktif ? ' active' : '') + '" data-tab="' + t[0] + '">' + ik(t[2], 14) + ' ' + t[1] + '</button>';
      }).join('') + '</div>';
  }
  function pasangTab(root, id, ganti) {
    $$(root, '#' + id + ' .tab').forEach(function (t) {
      t.onclick = function () {
        $$(root, '#' + id + ' .tab').forEach(function (x) { x.classList.toggle('active', x === t); });
        var k = t.getAttribute('data-tab');
        $$(root, '[data-panel]').forEach(function (p) { p.classList.toggle('hidden', p.getAttribute('data-panel') !== k); });
        if (ganti) ganti(k);
      };
    });
  }
  function bukaTab(root, id, k) {
    var t = $(root, '#' + id + ' [data-tab="' + k + '"]');
    if (t) t.click();
  }
  /** Ambil data modul: cache perangkat dulu (prefetch), lalu segarkan dari server. */
  function swr(action, data, render, opsi) {
    opsi = opsi || {};
    var kunci = 'adm_mod_' + action;
    var c = opsi.tanpaCache ? null : Simpan.get(kunci);
    if (c) render(c, true);
    return API.kirim(action, data || {}).then(function (r) {
      if (!r.success) { if (!c) UI.toast(r.message, 'error'); return r; }
      var lama = c ? JSON.stringify(c) : '';
      Simpan.set(kunci, r.data);
      if (JSON.stringify(r.data) !== lama) render(r.data, false);
      return r;
    });
  }
  function badgeWa(st) {
    if (st === 'Terdaftar') return '<span class="badge badge-green" title="Terdaftar di WhatsApp">' + ik('check', 10) + ' WA</span>';
    if (st === 'Tidak Terdaftar') return '<span class="badge badge-red" title="Tidak terdaftar di WhatsApp">✕ WA</span>';
    return '<span class="badge badge-gray" title="Belum dicek">? WA</span>';
  }
  /** Cek nomor WA per 50 (batas Fonnte /validate) dengan progres. */
  function cekNomor(nomor, progres) {
    var unik = [], lihat = {};
    nomor.forEach(function (n) { if (n && !lihat[n]) { lihat[n] = 1; unik.push(n); } });
    var hasil = {}, i = 0;
    function lanjut() {
      if (i >= unik.length) return Promise.resolve({ ok: true, hasil: hasil });
      var potong = unik.slice(i, i + 50);
      if (progres) progres(Math.min(i + 50, unik.length), unik.length);
      return API.kirim('waValidasi', { nomor: potong }).then(function (r) {
        if (!r.success) return { ok: false, pesan: r.message, hasil: hasil };
        Object.keys(r.data.hasil || {}).forEach(function (k) { hasil[k] = r.data.hasil[k]; });
        i += 50;
        return lanjut();
      });
    }
    return lanjut();
  }

  var Mod = {
    render: function (nama, el) {
      if (nama === 'notifikasi') return Notif.render(el);
      if (nama === 'crm') return Crm.render(el);
      if (nama === 'migrasi') return Migrasi.render(el);
    }
  };

  /* ======================================================================
     1. WHATSAPP & NOTIFIKASI
     ====================================================================== */

  var PLACEHOLDER = [
    ['{nama}', 'Nama penerima'], ['{nim}', 'NIM'], ['{dokumen}', 'Nama surat / formulir'], ['{nomor}', 'Nomor surat'],
    ['{id}', 'ID pengajuan'], ['{tanggal}', 'Tanggal'], ['{link}', 'Tautan unduh / aplikasi'], ['{alasan}', 'Catatan penolakan'],
    ['{hari}', 'Hari ujian'], ['{jam}', 'Jam ujian'], ['{ruang}', 'Ruang ujian'], ['{penguji}', 'Daftar penguji'],
    ['{sisa}', 'Sisa hari'], ['{unit}', 'Unit (BAAK)'], ['{institusi}', 'Nama institusi']
  ];
  var PLACEHOLDER_BLAST = [['{nama}', 'Nama'], ['{nim}', 'NIM'], ['{prodi}', 'Program studi'], ['{angkatan}', 'Angkatan'], ['{institusi}', 'Institusi'], ['{link}', 'Tautan aplikasi']];

  var Notif = {
    el: null, cfg: null, audiens: null, blastPenerima: null,

    render: function (el) {
      Notif.el = el;
      el.innerHTML =
        kepala('WhatsApp & Notifikasi', 'WhatsApp &amp; Notifikasi',
          'Fonnte WhatsApp + email otomatis lewat antrean (tombol admin tetap instan), blast WA per batch, dan deteksi nomor WhatsApp.',
          '<div class="row-wrap" id="nt-status"></div>') +
        tabBar('nt-tabs', [['konfig', 'Konfigurasi', 'settings'], ['antrean', 'Antrean &amp; Log', 'inbox'], ['blast', 'Blast WA', 'send']], 'konfig') +
        '<div data-panel="konfig" id="nt-konfig">' + UI.skeleton(4, 70) + '</div>' +
        '<div data-panel="antrean" class="hidden" id="nt-antrean"></div>' +
        '<div data-panel="blast" class="hidden" id="nt-blast"></div>';
      pasangTab(el, 'nt-tabs', function (k) {
        if (k === 'antrean') Notif.renderAntrean();
        if (k === 'blast') Notif.renderBlast();
      });
      swr('notifConfig', {}, function (d) { Notif.cfg = d; Notif.renderKonfig(); });
      if (Notif.blastPenerima) bukaTab(el, 'nt-tabs', 'blast');
    },

    renderStatus: function () {
      var c = Notif.cfg || {}, box = $(Notif.el, '#nt-status');
      if (!box) return;
      box.innerHTML =
        '<span class="badge ' + (c.waAktif && c.adaToken ? 'badge-green' : 'badge-gray') + '">' + ik('phone', 11) + ' WA ' + (c.waAktif && c.adaToken ? 'Aktif' : 'Nonaktif') + '</span>' +
        '<span class="badge ' + (c.emailAktif ? 'badge-green' : 'badge-gray') + '">' + ik('mail', 11) + ' Email ' + (c.emailAktif ? 'Aktif' : 'Nonaktif') + '</span>' +
        '<span class="badge ' + (c.trigger && c.trigger.latar ? 'badge-blue' : 'badge-red') + '" title="Pemicu pekerjaLatar (tiap 1 menit)">' + ik('clock', 11) + ' Pemicu ' + (c.trigger && c.trigger.latar ? 'aktif' : 'belum dipasang') + '</span>';
    },

    renderKonfig: function () {
      var c = Notif.cfg, box = $(Notif.el, '#nt-konfig');
      Notif.renderStatus();
      var appUrl = c.appUrl || (location.origin + location.pathname).replace(/index\.html$/, '');
      box.innerHTML =
        (c.trigger && !c.trigger.latar
          ? '<div class="notice danger mb2">' + ik('alert', 17) + '<span><b>Pemicu latar belum dipasang.</b> Buka editor Apps Script lalu jalankan fungsi ' +
            '<span class="mono">pasangTrigger()</span> sekali — tanpa ini PDF, WhatsApp, dan email di antrean tidak terkirim otomatis ' +
            '(menyimpan pengaturan dengan notifikasi aktif juga memasangnya otomatis).</span></div>' : '') +
        '<div class="split">' +
        '<div>' +
        '<div class="card mb3"><div class="card-head"><div><h3>Gateway WhatsApp — Fonnte</h3>' +
        '<div class="sub">Token disimpan di Script Properties — tidak pernah tampil utuh di browser.</div></div>' +
        '<button class="btn btn-ghost btn-sm" id="nt-device">' + ik('phone', 14) + 'Cek Perangkat</button></div><div class="card-body">' +
        '<div id="nt-device-info"></div>' +
        '<label class="sakelar"><input type="checkbox" id="nt-wa"' + (c.waAktif ? ' checked' : '') + '><span class="grow"><span class="s-t">Aktifkan WhatsApp</span>' +
        '<span class="s-d">Saklar utama kanal WhatsApp. Mati = tidak ada pesan WA yang diantrekan.</span></span></label>' +
        '<div class="field"><label>Token Perangkat Fonnte</label>' +
        '<input class="input mono" id="nt-token" placeholder="' + F.esc(c.adaToken ? 'Tersimpan: ' + c.tokenMask + ' — kosongkan bila tidak diubah' : 'Tempel token dari dashboard Fonnte → Device') + '">' +
        '<div class="hint">Dashboard Fonnte → <b>Device</b> → salin <b>Token</b>.' + (c.adaToken ? ' <a href="#" id="nt-hapus-token">Hapus token</a>' : '') + '</div></div>' +
        '<div class="grid-2"><div class="field"><label>Ukuran Batch Blast</label><select class="select" id="nt-batch">' +
        [10, 20, 50].map(function (n) { return '<option' + (c.batchDefault === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label>Jeda Antarpesan (detik)</label><input class="input mono" id="nt-jeda" value="' + F.esc(c.jeda) + '" placeholder="5 atau 3-8">' +
        '<div class="hint">Rentang acak (mis. 3-8) lebih aman dari pemblokiran.</div></div></div>' +
        '<label class="sakelar"><input type="checkbox" id="nt-deteksi"' + (c.deteksiOtomatis ? ' checked' : '') + '><span class="grow"><span class="s-t">Deteksi nomor WhatsApp otomatis</span>' +
        '<span class="s-d">Kontak baru dicek terdaftar/tidaknya di WhatsApp ±10 menit sekali (maks 50 nomor).</span></span></label>' +
        '<div class="field"><label>Uji Kirim WhatsApp</label><div class="row-wrap"><input class="input mono grow" id="nt-uji-wa" placeholder="08xxxxxxxxxx" maxlength="20">' +
        '<button class="btn btn-dark" id="nt-uji-wa-btn">' + ik('send', 15) + 'Kirim Uji</button></div><div class="hint">Simpan token lebih dahulu.</div></div>' +
        '</div></div>' +

        '<div class="card mb3"><div class="card-head"><div><h3>Email</h3><div class="sub">Dikirim dari akun Google pemilik skrip • sisa kuota hari ini: <b>' +
        F.esc(c.kuotaEmail === undefined ? '-' : c.kuotaEmail) + '</b></div></div></div><div class="card-body">' +
        '<label class="sakelar"><input type="checkbox" id="nt-email"' + (c.emailAktif ? ' checked' : '') + '><span class="grow"><span class="s-t">Aktifkan Email</span>' +
        '<span class="s-d">Email dokumen terbit hanya berisi tautan unduh — PDF tidak dilampirkan.</span></span></label>' +
        '<div class="field"><label>Nama Pengirim</label><input class="input" id="nt-pengirim" maxlength="100" value="' + F.esc(c.namaPengirim) + '"></div>' +
        '<div class="field"><label>Uji Kirim Email</label><div class="row-wrap"><input class="input grow" id="nt-uji-email" type="email" placeholder="nama@contoh.com">' +
        '<button class="btn btn-dark" id="nt-uji-email-btn">' + ik('mail', 15) + 'Kirim Uji</button></div></div>' +
        '</div></div>' +

        '<div class="card"><div class="card-head"><div><h3>Lain-lain</h3></div></div><div class="card-body">' +
        '<div class="field"><label>Alamat Aplikasi (untuk {link})</label><input class="input mono" id="nt-url" value="' + F.esc(appUrl) + '"></div>' +
        '<div class="field"><label>Sinkron CRM otomatis tiap (menit)</label><input class="input mono" id="nt-crm" type="number" min="10" value="' + F.esc(c.crmSyncMenit || 30) + '"></div>' +
        '</div></div>' +
        '</div>' +

        '<div>' +
        '<div class="card"><div class="card-head"><div><h3>Peristiwa &amp; Kanal</h3>' +
        '<div class="sub">Pilih kejadian yang dikirim via WhatsApp dan/atau email, lalu sesuaikan isi pesannya.</div></div></div>' +
        '<div class="card-body">' +
        '<div class="row-wrap mb2" style="gap:5px">' + PLACEHOLDER.map(function (p) {
          return '<span class="badge badge-gray mono" title="' + F.esc(p[1]) + '">' + F.esc(p[0]) + '</span>';
        }).join('') + '</div>' +
        (c.matriks || []).map(function (m) {
          return '<div class="tahap" style="margin-bottom:10px" data-ev="' + F.esc(m.kode) + '"><div class="tahap-h">' +
            '<div class="grow"><div class="bold" style="font-size:13.5px">' + F.esc(m.label) + '</div><div class="tiny muted mono">' + F.esc(m.kode) + '</div></div>' +
            '<label class="row" style="gap:6px;align-items:center;font-size:13px"><input type="checkbox" data-ev-wa' + (m.wa ? ' checked' : '') + '> WA</label>' +
            '<label class="row" style="gap:6px;align-items:center;font-size:13px;margin-left:10px"><input type="checkbox" data-ev-email' + (m.email ? ' checked' : '') + '> Email</label>' +
            '<button class="btn btn-ghost btn-sm" data-ev-ubah style="margin-left:8px">' + ik('edit', 13) + '</button></div>' +
            '<div class="tahap-b hidden" data-ev-isi>' +
            '<div class="field"><label>Subjek Email</label><input class="input" data-ev-subjek maxlength="200" value="' + F.esc(m.subjek) + '"></div>' +
            '<div class="field"><label>Isi Pesan</label><textarea class="textarea" data-ev-pesan rows="7" style="resize:vertical">' + F.esc(m.pesan) + '</textarea></div>' +
            '<button class="btn btn-ghost btn-sm" data-ev-reset>' + ik('refresh', 13) + 'Kembalikan bawaan</button></div></div>';
        }).join('') +
        '</div></div></div>' +
        '</div>' +
        '<div class="row-wrap mt2" style="justify-content:flex-end"><button class="btn btn-primary" id="nt-simpan">' + ik('check', 15) + 'Simpan Konfigurasi</button></div>';

      // Aksi
      $$(box, '[data-ev]').forEach(function (row) {
        var kode = row.getAttribute('data-ev'), m = null;
        (c.matriks || []).forEach(function (x) { if (x.kode === kode) m = x; });
        $(row, '[data-ev-ubah]').onclick = function () { $(row, '[data-ev-isi]').classList.toggle('hidden'); };
        $(row, '[data-ev-reset]').onclick = function () { $(row, '[data-ev-subjek]').value = m.subjekDefault; $(row, '[data-ev-pesan]').value = m.pesanDefault; };
      });
      var tokenBaru = '';
      var hapus = $(box, '#nt-hapus-token');
      if (hapus) hapus.onclick = function (e) {
        e.preventDefault();
        UI.konfirmasi({ judul: 'Hapus token Fonnte?', isi: 'WhatsApp otomatis berhenti sampai token baru diisi.', tombol: 'Hapus', bahaya: true })
          .then(function (ya) { if (ya) { tokenBaru = '__HAPUS__'; $(box, '#nt-wa').checked = false; simpan($(box, '#nt-simpan')); } });
      };
      function simpan(btn) {
        var matriks = {};
        $$(box, '[data-ev]').forEach(function (row) {
          matriks[row.getAttribute('data-ev')] = {
            wa: $(row, '[data-ev-wa]').checked, email: $(row, '[data-ev-email]').checked,
            subjek: $(row, '[data-ev-subjek]').value, pesan: $(row, '[data-ev-pesan]').value
          };
        });
        var data = {
          waAktif: $(box, '#nt-wa').checked, emailAktif: $(box, '#nt-email').checked,
          token: tokenBaru || $(box, '#nt-token').value.trim(),
          batchDefault: parseInt($(box, '#nt-batch').value, 10), jeda: $(box, '#nt-jeda').value.trim(),
          deteksiOtomatis: $(box, '#nt-deteksi').checked, namaPengirim: $(box, '#nt-pengirim').value.trim(),
          appUrl: $(box, '#nt-url').value.trim(), crmSyncMenit: $(box, '#nt-crm').value, matriks: matriks
        };
        UI.sibuk(btn, true, 'Menyimpan…');
        API.kirim('notifConfigSimpan', data).then(function (r) {
          UI.sibuk(btn, false);
          tokenBaru = '';
          if (!r.success) return UI.toast(r.message, 'error');
          UI.toast(r.message, 'ok');
          Notif.cfg = r.data; Simpan.set('adm_mod_notifConfig', r.data);
          Notif.renderKonfig();
        });
      }
      $(box, '#nt-simpan').onclick = function (ev) { simpan(ev.currentTarget); };
      $(box, '#nt-device').onclick = function (ev) {
        var btn = ev.currentTarget;
        UI.sibuk(btn, true, 'Mengecek…');
        API.kirim('waPerangkat', {}).then(function (r) {
          UI.sibuk(btn, false);
          var info = $(box, '#nt-device-info');
          if (!r.success) { info.innerHTML = '<div class="notice danger mb2" style="font-size:12.5px">' + ik('alert', 16) + '<span>' + F.esc(r.message) + '</span></div>'; return; }
          var d = r.data, ok = d.status === 'connect';
          info.innerHTML = '<div class="mini-stat mb2">' +
            '<div class="ms"><div class="l">Nomor</div><div class="v mono">' + F.esc(d.nomor) + '</div></div>' +
            '<div class="ms"><div class="l">Status</div><div class="v"><span class="badge ' + (ok ? 'badge-green' : 'badge-red') + '">' + F.esc(d.status) + '</span></div></div>' +
            '<div class="ms"><div class="l">Paket / Kuota</div><div class="v">' + F.esc(d.paket) + ' • ' + F.esc(d.kuota) + '</div></div>' +
            '<div class="ms"><div class="l">Kedaluwarsa</div><div class="v">' + F.esc(d.kedaluwarsa) + '</div></div></div>';
        });
      };
      $(box, '#nt-uji-wa-btn').onclick = function (ev) {
        var no = $(box, '#nt-uji-wa').value.trim(), btn = ev.currentTarget;
        if (!no) return UI.toast('Isi nomor tujuan.', 'error');
        UI.sibuk(btn, true, 'Mengirim…');
        API.kirim('ujiWa', { noWa: no }).then(function (r) {
          UI.sibuk(btn, false);
          UI.toast(r.message, r.success ? 'ok' : 'error', r.success ? 'Uji Berhasil' : 'Uji Gagal');
        });
      };
      $(box, '#nt-uji-email-btn').onclick = function (ev) {
        var em = $(box, '#nt-uji-email').value.trim(), btn = ev.currentTarget;
        if (!em) return UI.toast('Isi alamat email tujuan.', 'error');
        UI.sibuk(btn, true, 'Mengirim…');
        API.kirim('ujiEmail', { email: em }).then(function (r) {
          UI.sibuk(btn, false);
          UI.toast(r.message, r.success ? 'ok' : 'error');
        });
      };
    },

    /* ---------------------------------------------- Tab Antrean & Log */
    filter: { status: '', kanal: '', blastId: '' },

    renderAntrean: function () {
      var box = $(Notif.el, '#nt-antrean');
      var f = Notif.filter;
      box.innerHTML =
        '<div class="card"><div class="card-head"><div><h3>Antrean Pengiriman</h3><div class="sub" id="na-ringkas">Memuat…</div></div>' +
        '<div class="row-wrap"><button class="btn btn-ghost btn-sm" id="na-ulang">' + ik('refresh', 14) + 'Ulangi yang Gagal</button>' +
        '<button class="btn btn-primary btn-sm" id="na-proses">' + ik('send', 14) + 'Proses Sekarang</button></div></div>' +
        '<div class="card-body" style="padding:12px 16px;border-bottom:1px solid var(--line)"><div class="row-wrap">' +
        '<select class="select" id="na-status" style="max-width:180px"><option value="">Semua status</option>' +
        ['ANTRI', 'TERKIRIM', 'GAGAL', 'BATAL'].map(function (x) { return '<option' + (f.status === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select>' +
        '<select class="select" id="na-kanal" style="max-width:160px"><option value="">Semua kanal</option>' +
        ['WA', 'EMAIL'].map(function (x) { return '<option' + (f.kanal === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select>' +
        (f.blastId ? '<span class="badge badge-orange">Blast ' + F.esc(f.blastId) + ' <a href="#" id="na-lepas" style="color:inherit;margin-left:4px">✕</a></span>' : '') +
        '<button class="btn btn-ghost btn-sm" id="na-muat">' + ik('refresh', 14) + 'Muat Ulang</button></div></div>' +
        '<div id="na-isi">' + UI.skeleton(5, 34) + '</div></div>';

      function muat() {
        API.kirim('notifAntrean', Notif.filter).then(function (r) {
          var isi = $(box, '#na-isi');
          if (!r.success) { isi.innerHTML = '<div class="card-body">' + UI.kosong('Gagal memuat', r.message, 'alert') + '</div>'; return; }
          var d = r.data, s = d.ringkas || {};
          $(box, '#na-ringkas').innerHTML = 'Antri <b>' + (s.ANTRI || 0) + '</b> • Terkirim <b>' + (s.TERKIRIM || 0) + '</b> • Gagal <b>' + (s.GAGAL || 0) +
            '</b> • Batal <b>' + (s.BATAL || 0) + '</b> • Sisa kuota email ' + F.esc(d.kuotaEmail);
          if (!d.rows.length) { isi.innerHTML = '<div class="card-body">' + UI.kosong('Antrean kosong', 'Belum ada pesan pada filter ini.', 'send') + '</div>'; return; }
          isi.innerHTML = '<div class="table-wrap" style="max-height:540px;overflow:auto"><table class="tbl"><thead><tr>' +
            '<th>Waktu</th><th>Kanal</th><th>Tujuan</th><th>Peristiwa</th><th>Pesan</th><th>Status</th></tr></thead><tbody>' +
            d.rows.map(function (x) {
              var st = x.status === 'KIRIM' ? 'ANTRI' : x.status;
              var cls = st === 'TERKIRIM' ? 'badge-green' : (st === 'GAGAL' ? 'badge-red' : (st === 'BATAL' ? 'badge-gray' : 'badge-amber'));
              return '<tr><td class="nowrap small">' + F.tglJam(x.dikirimPada || x.dibuatPada) + '</td>' +
                '<td><span class="badge ' + (x.kanal === 'WA' ? 'badge-green' : 'badge-navy') + '">' + F.esc(x.kanal) + '</span></td>' +
                '<td class="mono small">' + F.esc(x.tujuan) + '<div class="tiny muted">' + F.esc(x.namaPenerima || '') + '</div></td>' +
                '<td class="small">' + F.esc(x.peristiwa) + '</td>' +
                '<td class="small" style="max-width:320px">' + F.esc(x.pesan) + '</td>' +
                '<td><span class="badge ' + cls + '" title="' + F.esc(x.respon || '') + '">' + F.esc(st) + '</span>' +
                (x.percobaan > 1 ? '<div class="tiny muted">' + x.percobaan + '× coba</div>' : '') + '</td></tr>';
            }).join('') + '</tbody></table></div>';
        });
      }
      $(box, '#na-status').onchange = function () { Notif.filter.status = this.value; muat(); };
      $(box, '#na-kanal').onchange = function () { Notif.filter.kanal = this.value; muat(); };
      var lepas = $(box, '#na-lepas');
      if (lepas) lepas.onclick = function (e) { e.preventDefault(); Notif.filter.blastId = ''; Notif.renderAntrean(); };
      $(box, '#na-muat').onclick = muat;
      $(box, '#na-proses').onclick = function (ev) {
        var btn = ev.currentTarget;
        UI.sibuk(btn, true, 'Mengirim…');
        API.kirim('notifProsesSekarang', {}).then(function (r) {
          UI.sibuk(btn, false);
          UI.toast(r.message, r.success ? 'ok' : 'error');
          muat();
        });
      };
      $(box, '#na-ulang').onclick = function (ev) {
        var btn = ev.currentTarget;
        UI.sibuk(btn, true, 'Memproses…');
        API.kirim('notifUlangi', {}).then(function (r) {
          UI.sibuk(btn, false);
          UI.toast(r.message, r.success ? 'ok' : 'error');
          muat();
        });
      };
      muat();
    },

    /* ------------------------------------------------------ Tab Blast WA */
    renderBlast: function () {
      var box = $(Notif.el, '#nt-blast');
      var c = Notif.cfg || {};
      var segmen = ['', 'Mahasiswa', 'Dosen'];
      var prodi = (S.Admin && S.Admin.D && S.Admin.D.master.prodi) || [];
      var dariCrm = Notif.blastPenerima;

      box.innerHTML =
        '<div class="split">' +
        '<div class="card"><div class="card-head"><div><h3>Buat Blast WhatsApp</h3>' +
        '<div class="sub">Dikirim bertahap per batch dengan jeda — aman dari pemblokiran &amp; tetap berjalan walau tab ditutup.</div></div></div>' +
        '<div class="card-body">' +
        '<div class="field"><label>Judul Blast</label><input class="input" id="bl-judul" maxlength="120" placeholder="Contoh: Info Yudisium Oktober"></div>' +
        (dariCrm
          ? '<div class="notice mb2">' + ik('users', 16) + '<span><b>' + dariCrm.length + ' kontak</b> dipilih dari CRM Kontak. ' +
            '<a href="#" id="bl-lepas">Gunakan filter</a></span></div>'
          : '<div class="field"><label>Sumber Penerima</label><select class="select" id="bl-sumber"><option value="CRM">CRM Kontak (mahasiswa &amp; dosen)</option><option value="MANUAL">Tempel daftar nomor</option></select></div>' +
            '<div id="bl-filter"><div class="grid-2">' +
            '<div class="field"><label>Segmen</label><select class="select" id="bl-segmen">' + segmen.map(function (x) { return '<option value="' + x + '">' + (x || 'Semua') + '</option>'; }).join('') + '</select></div>' +
            '<div class="field"><label>Program Studi</label><select class="select" id="bl-prodi"><option value="">Semua</option>' +
            prodi.map(function (p) { return '<option value="' + F.esc(p.kode) + '">' + F.esc(p.nama) + '</option>'; }).join('') + '</select></div>' +
            '<div class="field"><label>Angkatan</label><input class="input mono" id="bl-angkatan" maxlength="4" placeholder="Semua"></div>' +
            '<div class="field"><label>Semester</label><input class="input mono" id="bl-semester" maxlength="2" placeholder="Semua"></div>' +
            '<div class="field"><label>Tag</label><input class="input" id="bl-tag" placeholder="Semua"></div>' +
            '<div class="field"><label>Status WA</label><select class="select" id="bl-statuswa"><option value="">Semua</option><option value="TERDAFTAR">Hanya terdaftar WA</option><option value="BELUM">Belum dicek</option></select></div>' +
            '</div><label class="sakelar"><input type="checkbox" id="bl-aktif" checked><span class="grow"><span class="s-t">Hanya kontak aktif</span></span></label></div>' +
            '<div class="field hidden" id="bl-manual-wrap"><label>Daftar Nomor</label><textarea class="textarea" id="bl-manual" rows="6" placeholder="08123456789|Nama&#10;08234567890|Nama"></textarea>' +
            '<div class="hint">Satu baris satu nomor; nama opsional setelah tanda |</div></div>' +
            '<button class="btn btn-ghost btn-block" id="bl-muat">' + ik('users', 15) + 'Muat Penerima</button>') +
        '<div id="bl-audiens" class="mt2"></div>' +
        '<div class="field mt2"><label>Isi Pesan</label>' +
        '<div class="row-wrap mb1" style="gap:5px">' + PLACEHOLDER_BLAST.map(function (p) {
          return '<button type="button" class="badge badge-gray mono" style="border:none;cursor:pointer" data-sisip="' + p[0] + '" title="' + F.esc(p[1]) + '">' + p[0] + '</button>';
        }).join('') + '</div>' +
        '<textarea class="textarea" id="bl-pesan" rows="7" maxlength="4000" placeholder="Assalamu\'alaikum {nama} ({nim})…"></textarea></div>' +
        '<div class="grid-2"><div class="field"><label>Ukuran Batch</label><select class="select" id="bl-batch">' +
        [10, 20, 50].map(function (n) { return '<option' + ((c.batchDefault || 20) === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label>Jeda (detik)</label><input class="input mono" id="bl-jeda" value="' + F.esc(c.jeda || '5') + '"></div></div>' +
        '<button class="btn btn-primary btn-block btn-lg" id="bl-buat">' + ik('send', 16) + 'Buat &amp; Mulai Blast</button>' +
        '</div></div>' +

        '<div class="card"><div class="card-head"><div><h3>Riwayat Blast</h3><div class="sub">Batch berikutnya dikirim otomatis tiap menit oleh pemicu latar.</div></div>' +
        '<button class="btn btn-ghost btn-sm" id="bl-segar">' + ik('refresh', 14) + '</button></div><div id="bl-list">' + UI.skeleton(3, 70) + '</div></div>' +
        '</div>';

      var audiens = dariCrm ? { rows: dariCrm, ringkas: null } : null;
      function gambarAudiens() {
        var a = $(box, '#bl-audiens');
        if (!audiens) { a.innerHTML = ''; return; }
        var rows = audiens.rows, ok = rows.filter(function (r) { return r.valid !== false && !r.optOut && !r.ganda; });
        var terdaftar = rows.filter(function (r) { return r.statusWA === 'Terdaftar'; }).length;
        var belum = rows.filter(function (r) { return !r.statusWA && r.noWa; }).length;
        a.innerHTML = '<div class="mini-stat mb1">' +
          '<div class="ms"><div class="l">Penerima</div><div class="v">' + ok.length + ' / ' + rows.length + '</div></div>' +
          '<div class="ms"><div class="l">Terdaftar WA</div><div class="v">' + terdaftar + '</div></div>' +
          '<div class="ms"><div class="l">Belum dicek</div><div class="v">' + belum + '</div></div>' +
          '<div class="ms"><div class="l">Dibuang</div><div class="v">' + (rows.length - ok.length) + '</div></div></div>' +
          (belum ? '<button class="btn btn-ghost btn-sm btn-block" id="bl-cek">' + ik('phone', 14) + 'Cek ' + belum + ' nomor di WhatsApp</button>' : '') +
          '<div class="tiny muted mt1">Nomor tidak valid, ganda, dan opt-out otomatis tidak dikirimi.</div>';
        var bc = $(a, '#bl-cek');
        if (bc) bc.onclick = function () {
          var nomor = rows.filter(function (r) { return !r.statusWA && r.noWa; }).map(function (r) { return r.noWa; });
          UI.sibuk(bc, true, 'Mengecek…');
          cekNomor(nomor, function (n, tot) { bc.innerHTML = '<span class="spinner dark"></span> Mengecek ' + n + '/' + tot + '…'; }).then(function (h) {
            UI.sibuk(bc, false);
            rows.forEach(function (r) { if (h.hasil[r.noWa]) r.statusWA = h.hasil[r.noWa]; });
            if (!h.ok) UI.toast(h.pesan, 'warn');
            else UI.toast('Pengecekan nomor selesai.', 'ok');
            gambarAudiens();
          });
        };
      }
      gambarAudiens();

      var lepas = $(box, '#bl-lepas');
      if (lepas) lepas.onclick = function (e) { e.preventDefault(); Notif.blastPenerima = null; Notif.renderBlast(); };
      var sumber = $(box, '#bl-sumber');
      if (sumber) sumber.onchange = function () {
        var manual = sumber.value === 'MANUAL';
        $(box, '#bl-filter').classList.toggle('hidden', manual);
        $(box, '#bl-manual-wrap').classList.toggle('hidden', !manual);
      };
      var bMuat = $(box, '#bl-muat');
      if (bMuat) bMuat.onclick = function (ev) {
        var btn = ev.currentTarget;
        var data = sumber.value === 'MANUAL' ? { sumber: 'MANUAL', teks: $(box, '#bl-manual').value } : {
          sumber: 'CRM', filter: {
            segmen: $(box, '#bl-segmen').value, prodi: $(box, '#bl-prodi').value, angkatan: $(box, '#bl-angkatan').value.trim(),
            semester: $(box, '#bl-semester').value.trim(), tag: $(box, '#bl-tag').value.trim(), statusWA: $(box, '#bl-statuswa').value,
            aktif: $(box, '#bl-aktif').checked
          }
        };
        UI.sibuk(btn, true, 'Memuat…');
        API.kirim('waAudiens', data).then(function (r) {
          UI.sibuk(btn, false);
          if (!r.success) return UI.toast(r.message, 'error');
          audiens = r.data;
          gambarAudiens();
        });
      };
      var ta = $(box, '#bl-pesan');
      $$(box, '[data-sisip]').forEach(function (b) {
        b.onclick = function () {
          var t = b.getAttribute('data-sisip'), p = ta.selectionStart || ta.value.length;
          ta.value = ta.value.substring(0, p) + t + ta.value.substring(p);
          ta.focus(); ta.selectionStart = ta.selectionEnd = p + t.length;
        };
      });
      $(box, '#bl-buat').onclick = function (ev) {
        if (!audiens || !audiens.rows.length) return UI.toast('Muat penerima terlebih dahulu.', 'error');
        var pesan = ta.value.trim();
        if (!pesan) return UI.toast('Isi pesan wajib diisi.', 'error');
        var penerima = audiens.rows.filter(function (r) { return r.noWa && !r.optOut; })
          .map(function (r) { return { id: r.id, nama: r.nama, noWa: r.noWa, info: r.info || {} }; });
        var btn = ev.currentTarget;
        UI.konfirmasi({
          judul: 'Mulai Blast ke ' + penerima.length + ' penerima?',
          isi: 'Pesan dikirim per ' + $(box, '#bl-batch').value + ' nomor dengan jeda ' + F.esc($(box, '#bl-jeda').value) + ' detik. Blast dapat dihentikan kapan saja.',
          tombol: 'Ya, Mulai'
        }).then(function (ya) {
          if (!ya) return;
          UI.sibuk(btn, true, 'Menyiapkan…');
          API.kirim('blastBuat', {
            judul: $(box, '#bl-judul').value.trim(), pesan: pesan, ukuranBatch: parseInt($(box, '#bl-batch').value, 10),
            jeda: $(box, '#bl-jeda').value.trim(), penerima: penerima,
            sasaran: dariCrm ? penerima.length + ' kontak CRM terpilih' : ''
          }).then(function (r) {
            UI.sibuk(btn, false);
            if (!r.success) return UI.toast(r.message, 'error');
            var dib = r.data.dibuang || {};
            UI.toast(r.message + (dib.ganda || dib.optOut || dib.tidakValid ? ' (dibuang: ' + (dib.ganda || 0) + ' ganda, ' + (dib.optOut || 0) + ' opt-out, ' + (dib.tidakValid || 0) + ' tidak valid)' : ''), 'ok');
            Notif.blastPenerima = null;
            muatList(r.data.blastId);
          });
        });
      };

      function muatList(langsungKirim) {
        swr('blastList', {}, function (list) { gambarList(list); }).then(function () {
          if (langsungKirim) kirimBatch(langsungKirim);
        });
      }
      function gambarList(list) {
        var el = $(box, '#bl-list');
        if (!el) return;
        if (!list || !list.length) { el.innerHTML = '<div class="card-body">' + UI.kosong('Belum ada blast', 'Blast yang dibuat tampil di sini beserta progresnya.', 'send') + '</div>'; return; }
        el.innerHTML = '<div class="card-body" style="display:grid;gap:10px">' + list.map(function (b) {
          var jalan = b.status === 'BERJALAN';
          return '<div class="tahap" style="margin:0"><div class="tahap-h"><div class="grow" style="min-width:0">' +
            '<div class="bold truncate">' + F.esc(b.judul) + '</div><div class="tiny muted">' + F.tglJam(b.tanggal) + ' • ' + F.esc(b.sasaran || '') +
            ' • batch ' + b.ukuranBatch + ' • jeda ' + F.esc(b.jedaDetik) + ' dtk</div></div>' +
            '<span class="badge ' + (jalan ? 'badge-amber' : (b.status === 'SELESAI' ? 'badge-green' : 'badge-gray')) + '">' + F.esc(b.status) + '</span></div>' +
            '<div class="tahap-b"><div style="height:8px;border-radius:99px;background:var(--surface-2);overflow:hidden;margin-bottom:8px">' +
            '<div style="height:100%;width:' + b.persen + '%;background:var(--green-600)"></div></div>' +
            '<div class="between small"><span>Terkirim <b>' + b.terkirim + '</b> • Gagal <b>' + b.gagal + '</b> • Sisa <b>' + b.sisa + '</b> dari ' + b.total + '</span>' +
            '<span class="row-wrap" style="gap:6px">' +
            '<button class="btn btn-ghost btn-sm" data-bl-log="' + F.esc(b.id) + '">' + ik('list', 13) + '</button>' +
            (jalan ? '<button class="btn btn-soft btn-sm" data-bl-kirim="' + F.esc(b.id) + '">' + ik('send', 13) + 'Kirim batch berikutnya</button>' +
              '<button class="btn btn-danger btn-sm" data-bl-stop="' + F.esc(b.id) + '">Hentikan</button>' : '') +
            '</span></div></div></div>';
        }).join('') + '</div>';
        $$(el, '[data-bl-kirim]').forEach(function (x) { x.onclick = function () { kirimBatch(x.getAttribute('data-bl-kirim'), x); }; });
        $$(el, '[data-bl-log]').forEach(function (x) {
          x.onclick = function () { Notif.filter = { status: '', kanal: '', blastId: x.getAttribute('data-bl-log') }; bukaTab(Notif.el, 'nt-tabs', 'antrean'); };
        });
        $$(el, '[data-bl-stop]').forEach(function (x) {
          x.onclick = function () {
            UI.konfirmasi({ judul: 'Hentikan blast?', isi: 'Pesan yang belum terkirim akan dibatalkan.', tombol: 'Hentikan', bahaya: true }).then(function (ya) {
              if (!ya) return;
              UI.sibuk(x, true, '…');
              API.kirim('blastStop', { blastId: x.getAttribute('data-bl-stop') }).then(function (r) {
                UI.toast(r.message, r.success ? 'ok' : 'error');
                muatList();
              });
            });
          };
        });
      }
      function kirimBatch(id, btn) {
        if (btn) UI.sibuk(btn, true, 'Mengirim…');
        API.kirim('blastProses', { blastId: id }).then(function (r) {
          if (btn) UI.sibuk(btn, false);
          UI.toast(r.message, r.success ? 'ok' : 'error');
          muatList();
        });
      }
      $(box, '#bl-segar').onclick = function () { muatList(); };
      muatList();
    }
  };

  /* ======================================================================
     2. CRM KONTAK
     ====================================================================== */

  var Crm = {
    el: null, D: null, pilih: {}, kueri: '', segmen: '', status: '', tag: '', tampil: 100,

    render: function (el) {
      Crm.el = el;
      el.innerHTML =
        kepala('CRM Kontak', 'CRM Kontak',
          'Satu daftar Nama · Email · WhatsApp seluruh mahasiswa &amp; dosen — tersinkron otomatis dari data induk, siap untuk blast WhatsApp.',
          '<div class="row-wrap"><button class="btn btn-ghost btn-sm" id="crm-impor">' + ik('upload', 14) + 'Impor CSV</button>' +
          '<button class="btn btn-ghost btn-sm" id="crm-ekspor">' + ik('download', 14) + 'Ekspor CSV</button>' +
          '<button class="btn btn-dark btn-sm" id="crm-sync">' + ik('refresh', 14) + 'Sinkronkan</button></div>') +
        '<div id="crm-stat" class="kpi-grid mb3">' + UI.skeleton(1, 90) + '</div>' +
        '<div class="card"><div class="card-body" style="padding:12px 16px;border-bottom:1px solid var(--line)"><div class="row-wrap">' +
        '<div class="input-icon grow" style="min-width:220px">' + ik('search', 16) + '<input class="input" id="crm-cari" placeholder="Cari nama, NIM, nomor WA, email, atau tag…"></div>' +
        '<select class="select" id="crm-segmen" style="max-width:170px"><option value="">Semua segmen</option></select>' +
        '<select class="select" id="crm-status" style="max-width:190px"><option value="">Semua status</option>' +
        '<option value="TERDAFTAR">Terdaftar WA</option><option value="TIDAK">Tidak terdaftar WA</option><option value="BELUM">Belum dicek WA</option>' +
        '<option value="TANPA_WA">Tanpa nomor WA</option><option value="OPTOUT">Opt-out</option><option value="DUPLIKAT">Duplikat</option></select>' +
        '<input class="input" id="crm-tag" placeholder="Tag" style="max-width:130px"></div></div>' +
        '<div class="card-body hidden" id="crm-bulk" style="padding:10px 16px;border-bottom:1px solid var(--line);background:var(--surface-2)"></div>' +
        '<div id="crm-tabel">' + UI.skeleton(6, 40) + '</div></div>';

      $(el, '#crm-sync').onclick = function (ev) {
        var btn = ev.currentTarget;
        UI.sibuk(btn, true, 'Menyinkronkan…');
        API.kirim('crmSync', {}).then(function (r) {
          UI.sibuk(btn, false);
          UI.toast(r.message, r.success ? 'ok' : 'error');
          Crm.muat();
        });
      };
      $(el, '#crm-impor').onclick = Crm.dialogImpor;
      $(el, '#crm-ekspor').onclick = Crm.ekspor;
      $(el, '#crm-cari').addEventListener('input', S.debounce(function (e) { Crm.kueri = e.target.value; Crm.tampil = 100; Crm.gambar(); }, 220));
      $(el, '#crm-segmen').onchange = function () { Crm.segmen = this.value; Crm.tampil = 100; Crm.gambar(); };
      $(el, '#crm-status').onchange = function () { Crm.status = this.value; Crm.tampil = 100; Crm.gambar(); };
      $(el, '#crm-tag').addEventListener('input', S.debounce(function (e) { Crm.tag = e.target.value; Crm.gambar(); }, 220));
      Crm.muat();
    },

    muat: function () {
      return swr('crmList', {}, function (d) { Crm.D = d; Crm.gambarStat(); Crm.gambar(); });
    },

    gambarStat: function () {
      var s = Crm.D.stat || {};
      var kartu = [
        ['users', 'Total Kontak', s.total, 'k-orange', 'Mahasiswa ' + ((s.segmen || {}).Mahasiswa || 0) + ' • Dosen ' + ((s.segmen || {}).Dosen || 0)],
        ['phone', 'WA Valid', s.waValid, 'k-green', (s.terdaftarWA || 0) + ' terdaftar • ' + (s.belumCekWA || 0) + ' belum dicek'],
        ['mail', 'Email Valid', s.emailValid, '', (s.takTerjangkau || 0) + ' kontak tak terjangkau'],
        ['alert', 'Perlu Dirapikan', (s.duplikat || 0) + (s.optOut || 0), 'k-red', (s.duplikat || 0) + ' duplikat • ' + (s.optOut || 0) + ' opt-out']
      ];
      $(Crm.el, '#crm-stat').innerHTML = kartu.map(function (k) {
        return '<div class="kpi ' + k[3] + '"><div class="kpi-icon">' + ik(k[0], 16) + '</div><div class="kpi-label">' + k[1] + '</div>' +
          '<div class="kpi-value">' + (k[2] || 0) + '</div><div class="kpi-note">' + F.esc(k[4]) + '</div></div>';
      }).join('');
      var sel = $(Crm.el, '#crm-segmen'), seg = Object.keys(s.segmen || {}).sort();
      sel.innerHTML = '<option value="">Semua segmen</option>' + seg.map(function (x) { return '<option' + (Crm.segmen === x ? ' selected' : '') + '>' + F.esc(x) + '</option>'; }).join('');
    },

    terfilter: function () {
      var q = Crm.kueri.toLowerCase(), tag = Crm.tag.toLowerCase();
      return (Crm.D.rows || []).filter(function (k) {
        if (Crm.segmen && k.segmen !== Crm.segmen) return false;
        if (tag && String(k.tag).toLowerCase().indexOf(tag) < 0) return false;
        switch (Crm.status) {
          case 'TERDAFTAR': if (k.statusWA !== 'Terdaftar') return false; break;
          case 'TIDAK': if (k.statusWA !== 'Tidak Terdaftar') return false; break;
          case 'BELUM': if (!k.noWa || k.statusWA) return false; break;
          case 'TANPA_WA': if (k.noWa) return false; break;
          case 'OPTOUT': if (!k.optOut) return false; break;
          case 'DUPLIKAT': if (!k.duplikat) return false; break;
        }
        if (!q) return true;
        return [k.nama, k.noWa, k.email, k.tag, k.refId, (k.info || {}).NIM, (k.info || {}).Prodi].join(' ').toLowerCase().indexOf(q) >= 0;
      });
    },

    gambar: function () {
      if (!Crm.D) return;
      var rows = Crm.terfilter(), box = $(Crm.el, '#crm-tabel');
      Crm._terfilter = rows;
      if (!rows.length) { box.innerHTML = '<div class="card-body">' + UI.kosong('Tidak ada kontak', 'Ubah kata kunci atau filter.', 'users') + '</div>'; Crm.gambarBulk(); return; }
      var tampil = rows.slice(0, Crm.tampil);
      box.innerHTML = '<div class="table-wrap"><table class="tbl"><thead><tr>' +
        '<th style="width:34px"><input type="checkbox" id="crm-semua"></th><th>Nama</th><th>WhatsApp</th><th>Email</th><th>Segmen</th><th>Tag</th><th>Pesan</th><th>Terakhir Dihubungi</th></tr></thead><tbody>' +
        tampil.map(function (k) {
          var info = k.info || {};
          return '<tr data-kontak="' + F.esc(k.id) + '" style="cursor:pointer">' +
            '<td><input type="checkbox" data-pilih="' + F.esc(k.id) + '"' + (Crm.pilih[k.id] ? ' checked' : '') + '></td>' +
            '<td><div class="bold">' + F.esc(k.nama) + (k.duplikat ? ' <span class="badge badge-amber">duplikat</span>' : '') + (k.optOut ? ' <span class="badge badge-red">opt-out</span>' : '') + '</div>' +
            '<div class="tiny muted">' + F.esc(info.NIM || info.NIDN || '') + (info.Prodi ? ' • ' + F.esc(info.Prodi) : '') + (info.Status === 'Nonaktif' ? ' • Nonaktif' : '') + '</div></td>' +
            '<td class="nowrap"><span class="mono small">' + F.esc(k.noWa || '-') + '</span> ' + (k.noWa ? badgeWa(k.statusWA) : '') + '</td>' +
            '<td class="small">' + F.esc(k.email || '-') + '</td>' +
            '<td><span class="badge badge-navy">' + F.esc(k.segmen) + '</span></td>' +
            '<td class="small">' + (k.tag ? String(k.tag).split(',').map(function (t) { return '<span class="badge badge-gray">' + F.esc(t) + '</span>'; }).join(' ') : '-') + '</td>' +
            '<td class="center">' + (k.jumlahPesan || 0) + '</td>' +
            '<td class="small nowrap">' + (k.terakhirDihubungi ? F.relatif(k.terakhirDihubungi) : '-') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="card-body between small muted"><span>Menampilkan ' + tampil.length + ' dari ' + rows.length + ' kontak</span>' +
        (rows.length > tampil.length ? '<button class="btn btn-ghost btn-sm" id="crm-lagi">Muat 100 lagi</button>' : '') + '</div>';

      var semua = $(box, '#crm-semua');
      semua.checked = tampil.every(function (k) { return Crm.pilih[k.id]; });
      semua.onchange = function () { rows.forEach(function (k) { if (semua.checked) Crm.pilih[k.id] = true; else delete Crm.pilih[k.id]; }); Crm.gambar(); };
      $$(box, '[data-pilih]').forEach(function (c) {
        c.onclick = function (e) { e.stopPropagation(); };
        c.onchange = function () { if (c.checked) Crm.pilih[c.getAttribute('data-pilih')] = true; else delete Crm.pilih[c.getAttribute('data-pilih')]; Crm.gambarBulk(); };
      });
      $$(box, '[data-kontak]').forEach(function (tr) { tr.onclick = function () { Crm.detail(tr.getAttribute('data-kontak')); }; });
      var lagi = $(box, '#crm-lagi');
      if (lagi) lagi.onclick = function () { Crm.tampil += 100; Crm.gambar(); };
      Crm.gambarBulk();
    },

    terpilih: function () {
      return (Crm.D.rows || []).filter(function (k) { return Crm.pilih[k.id]; });
    },

    gambarBulk: function () {
      var box = $(Crm.el, '#crm-bulk'), sel = Crm.terpilih();
      box.classList.toggle('hidden', !sel.length);
      if (!sel.length) return;
      box.innerHTML = '<div class="row-wrap" style="align-items:center"><b class="small">' + sel.length + ' kontak dipilih</b>' +
        '<button class="btn btn-primary btn-sm" data-b="blast">' + ik('send', 13) + 'Blast WA</button>' +
        '<button class="btn btn-ghost btn-sm" data-b="cek">' + ik('phone', 13) + 'Cek WA</button>' +
        '<button class="btn btn-ghost btn-sm" data-b="tag">' + ik('plus', 13) + 'Tag</button>' +
        '<button class="btn btn-ghost btn-sm" data-b="untag">' + ik('x', 13) + 'Hapus tag</button>' +
        '<button class="btn btn-ghost btn-sm" data-b="optout">Opt-out</button>' +
        '<button class="btn btn-ghost btn-sm" data-b="optin">Opt-in</button>' +
        (sel.length >= 2 ? '<button class="btn btn-ghost btn-sm" data-b="merge">Gabungkan</button>' : '') +
        '<button class="btn btn-ghost btn-sm" data-b="hapus">' + ik('trash', 13) + 'Hapus manual</button>' +
        '<button class="btn btn-ghost btn-sm" data-b="batal">Batal pilih</button></div>';
      $$(box, '[data-b]').forEach(function (b) { b.onclick = function () { Crm.bulk(b.getAttribute('data-b'), b); }; });
    },

    bulk: function (aksi, btn) {
      var sel = Crm.terpilih(), ids = sel.map(function (k) { return k.id; });
      if (aksi === 'batal') { Crm.pilih = {}; return Crm.gambar(); }
      if (aksi === 'blast') {
        Notif.blastPenerima = sel.filter(function (k) { return k.noWa; }).map(function (k) {
          return { id: k.id, nama: k.nama, noWa: k.noWa, statusWA: k.statusWA, optOut: k.optOut, valid: true, info: k.info };
        });
        var A = S.Admin;
        A._modulSiap.notifikasi = false;
        A.kotor.notifikasi = true;
        A.pergi('notifikasi');
        return;
      }
      if (aksi === 'cek') {
        var nomor = sel.filter(function (k) { return k.noWa; }).map(function (k) { return k.noWa; });
        if (!nomor.length) return UI.toast('Kontak terpilih tidak memiliki nomor WA.', 'warn');
        UI.sibuk(btn, true, 'Mengecek…');
        return cekNomor(nomor, function (n, t) { btn.innerHTML = '<span class="spinner dark"></span> ' + n + '/' + t; }).then(function (h) {
          UI.sibuk(btn, false);
          if (!h.ok) UI.toast(h.pesan, 'warn'); else UI.toast('Status WhatsApp diperbarui.', 'ok');
          Crm.muat();
        });
      }
      if (aksi === 'merge') {
        return UI.konfirmasi({
          judul: 'Gabungkan ' + sel.length + ' kontak?',
          isi: 'Kontak utama: <b>' + F.esc(sel[0].nama) + '</b>. Tag &amp; catatan digabung; kontak lain ditandai sebagai gabungan.',
          tombol: 'Gabungkan'
        }).then(function (ya) {
          if (!ya) return;
          API.kirim('crmMerge', { utama: ids[0], gabung: ids.slice(1) }).then(function (r) {
            UI.toast(r.message, r.success ? 'ok' : 'error');
            Crm.pilih = {}; Crm.muat();
          });
        });
      }
      var nilai = '';
      var jalan = function () {
        UI.sibuk(btn, true, '…');
        API.kirim('crmBulk', { ids: ids, aksi: aksi === 'hapus' ? 'hapusManual' : aksi, nilai: nilai }).then(function (r) {
          UI.sibuk(btn, false);
          UI.toast(r.message, r.success ? 'ok' : 'error');
          Crm.pilih = {}; Crm.muat();
        });
      };
      if (aksi === 'tag' || aksi === 'untag') {
        UI.modal({
          judul: aksi === 'tag' ? 'Tambah Tag' : 'Hapus Tag', sub: sel.length + ' kontak',
          isi: '<div class="field"><label>Nama Tag</label><input class="input" id="crm-tagin" maxlength="40" placeholder="Contoh: Wisuda 2026"></div>',
          kaki: '<button class="btn btn-ghost" data-tutup>Batal</button><button class="btn btn-primary" id="crm-tagok">Terapkan</button>',
          siap: function (b) {
            $(b, '#crm-tagok').onclick = function () {
              nilai = $(b, '#crm-tagin').value.trim();
              if (!nilai) return UI.toast('Isi nama tag.', 'error');
              UI.tutupModal(); jalan();
            };
          }
        });
        return;
      }
      if (aksi === 'hapus') {
        return UI.konfirmasi({ judul: 'Hapus kontak manual?', isi: 'Hanya kontak hasil impor manual yang dihapus. Kontak dari data mahasiswa/dosen tetap ada.', tombol: 'Hapus', bahaya: true })
          .then(function (ya) { if (ya) jalan(); });
      }
      jalan();
    },

    detail: function (id) {
      UI.modal({
        judul: 'Detail Kontak', lebar: true, isi: UI.skeleton(4, 50),
        kaki: '<button class="btn btn-ghost" data-tutup>Tutup</button><button class="btn btn-primary" id="kt-simpan">' + ik('check', 15) + 'Simpan</button>',
        siap: function (box) {
          API.kirim('crmDetail', { id: id }).then(function (r) {
            var body = $(box, '#modal-body');
            if (!r.success) { body.innerHTML = UI.kosong('Gagal memuat', r.message, 'alert'); return; }
            var k = r.data.kontak, info = k.info || {}, manual = k.sumber === 'manual';
            body.innerHTML =
              '<div class="split" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">' +
              '<div>' +
              '<div class="mini-stat mb2">' + Object.keys(info).map(function (x) {
                return '<div class="ms"><div class="l">' + F.esc(x) + '</div><div class="v small">' + F.esc(info[x]) + '</div></div>';
              }).join('') + '</div>' +
              '<div class="field"><label>Nama</label><input class="input" id="kt-nama" value="' + F.esc(k.nama) + '"' + (manual ? '' : ' disabled') + '>' +
              (manual ? '' : '<div class="hint">Nama mengikuti data induk ' + F.esc(k.segmen) + '.</div>') + '</div>' +
              '<div class="field"><label>WhatsApp</label><div class="row-wrap"><input class="input mono grow" id="kt-wa" value="' + F.esc(k.noWa || '') + '">' +
              (k.noWa ? '<a class="btn btn-success" target="_blank" rel="noopener" href="https://wa.me/' + F.esc(String(k.noWa).replace(/^0/, '62')) + '">' + ik('phone', 15) + '</a>' : '') +
              '</div><div class="hint">' + badgeWa(k.statusWA) + (manual ? '' : ' Perubahan ditulis balik ke data induk.') + '</div></div>' +
              '<div class="field"><label>Email</label><input class="input" id="kt-email" type="email" value="' + F.esc(k.email || '') + '"></div>' +
              '<div class="field"><label>Tag</label><input class="input" id="kt-tag" value="' + F.esc(k.tag || '') + '" placeholder="pisahkan dengan koma"></div>' +
              '<div class="field"><label>Catatan</label><textarea class="textarea" id="kt-catatan" rows="3">' + F.esc(k.catatan || '') + '</textarea></div>' +
              '<label class="sakelar"><input type="checkbox" id="kt-optout"' + (k.optOut ? ' checked' : '') + '><span class="grow"><span class="s-t">Opt-out blast</span>' +
              '<span class="s-d">Tidak menerima blast WhatsApp (notifikasi layanan tetap dikirim).</span></span></label>' +
              '</div>' +
              '<div>' +
              '<h4 style="font-size:13.5px;margin-bottom:8px">Catat Interaksi</h4>' +
              '<div class="row-wrap mb1"><select class="select" id="kt-kanal" style="max-width:150px">' +
              ['Telepon', 'WA Manual', 'Kunjungan', 'Email Manual', 'Catatan'].map(function (x) { return '<option>' + x + '</option>'; }).join('') + '</select>' +
              '<input class="input grow" id="kt-ringkas" placeholder="Ringkasan interaksi…"><button class="btn btn-dark" id="kt-catat">' + ik('plus', 14) + '</button></div>' +
              '<h4 style="font-size:13.5px;margin:14px 0 8px">Riwayat</h4><div id="kt-timeline" style="max-height:380px;overflow:auto">' +
              (r.data.timeline.length ? r.data.timeline.map(function (t) {
                return '<div class="dok-item" style="align-items:flex-start"><span class="dok-ic">' + ik(t.jenis === 'PESAN' ? (t.kanal === 'EMAIL' ? 'mail' : 'send') : 'edit', 14) + '</span>' +
                  '<div class="grow" style="min-width:0"><div class="small">' + F.esc(t.ringkasan) + '</div>' +
                  '<div class="tiny muted">' + F.tglJam(t.waktu) + ' • ' + F.esc(t.jenis === 'PESAN' ? (t.peristiwa + ' • ' + t.status) : (t.kanal + ' • ' + (t.oleh || ''))) + '</div></div></div>';
              }).join('') : '<div class="small muted">Belum ada riwayat.</div>') + '</div>' +
              '</div></div>';
            $(box, '#kt-catat').onclick = function (ev) {
              var ring = $(box, '#kt-ringkas').value.trim();
              if (!ring) return UI.toast('Isi ringkasan interaksi.', 'error');
              var btn = ev.currentTarget;
              UI.sibuk(btn, true, '');
              API.kirim('crmInteraksi', { kontakId: id, kanal: $(box, '#kt-kanal').value, ringkasan: ring }).then(function (x) {
                UI.sibuk(btn, false);
                UI.toast(x.message, x.success ? 'ok' : 'error');
                if (x.success) Crm.detail(id);
              });
            };
            $(box, '#kt-simpan').onclick = function (ev) {
              var btn = ev.currentTarget;
              var data = {
                id: id, noWa: $(box, '#kt-wa').value.trim(), email: $(box, '#kt-email').value.trim(),
                tag: $(box, '#kt-tag').value, catatan: $(box, '#kt-catatan').value, optOut: $(box, '#kt-optout').checked
              };
              if (manual) data.nama = $(box, '#kt-nama').value.trim();
              UI.sibuk(btn, true, 'Menyimpan…');
              API.kirim('crmSimpan', data).then(function (x) {
                UI.sibuk(btn, false);
                if (!x.success) return UI.toast(x.message, 'error');
                UI.toast(x.message, 'ok');
                UI.tutupModal();
                Crm.muat();
              });
            };
          });
        }
      });
    },

    dialogImpor: function () {
      UI.modal({
        judul: 'Impor Kontak (CSV)', sub: 'Kolom: nama, wa, email, segmen, tag',
        isi: '<div class="notice mb2" style="font-size:12.5px">' + ik('info', 16) + '<span>Untuk kontak di luar data mahasiswa &amp; dosen (mis. calon mahasiswa, mitra). ' +
          'Impor ulang tidak menggandakan — kontak dengan nomor/email sama diperbarui.</span></div>' +
          '<div class="upload" id="ci-up"><input type="file" accept=".csv,text/csv"><div data-info><div class="upload-name">Pilih berkas CSV</div>' +
          '<div class="tiny muted">Pemisah koma atau titik-koma (Excel Indonesia)</div></div></div>' +
          '<div id="ci-pratinjau" class="mt2"></div>' +
          '<button class="btn btn-ghost btn-sm mt1" id="ci-template">' + ik('download', 13) + 'Unduh template</button>',
        kaki: '<button class="btn btn-ghost" data-tutup>Batal</button><button class="btn btn-primary" id="ci-ok" disabled>' + ik('upload', 15) + 'Impor</button>',
        siap: function (box) {
          var data = [];
          $(box, '#ci-template').onclick = function () {
            S.Csv.unduh('template-kontak-crm.csv', [['nama', 'wa', 'email', 'segmen', 'tag'], ['Calon Mahasiswa A', '081234567890', 'calon@contoh.com', 'Calon Mahasiswa', 'PMB 2027']]);
          };
          var up = $(box, '#ci-up'), input = $(up, 'input');
          up.onclick = function (e) { if (e.target !== input) input.click(); };
          input.onchange = function () {
            var f = input.files && input.files[0];
            if (!f) return;
            var fr = new FileReader();
            fr.onload = function () {
              var hasil = S.Csv.urai(fr.result);
              data = S.Csv.petakan(hasil.baris, {
                nama: ['nama', 'name', 'namalengkap'], wa: ['wa', 'nowa', 'whatsapp', 'hp', 'nohp', 'telepon'],
                email: ['email', 'surel'], segmen: ['segmen', 'kategori'], tag: ['tag', 'label']
              });
              $(up, '[data-info]').innerHTML = '<div class="upload-name">' + F.esc(f.name) + '</div><div class="tiny muted">' + data.length + ' baris terbaca</div>';
              $(box, '#ci-pratinjau').innerHTML = '<div class="table-wrap" style="max-height:220px;overflow:auto"><table class="tbl"><thead><tr><th>Nama</th><th>WA</th><th>Email</th><th>Segmen</th><th>Tag</th></tr></thead><tbody>' +
                data.slice(0, 20).map(function (b) { return '<tr><td>' + F.esc(b.nama) + '</td><td class="mono">' + F.esc(b.wa) + '</td><td>' + F.esc(b.email) + '</td><td>' + F.esc(b.segmen) + '</td><td>' + F.esc(b.tag) + '</td></tr>'; }).join('') +
                '</tbody></table></div>';
              $(box, '#ci-ok').disabled = !data.length;
            };
            fr.readAsText(f);
          };
          $(box, '#ci-ok').onclick = function (ev) {
            var btn = ev.currentTarget;
            UI.sibuk(btn, true, 'Mengimpor…');
            API.kirim('crmImport', { rows: data }).then(function (r) {
              UI.sibuk(btn, false);
              if (!r.success) return UI.toast(r.message, 'error');
              UI.toast(r.message, r.data.gagal.length ? 'warn' : 'ok');
              UI.tutupModal();
              Crm.muat();
            });
          };
        }
      });
    },

    ekspor: function () {
      if (!Crm.D) return;
      var rows = Crm._terfilter || Crm.D.rows || [];
      S.Csv.unduh('crm-kontak-' + new Date().toISOString().substring(0, 10) + '.csv',
        [['Nama', 'WhatsApp', 'Status WA', 'Email', 'Segmen', 'NIM/NIDN', 'Prodi', 'Tag', 'Opt-out', 'Jumlah Pesan', 'Terakhir Dihubungi']].concat(rows.map(function (k) {
          var i = k.info || {};
          return [k.nama, k.noWa, k.statusWA, k.email, k.segmen, i.NIM || i.NIDN || '', i.Prodi || '', k.tag, k.optOut ? 'YA' : '', k.jumlahPesan, k.terakhirDihubungi ? F.tglJam(k.terakhirDihubungi) : ''];
        })));
      API.kirim('crmEkspor', { jumlah: rows.length, filter: [Crm.segmen, Crm.status, Crm.kueri].filter(Boolean).join(' | ') });
      UI.toast(rows.length + ' kontak diekspor.', 'ok');
    }
  };

  /* ======================================================================
     3. MIGRASI DATA (gas-migrasi-database)
     ====================================================================== */

  var LABEL_SHEET = {
    Prodi: 'Program Studi', MasterDosen: 'Master Dosen', Users: 'Mahasiswa', AdminUsers: 'Akun Admin', AppConfig: 'Pengaturan Aplikasi',
    JenisDokumen: 'Jenis Surat & Formulir', CounterSurat: 'Penomoran Surat (v1)', TemplateSurat: 'Kop & TTD (v1)', PetaPlaceholder: 'Peta Placeholder',
    PengaturanAksesMenu: 'Akses Menu', Pengajuan: 'Riwayat Pengajuan', PenugasanPenguji: 'Penguji & Jadwal', AdministrasiKelulusan: 'Administrasi Kelulusan',
    DokumenTerbit: 'Arsip Dokumen Terbit', DosenMagang: 'Dosen Pembimbing Magang', CRM_Kontak: 'CRM Kontak', LogAktivitas: 'Log Aktivitas'
  };

  var Migrasi = {
    render: function (el) {
      el.innerHTML =
        kepala('Migrasi Data', 'Migrasi Data dari App Lama',
          'Pindahkan data dari spreadsheet SIAKAD Surat versi lama. App lama hanya DIBACA, aman diulang (tanpa data ganda), dan bisa dipindai dulu tanpa menulis.') +
        '<div class="split">' +
        '<div class="card"><div class="card-head"><div><h3>Sumber Data</h3><div class="sub">Spreadsheet milik akun Google yang sama dengan app ini</div></div></div>' +
        '<div class="card-body">' +
        '<div class="field"><label>URL atau ID Spreadsheet App Lama <span class="req">*</span></label>' +
        '<input class="input mono" id="mg-src" placeholder="https://docs.google.com/spreadsheets/d/…"></div>' +
        '<div class="field"><label>Data yang Diimpor</label><div class="checkgrid" id="mg-sheets">' + UI.skeleton(3, 30) + '</div></div>' +
        '<label class="sakelar"><input type="checkbox" id="mg-timpa"><span class="grow"><span class="s-t">Timpa data yang sudah ada</span>' +
        '<span class="s-d">Bawaan mati: data yang sudah diubah di app ini tidak ditimpa. Keputusan approval di app ini tidak pernah ditimpa.</span></span></label>' +
        '<div class="row-wrap mt2"><button class="btn btn-ghost grow" id="mg-pindai">' + ik('search', 15) + 'Pindai (Dry-run)</button>' +
        '<button class="btn btn-primary grow" id="mg-jalan">' + ik('upload', 15) + 'Jalankan Import</button></div>' +
        '</div></div>' +
        '<div><div class="card mb3"><div class="card-head"><div><h3>Hasil</h3><div class="sub" id="mg-sub">Belum dijalankan</div></div></div>' +
        '<div id="mg-hasil" class="card-body">' + UI.kosong('Belum ada hasil', 'Tekan Pindai untuk melihat perkiraan tanpa menulis apa pun.', 'search') + '</div></div>' +
        '<div class="card"><div class="card-head"><div><h3>Langkah Cutover</h3></div></div><div class="card-body small" style="line-height:1.7">' +
        '<ol style="padding-left:18px;margin:0">' +
        '<li>Tempel URL spreadsheet app lama → <b>Pindai</b> → periksa angka.</li>' +
        '<li><b>Jalankan Import</b>, lalu cek Data Mahasiswa, Jenis Dokumen, dan riwayat pengajuan.</li>' +
        '<li>Uji login dengan satu akun mahasiswa.</li>' +
        '<li>Tepat sebelum pindah, <b>Jalankan Import sekali lagi</b> untuk menangkap data baru (delta).</li>' +
        '<li>Umumkan alamat baru (blast WA), lalu arsipkan deployment lama.</li></ol>' +
        '<div class="notice mt2" style="font-size:12.5px">' + ik('info', 16) + '<span>Sesi login lama tidak ikut pindah — pengguna cukup masuk ulang. ' +
        'Berkas PDF lama tetap bisa dibuka karena ID Drive disalin apa adanya (akun Google yang sama).</span></div></div></div></div>' +
        '</div>';

      API.kirim('imporDaftar', {}).then(function (r) {
        var box = $(el, '#mg-sheets');
        if (!r.success) { box.innerHTML = '<div class="small">' + F.esc(r.message) + '</div>'; return; }
        box.innerHTML = r.data.urutan.map(function (n) {
          return '<label class="checkrow"><input type="checkbox" data-sh="' + n + '"' + (r.data.bawaan.indexOf(n) >= 0 ? ' checked' : '') + '>' +
            '<div class="grow"><div class="bold small">' + F.esc(LABEL_SHEET[n] || n) + '</div><div class="tiny muted mono">' + n + '</div></div></label>';
        }).join('');
      });

      function jalan(kering, btn) {
        var src = $(el, '#mg-src').value.trim();
        if (!src) return UI.toast('Tempel URL atau ID spreadsheet app lama.', 'error');
        var sheets = $$(el, '[data-sh]').filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute('data-sh'); });
        if (!sheets.length) return UI.toast('Pilih minimal satu data.', 'error');
        UI.sibuk(btn, true, kering ? 'Memindai…' : 'Mengimpor…');
        API.kirim(kering ? 'imporPindai' : 'imporJalankan', { sumber: src, sheets: sheets, timpa: $(el, '#mg-timpa').checked }).then(function (r) {
          UI.sibuk(btn, false);
          if (!r.success) return UI.toast(r.message, 'error');
          UI.toast(r.message, 'ok');
          var d = r.data, lap = d.laporan || {};
          $(el, '#mg-sub').innerHTML = (d.dryRun ? '<span class="badge badge-amber">Pindai</span> ' : '<span class="badge badge-green">Selesai</span> ') + F.esc(d.sumber.nama);
          $(el, '#mg-hasil').innerHTML = '<div class="table-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Di app lama</th><th>Ditambah</th><th>Diperbarui</th><th>Dilewati</th></tr></thead><tbody>' +
            Object.keys(lap).map(function (k) {
              var x = lap[k];
              return '<tr><td><div class="bold small">' + F.esc(LABEL_SHEET[k] || k) + '</div>' + (x.catatan ? '<div class="tiny muted">' + F.esc(x.catatan) + '</div>' : '') + '</td>' +
                '<td>' + (x.sumber || 0) + '</td><td class="bold" style="color:var(--green-600)">' + (x.ditambah || 0) + '</td><td>' + (x.diperbarui || 0) + '</td><td class="muted">' + (x.dilewati || 0) + '</td></tr>';
            }).join('') + '</tbody></table></div>' +
            ((d.peringatan || []).length ? '<div class="notice warn mt2" style="font-size:12.5px">' + ik('alert', 16) + '<span><b>Peringatan:</b><br>' +
              d.peringatan.map(F.esc).join('<br>') + '</span></div>' : '') +
            (!d.dryRun ? '<div class="notice ok mt2" style="font-size:12.5px">' + ik('checkCircle', 16) + '<span>Data tersalin. Panel dimuat ulang agar data baru tampil.</span></div>' : '');
          if (!d.dryRun && S.Admin) S.Admin.muat();
        });
      }
      $(el, '#mg-pindai').onclick = function (ev) { jalan(true, ev.currentTarget); };
      $(el, '#mg-jalan').onclick = function (ev) {
        var btn = ev.currentTarget;
        UI.konfirmasi({
          judul: 'Jalankan Import?', tombol: 'Ya, Import',
          isi: 'Data dari app lama disalin ke app ini. Aman diulang: data yang sudah ada tidak digandakan.'
        }).then(function (ya) { if (ya) jalan(false, btn); });
      };
    }
  };

  S.AdminModul = Mod;
})(window.SIAKAD);
