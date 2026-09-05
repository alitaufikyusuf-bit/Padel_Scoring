"use client";

/* ============================================================================
   STORE DAFTAR TURNAMEN

   Dipisah dari store sesi (store.ts) dengan sengaja: yang ini soal RIWAYAT
   (banyak turnamen, tersimpan di perangkat), yang itu soal SATU turnamen yang
   sedang dibuka. Menggabungkannya berarti setiap perubahan skor ikut memicu
   penggambaran ulang seluruh daftar.

   Rekaman disimpan tiap kali bagan berubah - tidak ada tombol Simpan lagi.
   ========================================================================== */

import { create } from "zustand";

import { KEY } from "@/shared/config";
import { lsDel, lsGet, lsSet } from "@/shared/lib";
import type { Role } from "@/shared/types";
import {
  trGet,
  trId,
  trLoad,
  trMigrate,
  trSave,
  trTitleFromCode,
  type TrFilter,
  type TrRecord,
  type TrRole,
} from "./model";

interface TrListState {
  list: TrRecord[];
  /** id turnamen yang sedang dibuka; null berarti sedang di layar daftar */
  current: string | null;
  filter: TrFilter;
  ready: boolean;

  /** Mengembalikan rekaman yang terakhir dibuka, kalau masih ada. */
  boot(): TrRecord | null;
  setFilter(v: TrFilter): void;

  /** Membuat rekaman baru dan langsung membukanya. */
  create(p: {
    name: string;
    date: string;
    code: string;
  }): TrRecord;

  open(id: string): TrRecord | null;
  close(): void;
  remove(id: string): void;

  /** Menyegarkan rekaman yang terbuka. Dipanggil tiap kali bagan berubah. */
  touch(p: {
    code: string;
    name?: string;
    date?: string;
    room?: string;
    pin?: string;
    role?: Role;
    rev?: number;
  }): void;

  /** Menyimpan rekaman hasil Gabung lewat ruang. */
  adopt(p: {
    name: string;
    date: string;
    code: string;
    room: string;
    pin: string;
    role: TrRole;
    rev: number;
  }): TrRecord;

  get(id: string | null): TrRecord | null;
}

export const useTrList = create<TrListState>((set, get) => ({
  list: [],
  current: null,
  filter: "all",
  ready: false,

  boot() {
    if (get().ready) return trGet(get().list, get().current);
    let list = trLoad();
    /* Pemindahan dari bagan tersimpan versi lama, sekali saja. Data lamanya
       tidak dihapus, jadi kalau versi ini dibatalkan tidak ada yang hilang. */
    const moved = trMigrate(list);
    if (moved) {
      list = moved;
      trSave(list);
    }
    /* Turnamen yang terakhir dibuka dipulihkan, supaya memuat ulang halaman
       tidak membuang bagan yang sedang dipakai. Kalau rekamannya sudah tidak
       ada (dihapus di perangkat lain, atau penyimpanan dibersihkan sebagian),
       penunjuknya dibuang dan layar pembuka yang muncul. */
    const wantId = lsGet(KEY.current);
    const want = trGet(list, wantId);
    if (wantId && !want) lsDel(KEY.current);
    set({ list, ready: true, current: want ? want.id : null });
    return want;
  },

  setFilter(v) {
    set({ filter: v });
  },

  create({ name, date, code }) {
    const t = new Date().toISOString();
    const rec: TrRecord = {
      id: trId(),
      name,
      date,
      room: "",
      pin: "",
      /* Turnamen selalu mulai LOKAL. Pembuatnya otomatis pencatat, dan
         berbagi jadi langkah tersendiri di dalam turnamen. */
      role: "solo",
      code,
      rev: 0,
      at: t,
      opened: t,
    };
    const list = [rec, ...get().list];
    trSave(list);
    lsSet(KEY.current, rec.id);
    set({ list, current: rec.id });
    return rec;
  },

  open(id) {
    const rec = trGet(get().list, id);
    if (!rec) return null;
    const list = get().list.map((r) =>
      r.id === id ? { ...r, opened: new Date().toISOString() } : r,
    );
    trSave(list);
    lsSet(KEY.current, id);
    set({ list, current: id });
    return rec;
  },

  close() {
    lsDel(KEY.current);
    set({ current: null });
  },

  remove(id) {
    const list = get().list.filter((r) => r.id !== id);
    trSave(list);
    if (get().current === id) lsDel(KEY.current);
    set({ list, current: get().current === id ? null : get().current });
  },

  touch(p) {
    const id = get().current;
    if (!id) return;
    const old = trGet(get().list, id);
    if (!old) return;
    const next: TrRecord = {
      ...old,
      code: p.code,
      name: p.name || old.name,
      date: p.date || old.date,
      room: p.room !== undefined ? p.room : old.room,
      pin: p.pin !== undefined ? p.pin : old.pin,
      /* Peran "off" berarti belum tergabung ke ruang mana pun - itu bukan
         peran, jadi peran lama dipertahankan. */
      role: p.role && p.role !== "off" ? p.role : old.role,
      rev: p.rev ?? old.rev,
      at: new Date().toISOString(),
    };
    /* Tidak ada gunanya menulis ke penyimpanan kalau tidak ada yang berubah -
       syncCode dipanggil sangat sering, termasuk tiap ketukan papan skor. */
    if (
      old.code === next.code &&
      old.name === next.name &&
      old.date === next.date &&
      old.room === next.room &&
      old.pin === next.pin &&
      old.role === next.role &&
      old.rev === next.rev
    ) {
      return;
    }
    const list = get().list.map((r) => (r.id === id ? next : r));
    trSave(list);
    set({ list });
  },

  adopt(p) {
    /* Kalau ruang itu sudah pernah dibuka di perangkat ini, rekamannya
       dipakai ulang - bukan dibuat ganda. */
    const found = get().list.find((r) => r.room && r.room === p.room);
    const t = new Date().toISOString();
    if (found) {
      const next: TrRecord = { ...found, ...p, at: t, opened: t };
      const list = get().list.map((r) => (r.id === found.id ? next : r));
      trSave(list);
      lsSet(KEY.current, found.id);
      set({ list, current: found.id });
      return next;
    }
    const fromCode = trTitleFromCode(p.code);
    const rec: TrRecord = {
      id: trId(),
      name: p.name || fromCode.name || "Turnamen",
      date: p.date || fromCode.date,
      room: p.room,
      pin: p.pin,
      role: p.role,
      code: p.code,
      rev: p.rev,
      at: t,
      opened: t,
    };
    const list = [rec, ...get().list];
    trSave(list);
    lsSet(KEY.current, rec.id);
    set({ list, current: rec.id });
    return rec;
  },

  get(id) {
    return trGet(get().list, id ?? get().current);
  },
}));
