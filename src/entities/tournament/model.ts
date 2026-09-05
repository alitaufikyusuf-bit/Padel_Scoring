/* ============================================================================
   REKAMAN TURNAMEN — layar pembuka

   Menggantikan gerbang lama yang menanyakan peran dan kode ruang sebelum apa
   pun. Tiga perubahan mendasar yang dibawa dari v5.0:

     1. Yang ditanya pertama adalah TURNAMEN, bukan peran.
     2. Peran disimpan PER TURNAMEN, bukan satu nilai global. Kalau Kamis lalu
        Anda mencatat dan Kamis ini menonton, keduanya diingat terpisah.
     3. Turnamen dibuat LOKAL dulu. Berbagi jadi langkah tersendiri di dalam
        turnamen, sehingga "tanpa sinkronisasi" tidak perlu ditanyakan lagi.

   Batasan yang disengaja: tidak ada akun, jadi riwayat hanya ada di perangkat
   masing-masing. Kalau HP pencatat rusak, daftarnya hilang - tapi bagannya
   sendiri masih aman di ruang dan bisa dipanggil kembali lewat Gabung.
   ========================================================================== */

import { KEY } from "@/shared/config";
import { lsJson, lsSet, shortId } from "@/shared/lib";
import type { Role } from "@/shared/types";

/** Peran "solo" berarti turnamen lokal yang belum pernah dibagikan. */
export type TrRole = Role | "solo";

export interface TrRecord {
  id: string;
  name: string;
  date: string;
  /** kode ruang; kosong berarti belum dibagikan */
  room: string;
  pin: string;
  role: TrRole;
  /** kode bagan v9 */
  code: string;
  /** versi ruang yang terakhir diketahui */
  rev: number;
  /** terakhir diubah */
  at: string;
  /** terakhir dibuka */
  opened: string;
}

/** Paling banyak 60 rekaman disimpan - selebihnya yang tertua dibuang. */
const MAX_RECORDS = 60;

export function trId(): string {
  return shortId("t");
}

export function trLoad(): TrRecord[] {
  const a = lsJson<unknown>(KEY.tournaments, null);
  return Array.isArray(a) ? (a as TrRecord[]) : [];
}

export function trSave(list: readonly TrRecord[]): boolean {
  return lsSet(KEY.tournaments, JSON.stringify(list.slice(0, MAX_RECORDS)));
}

export function trGet(list: readonly TrRecord[], id: string | null): TrRecord | null {
  if (!id) return null;
  for (const r of list) if (r.id === id) return r;
  return null;
}

/* ---------------------------------------------------------------------------
   Turunan dari kode bagan. Sengaja dibaca langsung dari string kode, bukan
   dengan memuat seluruh bagannya: daftar turnamen bisa berisi 60 baris, dan
   memuat 60 bagan hanya untuk menghitung progres itu pemborosan.
   --------------------------------------------------------------------------- */

/** Selesai kalau semua laga sudah punya skor.

    Untuk Mexicano, ronde yang sudah dibuat memang selalu terisi penuh sebelum
    ronde berikutnya bisa dibuat - jadi ia baru dianggap selesai kalau target
    rondenya tercapai juga. Tanpa syarat itu, Mexicano akan tampak "selesai"
    tiap kali satu ronde tuntas. */
export function trDone(rec: Pick<TrRecord, "code">): boolean {
  const p = String(rec.code || "").split(";;");
  if (p.length < 14) return false;
  const sc = (p[12] || "").split(",").filter((x) => x !== "");
  if (!sc.length) return false;
  const isiSemua = sc.every((x) => {
    const q = x.split("-");
    return q.length === 2 && /\d/.test(q[0] ?? "") && /\d/.test(q[1] ?? "");
  });
  if (!isiSemua) return false;
  if (p[14] === "1") {
    const target = parseInt(p[8] ?? "", 10) || 0;
    const ronde = (p[11] || "").split(",").filter((x) => x !== "").length;
    if (target && ronde < target) return false;
  }
  return true;
}

export interface TrProgress {
  isi: number;
  total: number;
}

export function trProgress(rec: Pick<TrRecord, "code">): TrProgress {
  const p = String(rec.code || "").split(";;");
  const sc = (p[12] || "").split(",").filter((x) => x !== "");
  const isi = sc.filter((x) => {
    const q = x.split("-");
    return q.length === 2 && q[0] !== "" && q[1] !== "";
  }).length;
  return { isi, total: sc.length };
}

/** Nama format untuk ditampilkan di baris daftar. Mexicano menang atas "solo". */
export function trFmtKey(rec: Pick<TrRecord, "code">): "mexicano" | "americano" | "pair" {
  const p = String(rec.code || "").split(";;");
  if (p[14] === "1") return "mexicano";
  return p[1] === "solo" ? "americano" : "pair";
}

/** Judul acara yang tertanam di kode, dipakai saat rekamannya belum bernama. */
export function trTitleFromCode(code: string): { name: string; date: string } {
  const head = String(code || "").split(";;");
  const ev = (head[6] || "").split("~");
  let name = "";
  let date = "";
  try {
    name = decodeURIComponent(ev[0] || "");
    date = decodeURIComponent(ev[1] || "");
  } catch {
    /* kode rusak: biarkan kosong, pemanggil sudah punya nilai bawaan */
  }
  return { name, date };
}

/* ---------------------------------------------------------------------------
   Pemindahan data dari versi vanilla.

   Bagan tersimpan lama (yang dulu harus disimpan manual di Atur -> Simpan)
   diangkat jadi turnamen, sekali saja. Datanya yang lama TIDAK dihapus, jadi
   kalau versi ini dibatalkan tidak ada yang hilang.
   --------------------------------------------------------------------------- */

interface LegacySlot {
  name?: string;
  code?: string;
  at?: string;
}

export function trMigrate(existing: readonly TrRecord[]): TrRecord[] | null {
  if (existing.length) return null;
  const legacy = lsJson<LegacySlot[]>(KEY.db, []);
  if (!Array.isArray(legacy) || !legacy.length) return null;
  const out: TrRecord[] = [];
  const now = new Date().toISOString();
  for (const r of legacy) {
    if (!r || !r.code) continue;
    const { name, date } = trTitleFromCode(r.code);
    out.push({
      id: trId(),
      name: r.name || name || "Turnamen",
      date,
      room: "",
      pin: "",
      role: "solo",
      code: r.code,
      rev: 0,
      at: r.at || now,
      opened: r.at || now,
    });
  }
  return out.length ? out : null;
}

/* ---------------------------------------------------------------------------
   Penyaringan dan pengurutan daftar.
   --------------------------------------------------------------------------- */

export type TrFilter = "all" | "active" | "past";

export function trFilterList(
  list: readonly TrRecord[],
  mode: TrFilter,
): TrRecord[] {
  const arr = list.slice();
  /* yang terakhir disentuh di atas */
  arr.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  if (mode === "active") return arr.filter((r) => !trDone(r));
  if (mode === "past") return arr.filter((r) => trDone(r));
  return arr;
}

/** Turnamen yang paling pantas ditawarkan di baris "Lanjutkan". */
export function trResume(list: readonly TrRecord[]): TrRecord | null {
  const arr = trFilterList(list, "all");
  for (const r of arr) if (!trDone(r)) return r;
  return arr[0] ?? null;
}
