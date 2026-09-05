/* ============================================================================
   PENYUSUN JADWAL — INDIVIDU

   Dipindahkan apa adanya dari v5.0 vanilla. Pendekatannya: banyak percobaan
   acak, tiap percobaan dinilai, yang terbaik dipakai. Bobot penilaian
   (5000/400/60/1) menyatakan urutan kepentingan dan sengaja tidak diubah:

     selisih porsi main   x5000  - paling penting, ini soal keadilan
     pasangan terulang    x400   - satu pasangan berulang paling banyak
     total pengulangan    x60
     lawan terulang       x1     - paling ringan, lawan berulang itu wajar

   perRoundCourts dan defaultRounds menerima parameter di sini, sementara di
   versi vanilla keduanya membaca variabel global. Itu satu-satunya perbedaan.
   ========================================================================== */

import { shuffled, zero2 } from "@/shared/lib";
import type { SoloMatch, SoloRound, SoloTeam } from "@/shared/types";

/** Lapangan yang benar-benar terpakai per ronde: satu lapangan butuh 4 orang. */
export function perRoundCourts(np: number, courts: number): number {
  return Math.max(1, Math.min(courts, Math.floor(np / 4)));
}

export function defaultRounds(np: number, courts: number): number {
  if (np % 4 === 0 && np / 4 <= courts) return Math.max(3, Math.min(24, np - 1));
  return Math.max(3, Math.min(24, 8));
}

export interface SoloAttempt {
  rounds: SoloRound[];
  games: number[];
  partner: number[][];
  opp: number[][];
}

/** Satu percobaan penyusunan jadwal individu. */
export function attemptSolo(P: number, pc: number, R: number): SoloAttempt {
  const games: number[] = [];
  const partner = zero2(P);
  const opp = zero2(P);
  for (let i = 0; i <= P; i++) games.push(0);
  const out: SoloRound[] = [];

  for (let r = 0; r < R; r++) {
    /* yang main: pemain dengan jumlah main paling sedikit */
    let order: number[] = [];
    for (let i = 1; i <= P; i++) order.push(i);
    order = shuffled(order);
    order.sort((a, b) => games[a]! - games[b]!);
    const need = 4 * pc;
    const playing = order.slice(0, need);

    /* bentuk pasangan: utamakan yang belum pernah sepasang */
    const pool = shuffled(playing);
    const teams: SoloTeam[] = [];
    while (pool.length) {
      const a = pool.shift()!;
      let bi = 0;
      let bs: [number, number, number] | null = null;
      for (let k = 0; k < pool.length; k++) {
        const b = pool[k]!;
        const sc: [number, number, number] = [partner[a]![b]!, opp[a]![b]!, Math.random()];
        if (
          !bs ||
          sc[0] < bs[0] ||
          (sc[0] === bs[0] && (sc[1] < bs[1] || (sc[1] === bs[1] && sc[2] < bs[2])))
        ) {
          bs = sc;
          bi = k;
        }
      }
      const mate = pool[bi]!;
      pool.splice(bi, 1);
      teams.push([a, mate]);
    }

    /* pasangkan tim jadi pertandingan: utamakan lawan yang jarang bertemu */
    const ms: SoloMatch[] = [];
    while (teams.length) {
      const t1 = teams.shift()!;
      let ci = 0;
      let cs: [number, number] | null = null;
      for (let q = 0; q < teams.length; q++) {
        const t2 = teams[q]!;
        const v =
          opp[t1[0]]![t2[0]]! +
          opp[t1[0]]![t2[1]]! +
          opp[t1[1]]![t2[0]]! +
          opp[t1[1]]![t2[1]]!;
        const rr = Math.random();
        if (cs === null || v < cs[0] || (v === cs[0] && rr < cs[1])) {
          cs = [v, rr];
          ci = q;
        }
      }
      const t2b = teams[ci]!;
      teams.splice(ci, 1);
      ms.push([t1, t2b]);
    }

    /* catat */
    for (const m of ms) {
      const A = m[0];
      const B = m[1];
      partner[A[0]]![A[1]]++;
      partner[A[1]]![A[0]]++;
      partner[B[0]]![B[1]]++;
      partner[B[1]]![B[0]]++;
      for (const x of [A[0], A[1]]) {
        for (const y of [B[0], B[1]]) {
          opp[x]![y]++;
          opp[y]![x]++;
        }
      }
      for (const x of [A[0], A[1], B[0], B[1]]) games[x]++;
    }
    out.push(ms);
  }
  return { rounds: out, games, partner, opp };
}

export function soloScore(a: SoloAttempt, P: number): number {
  let pr = 0;
  let prMax = 0;
  let op = 0;
  for (let i = 1; i <= P; i++) {
    for (let j = i + 1; j <= P; j++) {
      const pv = a.partner[i]![j]!;
      const ov = a.opp[i]![j]!;
      if (pv > 1) {
        pr += pv - 1;
        if (pv > prMax) prMax = pv;
      }
      if (ov > 1) op += ov - 1;
    }
  }
  let mn = Infinity;
  let mx = -Infinity;
  for (let i = 1; i <= P; i++) {
    if (a.games[i]! < mn) mn = a.games[i]!;
    if (a.games[i]! > mx) mx = a.games[i]!;
  }
  return (mx - mn) * 5000 + prMax * 400 + pr * 60 + op;
}

export function makeSolo(
  P: number,
  R: number,
  randomize: boolean,
  courts: number,
): SoloRound[] {
  const pc = perRoundCourts(P, courts);
  let best: SoloAttempt | null = null;
  let bs = Infinity;
  const tries = randomize ? 220 : 120;
  for (let t = 0; t < tries; t++) {
    const a = attemptSolo(P, pc, R);
    const sc = soloScore(a, P);
    if (sc < bs) {
      bs = sc;
      best = a;
    }
    if (bs === 0 && t > 30) break;
  }
  return best!.rounds;
}

export interface SoloStats {
  games: number[];
  minG: number;
  maxG: number;
  repeat: number;
  maxRep: number;
  pairsMet: number;
  pairsTotal: number;
}

/** Statistik mutu jadwal, dipakai untuk keterangan di bawah bagan. */
export function soloStats(rnds: readonly SoloRound[], np: number): SoloStats {
  const partner = zero2(np);
  const opp = zero2(np);
  const games: number[] = [];
  for (let i = 0; i <= np; i++) games.push(0);

  for (const ms of rnds) {
    for (const m of ms) {
      const A = m[0];
      const B = m[1];
      partner[A[0]]![A[1]]++;
      partner[A[1]]![A[0]]++;
      partner[B[0]]![B[1]]++;
      partner[B[1]]![B[0]]++;
      for (const x of [A[0], A[1]]) {
        for (const y of [B[0], B[1]]) {
          opp[x]![y]++;
          opp[y]![x]++;
        }
      }
      for (const x of [A[0], A[1], B[0], B[1]]) games[x]++;
    }
  }

  let repeat = 0;
  let maxRep = 0;
  let mn = Infinity;
  let mx = -Infinity;
  let pairsMet = 0;
  let total = 0;
  for (let i = 1; i <= np; i++) {
    for (let j = i + 1; j <= np; j++) {
      total++;
      if (partner[i]![j]! > 0) pairsMet++;
      if (partner[i]![j]! > 1) {
        repeat++;
        if (partner[i]![j]! > maxRep) maxRep = partner[i]![j]!;
      }
    }
  }
  for (let i = 1; i <= np; i++) {
    if (games[i]! < mn) mn = games[i]!;
    if (games[i]! > mx) mx = games[i]!;
  }
  return { games, minG: mn, maxG: mx, repeat, maxRep, pairsMet, pairsTotal: total };
}
