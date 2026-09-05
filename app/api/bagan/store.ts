/* ============================================================================
   PENYIMPANAN RUANG

   Versi Netlify memakai Netlify Blobs. Di Vercel itu tidak ada, jadi
   penyimpanannya dibuat berlapis dan dipilih dari variabel lingkungan:

     1. Vercel KV / Upstash Redis lewat REST  - kalau KV_REST_API_URL dan
        KV_REST_API_TOKEN tersedia. Dipanggil dengan fetch biasa, jadi tidak
        perlu SDK tambahan dan tidak menambah berat bundel.
     2. Memori proses - hanya untuk `next dev` di satu mesin.

   Lapisan memori SENGAJA tidak dipakai di produksi: setiap fungsi serverless
   Vercel punya prosesnya sendiri dan bisa dimatikan kapan saja, jadi ruang
   yang disimpan di memori akan tampak hilang secara acak. Karena itu ada
   peringatan tegas kalau KV belum disetel saat berjalan di Vercel.
   ========================================================================== */

export interface LiveEntry {
  idx: number;
  kind: string;
  a: number;
  b: number;
  na: string;
  nb: string;
  by: string;
  at: string;
}

export interface RoomRec {
  rev: number;
  code: string;
  pin: string;
  by: string;
  updatedAt: string;
  createdAt: string;
  live?: Record<string, LiveEntry>;
  liveRev?: number;
}

export interface RoomStore {
  kind: "kv" | "memory";
  get(room: string): Promise<RoomRec | null>;
  set(room: string, rec: RoomRec): Promise<void>;
  del(room: string): Promise<void>;
}

/* ------------------------------------------------------------------- KV --- */

const KV_URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.STORAGE_REST_API_URL ||
  process.env.STORAGE_REDIS_REST_URL ||
  "";
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.STORAGE_REST_API_TOKEN ||
  process.env.STORAGE_REDIS_REST_TOKEN ||
  "";

const PREFIX = "mnpadel:bagan:";

async function kvCmd(cmd: unknown[]): Promise<unknown> {
  const res = await fetch(KV_URL, {
    method: "POST",
    headers: {
      authorization: "Bearer " + KV_TOKEN,
      "content-type": "application/json",
    },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("kv " + res.status);
  const j = (await res.json()) as { result?: unknown; error?: string };
  if (j.error) throw new Error("kv " + j.error);
  return j.result ?? null;
}

const kvStore: RoomStore = {
  kind: "kv",
  async get(room) {
    const r = await kvCmd(["GET", PREFIX + room]);
    if (typeof r !== "string" || !r) return null;
    try {
      return JSON.parse(r) as RoomRec;
    } catch {
      return null;
    }
  },
  async set(room, rec) {
    await kvCmd(["SET", PREFIX + room, JSON.stringify(rec)]);
  },
  async del(room) {
    await kvCmd(["DEL", PREFIX + room]);
  },
};

/* --------------------------------------------------------------- memori --- */

/* globalThis dipakai supaya isinya bertahan melewati hot reload `next dev`;
   tanpa itu setiap penyimpanan berkas akan mengosongkan seluruh ruang uji. */
const g = globalThis as unknown as { __mnpadelRooms?: Map<string, RoomRec> };
if (!g.__mnpadelRooms) g.__mnpadelRooms = new Map();
const mem = g.__mnpadelRooms;

const memStore: RoomStore = {
  kind: "memory",
  async get(room) {
    return mem.get(room) ?? null;
  },
  async set(room, rec) {
    mem.set(room, rec);
  },
  async del(room) {
    mem.delete(room);
  },
};

export function getStore(): RoomStore {
  return KV_URL && KV_TOKEN ? kvStore : memStore;
}

/** Benar kalau penyimpanan yang dipakai tidak layak produksi. */
export function storeIsEphemeral(): boolean {
  return getStore().kind === "memory";
}
