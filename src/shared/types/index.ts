/* ============================================================================
   Tipe domain bersama.

   Angka pemain dan tim di seluruh aplikasi ini 1-based - itu bawaan dari versi
   vanilla dan sengaja tidak diubah, karena kode bagan yang tersimpan di
   perangkat orang menyimpan angka itu apa adanya. Mengubahnya ke 0-based
   berarti seluruh kode bagan yang sudah ada jadi salah baca.
   ========================================================================== */

/** Nomor tim atau pemain, 1-based. */
export type Id = number;

/** Pasangan dua tim yang bertemu di satu lapangan (format Fix Partner). */
export type PairMatch = [Id, Id];

/** Satu slot waktu, berisi satu pertandingan per lapangan. */
export type PairSlot = PairMatch[];

/** Pertandingan Fix Partner yang sudah dipipihkan. */
export interface FlatMatch {
  /** indeks slot */
  s: number;
  /** indeks lapangan di dalam slot */
  c: number;
  a: Id;
  b: Id;
}

/** Dua orang yang jadi satu tim di mode Individu. */
export type SoloTeam = [Id, Id];

/** Satu pertandingan Individu: dua tim berisi dua orang. */
export type SoloMatch = [SoloTeam, SoloTeam];

/** Satu ronde Individu, berisi satu pertandingan per lapangan. */
export type SoloRound = SoloMatch[];

/** Pertandingan Individu yang sudah dipipihkan. */
export interface FlatSoloMatch {
  /** indeks ronde */
  r: number;
  /** indeks lapangan di dalam ronde */
  c: number;
  t1: SoloTeam;
  t2: SoloTeam;
}

/** Skor satu pertandingan. null berarti belum diisi. */
export type Score = [number | null, number | null];

/** Skor yang sudah pasti terisi dua-duanya. */
export type DoneScore = [number, number];

/** Format turnamen. Mexicano adalah varian "solo" dengan penanda mexOn. */
export type Fmt = "pair" | "solo";

/** Cara satu pertandingan dinyatakan selesai. */
export type ScoreMode = "sum" | "first";

/** Sistem penilaian. */
export type ScoreSys = "points" | "tennis";

/** Cara bagan disusun. */
export type SchedKind = "standard" | "random";

/** Peringkat individu: total poin cetak, atau poin liga dari kemenangan. */
export type SoloRank = "points" | "wins";

/** Peran perangkat terhadap satu turnamen. */
export type Role = "off" | "scorer" | "viewer";

/** Bahasa antarmuka. */
export type Lang = "id" | "en";

/** Pilihan tema. */
export type Theme = "auto" | "light" | "dark";

/** Jenis bagan yang sedang dicatat di papan skor. */
export type MatchKind = "match" | "solo" | "ko";

/** Satu baris klasemen Fix Partner. */
export interface TableRow {
  id: Id;
  name: string;
  /** jumlah pertandingan dimainkan */
  p: number;
  w: number;
  l: number;
  d: number;
  /** poin liga */
  lp: number;
  /** total poin dicetak */
  tp: number;
  /** total poin kebobolan */
  pk: number;
  /** selisih poin */
  sp: number;
  /** hasil pertemuan langsung: id lawan -> selisih */
  h2h: Record<number, number>;
}

/** Satu baris klasemen Individu. */
export interface SoloRow {
  id: Id;
  name: string;
  p: number;
  w: number;
  l: number;
  d: number;
  tp: number;
  pk: number;
  sp: number;
  lp: number;
  /** rata-rata poin per pertandingan */
  avg: number;
}

/** Aturan penilaian yang aktif, diturunkan dari sistem skor terpilih. */
export interface Rules {
  target: number;
  mode: ScoreMode;
  winPts: number;
  drawPts: number;
  losePts: number;
}
