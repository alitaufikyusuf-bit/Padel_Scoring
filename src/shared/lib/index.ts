/* ============================================================================
   Pembantu kecil yang dipakai lintas lapisan. Semuanya murni kecuali yang
   memang menyentuh localStorage, dan yang menyentuh penyimpanan dibuat aman
   dipanggil saat render di server (window belum ada).
   ========================================================================== */

/** Acak salinan array, Fisher-Yates. Tidak menyentuh array aslinya. */
export function shuffled<T>(a: readonly T[]): T[] {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = out[i]!;
    out[i] = out[j]!;
    out[j] = t;
  }
  return out;
}

export function pad2(x: number): string {
  return (x < 10 ? "0" : "") + x;
}

/** Menit sejak tengah malam -> "08:15". */
export function clock(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  return pad2(Math.floor(m / 60)) + ":" + pad2(m % 60);
}

/** Bilangan bulat dalam rentang, dengan nilai bawaan kalau bukan angka. */
export function clampInt(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, Math.trunc(n)));
}

/** 1..cnt sebagai array. */
export function range1(cnt: number): number[] {
  const a: number[] = [];
  for (let i = 1; i <= cnt; i++) a.push(i);
  return a;
}

/** Matriks (cnt+1)x(cnt+1) berisi nol. Indeks 0 tidak dipakai (peserta 1-based). */
export function zero2(cnt: number): number[][] {
  const m: number[][] = [];
  for (let i = 0; i <= cnt; i++) {
    const row: number[] = [];
    for (let j = 0; j <= cnt; j++) row.push(0);
    m.push(row);
  }
  return m;
}

/** Kunci pasangan yang tidak bergantung urutan: 3 vs 7 dan 7 vs 3 sama. */
export function keyOf(a: number, b: number): string {
  return Math.min(a, b) + "-" + Math.max(a, b);
}

/** Nama berkas yang aman di semua sistem. */
export function fileSafe(s: string): string {
  return (
    String(s)
      .replace(/[^\w\s.-]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "bagan"
  );
}

/** Nama ruang yang dinormalkan - harus sama dengan aturan di sisi server. */
export function cleanRoom(v: unknown): string {
  return String(v ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

/* ---------------------------------------------------------------------------
   Penyimpanan lokal. Dibungkus karena tiga hal bisa membuatnya melempar:
   jendela privat, penyimpanan penuh, dan render di server.
   --------------------------------------------------------------------------- */

export const storeOk = (): boolean => {
  try {
    if (typeof window === "undefined") return false;
    const k = "__mnp_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
};

export function lsGet(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function lsSet(key: string, val: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    window.localStorage.setItem(key, val);
    return true;
  } catch {
    return false;
  }
}

export function lsDel(key: string): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  } catch {
    /* diabaikan dengan sengaja */
  }
}

/** Baca JSON dari penyimpanan; kembalikan fallback kalau kosong atau rusak. */
export function lsJson<T>(key: string, fallback: T): T {
  const raw = lsGet(key);
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw) as T;
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

/** Waktu ISO -> "4 Sep 2026 21.15" ala Indonesia, aman kalau tanggalnya rusak. */
export function stamp(iso: string | undefined, lang: "id" | "en" = "en"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleString(lang === "en" ? "en-GB" : "id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

/** Id acak pendek untuk rekaman turnamen. */
export function shortId(prefix = "t"): string {
  return (
    prefix +
    Date.now().toString(36) +
    Math.floor(Math.random() * 1e4).toString(36)
  );
}
