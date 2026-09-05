/* ============================================================================
   KLASEMEN

   Dua tabel, dua urutan pembeda, dipindahkan apa adanya dari v5.0.

   Fix Partner : poin liga -> poin cetak -> selisih -> pertemuan langsung
   Individu    : tiga varian, tergantung mode
       Mexicano     : poin cetak -> yang lebih SEDIKIT main diangkat -> selisih
       "wins"       : poin liga -> poin cetak -> selisih
       "points"     : poin cetak -> jumlah menang -> selisih

   Semua urutan diakhiri nomor pendaftaran supaya dua perangkat tidak mungkin
   menghasilkan urutan berbeda dari data yang sama - itu penting karena
   klasemen ikut dikirim lewat sinkronisasi.
   ========================================================================== */

import { DRAW_PTS, LOSE_PTS, WIN_PTS } from "@/shared/config";
import type {
  FlatMatch,
  FlatSoloMatch,
  Score,
  SoloRank,
  SoloRow,
  TableRow,
} from "@/shared/types";
import { isDone } from "@/entities/match";

/* --------------------------------------------------------- Fix Partner ---- */

export function computeTable(
  n: number,
  names: readonly string[],
  matches: readonly FlatMatch[],
  scores: readonly Score[],
): TableRow[] {
  const t: TableRow[] = [];
  for (let i = 1; i <= n; i++) {
    t.push({
      id: i,
      name: names[i - 1] ?? "Tim " + i,
      p: 0,
      w: 0,
      l: 0,
      d: 0,
      lp: 0,
      tp: 0,
      pk: 0,
      sp: 0,
      h2h: {},
    });
  }
  matches.forEach((m, idx) => {
    const s = scores[idx];
    if (!isDone(s)) return;
    const a = s![0] as number;
    const b = s![1] as number;
    const A = t[m.a - 1];
    const B = t[m.b - 1];
    if (!A || !B) return;
    A.p++;
    B.p++;
    A.tp += a;
    A.pk += b;
    B.tp += b;
    B.pk += a;
    if (a > b) {
      A.w++;
      B.l++;
      A.lp += WIN_PTS;
      B.lp += LOSE_PTS;
    } else if (b > a) {
      B.w++;
      A.l++;
      B.lp += WIN_PTS;
      A.lp += LOSE_PTS;
    } else {
      A.d++;
      B.d++;
      A.lp += DRAW_PTS;
      B.lp += DRAW_PTS;
    }
    A.h2h[B.id] = a - b;
    B.h2h[A.id] = b - a;
  });
  for (const x of t) x.sp = x.tp - x.pk;
  t.sort((a, b) => {
    if (b.lp !== a.lp) return b.lp - a.lp;
    if (b.tp !== a.tp) return b.tp - a.tp;
    if (b.sp !== a.sp) return b.sp - a.sp;
    const h = a.h2h[b.id];
    if (typeof h === "number" && h !== 0) return -h;
    return a.id - b.id;
  });
  return t;
}

/* ------------------------------------------------------------ Individu ---- */

export interface SoloTableOpts {
  np: number;
  pnames: readonly string[];
  matches: readonly FlatSoloMatch[];
  scores: readonly Score[];
  mexOn: boolean;
  soloRank: SoloRank;
}

export function soloTable(o: SoloTableOpts): SoloRow[] {
  const t: SoloRow[] = [];
  for (let i = 1; i <= o.np; i++) {
    t.push({
      id: i,
      name: o.pnames[i - 1] ?? "Pemain " + i,
      p: 0,
      w: 0,
      l: 0,
      d: 0,
      tp: 0,
      pk: 0,
      sp: 0,
      lp: 0,
      avg: 0,
    });
  }
  o.matches.forEach((m, idx) => {
    const s = o.scores[idx];
    if (!isDone(s)) return;
    const sides = [
      { team: m.t1, own: s![0] as number, foe: s![1] as number },
      { team: m.t2, own: s![1] as number, foe: s![0] as number },
    ];
    for (const sd of sides) {
      for (const pid of sd.team) {
        const x = t[pid - 1];
        if (!x) continue;
        x.p++;
        x.tp += sd.own;
        x.pk += sd.foe;
        if (sd.own > sd.foe) x.w++;
        else if (sd.own < sd.foe) x.l++;
        else x.d++;
      }
    }
  });
  for (const x of t) {
    x.sp = x.tp - x.pk;
    x.lp = x.w * WIN_PTS;
    x.avg = x.p ? Math.round((x.tp / x.p) * 10) / 10 : 0;
  }

  if (o.mexOn) {
    /* Urutan Mexicano. Yang lebih SEDIKIT mainnya diangkat: kalau tidak, orang
       yang baru main 2 kali selalu kalah peringkat dari yang sudah main 4 kali
       semata karena punya lebih banyak kesempatan mengumpulkan poin. Urutan
       ini juga yang dipakai menyusun ronde berikutnya, jadi klasemen yang
       dilihat pengguna memang dasar penyusunannya. */
    t.sort((a, b) => {
      if (b.tp !== a.tp) return b.tp - a.tp;
      if (a.p !== b.p) return a.p - b.p;
      if (b.sp !== a.sp) return b.sp - a.sp;
      return a.id - b.id;
    });
  } else if (o.soloRank === "wins") {
    t.sort((a, b) => {
      if (b.lp !== a.lp) return b.lp - a.lp;
      if (b.tp !== a.tp) return b.tp - a.tp;
      if (b.sp !== a.sp) return b.sp - a.sp;
      return a.id - b.id;
    });
  } else {
    t.sort((a, b) => {
      if (b.tp !== a.tp) return b.tp - a.tp;
      if (b.w !== a.w) return b.w - a.w;
      if (b.sp !== a.sp) return b.sp - a.sp;
      return a.id - b.id;
    });
  }
  return t;
}
