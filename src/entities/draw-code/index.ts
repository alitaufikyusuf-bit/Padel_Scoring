/* ============================================================================
   KODE BAGAN — versi v9

   Kontrak paling sensitif di aplikasi ini: kode ini tersimpan di perangkat
   orang, dikirim lewat tautan, dan dipertukarkan antar HP melalui ruang. Salah
   satu ruas saja bergeser, seluruh bagan yang sudah ada jadi salah baca.

   Susunan v9, 20 ruas dipisah ";;":
      0  "v9"
      1  fmt          "pair" | "solo"
      2  mode         "sum" | "first"
      3  courts
      4  startMin
      5  slotMin
      6  acara        judul~tanggal, masing-masing encodeURIComponent
      7  jumlah       tim (pair) atau pemain (solo)
      8  ronde        solo saja, 0 untuk pair
      9  bendera      pair: [knockout][juara3]   solo: [peringkat]
     10  nama         dipisah "|"
     11  bagan        pair: "1x2+3x4,..."   solo: "1.2v3.4+...,..."
     12  skor         "11-10,9-12,-,..."
     13  skorKO       pair saja
     --- ditambahkan di v9 ---
     14  mexOn        "1" | "0"
     15  scoreSys     "t" | "p"
     16  ptTarget
     17  gmTarget
     18  mexDeuce     "1" | "0"
     19  tidak hadir  "3.7.9"

   Ruas 0-13 sengaja identik dengan v8, sehingga menaikkan kode v8 cukup dengan
   menempelkan nilai bawaan di belakang.
   ========================================================================== */

import { MAX_C, MAX_P, MAX_T, MIN_P, MIN_T } from "@/shared/config";
import { keyOf } from "@/shared/lib";
import type {
  Fmt,
  PairSlot,
  Score,
  ScoreMode,
  ScoreSys,
  SoloRound,
  SoloRank,
} from "@/shared/types";

/** Nilai bawaan ruas v9 untuk kode lama: bukan Mexicano, sistem poin, target 21. */
const V9_TAIL = ["0", "p", "21", "4", "0", ""];

export function encScores(arr: readonly Score[]): string {
  return arr
    .map((s) => (s[0] === null ? "" : s[0]) + "-" + (s[1] === null ? "" : s[1]))
    .join(",");
}

function decScores(raw: string, count: number): Score[] {
  const parts = raw.split(",");
  const out: Score[] = [];
  for (let k = 0; k < count; k++) {
    const pr = (parts[k] || "-").split("-");
    const x = parseInt(pr[0] ?? "", 10);
    const y = parseInt(pr[1] ?? "", 10);
    out.push([Number.isNaN(x) ? null : x, Number.isNaN(y) ? null : y]);
  }
  return out;
}

/* ---------------------------------------------------------------- encode --- */

export interface EncodeInput {
  fmt: Fmt;
  mode: ScoreMode;
  courts: number;
  startMin: number;
  slotMin: number;
  evTitle: string;
  evDate: string;
  /* pair */
  n: number;
  names: readonly string[];
  slots: readonly PairSlot[];
  scores: readonly Score[];
  koScores: readonly Score[];
  koOn: boolean;
  thirdOn: boolean;
  /* solo */
  np: number;
  rounds: number;
  pnames: readonly string[];
  rnd: readonly SoloRound[];
  sscores: readonly Score[];
  soloRank: SoloRank;
  /* v9 */
  mexOn: boolean;
  scoreSys: ScoreSys;
  ptTarget: number;
  gmTarget: number;
  mexDeuce: boolean;
  mexOut: Record<number, boolean>;
}

export function encodeCode(s: EncodeInput): string {
  const head: (string | number)[] = [
    "v9",
    s.fmt,
    s.mode,
    s.courts,
    s.startMin,
    s.slotMin,
    encodeURIComponent(s.evTitle) + "~" + encodeURIComponent(s.evDate),
  ];
  let body: (string | number)[];
  if (s.fmt === "solo") {
    body = [
      s.np,
      s.rounds,
      s.soloRank === "wins" ? "1" : "0",
      s.pnames.slice(0, s.np).join("|"),
      s.rnd
        .map((ms) => ms.map((m) => m[0].join(".") + "v" + m[1].join(".")).join("+"))
        .join(","),
      encScores(s.sscores),
      "",
    ];
  } else {
    body = [
      s.n,
      0,
      (s.koOn ? 1 : 0) + "" + (s.thirdOn ? 1 : 0),
      s.names.slice(0, s.n).join("|"),
      s.slots.map((sl) => sl.map((m) => m[0] + "x" + m[1]).join("+")).join(","),
      encScores(s.scores),
      encScores(s.koScores),
    ];
  }
  const out: string[] = [];
  for (const q of Object.keys(s.mexOut)) if (s.mexOut[Number(q)]) out.push(q);
  const tail: (string | number)[] = [
    s.mexOn ? "1" : "0",
    s.scoreSys === "tennis" ? "t" : "p",
    s.ptTarget,
    s.gmTarget,
    s.mexDeuce ? "1" : "0",
    out.join("."),
  ];
  return head.concat(body).concat(tail).join(";;");
}

/* --------------------------------------------------------------- upgrade --- */

/**
 * Menaikkan kode lama ke v9. String kosong berarti tidak dikenali.
 *
 * v7 (aplikasi paling lama, hanya Fix Partner, 12 ruas):
 *   v7;;mode;;tim;;lapangan;;mulai;;durasi;;flagKO;;acara;;nama;;bagan;;skor;;skorKO
 * v8 (14 ruas) sama dengan v9 tanpa enam ruas terakhir.
 */
export function upgradeCode(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (s.indexOf("v9;;") === 0) return s;
  if (s.indexOf("v8;;") === 0) {
    const w = s.split(";;");
    while (w.length < 14) w.push("");
    w[0] = "v9";
    return w.slice(0, 14).concat(V9_TAIL).join(";;");
  }
  if (s.indexOf("v7;;") === 0) {
    const q = s.split(";;");
    if (q.length < 11) return "";
    return [
      "v9",
      "pair",
      q[1] || "sum",
      q[3] || "1",
      q[4] || "480",
      q[5] || "15",
      q[7] || "",
      q[2] || "0",
      "0",
      q[6] || "00",
      q[8] || "",
      q[9] || "",
      q[10] || "",
      q[11] || "",
    ]
      .concat(V9_TAIL)
      .join(";;");
  }
  return "";
}

/* ---------------------------------------------------------------- decode --- */

/** Kunci pesan galat. Diterjemahkan di lapisan tampilan, bukan di sini. */
export type DecodeError =
  | "terlalu-baru"
  | "tidak-dikenali"
  | "terpotong"
  | "lapangan"
  | "jumlah-pemain"
  | "jumlah-tim"
  | "bagan-solo"
  | "bagan-pair";

export interface DecodedCommon {
  fmt: Fmt;
  mode: ScoreMode;
  courts: number;
  startMin: number;
  slotMin: number;
  evTitle: string;
  evDate: string;
  mexOn: boolean;
  scoreSys: ScoreSys;
  ptTarget: number;
  gmTarget: number;
  mexDeuce: boolean;
  mexOut: Record<number, boolean>;
  /** kode ditulis ulang ke v9 - simpan ini, bukan masukan aslinya */
  normalized: string;
  /** masukan tadinya v7, jadi pengguna perlu diberi tahu */
  wasV7: boolean;
}

export interface DecodedPair extends DecodedCommon {
  fmt: "pair";
  n: number;
  names: string[];
  slots: PairSlot[];
  scores: Score[];
  koScores: Score[];
  koOn: boolean;
  thirdOn: boolean;
}

export interface DecodedSolo extends DecodedCommon {
  fmt: "solo";
  np: number;
  rounds: number;
  pnames: string[];
  rnd: SoloRound[];
  sscores: Score[];
  soloRank: SoloRank;
}

export type Decoded = DecodedPair | DecodedSolo;
export type DecodeResult = { ok: true; data: Decoded } | { ok: false; error: DecodeError };

export function decodeCode(raw: string): DecodeResult {
  const src = String(raw ?? "").trim();
  const up = upgradeCode(src);
  if (!up) {
    return {
      ok: false,
      error: src.indexOf("v") === 0 ? "terlalu-baru" : "tidak-dikenali",
    };
  }
  const p = up.split(";;");
  if (p.length < 13) return { ok: false, error: "terpotong" };
  const wasV7 = src.indexOf("v7;;") === 0;

  const f: Fmt = p[1] === "solo" ? "solo" : "pair";
  const md: ScoreMode = p[2] === "sum" ? "sum" : "first";
  const cts = parseInt(p[3] ?? "", 10);
  const sm = parseInt(p[4] ?? "", 10);
  const dur = parseInt(p[5] ?? "", 10);
  const ev = (p[6] || "").split("~");
  const cnt = parseInt(p[7] ?? "", 10);
  const rds = parseInt(p[8] ?? "", 10);
  const flag = String(p[9] || "00");
  const nmRaw = (p[10] || "").split("|");
  const groups = p[11] ? p[11].split(",") : [];
  const scRaw = p[12] || "";
  const ksRaw = p[13] || "";

  /* ruas v9 */
  const mexF = p[14] === "1";
  const sysF: ScoreSys = p[15] === "t" ? "tennis" : "points";
  let ptF = parseInt(p[16] ?? "", 10);
  if (!(ptF >= 6 && ptF <= 99)) ptF = 21;
  let gmF = parseInt(p[17] ?? "", 10);
  if (!(gmF >= 1 && gmF <= 9)) gmF = 4;
  const duF = p[18] === "1";
  const outF = String(p[19] || "")
    .split(".")
    .filter((x) => x !== "");

  if (!(cts >= 1 && cts <= MAX_C)) return { ok: false, error: "lapangan" };

  const mexOut: Record<number, boolean> = {};
  for (const x of outF) {
    const v = parseInt(x, 10);
    if (v >= 1) mexOut[v] = true;
  }

  const common: DecodedCommon = {
    fmt: f,
    mode: md,
    courts: cts,
    startMin: Number.isNaN(sm) ? 8 * 60 : sm,
    slotMin: Number.isNaN(dur) || dur < 5 ? 15 : dur,
    evTitle: decodeURIComponent(ev[0] || "") || "Turnamen Padel Kemerdekaan",
    evDate: decodeURIComponent(ev[1] || ""),
    mexOn: mexF && f === "solo",
    scoreSys: sysF,
    ptTarget: ptF,
    gmTarget: gmF,
    mexDeuce: duF,
    mexOut,
    normalized: up,
    wasV7,
  };

  if (f === "solo") {
    if (!(cnt >= MIN_P && cnt <= MAX_P)) return { ok: false, error: "jumlah-pemain" };
    const rnds: SoloRound[] = [];
    let bad = false;
    let tot = 0;
    for (const g of groups) {
      const ms: SoloRound = [];
      const used: Record<number, 1> = {};
      if (g) {
        for (const mm of g.split("+")) {
          const sides = mm.split("v");
          if (sides.length !== 2) {
            bad = true;
            continue;
          }
          const t1 = sides[0]!.split(".").map(Number);
          const t2 = sides[1]!.split(".").map(Number);
          if (t1.length !== 2 || t2.length !== 2) {
            bad = true;
            continue;
          }
          for (const x of t1.concat(t2)) {
            if (!(x >= 1 && x <= cnt) || used[x]) bad = true;
            used[x] = 1;
          }
          ms.push([
            [t1[0]!, t1[1]!],
            [t2[0]!, t2[1]!],
          ]);
          tot++;
        }
      }
      rnds.push(ms);
    }
    if (bad || !rnds.length) return { ok: false, error: "bagan-solo" };

    const pnames: string[] = [];
    for (let k = 0; k < cnt; k++) pnames.push(nmRaw[k] || "Pemain " + (k + 1));

    return {
      ok: true,
      data: {
        ...common,
        fmt: "solo",
        np: cnt,
        rounds: Number.isNaN(rds) || rds < 1 ? rnds.length : rds,
        pnames,
        rnd: rnds,
        sscores: decScores(scRaw, tot),
        soloRank: flag.charAt(0) === "1" ? "wins" : "points",
      },
    };
  }

  if (!(cnt >= MIN_T && cnt <= MAX_T)) return { ok: false, error: "jumlah-tim" };
  const slots: PairSlot[] = [];
  const seen: Record<string, 1> = {};
  let total = 0;
  let bad2 = false;
  for (const g of groups) {
    const sl: PairSlot = [];
    const usedHere: Record<number, 1> = {};
    if (g) {
      for (const pr of g.split("+")) {
        const q = pr.split("x");
        const a = parseInt(q[0] ?? "", 10);
        const b = parseInt(q[1] ?? "", 10);
        if (!(a >= 1 && a <= cnt) || !(b >= 1 && b <= cnt) || a === b) {
          bad2 = true;
          continue;
        }
        if (usedHere[a] || usedHere[b]) {
          bad2 = true;
          continue;
        }
        const kk = keyOf(a, b);
        if (seen[kk]) {
          bad2 = true;
          continue;
        }
        seen[kk] = 1;
        usedHere[a] = 1;
        usedHere[b] = 1;
        sl.push([a, b]);
        total++;
      }
    }
    slots.push(sl);
  }
  /* Fix Partner wajib round robin lengkap - kalau tidak, klasemennya tidak
     berarti dan babak knockout mengunggulkan tim yang kebetulan main lebih
     banyak. */
  if (bad2 || total !== (cnt * (cnt - 1)) / 2) return { ok: false, error: "bagan-pair" };

  const names: string[] = [];
  for (let k = 0; k < cnt; k++) names.push(nmRaw[k] || "Tim " + (k + 1));

  return {
    ok: true,
    data: {
      ...common,
      fmt: "pair",
      n: cnt,
      names,
      slots,
      scores: decScores(scRaw, total),
      koScores: decScores(ksRaw, 4),
      koOn: flag.charAt(0) === "1",
      thirdOn: flag.charAt(1) === "1",
    },
  };
}

/** Ringkasan satu baris dari kode, tanpa memuatnya. Dipakai daftar turnamen. */
export function summarizeCode(code: string): {
  fmt: Fmt;
  count: number;
  matches: number;
  courts: number;
  ko: boolean;
  mexOn: boolean;
} | null {
  const up = upgradeCode(code);
  if (!up) return null;
  const p = up.split(";;");
  if (p.length < 13) return null;
  const fmt: Fmt = p[1] === "solo" ? "solo" : "pair";
  const cnt = parseInt(p[7] ?? "", 10) || 0;
  const cts = parseInt(p[3] ?? "", 10) || 0;
  const groups = p[11] ? p[11].split(",") : [];
  let matches = 0;
  for (const g of groups) if (g) matches += g.split("+").length;
  return {
    fmt,
    count: cnt,
    matches,
    courts: cts,
    ko: String(p[9] || "").charAt(0) === "1" && fmt === "pair",
    mexOn: p[14] === "1" && fmt === "solo",
  };
}
