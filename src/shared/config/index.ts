/* ============================================================================
   Tetapan aplikasi. Angka-angka di sini disalin apa adanya dari versi vanilla
   v5.0 - mengubahnya akan mengubah bagan yang sudah dibagikan orang, jadi
   diperlakukan sebagai kontrak.
   ========================================================================== */

export const APP_VER = "5.0";

/** Versi kode bagan. Dinaikkan hanya kalau susunan bidangnya berubah. */
export const CODE_VER = "v9";

/* --- batas peserta --- */
export const MIN_T = 3;
export const MAX_T = 12;
export const MIN_P = 4;
export const MAX_P = 24;
export const MAX_C = 4;

/** Mexicano butuh minimal dua lapangan penuh supaya ada yang bisa ditukar. */
export const MEX_MIN = 8;

/* --- poin liga --- */
export const WIN_PTS = 10;
export const DRAW_PTS = 5;
export const LOSE_PTS = 0;

/* --- pilihan sistem skor --- */
export const PT_OPTS = [16, 21, 32] as const;
export const GM_OPTS = [3, 4, 5, 6] as const;

/** Label angka di dalam satu game, sistem tenis. */
export const TN_LBL = ["0", "15", "30", "40"] as const;

/* --- bawaan acara --- */
export const DEF_TITLE = "Turnamen Padel Kemerdekaan";
export const DEF_DATE = "17 Agustus 2026";
export const DEF_COURTS = 2;
export const DEF_SLOT_MIN = 15;
export const DEF_START_MIN = 8 * 60;
export const DEF_TEAMS = 6;
export const DEF_PLAYERS = 8;
export const DEF_ROUNDS = 7;

/* --- batas kode bagan yang dikirim ke ruang --- */
export const MAX_CODE = 3e5;

/* --- kunci penyimpanan lokal. Nama kuncinya dipertahankan supaya data orang
       yang sudah memakai versi vanilla tetap terbaca setelah pindah. --- */
export const KEY = {
  tournaments: "mnpadel.turnamen",
  /* Turnamen yang terakhir dibuka. Tanpa ini, memuat ulang halaman di
     tengah acara akan membuang bagan yang sedang dipakai - dan di pinggir
     lapangan halaman memang sering ter-muat ulang sendiri. */
  current: "mnpadel.turnamen.cur",
  db: "mnpadel.bagan",
  auto: "mnpadel.auto",
  draft: "mnpadel.draft",
  sync: "mnpadel.sync",
  lang: "mnpadel.lang",
  theme: "mnpadel.theme",
  gate: "mnpadel.gate",
} as const;

/* --- papan skor berjalan --- */
/** Jeda minimum antar kiriman live, per perangkat. */
export const LIVE_THROTTLE = 3000;
/** Entri live yang lebih tua dari ini dianggap basi dan tidak ditampilkan. */
export const LIVE_STALE = 360000;

/** Judul babak knockout. Indeks: 0 SF1, 1 SF2, 2 juara 3, 3 final. */
export const KO_KEYS = ["koSf1", "koSf2", "koThird", "koFinal"] as const;
