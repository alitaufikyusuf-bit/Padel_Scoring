"use client";

/* ============================================================================
   STORE SESI TURNAMEN

   Versi vanilla menyimpan sekitar 137 variabel global yang diubah langsung
   lalu diikuti panggilan renderAll(). Di React itu tidak bisa dipertahankan
   apa adanya, jadi seluruh state itu dikumpulkan di satu store dan komponen
   berlangganan bagian yang dibutuhkannya.

   Yang TIDAK disimpan di sini: apa pun yang bisa dihitung dari state lain -
   klasemen, aturan skor efektif, pasangan knockout, progres. Semuanya jadi
   selector di useDerived.ts. Versi vanilla menyimpan sebagian di antaranya
   sebagai global dan itulah sumber beberapa bug "angka tidak ikut berubah";
   di sini masalah itu hilang secara struktural.

   Turnamen adalah akar agregat: dia yang memiliki format, daftar peserta,
   bagan, skor, dan sistem skornya. Karena itu store-nya diletakkan di entitas
   tournament, bukan dipecah per entitas.
   ========================================================================== */

import { create } from "zustand";

import {
  swapInMatch as swapInMatchLogic,
  swapInRounds as swapInRoundsLogic,
  swapTeamPositions,
  type SwapAbsResult,
} from "@/features/swap-player/logic";
import {
  DEF_COURTS,
  DEF_DATE,
  DEF_PLAYERS,
  DEF_ROUNDS,
  DEF_SLOT_MIN,
  DEF_START_MIN,
  DEF_TEAMS,
  DEF_TITLE,
  MAX_C,
  MAX_P,
  MAX_T,
  MIN_P,
  MIN_T,
} from "@/shared/config";
import { clampInt } from "@/shared/lib";
import type {
  FlatMatch,
  FlatSoloMatch,
  Fmt,
  PairSlot,
  SchedKind,
  Score,
  ScoreMode,
  ScoreSys,
  SoloRank,
  SoloRound,
} from "@/shared/types";
import {
  applyPairSchedule,
  applySoloSchedule,
  flattenPair,
  flattenSolo,
} from "@/entities/match";
import { makeRandom, makeStandard } from "@/entities/schedule/pair";
import { defaultRounds, makeSolo } from "@/entities/schedule/solo";
import {
  mexBuildRound,
  mexRound1,
  mexSlots,
  soloGamesOf,
} from "@/entities/schedule/mexicano";
import { soloTable } from "@/entities/standings";
import { rulesOf } from "@/entities/score";
import { decodeCode, encodeCode, type Decoded } from "@/entities/draw-code";

const EMPTY_KO: Score[] = [
  [null, null],
  [null, null],
  [null, null],
  [null, null],
];

/* Hasil pembuatan ronde Mexicano. Ditulis sebagai union yang dibedakan oleh
   bidang "ok" literal - kalau ok bertipe boolean biasa, TypeScript tidak bisa
   menyempitkan cabangnya dan pemanggil tidak bisa membaca "why". */
export type MexNextResult =
  | { ok: true; resting: number[]; round: number }
  | { ok: false; why: "belum-lengkap" | "cukup-ronde" | "stuck"; sisa?: number };

export interface TournamentState {
  /* ---- acara ---- */
  evTitle: string;
  evDate: string;
  courts: number;
  slotMin: number;
  startMin: number;
  fmt: Fmt;

  /* ---- Fix Partner ---- */
  n: number;
  names: string[];
  slots: PairSlot[];
  matches: FlatMatch[];
  scores: Score[];
  koOn: boolean;
  thirdOn: boolean;
  koScores: Score[];
  schedKind: SchedKind;

  /* ---- Individu / Mexicano ---- */
  np: number;
  rounds: number;
  pnames: string[];
  rnd: SoloRound[];
  smatch: FlatSoloMatch[];
  sscores: Score[];
  soloKind: SchedKind | "mex";
  soloRank: SoloRank;
  mexOn: boolean;
  mexOut: Record<number, boolean>;

  /* ---- sistem skor ---- */
  scoreSys: ScoreSys;
  ptTarget: number;
  gmTarget: number;
  mexDeuce: boolean;
  mode: ScoreMode;

  /* ---- pesan singkat di bawah bagan ---- */
  schedMsg: string;
  /** kunci pesan yang perlu diterjemahkan, dipakai kalau pesannya baku */
  hydrated: boolean;
}

export interface TournamentActions {
  /* acara */
  setEvent(p: Partial<Pick<TournamentState, "evTitle" | "evDate">>): void;
  setCourts(c: number): void;
  setStartMin(m: number): void;
  setSlotMin(m: number): void;
  setSchedMsg(t: string): void;

  /* format */
  setFmt(v: Fmt, mexOn?: boolean): void;

  /* bagan Fix Partner */
  buildPair(kind: SchedKind, preserve: boolean): void;
  setTeamCount(v: number): void;
  renameTeam(i: number, name: string): void;
  removeTeam(i: number): void;
  setScore(i: number, side: 0 | 1, v: number | null): void;
  setScorePair(i: number, a: number | null, b: number | null): void;
  clearScores(): void;
  setKo(on: boolean): void;
  setThird(on: boolean): void;
  setKoScore(i: number, a: number | null, b: number | null): void;

  /* bagan Individu */
  buildSolo(kind: SchedKind, preserve: boolean): void;
  setPlayerCount(v: number): void;
  renamePlayer(i: number, name: string): void;
  removePlayer(i: number): void;
  setRounds(v: number): void;
  setSoloRank(v: SoloRank): void;
  setSScore(i: number, side: 0 | 1, v: number | null): void;
  setSScorePair(i: number, a: number | null, b: number | null): void;
  applySoloRounds(rnds: SoloRound[], kind: SchedKind | "mex", preserve: boolean): void;

  /* Mexicano */
  toggleOut(pid: number): void;
  mexStart(acak: boolean): boolean;
  mexNext(): MexNextResult;

  /* sistem skor */
  setScoreSys(v: ScoreSys): void;
  setPtTarget(v: number): void;
  setGmTarget(v: number): void;
  setDeuce(on: boolean): void;
  setMode(v: ScoreMode): void;

  /* ganti pemain / tukar tim */
  swapSoloMatch(matchIdx: number, oldPid: number, newPid: number): boolean;
  swapSoloAbsent(oldPid: number, fromRound: number, toRound: number): SwapAbsResult;
  swapTeams(teamA: number, teamB: number): void;

  /* kode bagan */
  toCode(): string;
  fromDecoded(d: Decoded): void;

  /* pemulihan */
  replaceAll(s: Partial<TournamentState>): void;
}

export type TournamentStore = TournamentState & TournamentActions;

function initialPair(n: number, courts: number) {
  const slots = makeStandard(n, courts);
  const matches = flattenPair(slots);
  return { slots, matches, scores: matches.map((): Score => [null, null]) };
}

function initialSolo(np: number, rounds: number, courts: number) {
  const rnd = makeSolo(np, rounds, false, courts);
  const smatch = flattenSolo(rnd);
  return { rnd, smatch, sscores: smatch.map((): Score => [null, null]) };
}

function defaultState(): TournamentState {
  const names: string[] = [];
  for (let i = 1; i <= MAX_T; i++) names.push("Tim " + i);
  const pnames: string[] = [];
  for (let i = 1; i <= MAX_P; i++) pnames.push("Pemain " + i);
  return {
    evTitle: DEF_TITLE,
    evDate: DEF_DATE,
    courts: DEF_COURTS,
    slotMin: DEF_SLOT_MIN,
    startMin: DEF_START_MIN,
    fmt: "pair",

    n: DEF_TEAMS,
    names,
    slots: [],
    matches: [],
    scores: [],
    koOn: true,
    thirdOn: false,
    koScores: EMPTY_KO.map((s) => [s[0], s[1]] as Score),
    schedKind: "standard",

    np: DEF_PLAYERS,
    rounds: DEF_ROUNDS,
    pnames,
    rnd: [],
    smatch: [],
    sscores: [],
    soloKind: "standard",
    soloRank: "points",
    mexOn: false,
    mexOut: {},

    scoreSys: "points",
    ptTarget: 21,
    gmTarget: 4,
    mexDeuce: false,
    mode: "sum",

    schedMsg: "",
    hydrated: false,
  };
}

export const useTournament = create<TournamentStore>((set, get) => ({
  ...defaultState(),

  /* ------------------------------------------------------------ acara ---- */
  setEvent(p) {
    set(p);
  },
  setCourts(c) {
    const courts = clampInt(c, 1, MAX_C, DEF_COURTS);
    const s = get();
    set({ courts });
    /* Mengubah jumlah lapangan TIDAK menghapus skor: daftar pertandingannya
       tidak berubah, hanya pengelompokan slotnya yang disusun ulang. */
    if (s.fmt === "pair") get().buildPair(s.schedKind, true);
    else if (!s.mexOn) get().buildSolo(s.soloKind === "mex" ? "standard" : s.soloKind, true);
  },
  setStartMin(m) {
    set({ startMin: clampInt(m, 0, 1439, DEF_START_MIN) });
  },
  setSlotMin(m) {
    set({ slotMin: clampInt(m, 5, 60, DEF_SLOT_MIN) });
  },
  setSchedMsg(t) {
    set({ schedMsg: t });
  },

  /* ----------------------------------------------------------- format ---- */
  setFmt(v, mexOn) {
    const s = get();
    const wantMex = !!mexOn && v === "solo";
    if (s.fmt === v && s.mexOn === wantMex) return;
    set({ fmt: v, mexOn: wantMex });
    if (v === "pair") {
      get().buildPair(s.schedKind, false);
    } else if (wantMex) {
      get().mexStart(false);
    } else {
      get().buildSolo("standard", false);
    }
  },

  /* ------------------------------------------------- bagan Fix Partner ---- */
  buildPair(kind, preserve) {
    const s = get();
    const slots = kind === "random" ? makeRandom(s.n, s.courts) : makeStandard(s.n, s.courts);
    const { matches, scores } = applyPairSchedule(slots, s.matches, s.scores, preserve);
    set({
      slots,
      matches,
      scores,
      schedKind: kind,
      /* Skor knockout hanya berarti kalau klasemen liganya utuh, jadi ia
         dibuang setiap kali bagan disusun dari nol. */
      koScores: preserve ? s.koScores : EMPTY_KO.map((x) => [x[0], x[1]] as Score),
    });
  },
  setTeamCount(v) {
    const n = clampInt(v, MIN_T, MAX_T, DEF_TEAMS);
    set({ n });
    get().buildPair(get().schedKind, false);
  },
  renameTeam(i, name) {
    const names = get().names.slice();
    names[i] = name;
    set({ names });
  },
  removeTeam(i) {
    const s = get();
    if (s.n <= MIN_T) return;
    const names = s.names.slice();
    names.splice(i, 1);
    names.push("Tim " + (MAX_T + 1));
    set({ names, n: s.n - 1 });
    get().buildPair(s.schedKind, false);
  },
  setScore(i, side, v) {
    const scores = get().scores.map((x) => [x[0], x[1]] as Score);
    if (!scores[i]) return;
    scores[i]![side] = v;
    set({ scores });
  },
  setScorePair(i, a, b) {
    const scores = get().scores.map((x) => [x[0], x[1]] as Score);
    if (!scores[i]) return;
    scores[i] = [a, b];
    set({ scores });
  },
  clearScores() {
    const s = get();
    if (s.fmt === "pair") {
      set({
        scores: s.matches.map((): Score => [null, null]),
        koScores: EMPTY_KO.map((x) => [x[0], x[1]] as Score),
      });
    } else {
      set({ sscores: s.smatch.map((): Score => [null, null]) });
    }
  },
  setKo(on) {
    set({ koOn: on });
  },
  setThird(on) {
    set({ thirdOn: on });
  },
  setKoScore(i, a, b) {
    const koScores = get().koScores.map((x) => [x[0], x[1]] as Score);
    while (koScores.length < 4) koScores.push([null, null]);
    koScores[i] = [a, b];
    set({ koScores });
  },

  /* ---------------------------------------------------- bagan Individu ---- */
  buildSolo(kind, preserve) {
    const s = get();
    const rnds = makeSolo(s.np, s.rounds, kind === "random", s.courts);
    get().applySoloRounds(rnds, kind, preserve);
  },
  applySoloRounds(rnds, kind, preserve) {
    const s = get();
    const { matches, scores } = applySoloSchedule(rnds, s.smatch, s.sscores, preserve);
    set({ rnd: rnds, smatch: matches, sscores: scores, soloKind: kind });
  },
  setPlayerCount(v) {
    const s = get();
    const np = clampInt(v, MIN_P, MAX_P, DEF_PLAYERS);
    /* Pemain yang hilang dari daftar tidak boleh tetap tercatat absen -
       kalau dibiarkan, jumlah "hadir" ikut salah. */
    const mexOut: Record<number, boolean> = {};
    for (const k of Object.keys(s.mexOut)) {
      const id = Number(k);
      if (id <= np && s.mexOut[id]) mexOut[id] = true;
    }
    set({ np, mexOut });
    if (s.mexOn) get().mexStart(false);
    else get().buildSolo(s.soloKind === "mex" ? "standard" : s.soloKind, false);
  },
  renamePlayer(i, name) {
    const pnames = get().pnames.slice();
    pnames[i] = name;
    set({ pnames });
  },
  removePlayer(i) {
    const s = get();
    if (s.np <= MIN_P) return;
    const pnames = s.pnames.slice();
    pnames.splice(i, 1);
    pnames.push("Pemain " + (MAX_P + 1));
    set({ pnames });
    get().setPlayerCount(s.np - 1);
  },
  setRounds(v) {
    const s = get();
    const rounds = clampInt(v, 3, 24, defaultRounds(s.np, s.courts));
    set({ rounds });
    /* Di Mexicano jumlah ronde hanya batas atas - bagannya tidak disusun ulang,
       karena ronde yang sudah dimainkan tidak boleh hilang. */
    if (!s.mexOn) get().buildSolo(s.soloKind === "mex" ? "standard" : s.soloKind, true);
  },
  setSoloRank(v) {
    set({ soloRank: v });
  },
  setSScore(i, side, v) {
    const sscores = get().sscores.map((x) => [x[0], x[1]] as Score);
    if (!sscores[i]) return;
    sscores[i]![side] = v;
    set({ sscores });
  },
  setSScorePair(i, a, b) {
    const sscores = get().sscores.map((x) => [x[0], x[1]] as Score);
    if (!sscores[i]) return;
    sscores[i] = [a, b];
    set({ sscores });
  },

  /* --------------------------------------------------------- Mexicano ---- */
  toggleOut(pid) {
    const s = get();
    const mexOut = { ...s.mexOut };
    if (mexOut[pid]) delete mexOut[pid];
    else mexOut[pid] = true;
    set({ mexOut });
  },
  mexStart(acak) {
    const s = get();
    const ms = mexRound1(s.np, s.courts, s.mexOut, acak);
    if (!ms) return false;
    get().applySoloRounds([ms], "mex", false);
    return true;
  },
  mexNext() {
    const s = get();
    if (!s.mexOn) return { ok: false as const, why: "stuck" as const };
    if (!s.smatch.length) {
      return get().mexStart(false)
        ? { ok: true as const, resting: [], round: 1 }
        : { ok: false as const, why: "stuck" as const };
    }
    const belum = s.sscores.filter((x) => !(x[0] !== null && x[1] !== null)).length;
    if (belum) return { ok: false as const, why: "belum-lengkap" as const, sisa: belum };
    if (s.rnd.length >= s.rounds) return { ok: false as const, why: "cukup-ronde" as const };

    const order = soloTable({
      np: s.np,
      pnames: s.pnames,
      matches: s.smatch,
      scores: s.sscores,
      mexOn: true,
      soloRank: s.soloRank,
    });
    const ms = mexBuildRound({
      order,
      rnds: s.rnd,
      np: s.np,
      courts: s.courts,
      out: s.mexOut,
    });
    if (!ms) return { ok: false as const, why: "stuck" as const };

    const rnds = s.rnd.slice();
    rnds.push(ms);
    get().applySoloRounds(rnds, "mex", true);

    const playing = new Set<number>();
    for (const m of ms) for (const x of [m[0][0], m[0][1], m[1][0], m[1][1]]) playing.add(x);
    const resting: number[] = [];
    for (let i = 1; i <= s.np; i++) if (!s.mexOut[i] && !playing.has(i)) resting.push(i);
    return { ok: true as const, resting, round: rnds.length };
  },

  /* ----------------------------------------------------- sistem skor ---- */
  setScoreSys(v) {
    set({ scoreSys: v });
  },
  setPtTarget(v) {
    set({ ptTarget: clampInt(v, 6, 99, 21) });
  },
  setGmTarget(v) {
    set({ gmTarget: clampInt(v, 1, 9, 4) });
  },
  setDeuce(on) {
    set({ mexDeuce: on });
  },
  setMode(v) {
    set({ mode: v });
  },

  /* ------------------------------------------------ ganti pemain / tukar tim ---- */
  swapSoloMatch(matchIdx, oldPid, newPid) {
    const s = get();
    const res = swapInMatchLogic(s.rnd, s.smatch, s.sscores, matchIdx, oldPid, newPid);
    if (!res.ok) return false;
    set({ rnd: res.rnd, smatch: res.smatch });
    return true;
  },
  swapSoloAbsent(oldPid, fromRound, toRound) {
    const s = get();
    const res = swapInRoundsLogic(
      s.rnd, s.smatch, s.sscores, s.np, s.pnames,
      oldPid, fromRound, toRound,
    );
    if (res.ok) set({ rnd: res.rnd, smatch: res.smatch });
    return res;
  },
  swapTeams(teamA, teamB) {
    const s = get();
    const res = swapTeamPositions(s.slots, s.matches, s.scores, teamA, teamB);
    set({ slots: res.slots, matches: res.matches, scores: res.scores });
  },

  /* ------------------------------------------------------ kode bagan ---- */
  toCode() {
    const s = get();
    return encodeCode({
      fmt: s.fmt,
      /* Di sistem tenis mode selalu "first"; yang tersimpan harus mode
         EFEKTIF, bukan pilihan pengguna yang sedang tidak berlaku - kalau
         tidak, kode yang dimuat di HP lain bisa memakai aturan berbeda. */
      mode: rulesOf(s).mode,
      courts: s.courts,
      startMin: s.startMin,
      slotMin: s.slotMin,
      evTitle: s.evTitle,
      evDate: s.evDate,
      n: s.n,
      names: s.names,
      slots: s.slots,
      scores: s.scores,
      koScores: s.koScores,
      koOn: s.koOn,
      thirdOn: s.thirdOn,
      np: s.np,
      rounds: s.rounds,
      pnames: s.pnames,
      rnd: s.rnd,
      sscores: s.sscores,
      soloRank: s.soloRank,
      mexOn: s.mexOn,
      scoreSys: s.scoreSys,
      ptTarget: s.ptTarget,
      gmTarget: s.gmTarget,
      mexDeuce: s.mexDeuce,
      mexOut: s.mexOut,
    });
  },

  fromDecoded(d) {
    const base: Partial<TournamentState> = {
      fmt: d.fmt,
      mode: d.mode,
      courts: d.courts,
      startMin: d.startMin,
      slotMin: d.slotMin,
      evTitle: d.evTitle,
      evDate: d.evDate,
      mexOn: d.mexOn,
      scoreSys: d.scoreSys,
      ptTarget: d.ptTarget,
      gmTarget: d.gmTarget,
      mexDeuce: d.mexDeuce,
      mexOut: d.mexOut,
    };
    if (d.fmt === "solo") {
      const pnames = get().pnames.slice();
      d.pnames.forEach((nm, i) => {
        pnames[i] = nm;
      });
      set({
        ...base,
        np: d.np,
        rounds: d.rounds,
        pnames,
        rnd: d.rnd,
        smatch: flattenSolo(d.rnd),
        sscores: d.sscores,
        soloRank: d.soloRank,
        soloKind: d.mexOn ? "mex" : "standard",
      });
    } else {
      const names = get().names.slice();
      d.names.forEach((nm, i) => {
        names[i] = nm;
      });
      set({
        ...base,
        n: d.n,
        names,
        slots: d.slots,
        matches: flattenPair(d.slots),
        scores: d.scores,
        koScores: d.koScores,
        koOn: d.koOn,
        thirdOn: d.thirdOn,
      });
    }
  },

  replaceAll(s) {
    set(s);
  },
}));

/* ---------------------------------------------------------------------------
   Penyiapan awal. Bagan tidak dibangun di defaultState() karena penyusunnya
   memakai Math.random() untuk mode acak - dan menjalankannya saat modul dimuat
   berarti hasil di server dan di klien bisa berbeda, yang memicu galat
   hidrasi. Jadi bagan pertama dibangun setelah komponen terpasang.
   --------------------------------------------------------------------------- */
export function bootTournament(): void {
  const s = useTournament.getState();
  if (s.hydrated) return;
  const p = initialPair(s.n, s.courts);
  const q = initialSolo(s.np, s.rounds, s.courts);
  useTournament.setState({ ...p, ...q, hydrated: true });
}

/** Dipakai layar Mexicano untuk tahu apakah kursi yang hadir cukup. */
export function mexSeatsNeeded(np: number, courts: number): number {
  return mexSlots(np, courts);
}

export { soloGamesOf, decodeCode };
