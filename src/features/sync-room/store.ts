"use client";

/* ============================================================================
   SINKRONISASI RUANG

   Satu pencatat menulis, sisanya menonton. Yang perlu diingat dari rancangan
   v5.0 dan dipertahankan di sini:

   1. Bagan dan papan skor berjalan dikirim TERPISAH. Papan skor berubah tiap
      reli; kalau ikut menaikkan versi bagan, penonton akan memuat ulang
      seluruh bagan puluhan kali per menit dan pencatat lain terganggu saat
      sedang mengetik.
   2. Kiriman bagan ditunda 1,5 detik. Mengetik skor menghasilkan banyak
      perubahan berturut-turut, dan tanpa penundaan tiap ketukan jadi satu
      permintaan.
   3. Kiriman papan skor dibatasi 3 detik per perangkat, dengan kiriman
      terakhir selalu menyusul - jadi angka terakhir pasti sampai.
   4. Pengambilan dilewati saat layar mati, tapi dijalankan segera begitu
      aplikasi kembali terlihat. HP biasanya dibuka sebentar lalu dikunci
      lagi; tanpa ini bagan baru bisa terlambat satu putaran penuh.
   ========================================================================== */

import { create } from "zustand";

import { KEY, LIVE_STALE, LIVE_THROTTLE } from "@/shared/config";
import { cleanRoom, lsJson, lsSet } from "@/shared/lib";
import type { Role } from "@/shared/types";
import { apiCall, type LiveWire, type RoomInfo } from "./api";

const PULL_MS = 8000;
const PUSH_MS = 1500;

export interface LiveEntry extends LiveWire {}

interface Saved {
  room: string;
  pin: string;
  role: Role;
  dev: string;
}

interface SyncState {
  room: string;
  pin: string;
  role: Role;
  dev: string;
  rev: number;
  /** berapa kali berturut-turut gagal; > 0 berarti bilah status memerah */
  fail: number;
  /** pesan terakhir untuk kartu Ruang */
  msg: string;
  /** true selama bagan dari server sedang diterapkan, supaya tidak dikirim balik */
  applying: boolean;

  /* papan skor berjalan */
  live: Record<string, LiveEntry>;
  /** jam server saat balasan terakhir diterima */
  srvNow: number;
  /** jam lokal saat balasan itu diterima */
  gotAt: number;

  boot(): void;
  setMsg(t: string): void;
  setDev(v: string): void;

  isViewer(): boolean;
  isScorer(): boolean;

  join(p: { room: string; pin: string; role: Role; rev: number }): void;
  off(): void;

  /** Menarik keadaan ruang sekali. */
  tick(): Promise<void>;
  /** Mengirim bagan, ditunda. */
  push(code: string): void;
  /** Mengirim bagan sekarang dan menang atas isi server (tombol Kirim bagan). */
  pushFull(code: string): Promise<RoomInfo>;
  /** Mengirim papan skor satu lapangan. data null berarti hapus entrinya. */
  pushLive(court: string, data: Omit<LiveWire, "by" | "at"> | null): void;
  /** Lapangan yang entri live-nya minta dihapus pada kiriman bagan berikutnya. */
  clearLive(court: string): void;

  /** Dipasang oleh komponen: bagaimana bagan dari server diterapkan. */
  onRemote: ((code: string, rev: number, by: string, at: string) => void) | null;
  setOnRemote(fn: SyncState["onRemote"]): void;
}

let pushTimer: number | null = null;
let pullTimer: number | null = null;
let livePending: Record<string, Omit<LiveWire, "by" | "at"> | null> = {};
let liveTimer: number | null = null;
let liveLast = 0;
const liveToClear: string[] = [];

export const useSync = create<SyncState>((set, get) => ({
  room: "",
  pin: "",
  role: "off",
  dev: "",
  rev: 0,
  fail: 0,
  msg: "",
  applying: false,
  live: {},
  srvNow: 0,
  gotAt: 0,
  onRemote: null,

  boot() {
    const s = lsJson<Saved | null>(KEY.sync, null);
    if (s && s.room) {
      set({
        room: cleanRoom(s.room),
        pin: String(s.pin || ""),
        role: s.role === "scorer" || s.role === "viewer" ? s.role : "off",
        dev: String(s.dev || ""),
      });
      startPull();
      void get().tick();
    } else if (s && s.dev) {
      set({ dev: String(s.dev) });
    }
  },

  setMsg(t) {
    set({ msg: t });
  },
  setDev(v) {
    set({ dev: v.slice(0, 40) });
    save();
  },

  isViewer() {
    return get().role === "viewer";
  },
  isScorer() {
    return get().role === "scorer";
  },

  join({ room, pin, role, rev }) {
    set({ room: cleanRoom(room), pin, role, rev, fail: 0 });
    save();
    startPull();
    void get().tick();
  },

  off() {
    stopPull();
    set({ room: "", pin: "", role: "off", rev: 0, fail: 0, live: {} });
    save();
  },

  async tick() {
    const s = get();
    if (!s.room || s.role === "off") return;
    const r = await apiCall("GET", "?room=" + encodeURIComponent(s.room));
    if (!r.ok) {
      set({ fail: get().fail + 1 });
      return;
    }
    set({ fail: 0 });
    if (!r.exists) {
      set({ msg: "__ruang-hilang__" });
      return;
    }
    /* Papan skor berjalan diserap terpisah dari bagan: ia berubah jauh lebih
       sering dan tidak boleh memicu muat ulang seluruh bagan. */
    if (r.live !== undefined) {
      set({
        live: (r.live || {}) as Record<string, LiveEntry>,
        srvNow: Date.parse(r.now || "") || Date.now(),
        gotAt: Date.now(),
      });
    }
    if (typeof r.rev === "number" && r.rev !== get().rev) {
      const fn = get().onRemote;
      set({ applying: true });
      try {
        if (fn && r.code) fn(r.code, r.rev, String(r.by || ""), String(r.updatedAt || ""));
      } finally {
        set({ applying: false, rev: r.rev });
      }
    }
  },

  push(code) {
    const s = get();
    if (s.role !== "scorer" || !s.room || s.applying) return;
    if (pushTimer) window.clearTimeout(pushTimer);
    pushTimer = window.setTimeout(async () => {
      const cur = get();
      const r = await apiCall("POST", "", {
        act: "write",
        room: cur.room,
        pin: cur.pin,
        by: cur.dev,
        code,
        clearLive: liveToClear.splice(0),
      });
      if (r.ok && typeof r.rev === "number") set({ rev: r.rev, fail: 0 });
      else if (r.error === "kunci-salah") set({ msg: "__kunci-salah__", fail: 9 });
      else set({ fail: get().fail + 1 });
    }, PUSH_MS);
  },

  async pushFull(code) {
    const s = get();
    if (!s.room) return { ok: false, error: "room-kosong" };
    const r = await apiCall("POST", "", {
      act: "write",
      room: s.room,
      pin: s.pin,
      by: s.dev,
      code,
      full: true,
      clearLive: liveToClear.splice(0),
    });
    if (r.ok && typeof r.rev === "number") set({ rev: r.rev, fail: 0 });
    return r;
  },

  pushLive(court, data) {
    const s = get();
    if (s.role !== "scorer" || !s.room) return;
    livePending[court] = data;
    const flush = async () => {
      liveLast = Date.now();
      liveTimer = null;
      const batch = livePending;
      livePending = {};
      const cur = get();
      for (const c of Object.keys(batch)) {
        await apiCall("POST", "", {
          act: "live",
          room: cur.room,
          pin: cur.pin,
          by: cur.dev,
          court: c,
          data: batch[c],
        });
      }
    };
    const since = Date.now() - liveLast;
    if (since >= LIVE_THROTTLE) {
      void flush();
    } else if (!liveTimer) {
      /* Kiriman terakhir selalu menyusul, jadi angka final pasti sampai. */
      liveTimer = window.setTimeout(flush, LIVE_THROTTLE - since);
    }
  },

  clearLive(court) {
    if (liveToClear.indexOf(court) < 0) liveToClear.push(court);
    /* Entri lokalnya ikut dibuang supaya layar Live tidak menahan angka lama
       sampai putaran pengambilan berikutnya. */
    const live = { ...get().live };
    delete live[court];
    set({ live });
  },

  setOnRemote(fn) {
    set({ onRemote: fn });
  },
}));

function save(): void {
  const s = useSync.getState();
  lsSet(
    KEY.sync,
    JSON.stringify({ room: s.room, pin: s.pin, role: s.role, dev: s.dev } satisfies Saved),
  );
}

function startPull(): void {
  stopPull();
  if (typeof window === "undefined") return;
  pullTimer = window.setInterval(() => {
    /* Layar mati = tidak ada yang melihat. Melewatinya menghemat baterai dan
       kuota, dan visibilitychange di bawah mengejar ketertinggalannya. */
    if (document.hidden) return;
    void useSync.getState().tick();
  }, PULL_MS);
}

function stopPull(): void {
  if (pullTimer) window.clearInterval(pullTimer);
  pullTimer = null;
}

/** Dipasang sekali dari komponen; aman dipanggil berulang. */
let wired = false;
export function wireSyncWake(): void {
  if (wired || typeof document === "undefined") return;
  wired = true;
  const wake = () => {
    const s = useSync.getState();
    if (s.room && s.role !== "off") void s.tick();
  };
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) wake();
  });
  window.addEventListener("focus", wake);
}

/* ---------------------------------------------------------------------------
   Umur entri papan skor berjalan.

   Dihitung dengan jam SERVER, bukan jam HP. Jam perangkat bisa meleset
   berjam-jam, dan kalau itu dipakai, entri yang baru saja masuk bisa dianggap
   basi (atau sebaliknya, entri mati bertahan di layar sepanjang acara).
   --------------------------------------------------------------------------- */
export function liveAge(at: string): number {
  const s = useSync.getState();
  const t = Date.parse(at || "");
  if (!t) return Infinity;
  const nowOnServer = s.srvNow + (Date.now() - s.gotAt);
  return nowOnServer - t;
}

export function liveFresh(e: LiveEntry): boolean {
  return liveAge(e.at) < LIVE_STALE;
}
