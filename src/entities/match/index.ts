/* ============================================================================
   PERTANDINGAN — kesahihan skor dan penerapan bagan

   isDone dan validPair adalah dua fungsi paling banyak dipanggil di aplikasi
   ini, dan aturannya persis seperti v5.0:
     mode "sum"   - jumlah kedua skor harus tepat TARGET, jadi seri mungkin
                    kalau TARGET genap
     mode "first" - yang menang tepat TARGET dan yang kalah di bawahnya, jadi
                    seri tidak mungkin
   ========================================================================== */

import { keyOf } from "@/shared/lib";
import type {
  FlatMatch,
  FlatSoloMatch,
  PairSlot,
  Score,
  ScoreMode,
  SoloRound,
  SoloTeam,
} from "@/shared/types";

export { keyOf };

/** Skor sudah terisi dua-duanya. */
export function isDone(s: Score | undefined | null): boolean {
  return !!s && s[0] !== null && s[1] !== null;
}

/** Ada isinya di salah satu sisi. Dipakai saat mempertahankan skor lama:
    setengah terisi pun sayang dibuang. */
export function isTouched(s: Score | undefined | null): boolean {
  return !!s && (s[0] !== null || s[1] !== null);
}

/** Skor terisi DAN sah menurut aturan yang aktif. */
export function validPair(s: Score, target: number, mode: ScoreMode): boolean {
  if (!isDone(s)) return false;
  const a = s[0] as number;
  const b = s[1] as number;
  if (mode === "sum") return a + b === target;
  return Math.max(a, b) === target && Math.min(a, b) < target;
}

/** Slot bagan -> daftar pertandingan pipih. */
export function flattenPair(slots: readonly PairSlot[]): FlatMatch[] {
  const out: FlatMatch[] = [];
  slots.forEach((sl, si) => {
    sl.forEach((m, ci) => {
      out.push({ s: si, c: ci, a: m[0], b: m[1] });
    });
  });
  return out;
}

/** Ronde individu -> daftar pertandingan pipih. */
export function flattenSolo(rnds: readonly SoloRound[]): FlatSoloMatch[] {
  const out: FlatSoloMatch[] = [];
  rnds.forEach((ms, ri) => {
    ms.forEach((m, ci) => {
      out.push({ r: ri, c: ci, t1: m[0], t2: m[1] });
    });
  });
  return out;
}

/* ---------------------------------------------------------------------------
   Penerapan bagan baru dengan skor yang dipertahankan.

   Kuncinya BUKAN posisi pertandingan tapi PASANGAN yang bertemu. Kalau bagan
   diacak ulang, "Tim 3 lawan Tim 7" bisa pindah dari slot 2 ke slot 5 - dan
   skor 11-10 itu tetap milik pertemuan tersebut, bukan milik slot 2.

   Yang mudah terlewat: SISINYA bisa ikut tertukar. Kalau dulu tercatat
   "Tim 3 11 - 10 Tim 7" lalu di bagan baru urutannya jadi Tim 7 lawan Tim 3,
   skornya harus dibalik menjadi 10 - 11. Karena itu skor disimpan dalam
   orientasi baku (id kecil di kiri) lalu dibalik lagi saat dibaca kalau perlu.
   --------------------------------------------------------------------------- */

export function applyPairSchedule(
  slots: readonly PairSlot[],
  prevMatches: readonly FlatMatch[],
  prevScores: readonly Score[],
  preserve: boolean,
): { matches: FlatMatch[]; scores: Score[] } {
  let keep: Record<string, Score> | null = null;
  if (preserve) {
    keep = {};
    prevMatches.forEach((m, i) => {
      const s = prevScores[i];
      if (!isTouched(s)) return;
      /* disimpan dengan id kecil di kiri */
      keep![keyOf(m.a, m.b)] = m.a < m.b ? [s![0], s![1]] : [s![1], s![0]];
    });
  }
  const matches = flattenPair(slots);
  const scores: Score[] = matches.map((m) => {
    const k = keep ? keep[keyOf(m.a, m.b)] : undefined;
    if (!k) return [null, null];
    return m.a < m.b ? [k[0], k[1]] : [k[1], k[0]];
  });
  return { matches, scores };
}

/** Kunci satu pertandingan individu: dua tim, tidak bergantung urutan sisi. */
export function soloKey(t1: SoloTeam, t2: SoloTeam): string {
  const s1 = t1.slice().sort((x, y) => x - y).join(".");
  const s2 = t2.slice().sort((x, y) => x - y).join(".");
  return s1 < s2 ? s1 + "|" + s2 : s2 + "|" + s1;
}

function sortedTeam(t: SoloTeam): string {
  return t.slice().sort((x, y) => x - y).join(".");
}

export function applySoloSchedule(
  rnds: readonly SoloRound[],
  prevMatches: readonly FlatSoloMatch[],
  prevScores: readonly Score[],
  preserve: boolean,
): { matches: FlatSoloMatch[]; scores: Score[] } {
  let keep: Record<string, { t1: SoloTeam; s: Score }> | null = null;
  if (preserve) {
    keep = {};
    prevMatches.forEach((m, i) => {
      const s = prevScores[i];
      if (!s || s[0] === null) return;
      keep![soloKey(m.t1, m.t2)] = { t1: [m.t1[0], m.t1[1]], s: [s[0], s[1]] };
    });
  }
  const matches = flattenSolo(rnds);
  const scores: Score[] = matches.map((m) => {
    const k = keep ? keep[soloKey(m.t1, m.t2)] : undefined;
    if (!k) return [null, null];
    /* sisi mana yang dulu jadi t1 menentukan perlu dibalik atau tidak */
    const same = sortedTeam(k.t1) === sortedTeam(m.t1);
    return same ? [k.s[0], k.s[1]] : [k.s[1], k.s[0]];
  });
  return { matches, scores };
}
