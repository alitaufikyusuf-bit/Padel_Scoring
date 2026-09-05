/* ============================================================================
   /api/bagan — sinkronisasi bagan antar perangkat

   Port satu-per-satu dari netlify/functions/bagan.mjs v5.0. Bentuk permintaan
   dan balasannya SAMA PERSIS, termasuk kunci galat dalam bahasa Indonesia
   ("ruang-tidak-ada", "kunci-salah", ...) karena sisi klien mencocokkannya.
   Satu-satunya yang berubah adalah lapisan penyimpanan; lihat store.ts.

   Aturan penggabungan skor di bawah adalah bagian tersulit dan paling penting
   dari berkas ini - penjelasannya ditulis panjang di tempatnya.
   ========================================================================== */

import { getStore, type LiveEntry, type RoomRec } from "./store";

/* Node runtime, bukan Edge: fetch ke KV sama saja di keduanya, tapi Node
   memberi jejak galat yang jauh lebih mudah dibaca saat ada yang salah. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CODE = 3e5;

const HEADERS: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

const reply = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: HEADERS });

const cleanRoom = (v: unknown): string =>
  String(v ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

const now = (): string => new Date().toISOString();

export async function OPTIONS() {
  return reply({ ok: true });
}

export async function GET(req: Request) {
  const store = getStore();
  const room = cleanRoom(new URL(req.url).searchParams.get("room"));
  if (!room) return reply({ ok: false, error: "room-kosong" }, 400);
  const rec = await store.get(room);
  if (!rec) return reply({ ok: true, exists: false, room });
  return reply({
    ok: true,
    exists: true,
    room,
    rev: rec.rev,
    updatedAt: rec.updatedAt,
    by: rec.by || "",
    locked: !!rec.pin,
    code: rec.code,
    /* Papan skor yang sedang berjalan, satu entri per lapangan. Ikut di
       balasan yang sama supaya penonton tidak perlu permintaan tambahan. */
    live: rec.live || null,
    liveRev: rec.liveRev || 0,
    /* Jam server, dipakai klien untuk menilai umur entri live tanpa
       bergantung pada jam masing-masing HP yang bisa meleset. */
    now: now(),
  });
}

interface Body {
  room?: unknown;
  act?: unknown;
  pin?: unknown;
  newPin?: unknown;
  by?: unknown;
  code?: unknown;
  full?: unknown;
  court?: unknown;
  data?: unknown;
  clearLive?: unknown;
}

export async function POST(req: Request) {
  const store = getStore();
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return reply({ ok: false, error: "body-tidak-valid" }, 400);
  }

  const room = cleanRoom(body.room);
  if (!room) return reply({ ok: false, error: "room-kosong" }, 400);
  const act = String(body.act || "write");
  const pin = String(body.pin == null ? "" : body.pin);
  const by = String(body.by || "").slice(0, 40);
  const rec = await store.get(room);

  if (act === "create") {
    if (rec) return reply({ ok: false, error: "sudah-ada", rev: rec.rev }, 409);
    const code = String(body.code || "");
    if (!code || code.length > MAX_CODE)
      return reply({ ok: false, error: "kode-tidak-valid" }, 400);
    const t = now();
    const fresh: RoomRec = { rev: 1, code, pin, by, updatedAt: t, createdAt: t };
    await store.set(room, fresh);
    return reply({ ok: true, room, rev: 1, updatedAt: t, locked: !!pin, created: true });
  }

  if (!rec) return reply({ ok: false, error: "ruang-tidak-ada" }, 404);
  if (rec.pin && pin !== rec.pin) return reply({ ok: false, error: "kunci-salah" }, 403);

  if (act === "check") {
    return reply({
      ok: true,
      room,
      rev: rec.rev,
      updatedAt: rec.updatedAt,
      locked: !!rec.pin,
      code: rec.code,
    });
  }

  if (act === "setpin") {
    rec.pin = String(body.newPin == null ? "" : body.newPin);
    rec.rev = (rec.rev || 0) + 1;
    rec.updatedAt = now();
    await store.set(room, rec);
    return reply({ ok: true, room, rev: rec.rev, locked: !!rec.pin });
  }

  /* Papan skor berjalan. Sengaja dipisah dari kode bagan: tiap pencatat hanya
     menyentuh slot lapangannya sendiri, jadi tiga pencatat di tiga lapangan
     tidak saling menimpa seperti kalau seluruh bagan yang dikirim.
     rev bagan TIDAK dinaikkan, supaya penonton tidak memuat ulang seluruh
     bagan tiap reli dan pencatat lain tidak terganggu saat sedang mengetik. */
  if (act === "live") {
    const court = String(body.court == null ? "" : body.court).slice(0, 8);
    if (!court) return reply({ ok: false, error: "lapangan-kosong" }, 400);
    const live: Record<string, LiveEntry> =
      rec.live && typeof rec.live === "object" ? rec.live : {};
    if (body.data === null || body.data === undefined) {
      delete live[court];
    } else {
      const d = (body.data || {}) as Record<string, unknown>;
      const a = Number(d.a);
      const b = Number(d.b);
      const idx = Number(d.idx);
      const okNum = (v: number) => Number.isFinite(v) && v >= 0 && v <= 99;
      if (!okNum(a) || !okNum(b) || !Number.isFinite(idx))
        return reply({ ok: false, error: "skor-tidak-valid" }, 400);
      live[court] = {
        idx,
        kind: String(d.kind || "league").slice(0, 8),
        a,
        b,
        na: String(d.na || "").slice(0, 60),
        nb: String(d.nb || "").slice(0, 60),
        by,
        at: now(),
      };
    }
    rec.live = live;
    rec.liveRev = (rec.liveRev || 0) + 1;
    await store.set(room, rec);
    return reply({ ok: true, room, rev: rec.rev, liveRev: rec.liveRev, now: now() });
  }

  if (act === "delete") {
    await store.del(room);
    return reply({ ok: true, room, deleted: true });
  }

  let code = String(body.code || "");
  if (!code || code.length > MAX_CODE)
    return reply({ ok: false, error: "kode-tidak-valid" }, 400);

  /* Dua pencatat di dua lapangan mengirim SELURUH kode bagan, masing-masing
     hanya tahu skor yang dilihatnya sendiri. Tanpa penggabungan, yang menulis
     terakhir menghapus skor lapangan lain. Aturannya: posisi yang KOSONG di
     kiriman tidak boleh menghapus skor yang sudah ada di server. Mengubah
     skor tetap bisa; yang tidak bisa cuma mengosongkannya - untuk itu ada
     tombol "Kirim bagan ini ke ruang" yang memakai full:true. */
  if (!body.full && rec.code) {
    const inp = code.split(";;");
    const old = rec.code.split(";;");

    /* Hanya kalau bentuk bagannya memang sama: versi, format, jumlah peserta,
       dan susunan pertandingan. Kalau bagannya diacak ulang, susunannya beda
       dan kiriman baru memang harus menang (skor sengaja dikosongkan).

       Di Mexicano susunan bagan BERTAMBAH tiap ronde, jadi menuntut
       susunannya identik akan mematikan penggabungan persis di saat ronde
       baru dibuat - dan tulisan pencatat lain ikut hilang. Susunan lama yang
       merupakan awalan dari susunan baru diperlakukan sama sahnya. */
    const samaAtauAwalan = (baru: string, lama: string): boolean => {
      if (baru === lama) return true;
      if (!lama) return true;
      return baru.startsWith(lama + ",");
    };
    const sameShape =
      inp.length === old.length &&
      inp.length >= 14 &&
      inp[0] === old[0] &&
      inp[1] === old[1] &&
      inp[7] === old[7] &&
      samaAtauAwalan(String(inp[11]), String(old[11]));

    if (sameShape) {
      /* Digabung sepanjang bagian yang sama; laga baru di belakang diambil apa
         adanya dari kiriman. */
      const mergeScores = (a: string | undefined, b: string | undefined): string => {
        if (!b) return a ?? "";
        const x = String(a ?? "").split(",");
        const y = String(b).split(",");
        const n = Math.min(x.length, y.length);
        for (let i = 0; i < n; i++) if (x[i] === "-" || x[i] === "") x[i] = y[i]!;
        return x.join(",");
      };
      inp[12] = mergeScores(inp[12], old[12]);
      inp[13] = mergeScores(inp[13], old[13]);
      const merged = inp.join(";;");
      if (merged.length <= MAX_CODE) code = merged;
    }
  }

  rec.code = code;
  rec.by = by;
  rec.rev = (rec.rev || 0) + 1;
  rec.updatedAt = now();

  /* Pertandingan yang skornya baru masuk ke bagan tidak lagi "sedang
     berjalan"; entri live-nya dibuang di sini supaya angka lama tidak
     menggantung di layar penonton kalau pencatat menutup aplikasi. */
  if (Array.isArray(body.clearLive) && rec.live) {
    for (const c of body.clearLive as unknown[]) delete rec.live[String(c)];
  }

  await store.set(room, rec);
  return reply({ ok: true, room, rev: rec.rev, updatedAt: rec.updatedAt, now: now() });
}
