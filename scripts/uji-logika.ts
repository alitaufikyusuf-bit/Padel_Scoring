/* ============================================================================
   Uji logika inti yang dipindahkan dari v5.0 vanilla.

   Jalankan:
     node --import ./scripts/alias-loader.mjs scripts/uji-logika.ts

   Yang diuji di sini bukan tampilan, tapi janji-janji yang kalau dilanggar
   membuat turnamen salah hitung dan tidak ada yang menyadarinya sampai
   klasemen akhir keluar:

     - bagan Fix Partner adalah round robin LENGKAP, tanpa pasangan terulang,
       dan tidak ada tim yang main dua kali di slot yang sama
     - skor ikut pertemuan, bukan posisi, saat bagan diacak ulang - termasuk
       kalau sisinya tertukar
     - kode bagan v9 bolak-balik tanpa kehilangan apa pun, dan kode v7/v8 lama
       masih terbaca
     - mesin skor tenis menutup game tepat sesuai aturan deuce yang dipilih
     - klasemen memakai pembeda yang benar
   ========================================================================== */

import { effCourts, makeRandom, makeStandard, minSlots } from "@/entities/schedule/pair";
import { makeSolo, soloStats } from "@/entities/schedule/solo";
import {
  applyPairSchedule,
  flattenPair,
  isDone,
  keyOf,
  validPair,
} from "@/entities/match";
import { decodeCode, encodeCode, summarizeCode, upgradeCode } from "@/entities/draw-code";
import { rulesOf, tennisReplay } from "@/entities/score";
import { computeTable, soloTable } from "@/entities/standings";
import type { PairSlot, Score } from "@/shared/types";

let gagal = 0;
function cek(nama: string, syarat: boolean, detail = ""): void {
  if (syarat) console.log("  lolos  " + nama + (detail ? "  " + detail : ""));
  else {
    gagal++;
    console.log("  GAGAL  " + nama + (detail ? "  " + detail : ""));
  }
}

/* ========================================================================== */
console.log("\n1. Bagan Fix Partner harus round robin lengkap");
for (const n of [3, 4, 5, 6, 7, 8, 10, 12]) {
  for (const c of [1, 2, 3, 4]) {
    for (const acak of [false, true]) {
      const slots: PairSlot[] = acak ? makeRandom(n, c) : makeStandard(n, c);
      const seen = new Set<string>();
      let dobel = false;
      let bentrok = false;
      let total = 0;
      for (const sl of slots) {
        const dipakai = new Set<number>();
        if (sl.length > effCourts(n, c)) bentrok = true;
        for (const m of sl) {
          const k = keyOf(m[0], m[1]);
          if (seen.has(k)) dobel = true;
          seen.add(k);
          if (dipakai.has(m[0]) || dipakai.has(m[1])) bentrok = true;
          dipakai.add(m[0]);
          dipakai.add(m[1]);
          total++;
        }
      }
      const harus = (n * (n - 1)) / 2;
      cek(
        `${n} tim · ${c} lapangan · ${acak ? "acak" : "baku"}`,
        total === harus && !dobel && !bentrok && slots.length >= minSlots(n, c),
        `${total}/${harus} laga · ${slots.length} slot`,
      );
    }
  }
}

/* ========================================================================== */
console.log("\n2. Skor ikut pertemuan, bukan posisi");
{
  const n = 6;
  const slots = makeStandard(n, 2);
  const matches = flattenPair(slots);
  const scores: Score[] = matches.map(() => [null, null]);
  /* satu pertemuan diberi skor, lalu bagan diacak ulang */
  const target = matches[3]!;
  scores[3] = [13, 8];
  const kunci = keyOf(target.a, target.b);
  const kiriAwal = target.a;

  const acak = makeRandom(n, 2);
  const hasil = applyPairSchedule(acak, matches, scores, true);
  const idxBaru = hasil.matches.findIndex((m) => keyOf(m.a, m.b) === kunci);
  cek("pertemuannya masih ada setelah diacak", idxBaru >= 0);
  if (idxBaru >= 0) {
    const m = hasil.matches[idxBaru]!;
    const s = hasil.scores[idxBaru]!;
    const samaSisi = m.a === kiriAwal;
    cek(
      "skor mengikuti sisinya" + (samaSisi ? " (sisi sama)" : " (sisi tertukar, harus dibalik)"),
      samaSisi ? s[0] === 13 && s[1] === 8 : s[0] === 8 && s[1] === 13,
      `${s[0]}-${s[1]}`,
    );
  }
  /* hanya satu skor yang boleh terbawa */
  const berskor = hasil.scores.filter((s) => isDone(s)).length;
  cek("tidak ada skor lain yang ikut terbawa", berskor === 1, "berskor=" + berskor);

  /* preserve=false harus mengosongkan semuanya */
  const bersih = applyPairSchedule(acak, matches, scores, false);
  cek(
    "acak tanpa mempertahankan skor mengosongkan semuanya",
    bersih.scores.every((s) => !isDone(s)),
  );
}

/* ========================================================================== */
console.log("\n3. Kode bagan v9 bolak-balik tanpa kehilangan apa pun");
{
  const n = 6;
  const slots = makeStandard(n, 2);
  const matches = flattenPair(slots);
  const scores: Score[] = matches.map((_, i) => (i % 2 ? [11, 10] : [null, null]));
  const names = ["Alfa", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"];
  const kode = encodeCode({
    fmt: "pair",
    mode: "sum",
    courts: 2,
    startMin: 8 * 60 + 30,
    slotMin: 20,
    evTitle: "Kamisan TH · uji",
    evDate: "4 September 2026",
    n,
    names,
    slots,
    scores,
    koScores: [
      [21, 15],
      [null, null],
      [null, null],
      [null, null],
    ],
    koOn: true,
    thirdOn: true,
    np: 8,
    rounds: 7,
    pnames: [],
    rnd: [],
    sscores: [],
    soloRank: "points",
    mexOn: false,
    scoreSys: "points",
    ptTarget: 21,
    gmTarget: 4,
    mexDeuce: false,
    mexOut: {},
  });
  const r = decodeCode(kode);
  cek("kode pair terbaca", r.ok, r.ok ? "" : (r as { error: string }).error);
  if (r.ok && r.data.fmt === "pair") {
    const d = r.data;
    cek("nama tim utuh", JSON.stringify(d.names) === JSON.stringify(names));
    cek("jam mulai & durasi utuh", d.startMin === 510 && d.slotMin === 20);
    cek("judul & tanggal utuh", d.evTitle === "Kamisan TH · uji" && d.evDate === "4 September 2026");
    cek("bendera knockout utuh", d.koOn === true && d.thirdOn === true);
    cek("skor liga utuh", JSON.stringify(d.scores) === JSON.stringify(scores));
    cek("skor knockout utuh", d.koScores[0]![0] === 21 && d.koScores[0]![1] === 15);
    cek("bagan identik", JSON.stringify(d.slots) === JSON.stringify(slots));
    cek("mengkodekan ulang menghasilkan kode yang sama", encodeCode({
      fmt: d.fmt, mode: d.mode, courts: d.courts, startMin: d.startMin, slotMin: d.slotMin,
      evTitle: d.evTitle, evDate: d.evDate, n: d.n, names: d.names, slots: d.slots,
      scores: d.scores, koScores: d.koScores, koOn: d.koOn, thirdOn: d.thirdOn,
      np: 8, rounds: 7, pnames: [], rnd: [], sscores: [], soloRank: "points",
      mexOn: d.mexOn, scoreSys: d.scoreSys, ptTarget: d.ptTarget, gmTarget: d.gmTarget,
      mexDeuce: d.mexDeuce, mexOut: d.mexOut,
    }) === kode);
  }
}

console.log("\n4. Kode Mexicano dengan sistem tenis dan daftar absen");
{
  const rnd = makeSolo(12, 3, false, 3);
  const flat = rnd.reduce((a, b) => a + b.length, 0);
  const sscores: Score[] = Array.from({ length: flat }, (_, i) =>
    i === 0 ? [4, 2] : [null, null],
  );
  const pnames = Array.from({ length: 12 }, (_, i) => "Pemain " + (i + 1));
  const kode = encodeCode({
    fmt: "solo", mode: "first", courts: 3, startMin: 1140, slotMin: 15,
    evTitle: "Mexicano", evDate: "5 Sep",
    n: 6, names: [], slots: [], scores: [], koScores: [], koOn: false, thirdOn: false,
    np: 12, rounds: 8, pnames, rnd, sscores, soloRank: "points",
    mexOn: true, scoreSys: "tennis", ptTarget: 32, gmTarget: 5, mexDeuce: true,
    mexOut: { 3: true, 7: true },
  });
  const r = decodeCode(kode);
  cek("kode solo terbaca", r.ok, r.ok ? "" : (r as { error: string }).error);
  if (r.ok && r.data.fmt === "solo") {
    const d = r.data;
    cek("penanda Mexicano utuh", d.mexOn === true);
    cek("sistem tenis utuh", d.scoreSys === "tennis" && d.gmTarget === 5);
    cek("aturan deuce utuh", d.mexDeuce === true);
    cek("target poin ikut tersimpan walau tidak dipakai", d.ptTarget === 32);
    cek("daftar absen utuh", !!d.mexOut[3] && !!d.mexOut[7] && !d.mexOut[5]);
    cek("bagan ronde identik", JSON.stringify(d.rnd) === JSON.stringify(rnd));
    cek("skor individu utuh", d.sscores[0]![0] === 4 && d.sscores[0]![1] === 2);
    cek("jumlah ronde utuh", d.rounds === 8);
  }
}

console.log("\n5. Kode lama harus tetap terbaca");
{
  /* v8 = v9 tanpa enam ruas terakhir */
  const v8 =
    "v8;;pair;;sum;;2;;480;;15;;Uji~17%20Agt;;4;;0;;10;;A|B|C|D;;1x2+3x4,1x3+2x4,1x4+2x3;;11-10,-,-,-,-,-;;-,-,-,-";
  const up8 = upgradeCode(v8);
  cek("v8 dinaikkan ke v9", up8.startsWith("v9;;") && up8.split(";;").length === 20);
  const r8 = decodeCode(v8);
  cek("v8 terbaca", r8.ok, r8.ok ? "" : (r8 as { error: string }).error);
  if (r8.ok) {
    cek("v8 dianggap bukan Mexicano dan sistem poin 21", !r8.data.mexOn && r8.data.scoreSys === "points" && r8.data.ptTarget === 21);
  }

  /* v7 = aplikasi paling lama, hanya Fix Partner, 12 ruas */
  const v7 = "v7;;sum;;4;;2;;480;;15;;10;;Uji%20Lama~17%20Agt;;A|B|C|D;;1x2+3x4,1x3+2x4,1x4+2x3;;11-10,-,-,-,-,-;;-,-,-,-";
  const r7 = decodeCode(v7);
  cek("v7 terbaca", r7.ok, r7.ok ? "" : (r7 as { error: string }).error);
  if (r7.ok && r7.data.fmt === "pair") {
    cek("v7 dikenali sebagai Fix Partner 4 tim", r7.data.n === 4);
    cek("v7 ditandai perlu pemberitahuan", r7.data.wasV7 === true);
  }

  cek("kode ngawur ditolak", !decodeCode("halo dunia").ok);
  cek("versi masa depan dibedakan", (() => {
    const r = decodeCode("v99;;pair;;sum");
    return !r.ok && r.error === "terlalu-baru";
  })());
  cek("bagan pair tidak lengkap ditolak", (() => {
    const rusak = "v9;;pair;;sum;;2;;480;;15;;U~x;;4;;0;;10;;A|B|C|D;;1x2+3x4;;11-10,-;;-,-,-,-;;0;;p;;21;;4;;0;;";
    const r = decodeCode(rusak);
    return !r.ok && r.error === "bagan-pair";
  })());

  const sum = summarizeCode(v8);
  cek("ringkasan kode benar", !!sum && sum.fmt === "pair" && sum.count === 4 && sum.matches === 6, JSON.stringify(sum));
}

/* ========================================================================== */
console.log("\n6. Mesin skor tenis");
{
  const semua = (n: number, side: number) => Array.from({ length: n }, () => side);
  const gantian = (n: number) => Array.from({ length: n }, (_, i) => i % 2);

  /* golden point: 40-40 diputus satu reli */
  cek("golden point — 4 reli bersih = 1 game", tennisReplay(semua(4, 0), 4, false).gm[0] === 1);
  cek(
    "golden point — reli bergantian, game selesai di reli ke-7",
    tennisReplay(gantian(6), 4, false).gm.join() === "0,0" &&
      tennisReplay(gantian(7), 4, false).gm.join() === "1,0",
  );

  /* advantage: harus menang dua reli berturut-turut sesudah 40-40 */
  cek("advantage — 4 reli bersih = 1 game", tennisReplay(semua(4, 0), 4, true).gm[0] === 1);
  cek(
    "advantage — reli bergantian tidak pernah menutup game",
    tennisReplay(gantian(40), 4, true).gm.join() === "0,0",
  );
  {
    /* 0,1,0,1,0,1 -> 40-40, lalu 0,0 -> game untuk sisi 0 */
    const h = [0, 1, 0, 1, 0, 1, 0, 0];
    cek("advantage — dua reli berturut-turut menutup game", tennisReplay(h, 4, true).gm.join() === "1,0");
  }
  {
    /* advantage lalu hilang lagi, baru diputus */
    const h = [0, 1, 0, 1, 0, 1, 0, 1, 1, 1];
    cek("advantage bisa hilang lagi lalu ganti pemilik", tennisReplay(h, 4, true).gm.join() === "0,1");
  }

  /* pertandingan berhenti begitu targetnya tercapai */
  {
    const h = semua(40, 0);
    const st = tennisReplay(h, 4, false);
    cek("laga berhenti di target, reli sisanya diabaikan", st.gm.join() === "4,0", st.gm.join());
  }

  /* aturan efektif */
  cek(
    "sistem tenis memaksa mode first dan target = jumlah game",
    (() => {
      const r = rulesOf({ scoreSys: "tennis", ptTarget: 21, gmTarget: 5, mexDeuce: false, mode: "sum" });
      return r.mode === "first" && r.target === 5;
    })(),
  );
  cek(
    "sistem poin memakai mode pilihan pengguna",
    (() => {
      const r = rulesOf({ scoreSys: "points", ptTarget: 32, gmTarget: 4, mexDeuce: false, mode: "sum" });
      return r.mode === "sum" && r.target === 32;
    })(),
  );
}

/* ========================================================================== */
console.log("\n7. Kesahihan skor");
{
  cek("sum: 13+8 sah untuk 21", validPair([13, 8], 21, "sum"));
  cek("sum: 13+9 tidak sah", !validPair([13, 9], 21, "sum"));
  cek("sum: seri mungkin kalau target genap", validPair([8, 8], 16, "sum"));
  cek("first: 21-15 sah", validPair([21, 15], 21, "first"));
  cek("first: 21-21 tidak sah", !validPair([21, 21], 21, "first"));
  cek("first: 20-15 tidak sah", !validPair([20, 15], 21, "first"));
  cek("belum terisi tidak pernah sah", !validPair([13, null], 21, "sum"));
}

/* ========================================================================== */
console.log("\n8. Klasemen");
{
  const slots: PairSlot[] = [
    [
      [1, 2],
      [3, 4],
    ],
    [
      [1, 3],
      [2, 4],
    ],
    [
      [1, 4],
      [2, 3],
    ],
  ];
  const matches = flattenPair(slots);
  /* 1 menang semua; 2 dan 3 sama-sama menang sekali */
  const scores: Score[] = [
    [21, 5],
    [12, 9],
    [21, 8],
    [10, 11],
    [21, 3],
    [15, 6],
  ];
  const t = computeTable(4, ["A", "B", "C", "D"], matches, scores);
  cek("A juara dengan 30 poin liga", t[0]!.name === "A" && t[0]!.lp === 30, JSON.stringify(t.map((x) => x.name + ":" + x.lp)));
  cek("jumlah main tiap tim = 3", t.every((x) => x.p === 3));
  const totalCetak = t.reduce((a, b) => a + b.tp, 0);
  const totalSkor = scores.reduce((a, s) => a + (s[0] as number) + (s[1] as number), 0);
  cek("total poin cetak = total skor yang masuk", totalCetak === totalSkor, totalCetak + " vs " + totalSkor);
  cek("selisih poin berjumlah nol", t.reduce((a, b) => a + b.sp, 0) === 0);

  /* Mexicano: yang lebih sedikit main harus diangkat saat poinnya sama */
  const sm = [
    { r: 0, c: 0, t1: [1, 2] as [number, number], t2: [3, 4] as [number, number] },
    { r: 1, c: 0, t1: [1, 2] as [number, number], t2: [3, 4] as [number, number] },
  ];
  const ss: Score[] = [
    [10, 10],
    [10, 10],
  ];
  const solo = soloTable({
    np: 5,
    pnames: ["P1", "P2", "P3", "P4", "P5"],
    matches: sm,
    scores: ss,
    mexOn: true,
    soloRank: "points",
  });
  /* P5 belum pernah main: 0 poin, jadi paling bawah walau porsi mainnya 0 */
  cek("Mexicano: poin cetak tetap yang utama", solo[0]!.tp === 20, JSON.stringify(solo.map((x) => x.name + ":" + x.tp + "/" + x.p)));
  cek("Mexicano: yang belum main ada di bawah karena poinnya nol", solo[solo.length - 1]!.id === 5);
}

/* ========================================================================== */
console.log("\n9. Bagan Individu — porsi main dan variasi pasangan");
for (const k of [
  { np: 8, courts: 2, rounds: 7 },
  { np: 12, courts: 3, rounds: 8 },
  { np: 9, courts: 2, rounds: 8 },
  { np: 24, courts: 4, rounds: 12 },
]) {
  const rnd = makeSolo(k.np, k.rounds, false, k.courts);
  const st = soloStats(rnd, k.np);
  const selisih = st.maxG - st.minG;
  cek(
    `${k.np} pemain · ${k.courts} lapangan · ${k.rounds} ronde`,
    rnd.length === k.rounds && selisih <= 1,
    `porsi main ${st.minG}-${st.maxG} · pasangan terpakai ${st.pairsMet}/${st.pairsTotal} · terulang ${st.repeat}`,
  );
}

console.log("\n" + (gagal ? gagal + " UJI GAGAL" : "semua uji lolos") + "\n");
process.exit(gagal ? 1 : 0);
