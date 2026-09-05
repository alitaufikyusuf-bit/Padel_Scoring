/* ============================================================================
   LOGIKA GANTI PEMAIN / TUKAR TIM

   Fungsi murni yang menghitung hasil swap tanpa efek samping. Store memanggil
   ini dan menerapkan hasilnya.

   Aturan utama: swap HANYA untuk laga yang belum punya skor.
   ========================================================================== */

import type {
  FlatSoloMatch,
  Score,
  SoloRound,
  SoloTeam,
  PairSlot,
  FlatMatch,
} from "@/shared/types";
import { isDone } from "@/entities/match";
import { soloGamesOf } from "@/entities/schedule/mexicano";

/* ---------------------------------------------------------------------------
   INDIVIDU / MEXICANO — satu laga
   --------------------------------------------------------------------------- */

export interface SwapOneResult {
  ok: boolean;
  reason?: string;
  rnd: SoloRound[];
  smatch: FlatSoloMatch[];
}

/**
 * Ganti satu pemain di satu laga individu.
 * Menolak jika skor sudah ada.
 */
export function swapInMatch(
  rnd: readonly SoloRound[],
  smatch: readonly FlatSoloMatch[],
  sscores: readonly Score[],
  matchIdx: number,
  oldPid: number,
  newPid: number,
): SwapOneResult {
  const m = smatch[matchIdx];
  if (!m) return { ok: false, reason: "no-match", rnd: [...rnd], smatch: [...smatch] };

  const sc = sscores[matchIdx];
  if (isDone(sc)) {
    return { ok: false, reason: "has-score", rnd: [...rnd], smatch: [...smatch] };
  }

  /* Pastikan pemain lama memang ada di laga ini */
  const inT1 = m.t1.indexOf(oldPid as 0) as number;
  const inT2 = m.t2.indexOf(oldPid as 0) as number;
  if (inT1 < 0 && inT2 < 0) {
    return { ok: false, reason: "not-in-match", rnd: [...rnd], smatch: [...smatch] };
  }

  /* Pastikan pemain baru belum ada di laga ini */
  if (m.t1.includes(newPid) || m.t2.includes(newPid)) {
    return { ok: false, reason: "already-in-match", rnd: [...rnd], smatch: [...smatch] };
  }

  /* Clone ronde dan ganti */
  const newRnds = rnd.map((r) =>
    r.map((mm): [SoloTeam, SoloTeam] => {
      const t1: SoloTeam = [mm[0][0], mm[0][1]];
      const t2: SoloTeam = [mm[1][0], mm[1][1]];
      return [t1, t2];
    }),
  );

  const ri = m.r;
  const ci = m.c;
  const rm = newRnds[ri]?.[ci];
  if (!rm) return { ok: false, reason: "internal", rnd: [...rnd], smatch: [...smatch] };

  /* Ganti di tim yang tepat */
  if (inT1 >= 0) rm[0][inT1 as 0 | 1] = newPid;
  else rm[1][inT2 as 0 | 1] = newPid;

  /* Bangun ulang smatch dari ronde */
  const newSmatch = flattenSoloFromRnds(newRnds);

  return { ok: true, rnd: newRnds, smatch: newSmatch };
}

/* ---------------------------------------------------------------------------
   INDIVIDU / MEXICANO — absen beberapa ronde
   --------------------------------------------------------------------------- */

export interface SwapAbsResult {
  ok: boolean;
  rnd: SoloRound[];
  smatch: FlatSoloMatch[];
  /** Ringkasan: berapa laga diganti, siapa yang menggantikan, mana yang dilewati */
  replaced: number;
  skippedScore: number;
  skippedNoSub: number;
  changes: SwapChange[];
}

export interface SwapChange {
  round: number;
  court: number;
  oldPid: number;
  newPid: number;
  newName: string;
}

/**
 * Ganti pemain di rentang ronde [fromRound, toRound] inklusif.
 * Untuk setiap laga yang belum punya skor, cari pemain pengganti dari yang
 * istirahat di ronde itu, dengan porsi main paling sedikit.
 */
export function swapInRounds(
  rnd: readonly SoloRound[],
  smatch: readonly FlatSoloMatch[],
  sscores: readonly Score[],
  np: number,
  pnames: readonly string[],
  oldPid: number,
  fromRound: number,
  toRound: number,
): SwapAbsResult {
  let curRnd = rnd.map((r) =>
    r.map((mm): [SoloTeam, SoloTeam] => {
      const t1: SoloTeam = [mm[0][0], mm[0][1]];
      const t2: SoloTeam = [mm[1][0], mm[1][1]];
      return [t1, t2];
    }),
  );
  let curSmatch = flattenSoloFromRnds(curRnd);

  let replaced = 0;
  let skippedScore = 0;
  let skippedNoSub = 0;
  const changes: SwapChange[] = [];

  for (let ri = fromRound; ri <= toRound && ri < curRnd.length; ri++) {
    /* Cari laga di ronde ini yang melibatkan oldPid */
    const matchIdxs: number[] = [];
    curSmatch.forEach((m, idx) => {
      if (m.r !== ri) return;
      if (m.t1.includes(oldPid) || m.t2.includes(oldPid)) matchIdxs.push(idx);
    });

    for (const mi of matchIdxs) {
      const sc = sscores[mi];
      if (isDone(sc)) {
        skippedScore++;
        continue;
      }

      /* Cari pengganti: yang istirahat di ronde ini, porsi main terkecil */
      const candidates = getCandidates(curRnd, curSmatch, sscores, np, ri, oldPid);
      if (!candidates.length) {
        skippedNoSub++;
        continue;
      }

      const best = candidates[0]!;
      const res = swapInMatch(curRnd, curSmatch, sscores, mi, oldPid, best.id);
      if (res.ok) {
        curRnd = res.rnd;
        curSmatch = res.smatch;
        replaced++;
        changes.push({
          round: ri,
          court: curSmatch[mi]?.c ?? 0,
          oldPid,
          newPid: best.id,
          newName: pnames[best.id - 1] ?? "Pemain " + best.id,
        });
      }
    }
  }

  return { ok: true, rnd: curRnd, smatch: curSmatch, replaced, skippedScore, skippedNoSub, changes };
}

/* ---------------------------------------------------------------------------
   KANDIDAT PENGGANTI
   --------------------------------------------------------------------------- */

export interface SwapCandidate {
  id: number;
  name: string;
  gamesPlayed: number;
  recommended: boolean;
}

/**
 * Daftar pemain yang bisa menggantikan di ronde tertentu.
 * Syarat: istirahat di ronde itu dan bukan oldPid.
 * Diurutkan dari porsi main paling sedikit.
 */
export function getCandidates(
  rnd: readonly SoloRound[],
  smatch: readonly FlatSoloMatch[],
  sscores: readonly Score[],
  np: number,
  roundIdx: number,
  excludePid: number,
  pnames?: readonly string[],
): SwapCandidate[] {
  /* Siapa yang main di ronde ini */
  const playing = new Set<number>();
  const ms = rnd[roundIdx];
  if (ms) {
    for (const m of ms) {
      for (const x of [m[0][0], m[0][1], m[1][0], m[1][1]]) playing.add(x);
    }
  }

  /* Hitung porsi main */
  const games = soloGamesOf(rnd, np);

  /* Yang istirahat */
  const candidates: SwapCandidate[] = [];
  for (let i = 1; i <= np; i++) {
    if (i === excludePid) continue;
    if (playing.has(i)) continue;
    candidates.push({
      id: i,
      name: pnames ? (pnames[i - 1] ?? "Pemain " + i) : "Pemain " + i,
      gamesPlayed: games[i] ?? 0,
      recommended: false,
    });
  }

  /* Urutkan dari porsi main terkecil */
  candidates.sort((a, b) => a.gamesPlayed - b.gamesPlayed);

  /* Tandai yang disarankan */
  if (candidates.length > 0) {
    const minGames = candidates[0]!.gamesPlayed;
    for (const c of candidates) {
      if (c.gamesPlayed === minGames) c.recommended = true;
      else break;
    }
  }

  return candidates;
}

/* ---------------------------------------------------------------------------
   PORSI MAIN per pemain (helper)
   --------------------------------------------------------------------------- */

export function playerGameCount(
  rnd: readonly SoloRound[],
  np: number,
  pid: number,
): number {
  const games = soloGamesOf(rnd, np);
  return games[pid] ?? 0;
}

/* ---------------------------------------------------------------------------
   FIX PARTNER — tukar posisi dua tim di bagan
   --------------------------------------------------------------------------- */

export interface SwapTeamResult {
  slots: PairSlot[];
  matches: FlatMatch[];
  scores: Score[];
}

/**
 * Tukar posisi dua tim di seluruh bagan Fix Partner.
 * Skor mengikuti pasangan timnya: kalau Tim A vs Tim C punya skor 11-10,
 * setelah Tim A ditukar posisinya dengan Tim B, laga Tim A vs Tim C tetap 11-10
 * tapi di slot yang berbeda.
 *
 * Karena skor disimpan per pasangan (bukan per posisi), yang dilakukan hanyalah
 * menukar semua kemunculan teamA ↔ teamB di slots, lalu membangun ulang matches
 * dari slots.
 */
export function swapTeamPositions(
  slots: readonly PairSlot[],
  matches: readonly FlatMatch[],
  scores: readonly Score[],
  teamA: number,
  teamB: number,
): SwapTeamResult {
  /* Clone slots dan tukar semua kemunculan */
  const newSlots: PairSlot[] = slots.map((sl) =>
    sl.map(([a, b]) => {
      const na = a === teamA ? teamB : a === teamB ? teamA : a;
      const nb = b === teamA ? teamB : b === teamB ? teamA : b;
      return [na, nb];
    }),
  );

  /* Bangun ulang matches dari slots */
  const newMatches: FlatMatch[] = [];
  newSlots.forEach((sl, si) => {
    sl.forEach((m, ci) => {
      newMatches.push({ s: si, c: ci, a: m[0], b: m[1] });
    });
  });

  /* Skor mengikuti pasangan timnya. Karena kita cuma menukar identitas,
     posisi laga (indeks) sama persis, jadi skor tidak perlu dipindah. */
  const newScores: Score[] = scores.map((s) => [s[0], s[1]]);

  return { slots: newSlots, matches: newMatches, scores: newScores };
}

/* ---------------------------------------------------------------------------
   PEMBANTU
   --------------------------------------------------------------------------- */

function flattenSoloFromRnds(rnds: SoloRound[]): FlatSoloMatch[] {
  const out: FlatSoloMatch[] = [];
  rnds.forEach((ms, ri) => {
    ms.forEach((m, ci) => {
      out.push({ r: ri, c: ci, t1: m[0], t2: m[1] });
    });
  });
  return out;
}
