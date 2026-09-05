/* ============================================================================
   Uji properti blok tier Mexicano.

   Yang dibuktikan di sini adalah janji v4.1: setiap lapangan mendapat empat
   peringkat BERURUTAN dari klasemen, dan porsi mainnya tetap merata. Dua hal
   itu saling menarik ke arah berlawanan, jadi keduanya harus diperiksa
   bersama - versi yang hanya mengejar salah satunya sudah pernah dicoba dan
   dibuang (alasannya ada di mexicano.ts).

   Jalankan:
     node --import ./scripts/register-alias.mjs scripts/uji-mexicano.ts

   Node 24 menjalankan TypeScript apa adanya; alias "@/" dipetakan oleh hook
   di scripts/alias-loader.mjs, karena Node tidak membaca paths dari tsconfig.
   ========================================================================== */

import {
  mexBlocks,
  mexPairUp,
  mexSlots,
  soloGamesOf,
  soloSpreadOf,
} from "@/entities/schedule/mexicano";
import type { SoloRound, SoloRow } from "@/shared/types";

function row(id: number, tp: number, p: number): SoloRow {
  return { id, name: "P" + id, p, w: 0, l: 0, d: 0, tp, pk: 0, sp: tp, lp: 0, avg: 0 };
}

/** Urutan Mexicano: poin cetak turun, lalu yang lebih sedikit main diangkat. */
function order(rows: SoloRow[]): SoloRow[] {
  return rows.slice().sort((a, b) => {
    if (b.tp !== a.tp) return b.tp - a.tp;
    if (a.p !== b.p) return a.p - b.p;
    if (b.sp !== a.sp) return b.sp - a.sp;
    return a.id - b.id;
  });
}

let gagal = 0;
function cek(nama: string, syarat: boolean, detail = ""): void {
  if (syarat) {
    console.log("  lolos  " + nama + (detail ? "  " + detail : ""));
  } else {
    gagal++;
    console.log("  GAGAL  " + nama + (detail ? "  " + detail : ""));
  }
}

/* -------------------------------------------------------------------------- */
console.log("\n1. Contoh nyata dari catatan v4.1");
console.log("   9 pemain, 1 lapangan, klasemen P2·P9·P3·P5·P6·P7·P8·P1·P4,");
console.log("   P1 dan P4 baru main 1x, tujuh lainnya sudah 2x.");
{
  const ids = [2, 9, 3, 5, 6, 7, 8, 1, 4];
  const rows = ids.map((id, i) => row(id, 100 - i, id === 1 || id === 4 ? 1 : 2));
  const ord = order(rows);
  /* porsi main dibuat lewat ronde palsu supaya soloGamesOf menghitungnya */
  const rnds: SoloRound[] = [];
  const dua = ids.filter((x) => x !== 1 && x !== 4);
  /* dua ronde untuk tujuh orang itu, satu ronde untuk P1 dan P4 */
  rnds.push([
    [
      [dua[0]!, dua[1]!],
      [dua[2]!, dua[3]!],
    ],
  ]);
  rnds.push([
    [
      [dua[4]!, dua[5]!],
      [dua[6]!, 1],
    ],
  ]);
  rnds.push([
    [
      [dua[0]!, dua[1]!],
      [dua[2]!, 4],
    ],
  ]);

  const b = mexBlocks({ order: ord, rnds, np: 9, courts: 1, out: {} });
  cek("blok terbentuk", !!b);
  if (b) {
    const blok = b[0]!;
    const pos = blok.map((x) => ord.findIndex((y) => y.id === x.id));
    const rentang = Math.max(...pos) - Math.min(...pos);
    cek(
      "empat peringkat berurutan (rentang harus 3)",
      rentang === 3,
      "rentang=" + rentang + " id=" + blok.map((x) => "P" + x.id).join(","),
    );
    const pair = mexPairUp(blok);
    cek(
      "pasangan 1+4 lawan 2+3",
      pair[0][0] === blok[0]!.id &&
        pair[0][1] === blok[3]!.id &&
        pair[1][0] === blok[1]!.id &&
        pair[1][1] === blok[2]!.id,
      JSON.stringify(pair),
    );
  }
}

/* -------------------------------------------------------------------------- */
console.log("\n2. Simulasi penuh — rentang peringkat dan selisih porsi main");
const KONFIG: { np: number; courts: number; rounds: number }[] = [
  { np: 9, courts: 1, rounds: 10 },
  { np: 12, courts: 3, rounds: 10 },
  { np: 16, courts: 3, rounds: 10 },
  { np: 20, courts: 3, rounds: 12 },
  { np: 24, courts: 4, rounds: 12 },
];

for (const k of KONFIG) {
  const rnds: SoloRound[] = [];
  const tp: Record<number, number> = {};
  const played: Record<number, number> = {};
  for (let i = 1; i <= k.np; i++) {
    tp[i] = 0;
    played[i] = 0;
  }

  let rentangMax = 0;
  let bisa = true;

  /* ronde 1: nomor pendaftaran, sama seperti aplikasinya */
  const seats = mexSlots(k.np, k.courts);
  const first: SoloRound = [];
  for (let q = 0; q + 3 < seats; q += 4) {
    first.push(
      mexPairUp([{ id: q + 1 }, { id: q + 2 }, { id: q + 3 }, { id: q + 4 }]),
    );
  }
  rnds.push(first);
  skor(first);

  for (let r = 1; r < k.rounds; r++) {
    const rows: SoloRow[] = [];
    for (let i = 1; i <= k.np; i++) rows.push(row(i, tp[i]!, played[i]!));
    const ord = order(rows);
    const b = mexBlocks({ order: ord, rnds, np: k.np, courts: k.courts, out: {} });
    if (!b) {
      bisa = false;
      break;
    }
    for (const blok of b) {
      const pos = blok.map((x) => ord.findIndex((y) => y.id === x.id));
      const rentang = Math.max(...pos) - Math.min(...pos);
      if (rentang > rentangMax) rentangMax = rentang;
    }
    const ms: SoloRound = b.map((q) => mexPairUp(q));
    rnds.push(ms);
    skor(ms);
  }

  const g = soloGamesOf(rnds, k.np);
  const sp = soloSpreadOf(g, k.np);
  const nama = k.np + " pemain · " + k.courts + " lapangan · " + k.rounds + " ronde";
  cek(
    nama,
    bisa && rentangMax === 3 && sp.gap <= 2,
    "rentang=" + rentangMax + " selisih porsi main=" + sp.gap,
  );

  function skor(ms: SoloRound): void {
    /* skor palsu tapi tidak seragam, supaya klasemennya benar-benar bergerak */
    ms.forEach((m, ci) => {
      const a = 3 + ((ci + rnds.length) % 2);
      const b2 = 4 - a + 3;
      for (const x of m[0]) {
        tp[x] = tp[x]! + a;
        played[x] = played[x]! + 1;
      }
      for (const x of m[1]) {
        tp[x] = tp[x]! + b2;
        played[x] = played[x]! + 1;
      }
    });
  }
}

/* -------------------------------------------------------------------------- */
console.log("\n3. Pemain hadir tidak cukup harus ditolak, bukan dipaksakan");
{
  const rows: SoloRow[] = [];
  for (let i = 1; i <= 8; i++) rows.push(row(i, 0, 0));
  /* 8 pemain, 2 lapangan butuh 8 kursi; lima orang absen */
  const out = { 1: true, 2: true, 3: true, 4: true, 5: true };
  const b = mexBlocks({ order: order(rows), rnds: [], np: 8, courts: 2, out });
  cek("mexBlocks menolak kalau kursi tidak terisi", b === null);
}

console.log("\n" + (gagal ? gagal + " UJI GAGAL" : "semua uji lolos") + "\n");
process.exit(gagal ? 1 : 0);
