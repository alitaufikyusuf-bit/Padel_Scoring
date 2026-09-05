/* ============================================================================
   BABAK KNOCKOUT 4 BESAR (hanya format Fix Partner)

   Empat teratas klasemen liga lolos. Semifinal mempertemukan unggulan 1 lawan
   3 dan unggulan 2 lawan 4, jadi tim dengan catatan liga terbaik tidak
   langsung bertemu pesaing terdekatnya.

   Indeks laga: 0 = SF1, 1 = SF2, 2 = perebutan juara 3, 3 = final.
   ========================================================================== */

import type { FlatMatch, Score, TableRow } from "@/shared/types";
import { isDone } from "@/entities/match";

export interface KoCtx {
  n: number;
  koOn: boolean;
  thirdOn: boolean;
  courts: number;
  table: readonly TableRow[];
  matches: readonly FlatMatch[];
  scores: readonly Score[];
  koScores: readonly Score[];
}

export function koActive(c: Pick<KoCtx, "koOn" | "n">): boolean {
  return c.koOn && c.n >= 4;
}

export function leagueDone(c: Pick<KoCtx, "matches" | "scores">): boolean {
  return c.matches.length > 0 && c.scores.every((s) => isDone(s));
}

export function seedList(c: Pick<KoCtx, "table">): number[] {
  return c.table.slice(0, 4).map((x) => x.id);
}

/** Pasangan tim di laga knockout ke-i; null = belum ditentukan. */
export function koPair(c: KoCtx, i: number): [number | null, number | null] {
  if (!koActive(c) || !leagueDone(c)) return [null, null];
  const s = seedList(c);
  if (i === 0) return [s[0] ?? null, s[2] ?? null];
  if (i === 1) return [s[1] ?? null, s[3] ?? null];
  if (i === 2) return [koSide(c, 0, false), koSide(c, 1, false)];
  return [koSide(c, 0, true), koSide(c, 1, true)];
}

export function koSide(c: KoCtx, i: number, wantWinner: boolean): number | null {
  const p = koPair(c, i);
  const s = c.koScores[i];
  if (!p[0] || !p[1] || !isDone(s) || s![0] === s![1]) return null;
  const aWon = (s![0] as number) > (s![1] as number);
  const win = aWon ? p[0] : p[1];
  const lose = aWon ? p[1] : p[0];
  return wantWinner ? win : lose;
}

export function koReady(c: KoCtx, i: number): boolean {
  const p = koPair(c, i);
  return !!(p[0] && p[1]);
}

/** Nomor unggulan satu tim; 0 kalau tidak lolos. */
export function seedOf(c: Pick<KoCtx, "table">, id: number): number {
  const k = seedList(c).indexOf(id);
  return k < 0 ? 0 : k + 1;
}

/** Susunan slot: SF serentak kalau lapangan >= 2, lalu (opsional) juara 3, lalu final. */
export function koLayout(c: Pick<KoCtx, "courts" | "thirdOn">): number[][] {
  const out: number[][] = c.courts >= 2 ? [[0, 1]] : [[0], [1]];
  if (c.thirdOn) out.push([2]);
  out.push([3]);
  return out;
}

export function koSlotCount(c: KoCtx): number {
  return koActive(c) ? koLayout(c).length : 0;
}

/** Jam mulai slot knockout ke-si. */
export function koStart(
  si: number,
  startMin: number,
  slotCount: number,
  slotMin: number,
): number {
  return startMin + (slotCount + si) * slotMin;
}

/** Laga knockout mana saja yang skornya ikut menentukan podium. */
export function koPodium(c: KoCtx): {
  first: number | null;
  second: number | null;
  third: number | null;
  thirdAlt: [number | null, number | null] | null;
} {
  const first = koSide(c, 3, true);
  const second = koSide(c, 3, false);
  if (c.thirdOn) {
    return { first, second, third: koSide(c, 2, true), thirdAlt: null };
  }
  /* Tanpa perebutan juara 3, dua tim yang kalah di semifinal sama-sama
     menempati peringkat 3 dan keduanya disebut di bawah podium. */
  return {
    first,
    second,
    third: null,
    thirdAlt: [koSide(c, 0, false), koSide(c, 1, false)],
  };
}
