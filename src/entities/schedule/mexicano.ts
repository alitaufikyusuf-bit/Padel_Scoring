/* ============================================================================
   MEXICANO

   Bedanya dengan Americano cuma satu: ronde berikutnya TIDAK bisa disusun di
   muka, karena susunannya ditentukan klasemen saat itu juga.

   Inti versi 4.1 ada di mexBlocks: tiap LAPANGAN mendapat satu blok berisi
   empat peringkat BERURUTAN, dan blok-blok itu tidak harus bersambung satu
   sama lain. Bloknya dipilih dengan pemrograman dinamis untuk meminimalkan
   total porsi main.

   Dua pendekatan yang dibuang, ditulis di sini supaya tidak dicoba lagi:

   1. Memilih pemain satu per satu menurut porsi main terkecil. Terdengar adil,
      tapi merusak inti Mexicano: ketika banyak orang punya porsi main sama,
      serinya dipecah menurut peringkat dari atas - sehingga peringkat 1 dan 2
      ikut tertarik masuk menemani peringkat 8 dan 9 di satu lapangan. Justru
      laga paling timpang.
   2. Satu jendela berurutan sepanjang semua slot. Tiap lapangan jadi se-tier,
      tapi yang istirahat selalu terambil dari kedua ujung klasemen, sehingga
      pemain papan tengah nyaris tidak pernah istirahat dan selisih porsi main
      melebar sampai 3-4 laga.

   Diuji pada 9, 12, 16, 20, dan 24 pemain: rentang peringkat tiap lapangan
   selalu tepat 3, dan selisih porsi main tinggal 1-2 laga.
   ========================================================================== */

import type { SoloMatch, SoloRound, SoloRow } from "@/shared/types";

export function mexCourts(np: number, courts: number): number {
  return Math.max(1, Math.min(courts, Math.floor(np / 4)));
}

/** Jumlah kursi yang harus terisi satu ronde. */
export function mexSlots(np: number, courts: number): number {
  return mexCourts(np, courts) * 4;
}

/** Porsi main tiap orang di satu susunan ronde. Indeks 1-based. */
export function soloGamesOf(rnds: readonly SoloRound[], np: number): number[] {
  const g: number[] = [];
  for (let i = 0; i <= np; i++) g.push(0);
  for (const ms of rnds) {
    for (const m of ms) {
      for (const x of [m[0][0], m[0][1], m[1][0], m[1][1]]) {
        if (g[x] !== undefined) g[x]++;
      }
    }
  }
  return g;
}

export interface Spread {
  min: number;
  max: number;
  gap: number;
}

/* skip = orang yang tidak ikut dihitung, mis. yang memang tidak hadir. Porsi
   mainnya rendah karena dia tidak ada, bukan karena jadwalnya timpang -
   memasukkannya ke hitungan membuat jadwal yang sudah paling rata terlihat
   seperti gagal. */
export function soloSpreadOf(
  g: readonly number[],
  np: number,
  skip?: Record<number, boolean>,
): Spread {
  let mn = Infinity;
  let mx = -Infinity;
  for (let i = 1; i <= np; i++) {
    if (skip && skip[i]) continue;
    const v = g[i] ?? 0;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  if (mn === Infinity) {
    mn = 0;
    mx = 0;
  }
  return { min: mn, max: mx, gap: mx - mn };
}

/** Siapa saja yang ikut main di ronde ke-r. */
export function soloInRound(rnds: readonly SoloRound[], r: number): Record<number, 1> {
  const set: Record<number, 1> = {};
  const ms = rnds[r] || [];
  for (const m of ms) {
    for (const x of [m[0][0], m[0][1], m[1][0], m[1][1]]) set[x] = 1;
  }
  return set;
}

export interface MexBlocksArgs {
  /** klasemen terkini, sudah dalam urutan Mexicano */
  order: readonly SoloRow[];
  /** ronde yang sudah jalan, untuk menghitung porsi main */
  rnds: readonly SoloRound[];
  np: number;
  courts: number;
  /** pemain yang sedang tidak hadir */
  out: Record<number, boolean>;
}

/**
 * Blok per lapangan: masing-masing empat peringkat berurutan dari klasemen,
 * dipilih agar total porsi main paling kecil. Null kalau pemain hadir tidak
 * cukup untuk mengisi seluruh lapangan.
 */
export function mexBlocks(a: MexBlocksArgs): SoloRow[][] | null {
  const need = mexSlots(a.np, a.courts);
  const k = need / 4;
  const g = soloGamesOf(a.rnds, a.np);
  const pool = a.order.filter((x) => !a.out[x.id]);
  if (pool.length < need) return null;

  const n = pool.length;
  const INF = 1e9;
  const cost: number[] = [];
  for (let i = 0; i + 4 <= n; i++) {
    let c = 0;
    for (let q = i; q < i + 4; q++) c += g[pool[q]!.id] || 0;
    cost[i] = c;
  }

  /* dp[i][j] = biaya terkecil memilih j blok dari pool mulai indeks i */
  const dp: number[][] = [];
  const ch: (string | null)[][] = [];
  for (let i = 0; i <= n; i++) {
    const dr: number[] = [];
    const cr: (string | null)[] = [];
    for (let j = 0; j <= k; j++) {
      dr.push(j === 0 ? 0 : INF);
      cr.push(null);
    }
    dp.push(dr);
    ch.push(cr);
  }
  for (let i = n - 1; i >= 0; i--) {
    for (let j = 1; j <= k; j++) {
      let best = INF;
      let pick: string | null = null;
      if (dp[i + 1]![j]! < best) {
        best = dp[i + 1]![j]!;
        pick = "lewat";
      }
      if (i + 4 <= n && cost[i]! + dp[i + 4]![j - 1]! < best) {
        best = cost[i]! + dp[i + 4]![j - 1]!;
        pick = "ambil";
      }
      dp[i]![j] = best;
      ch[i]![j] = pick;
    }
  }
  if (dp[0]![k]! >= INF) return null;

  const out: SoloRow[][] = [];
  let ii = 0;
  let jj = k;
  while (jj > 0 && ii < n) {
    if (ch[ii]![jj] === "ambil") {
      out.push(pool.slice(ii, ii + 4));
      ii += 4;
      jj--;
    } else ii++;
  }
  return out.length === k ? out : null;
}

/** Daftar rata semua yang terpilih main, urut peringkat. */
export function mexPick(a: MexBlocksArgs): SoloRow[] | null {
  const b = mexBlocks(a);
  if (!b) return null;
  let out: SoloRow[] = [];
  for (const q of b) out = out.concat(q);
  return out;
}

/* Pasangan Mexicano baku: dari empat orang di satu lapangan, yang terkuat
   digandeng yang terlemah melawan dua peringkat tengah - 1+4 lawan 2+3.
   Kekuatan kedua tim jadi setara, dan itu memang inti formatnya. Kalau
   dipasang 1+3 lawan 2+4, tim pertama selalu lebih kuat secara konstruksi,
   peringkat 1 menang terus, dan poinnya kabur meninggalkan yang lain. */
export function mexPairUp(quart: readonly { id: number }[]): SoloMatch {
  return [
    [quart[0]!.id, quart[3]!.id],
    [quart[1]!.id, quart[2]!.id],
  ];
}

/** Ronde berikutnya, disusun dari klasemen terkini. */
export function mexBuildRound(a: MexBlocksArgs): SoloRound | null {
  const blok = mexBlocks(a);
  if (!blok) return null;
  return blok.map((q) => mexPairUp(q));
}

/* Ronde 1 belum punya klasemen, jadi urutannya memakai nomor pendaftaran -
   hasilnya bisa ditebak dan bisa disetel sendiri oleh penyelenggara lewat
   urutan nama. Tombol Acak menyusun ulang ronde 1 secara acak. */
export function mexRound1(
  np: number,
  courts: number,
  out: Record<number, boolean>,
  acak: boolean,
): SoloRound | null {
  const ids: number[] = [];
  for (let i = 1; i <= np; i++) if (!out[i]) ids.push(i);
  const need = mexSlots(np, courts);
  if (ids.length < need) return null;
  if (acak) {
    for (let k = ids.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      const t = ids[k]!;
      ids[k] = ids[j]!;
      ids[j] = t;
    }
  }
  const sel = ids.slice(0, need).map((id) => ({ id }));
  const ms: SoloRound = [];
  for (let q = 0; q + 3 < sel.length; q += 4) ms.push(mexPairUp(sel.slice(q, q + 4)));
  return ms;
}

/** Siapa yang istirahat di ronde yang baru dibuat. */
export function mexResting(
  ms: SoloRound,
  np: number,
  pnames: readonly string[],
  out: Record<number, boolean>,
): string[] {
  const duduk: string[] = [];
  for (let i = 1; i <= np; i++) {
    if (out[i]) continue;
    let main = false;
    for (const m of ms) {
      if ([m[0][0], m[0][1], m[1][0], m[1][1]].indexOf(i) >= 0) main = true;
    }
    if (!main) duduk.push(pnames[i - 1] ?? "Pemain " + i);
  }
  return duduk;
}
