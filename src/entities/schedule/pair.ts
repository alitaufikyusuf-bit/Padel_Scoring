/* ============================================================================
   PENYUSUN JADWAL — FIX PARTNER

   Dipindahkan apa adanya dari v5.0 vanilla. Algoritmanya tidak diubah sama
   sekali; yang ditambah hanya tipe. Hasilnya harus identik bit-per-bit dengan
   versi lama untuk masukan yang sama (kecuali yang memang memakai acak).

   Dua kandidat dijalankan lalu yang terbaik dipakai:
     circleSlots - pola baku round robin, unggul kalau lapangan cukup untuk
                   memainkan seluruh ronde sekaligus
     buildSlots  - greedy per slot dengan batas jeda istirahat, unggul kalau
                   lapangan lebih sedikit dari yang dibutuhkan satu ronde
   ========================================================================== */

import { shuffled, range1 } from "@/shared/lib";
import type { PairMatch, PairSlot } from "@/shared/types";

export function allPairs(cnt: number): PairMatch[] {
  const out: PairMatch[] = [];
  for (let i = 1; i <= cnt; i++) for (let j = i + 1; j <= cnt; j++) out.push([i, j]);
  return out;
}

/** Lapangan yang benar-benar terpakai: satu tim tidak bisa main di dua tempat. */
export function effCourts(cnt: number, c: number): number {
  return Math.max(1, Math.min(c, Math.floor(cnt / 2)));
}

export function minSlots(cnt: number, c: number): number {
  const total = (cnt * (cnt - 1)) / 2;
  return Math.max(Math.ceil(total / effCourts(cnt, c)), cnt - 1);
}

/** Urutan tim teracak, dipakai untuk mengaburkan pola bagan. */
function rangeArr(cnt: number): number[] {
  return shuffled(range1(cnt));
}

/* Greedy: isi slot demi slot. Di dalam satu slot semua tim harus berbeda.
   Prioritas pemilihan = jeda istirahat (dibatasi restCap supaya tidak
   mengorbankan kepadatan), lalu tim yang sisa pertandingannya paling banyak. */
export function buildSlots(
  cnt: number,
  c: number,
  randomize: boolean,
  restCap: number,
): PairSlot[] {
  let pending = allPairs(cnt);
  if (randomize) {
    const perm = shuffled(pending.length ? rangeArr(cnt) : []);
    pending = pending.map((m) => [perm[m[0] - 1]!, perm[m[1] - 1]!] as PairMatch);
    pending = shuffled(pending);
  }
  const rem: Record<number, number> = {};
  const last: Record<number, number> = {};
  for (let k = 1; k <= cnt; k++) rem[k] = cnt - 1;
  const cap = effCourts(cnt, c);
  const slots: PairSlot[] = [];
  let si = 0;

  while (pending.length) {
    const used: Record<number, number> = {};
    const slot: PairSlot = [];
    while (slot.length < cap) {
      let best = -1;
      let bs: [number, number] | null = null;
      for (let k = 0; k < pending.length; k++) {
        const m = pending[k]!;
        if (used[m[0]] || used[m[1]]) continue;
        const rA = last[m[0]] === undefined ? 99 : si - last[m[0]]! - 1;
        const rB = last[m[1]] === undefined ? 99 : si - last[m[1]]! - 1;
        const sc: [number, number] = [
          Math.min(Math.min(rA, rB), restCap),
          rem[m[0]]! + rem[m[1]]!,
        ];
        if (!bs || sc[0] > bs[0] || (sc[0] === bs[0] && sc[1] > bs[1])) {
          bs = sc;
          best = k;
        }
      }
      if (best < 0) break;
      const mm = pending[best]!;
      used[mm[0]] = 1;
      used[mm[1]] = 1;
      rem[mm[0]] = rem[mm[0]]! - 1;
      rem[mm[1]] = rem[mm[1]]! - 1;
      slot.push(mm);
      pending.splice(best, 1);
    }
    for (const m of slot) {
      last[m[0]] = si;
      last[m[1]] = si;
    }
    slots.push(slot);
    si++;
  }
  return slots;
}

/* Kandidat kedua: circle method (pola baku round robin) lalu tiap ronde
   dipotong sesuai kapasitas lapangan. */
export function circleSlots(cnt: number, c: number, randomize: boolean): PairSlot[] {
  const arr: number[] = [];
  for (let i = 1; i <= cnt; i++) arr.push(i);
  if (cnt % 2) arr.push(0);
  const m = arr.length;
  let rounds: PairSlot[] = [];
  for (let r = 0; r < m - 1; r++) {
    const pairs: PairSlot = [];
    for (let i = 0; i < m / 2; i++) {
      const a = arr[i]!;
      const b = arr[m - 1 - i]!;
      if (a !== 0 && b !== 0) pairs.push([a, b]);
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop()!);
  }
  const perm = randomize ? rangeArr(cnt) : null;
  if (perm) {
    rounds = shuffled(rounds).map((rr) =>
      shuffled(rr).map((x) => [perm[x[0] - 1]!, perm[x[1] - 1]!] as PairMatch),
    );
  }
  const cap = effCourts(cnt, c);
  const slots: PairSlot[] = [];
  for (const rr of rounds) {
    for (let k = 0; k < rr.length; k += cap) slots.push(rr.slice(k, k + cap));
  }
  return slots;
}

export interface RestStats {
  min: number;
  sum: number;
}

export function restStats(slots: readonly PairSlot[]): RestStats {
  const pos: Record<number, number[]> = {};
  slots.forEach((sl, si) => {
    for (const m of sl) {
      (pos[m[0]] = pos[m[0]] || []).push(si);
      (pos[m[1]] = pos[m[1]] || []).push(si);
    }
  });
  let min = Infinity;
  let sum = 0;
  let any = false;
  for (const t of Object.keys(pos)) {
    const v = pos[Number(t)]!;
    for (let i = 1; i < v.length; i++) {
      const g = v[i]! - v[i - 1]! - 1;
      sum += g;
      any = true;
      if (g < min) min = g;
    }
  }
  return { min: any ? min : 0, sum };
}

interface Candidate {
  slots: PairSlot[];
  st: RestStats;
}

/** slot paling sedikit -> jeda minimum terbesar -> total jeda terbesar */
function better(a: Candidate, b: Candidate | null): boolean {
  if (!b) return true;
  if (a.slots.length !== b.slots.length) return a.slots.length < b.slots.length;
  if (a.st.min !== b.st.min) return a.st.min > b.st.min;
  return a.st.sum > b.st.sum;
}

function pack(slots: PairSlot[]): Candidate {
  return { slots, st: restStats(slots) };
}

export function makeStandard(cnt: number, c: number): PairSlot[] {
  let best = pack(circleSlots(cnt, c, false));
  for (const cap of [0, 1, 2, 3, 99]) {
    const cand = pack(buildSlots(cnt, c, false, cap));
    if (better(cand, best)) best = cand;
  }
  return best.slots;
}

export function makeRandom(cnt: number, c: number): PairSlot[] {
  const target = minSlots(cnt, c);
  let best: Candidate | null = null;
  for (let a = 0; a < 6; a++) {
    const cc = pack(circleSlots(cnt, c, true));
    if (better(cc, best)) best = cc;
  }
  for (let a = 0; a < 160; a++) {
    const cap = [1, 2, 3, 99][a % 4]!;
    const cand = pack(buildSlots(cnt, c, true, cap));
    if (better(cand, best)) best = cand;
    if (best!.slots.length === target && best!.st.min >= 1 && a > 40) break;
  }
  return best!.slots;
}
