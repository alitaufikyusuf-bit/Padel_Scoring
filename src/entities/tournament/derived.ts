"use client";

/* ============================================================================
   NILAI TURUNAN

   Semua yang bisa dihitung dari state TIDAK disimpan di store. Ini bukan
   pilihan gaya: di versi vanilla, TARGET, WIN_PTS, tabel klasemen, dan
   pasangan knockout semuanya global yang harus diperbarui manual, dan setiap
   jalur yang lupa memperbaruinya melahirkan bug "angka tidak ikut berubah".
   Dihitung ulang saat render, masalah itu tidak bisa terjadi lagi.

   Perhitungannya murni dan ringan (klasemen 24 pemain = beberapa ratus operasi),
   jadi tidak perlu memoisasi apa pun kecuali nanti terbukti perlu.
   ========================================================================== */

import { useTournament, type TournamentState } from "./store";
import { rulesOf } from "@/entities/score";
import { isDone, validPair } from "@/entities/match";
import { computeTable, soloTable } from "@/entities/standings";
import { effCourts } from "@/entities/schedule/pair";
import { perRoundCourts, soloStats } from "@/entities/schedule/solo";
import { mexCourts, mexSlots, soloGamesOf, soloSpreadOf } from "@/entities/schedule/mexicano";
import {
  koActive,
  koLayout,
  koPair,
  koPodium,
  koSlotCount,
  koStart,
  leagueDone,
  seedList,
  seedOf,
  type KoCtx,
} from "@/entities/knockout";
import type { Rules, Score, SoloRow, TableRow } from "@/shared/types";
import {
  getCandidates,
  playerGameCount,
  type SwapCandidate,
} from "@/features/swap-player/logic";

/** Aturan penilaian yang sedang berlaku.

    rulesOf() membuat objek BARU tiap dipanggil, jadi ia tidak boleh dipakai
    sebagai selektor: Zustand v5 membandingkan hasil selektor dengan kesamaan
    identitas, sehingga hasilnya selalu dianggap berubah dan komponen
    menggambar ulang tanpa henti sampai perambannya menyerah. Yang dilanggani
    adalah empat bidang mentahnya, dan objeknya dibentuk di luar selektor. */
export function useRules(): Rules {
  const scoreSys = useTournament((s) => s.scoreSys);
  const ptTarget = useTournament((s) => s.ptTarget);
  const gmTarget = useTournament((s) => s.gmTarget);
  const mexDeuce = useTournament((s) => s.mexDeuce);
  const mode = useTournament((s) => s.mode);
  return rulesOf({ scoreSys, ptTarget, gmTarget, mexDeuce, mode });
}

/** Klasemen Fix Partner. */
export function useTable(): TableRow[] {
  const n = useTournament((s) => s.n);
  const names = useTournament((s) => s.names);
  const matches = useTournament((s) => s.matches);
  const scores = useTournament((s) => s.scores);
  return computeTable(n, names, matches, scores);
}

/** Klasemen Individu / Mexicano. */
export function useSoloTable(): SoloRow[] {
  const np = useTournament((s) => s.np);
  const pnames = useTournament((s) => s.pnames);
  const matches = useTournament((s) => s.smatch);
  const scores = useTournament((s) => s.sscores);
  const mexOn = useTournament((s) => s.mexOn);
  const soloRank = useTournament((s) => s.soloRank);
  return soloTable({ np, pnames, matches, scores, mexOn, soloRank });
}

/** Konteks knockout yang siap dipakai fungsi-fungsi entitas knockout. */
export function useKoCtx(): KoCtx {
  const s = useTournament();
  const table = useTable();
  return {
    n: s.n,
    koOn: s.koOn,
    thirdOn: s.thirdOn,
    courts: s.courts,
    table,
    matches: s.matches,
    scores: s.scores,
    koScores: s.koScores,
  };
}

export interface KoView {
  active: boolean;
  leagueDone: boolean;
  seeds: number[];
  layout: number[][];
  slotCount: number;
  pair(i: number): [number | null, number | null];
  seedOf(id: number): number;
  podium: ReturnType<typeof koPodium>;
  startOf(si: number): number;
}

export function useKo(): KoView {
  const ctx = useKoCtx();
  const startMin = useTournament((s) => s.startMin);
  const slotMin = useTournament((s) => s.slotMin);
  const slotCount = useTournament((s) => s.slots.length);
  return {
    active: koActive(ctx),
    leagueDone: leagueDone(ctx),
    seeds: seedList(ctx),
    layout: koLayout(ctx),
    slotCount: koSlotCount(ctx),
    pair: (i) => koPair(ctx, i),
    seedOf: (id) => seedOf(ctx, id),
    podium: koPodium(ctx),
    startOf: (si) => koStart(si, startMin, slotCount, slotMin),
  };
}

export interface Progress {
  done: number;
  total: number;
  /** skor yang terisi tapi tidak sah menurut aturan yang aktif */
  invalid: number;
  complete: boolean;
  pct: number;
}

/** Progres pengisian skor pada format yang sedang aktif. */
export function useProgress(): Progress {
  const fmt = useTournament((s) => s.fmt);
  const scores = useTournament((s) => (s.fmt === "pair" ? s.scores : s.sscores));
  const rules = useRules();
  void fmt;
  let done = 0;
  let invalid = 0;
  for (const s of scores) {
    if (!isDone(s)) continue;
    done++;
    if (!validPair(s, rules.target, rules.mode)) invalid++;
  }
  const total = scores.length;
  return {
    done,
    total,
    invalid,
    complete: total > 0 && done === total,
    pct: total ? Math.round((done / total) * 100) : 0,
  };
}

/** Jam mulai satu slot bagan. */
export function slotTimeOf(si: number, startMin: number, slotMin: number): number {
  return startMin + si * slotMin;
}

export interface CourtInfo {
  /** lapangan yang benar-benar terpakai */
  eff: number;
  /** lapangan tersedia menurut setelan */
  set: number;
  /** kelebihan lapangan yang pasti menganggur */
  idle: number;
}

/** Karena satu peserta tidak bisa main di dua tempat, ada batas atas nyata. */
export function useCourtInfo(): CourtInfo {
  const s = useTournament();
  const eff =
    s.fmt === "pair"
      ? effCourts(s.n, s.courts)
      : s.mexOn
        ? mexCourts(s.np, s.courts)
        : perRoundCourts(s.np, s.courts);
  return { eff, set: s.courts, idle: Math.max(0, s.courts - eff) };
}

/** Mutu bagan Individu: porsi main, pasangan terulang, pasangan yang terpakai. */
export function useSoloStats() {
  const rnd = useTournament((s) => s.rnd);
  const np = useTournament((s) => s.np);
  return soloStats(rnd, np);
}

export interface MexView {
  seatsNeeded: number;
  present: number;
  courts: number;
  /** ronde berjalan sudah lengkap skornya */
  ready: boolean;
  /** boleh membuat ronde berikutnya */
  canNext: boolean;
  spread: ReturnType<typeof soloSpreadOf>;
  games: number[];
}

export function useMex(): MexView {
  const s = useTournament();
  const seatsNeeded = mexSlots(s.np, s.courts);
  let present = 0;
  for (let i = 1; i <= s.np; i++) if (!s.mexOut[i]) present++;
  const ready =
    s.mexOn && s.smatch.length > 0 && s.sscores.every((x) => isDone(x));
  const games = soloGamesOf(s.rnd, s.np);
  return {
    seatsNeeded,
    present,
    courts: mexCourts(s.np, s.courts),
    ready,
    canNext: s.mexOn && ready && s.rnd.length < s.rounds,
    spread: soloSpreadOf(games, s.np, s.mexOut),
    games,
  };
}

/* ---------------------------------------------------------------------------
   Apa yang sedang dipertaruhkan.

   Dipakai sebelum tindakan yang merusak (acak ulang, ganti format, ubah jumlah
   peserta). Versi vanilla awalnya hanya menghitung skor yang SUDAH tercatat -
   dan itu meleset justru di saat paling berbahaya: hitungan yang masih
   berjalan di papan skor belum tercatat, tapi kehilangannya sama saja
   menyakitkan. Jadi draft ikut dihitung.
   --------------------------------------------------------------------------- */

export interface AtStake {
  /** laga yang skornya sudah tercatat */
  done: number;
  /** hitungan yang masih tertunda di papan skor */
  drafts: number;
  any: boolean;
}

export function atStakeOf(
  s: Pick<TournamentState, "fmt" | "scores" | "sscores" | "koScores">,
  draftCount: number,
): AtStake {
  const arr: readonly Score[] = s.fmt === "pair" ? s.scores : s.sscores;
  let done = 0;
  for (const x of arr) if (isDone(x)) done++;
  if (s.fmt === "pair") for (const x of s.koScores) if (isDone(x)) done++;
  return { done, drafts: draftCount, any: done > 0 || draftCount > 0 };
}

/* ---------------------------------------------------------------------------
   Kandidat pengganti untuk swap pemain.
   --------------------------------------------------------------------------- */

export type { SwapCandidate };

export function useSwapCandidates(roundIdx: number, excludePid: number): SwapCandidate[] {
  const rnd = useTournament((s) => s.rnd);
  const smatch = useTournament((s) => s.smatch);
  const sscores = useTournament((s) => s.sscores);
  const np = useTournament((s) => s.np);
  const pnames = useTournament((s) => s.pnames);
  return getCandidates(rnd, smatch, sscores, np, roundIdx, excludePid, pnames);
}

export function usePlayerGames(pid: number): number {
  const rnd = useTournament((s) => s.rnd);
  const np = useTournament((s) => s.np);
  return playerGameCount(rnd, np, pid);
}
