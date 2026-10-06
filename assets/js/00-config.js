/* ==========================================================================
   SIAKAD SURAT — STIS AL WAFA
   00 — KONFIGURASI FRONTEND
   --------------------------------------------------------------------------
   ⚠️  SATU-SATUNYA BARIS YANG WAJIB ANDA UBAH ADA DI BAWAH INI.
   Tempel URL Web App Google Apps Script Anda (yang berakhiran /exec).

   Cara mendapatkannya:
     Apps Script → Deploy → New deployment → Web app
     Execute as       : Me
     Who has access   : Anyone
     → Salin URL yang muncul, lalu tempel menggantikan teks GANTI_DENGAN_URL_EXEC.
   ========================================================================== */

window.APP_CONFIG = {

  GAS_URL: 'https://script.google.com/macros/s/AKfycbzYG5ZhNbeusuBq0w9690H8o_uD5ZoFa8bReHcyu9_WZ8dbbsAnVfTrrH9Kei0uiKiC/exec',

  /* --- Pengaturan lanjutan (boleh dibiarkan apa adanya) ------------------ */
  NAMA_APP: 'SIAKAD Surat',
  NAMA_INSTITUSI: 'STIS Al Wafa',
  VERSI: '1.0.0',

  // Umur cache lokal (ms). Data lama tetap ditampilkan seketika,
  // lalu diperbarui di latar belakang (stale-while-revalidate).
  CACHE_MS: 5 * 60 * 1000,

  // Batas ukuran unggahan di sisi frontend (MB).
  MAKS_UNGGAH_MB: 5,

  // Waktu tunggu maksimum permintaan jaringan (ms).
  TIMEOUT_MS: 45000
};
