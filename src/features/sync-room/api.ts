"use client";

/* ============================================================================
   PEMANGGIL API RUANG

   Di versi Netlify, dua jalur dicoba berurutan (/api/bagan lalu
   /.netlify/functions/bagan) karena redirect Netlify tidak selalu terpasang.
   Di Vercel jalurnya cuma satu dan pasti ada, jadi daftar itu disederhanakan -
   tapi pembedaan galatnya DIPERTAHANKAN semuanya, karena tiap kunci galat
   menghasilkan pesan berbeda ke pengguna dan itu yang membuat masalah
   sinkronisasi bisa didiagnosis sendiri tanpa membuka konsol.
   ========================================================================== */

const BASE = "/api/bagan";

export interface ApiReply {
  ok: boolean;
  error?: string;
  __status?: number;
  [k: string]: unknown;
}

export interface RoomInfo extends ApiReply {
  exists?: boolean;
  room?: string;
  rev?: number;
  updatedAt?: string;
  by?: string;
  locked?: boolean;
  code?: string;
  live?: Record<string, LiveWire> | null;
  liveRev?: number;
  now?: string;
  created?: boolean;
  deleted?: boolean;
}

export interface LiveWire {
  idx: number;
  kind: string;
  a: number;
  b: number;
  na: string;
  nb: string;
  by: string;
  at: string;
}

export async function apiCall(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<RoomInfo> {
  const opt: RequestInit = { method, headers: { accept: "application/json" }, cache: "no-store" };
  if (body) {
    opt.headers = { ...opt.headers, "content-type": "application/json" };
    opt.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(BASE + (path || ""), opt);

    /* Situs yang masih dilindungi kata sandi membalas 401/403 berisi halaman
       login HTML, bukan JSON. Dibedakan supaya pesannya menyebut sebab yang
       benar, bukan "server bermasalah". */
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "situs-terkunci", __status: res.status };
    }
    /* 404 di sini berarti route handler-nya memang tidak terpasang - biasanya
       karena yang ter-deploy hanya halaman statisnya. */
    if (res.status === 404) {
      return { ok: false, error: "fungsi-tidak-ada", __status: 404 };
    }
    try {
      const j = (await res.json()) as RoomInfo;
      j.__status = res.status;
      return j;
    } catch {
      return {
        ok: false,
        error: res.ok ? "balasan-tidak-valid" : "server-bermasalah",
        __status: res.status,
      };
    }
  } catch {
    return { ok: false, error: "offline", __status: 0 };
  }
}

/** Pesan galat dalam bahasa manusia. Kuncinya sama dengan sisi server. */
export function syErrText(r: ApiReply, tx: (s: string) => string): string {
  switch (r.error) {
    case "situs-terkunci":
      return tx(
        "Situs ini masih terkunci di pengaturan hosting, jadi perangkat lain tidak bisa membacanya. Buka akses publik untuk situs ini, lalu coba lagi.",
      );
    case "fungsi-tidak-ada":
      return tx(
        "Fungsi sinkronisasi tidak ada di server. Pastikan seluruh isi paket ter-deploy, bukan cuma halaman depannya.",
      );
    case "offline":
      return tx("Tidak ada koneksi ke server. Bagan tetap aman di perangkat ini.");
    case "ruang-tidak-ada":
      return tx("Ruang ini belum ada.");
    case "sudah-ada":
      return tx("Kode ruang itu sudah dipakai. Pilih kode lain.");
    case "kunci-salah":
      return tx("Kunci pencatat salah.");
    case "kode-tidak-valid":
      return tx("Kode bagannya tidak valid atau terlalu panjang.");
    case "room-kosong":
      return tx("Isi dulu kode ruangnya, misalnya MN-PADEL-17AGT.");
    case "balasan-tidak-valid":
    case "server-bermasalah":
    default:
      return tx("Server membalas tidak seperti seharusnya. Coba lagi sebentar.");
  }
}
