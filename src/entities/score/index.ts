/* ============================================================================
   SISTEM SKOR

   Dua sistem, keduanya bermuara ke TARGET yang sama sehingga papan skor,
   validPair(), dan penyimpanan skor tidak perlu tahu bedanya:

     poin  : TARGET = 16/21/32, mode "sum" atau "first" seperti biasa
     tenis : TARGET = 3/4/5/6 GAME, mode selalu "first"

   Di sistem tenis, angka yang TERSIMPAN di bagan adalah jumlah game; hitungan
   15/30/40 hanya hidup di dalam papan skor.
   ========================================================================== */

import { DRAW_PTS, LOSE_PTS, TN_LBL, WIN_PTS } from "@/shared/config";
import type { Rules, ScoreMode, ScoreSys } from "@/shared/types";

export interface ScoreSetup {
  scoreSys: ScoreSys;
  /** target poin kalau sistemnya poin */
  ptTarget: number;
  /** target game kalau sistemnya tenis */
  gmTarget: number;
  /** true = deuce/advantage, false = golden point (lazim di padel sosial) */
  mexDeuce: boolean;
  /** mode skor pilihan pengguna, hanya berlaku di sistem poin */
  mode: ScoreMode;
}

/** Aturan efektif yang dipakai seluruh aplikasi. */
export function rulesOf(s: ScoreSetup): Rules {
  if (s.scoreSys === "tennis") {
    return {
      target: s.gmTarget,
      mode: "first",
      winPts: WIN_PTS,
      drawPts: DRAW_PTS,
      losePts: LOSE_PTS,
    };
  }
  return {
    target: s.ptTarget,
    mode: s.mode,
    winPts: WIN_PTS,
    drawPts: DRAW_PTS,
    losePts: LOSE_PTS,
  };
}

/* ============================================================================
   PAPAN SKOR TENIS 15 · 30 · 40

   Riwayat reli (siapa memenangkan reli ke-berapa) dijadikan SATU-SATUNYA
   sumber kebenaran: jumlah game dan angka di dalam game selalu dihitung ulang
   dari nol setiap kali ada perubahan. Undo jadi sepele dan selalu benar -
   termasuk membatalkan reli yang tadinya menutup sebuah game, yang kalau
   dihitung secara bertahap gampang salah.
   ========================================================================== */

export interface TennisState {
  /** jumlah game tiap sisi */
  gm: [number, number];
  /** angka di dalam game berjalan, 0..4 */
  pt: [number, number];
  /** sisi yang sedang unggul advantage, -1 kalau tidak ada */
  adv: number;
}

/** Sisi mana yang menang reli ke-i. 0 atau 1. */
export type RallyHist = readonly number[];

export function tennisReplay(
  hist: RallyHist,
  target: number,
  deuce: boolean,
): TennisState {
  const gm: [number, number] = [0, 0];
  let pt: [number, number] = [0, 0];
  let adv = -1;
  for (let i = 0; i < hist.length; i++) {
    if (gm[0] >= target || gm[1] >= target) break; /* pertandingan sudah usai */
    const w = hist[i] === 1 ? 1 : 0;
    const l = 1 - w;
    if (!deuce) {
      /* golden point: 40-40 diputus satu reli */
      if (pt[0] >= 3 && pt[1] >= 3) {
        gm[w]++;
        pt = [0, 0];
        continue;
      }
      pt[w]++;
      if (pt[w] >= 4 && pt[w] - pt[l] >= 1 && !(pt[0] >= 3 && pt[1] >= 3)) {
        gm[w]++;
        pt = [0, 0];
      }
      continue;
    }
    /* deuce / advantage */
    if (pt[0] >= 3 && pt[1] >= 3) {
      if (adv === w) {
        gm[w]++;
        pt = [0, 0];
        adv = -1;
      } else if (adv === l) {
        adv = -1; /* kembali ke deuce */
      } else {
        adv = w;
      }
      continue;
    }
    pt[w]++;
    if (pt[w] >= 4) {
      gm[w]++;
      pt = [0, 0];
      adv = -1;
    }
  }
  return { gm, pt, adv };
}

/** Label angka di dalam game, untuk ditampilkan di bawah jumlah game. */
export function tennisLabel(
  st: TennisState,
  side: number,
  target: number,
  deuce: boolean,
  goldenWord: string,
  advWord: string,
): string {
  const o = 1 - side;
  if (st.gm[0] >= target || st.gm[1] >= target) return "";
  if (st.pt[0] >= 3 && st.pt[1] >= 3) {
    if (!deuce) return goldenWord; /* golden point */
    if (st.adv === side) return advWord;
    if (st.adv === o) return "40";
    return "40";
  }
  return TN_LBL[Math.min(3, st.pt[side]!)] || "0";
}

/** Sedang di 40-40. */
export function tennisAtDeuce(st: TennisState): boolean {
  return st.pt[0] >= 3 && st.pt[1] >= 3;
}
