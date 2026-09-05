"use client";

/* ============================================================================
   PAPAN SKOR

   Riwayat reli (hist) adalah SATU-SATUNYA sumber kebenaran di sistem tenis:
   jumlah game selalu dihitung ulang dari nol setiap ada perubahan. Undo jadi
   sepele dan selalu benar - termasuk membatalkan reli yang tadinya menutup
   sebuah game, yang kalau dihitung bertahap gampang salah.

   Di sistem poin, val yang jadi sumbernya dan riwayat hanya dipakai undo.

   Catatan sementara (draft) disimpan di perangkat, dipatok ke jenis + indeks
   pertandingan. Gunanya: papan skor boleh ditutup di tengah laga lalu
   dilanjutkan, dan kartu lapangan menampilkan tanda ⏱ supaya tidak ada
   hitungan yang terlupa.
   ========================================================================== */

import { create } from "zustand";

import { KEY } from "@/shared/config";
import { lsJson, lsSet } from "@/shared/lib";
import type { MatchKind, Score, ScoreMode } from "@/shared/types";
import { tennisReplay, type TennisState } from "@/entities/score";

export interface Draft {
  /** jumlah game (sistem tenis) atau poin (sistem poin) tiap sisi */
  v: [number, number];
  /** riwayat reli, dipangkas 60 terakhir supaya penyimpanan tidak membengkak */
  h: number[];
}

/** Aturan yang perlu diketahui papan skor. Selalu dikirim dari pemanggil,
    tidak disalin ke store - supaya tidak ada dua sumber kebenaran. */
export interface SbRules {
  target: number;
  mode: ScoreMode;
  tennis: boolean;
  deuce: boolean;
}

interface SbState {
  kind: MatchKind | null;
  idx: number;
  val: [number, number];
  hist: number[];
  /** tombol "Mulai dari 0" perlu ketukan kedua */
  clearArm: boolean;
  drafts: Record<string, Draft>;
  ready: boolean;

  boot(): void;
  /** current = skor yang sudah tercatat di bagan, kalau ada. */
  open(kind: MatchKind, idx: number, current?: Score): void;
  close(): void;
  /** side = sisi yang menang reli; d = +1 tambah, -1 batalkan reli terakhirnya */
  tap(side: 0 | 1, d: 1 | -1, r: SbRules): void;
  undo(r: SbRules): void;
  clear(): void;
  armClear(v: boolean): void;
  dropDraft(kind: MatchKind, idx: number): void;
  draftCount(): number;
}

export function draftKey(kind: MatchKind, idx: number): string {
  return kind + ":" + idx;
}

/** Batas atas tambah angka. Dipakai kedua sistem skor. */
export function sbCanAdd(
  val: readonly [number, number],
  target: number,
  mode: ScoreMode,
): boolean {
  if (mode === "sum") return val[0] + val[1] < target;
  /* first to N - termasuk sistem tenis, yang N-nya jumlah game. Begitu salah
     satu sisi mencapai N, pertandingannya selesai, jadi KEDUA tombol tambah
     harus mati. Versi lama hanya memeriksa nilai sisi itu sendiri, sehingga
     sisi yang kalah masih bisa menambah angka pada laga yang sudah usai. */
  return Math.max(val[0], val[1]) < target;
}

export function sbComplete(
  val: readonly [number, number],
  target: number,
  mode: ScoreMode,
): boolean {
  if (mode === "sum") return val[0] + val[1] === target;
  return Math.max(val[0], val[1]) === target && val[0] !== val[1];
}

export const useSb = create<SbState>((set, get) => {
  /** Menyimpan hasil ketukan sekaligus menulis draft-nya. */
  function commit(val: [number, number], hist: number[]): void {
    const s = get();
    const drafts = { ...s.drafts };
    if (s.kind && s.idx >= 0) {
      const k = draftKey(s.kind, s.idx);
      if (val[0] === 0 && val[1] === 0) delete drafts[k];
      else drafts[k] = { v: [val[0], val[1]], h: hist.slice(0, 60) };
      lsSet(KEY.draft, JSON.stringify(drafts));
    }
    set({ val, hist, clearArm: false, drafts });
  }

  return {
    kind: null,
    idx: -1,
    val: [0, 0],
    hist: [],
    clearArm: false,
    drafts: {},
    ready: false,

    boot() {
      if (get().ready) return;
      set({ drafts: lsJson<Record<string, Draft>>(KEY.draft, {}), ready: true });
    },

    open(kind, idx, current) {
      const d = get().drafts[draftKey(kind, idx)];
      /* Urutannya penting. Catatan sementara menang atas skor di bagan: kalau
         ada hitungan yang belum dicatat, itulah yang sedang dikerjakan orang.

         Kalau tidak ada catatan sementara tapi laganya sudah berskor, angkanya
         dimuat dari bagan - supaya skor yang salah bisa dikoreksi di papan skor
         tanpa mengetik ulang dari nol. Riwayat relinya memang tidak ada, jadi
         tombol Batalkan mati sampai ada reli baru; itu wajar, karena reli
         aslinya tidak pernah tercatat. */
      const seeded: [number, number] =
        current && current[0] !== null && current[1] !== null
          ? [current[0], current[1]]
          : [0, 0];
      set({
        kind,
        idx,
        clearArm: false,
        val: d ? [d.v[0], d.v[1]] : seeded,
        hist: d ? d.h.slice() : [],
      });
    },

    close() {
      set({ kind: null, idx: -1, clearArm: false });
    },

    tap(side, d, r) {
      const s = get();
      if (!s.kind || s.idx < 0) return;

      if (r.tennis) {
        /* Satu ketukan = satu RELI, bukan satu game. Jumlah game dihitung
           ulang dari riwayat, jadi tombol minus cukup membuang reli terakhir
           milik sisi itu. */
        let hist: number[];
        if (d > 0) {
          const st = tennisReplay(s.hist, r.target, r.deuce);
          if (st.gm[0] >= r.target || st.gm[1] >= r.target) return;
          hist = s.hist.concat(side);
        } else {
          const q = s.hist.lastIndexOf(side);
          if (q < 0) return;
          hist = s.hist.slice();
          hist.splice(q, 1);
        }
        const gm = tennisReplay(hist, r.target, r.deuce).gm;
        commit([gm[0], gm[1]], hist);
        return;
      }

      /* Sistem poin: val yang jadi sumbernya. */
      const val: [number, number] = [s.val[0], s.val[1]];
      let hist = s.hist.slice();
      if (d > 0) {
        if (!sbCanAdd(s.val, r.target, r.mode)) return;
        val[side] += 1;
        hist.push(side);
      } else {
        if (val[side] <= 0) return;
        val[side] -= 1;
        const q = hist.lastIndexOf(side);
        if (q >= 0) hist.splice(q, 1);
      }
      commit(val, hist);
    },

    undo(r) {
      const s = get();
      if (!s.hist.length) return;
      const hist = s.hist.slice();
      const side = hist.pop() as 0 | 1;
      if (r.tennis) {
        const gm = tennisReplay(hist, r.target, r.deuce).gm;
        commit([gm[0], gm[1]], hist);
        return;
      }
      const val: [number, number] = [s.val[0], s.val[1]];
      if (val[side] > 0) val[side] -= 1;
      commit(val, hist);
    },

    clear() {
      commit([0, 0], []);
    },

    armClear(v) {
      set({ clearArm: v });
    },

    dropDraft(kind, idx) {
      const drafts = { ...get().drafts };
      delete drafts[draftKey(kind, idx)];
      lsSet(KEY.draft, JSON.stringify(drafts));
      set({ drafts });
    },

    draftCount() {
      return Object.keys(get().drafts).length;
    },
  };
});

/** Keadaan game berjalan, untuk digambar di papan skor. */
export function tennisStateOf(
  hist: readonly number[],
  target: number,
  deuce: boolean,
): TennisState {
  return tennisReplay(hist, target, deuce);
}

/** Skor yang akan dicatat ke bagan. */
export function sbAsScore(val: readonly [number, number]): Score {
  return [val[0], val[1]];
}
