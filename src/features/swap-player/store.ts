"use client";

/* ============================================================================
   STATE DIALOG GANTI PEMAIN

   Dipakai untuk membuka/menutup sheet swap dan menyimpan konteks laganya.
   ========================================================================== */

import { create } from "zustand";

import type { Fmt } from "@/shared/types";

export type SwapMode = "one" | "abs";

interface SwapState {
  /** Dialog terbuka atau tidak */
  open: boolean;
  /** Format turnamen aktif */
  fmt: Fmt;
  /** Indeks laga yang di-klik (untuk mode "one") */
  matchIdx: number;
  /** ID pemain/tim yang mau diganti */
  pid: number;
  /** Tab aktif */
  mode: SwapMode;

  openSwap(fmt: Fmt, matchIdx: number, pid: number): void;
  setMode(m: SwapMode): void;
  close(): void;
}

export const useSwap = create<SwapState>((set) => ({
  open: false,
  fmt: "solo",
  matchIdx: -1,
  pid: 0,
  mode: "one",

  openSwap(fmt, matchIdx, pid) {
    set({ open: true, fmt, matchIdx, pid, mode: "one" });
  },
  setMode(m) {
    set({ mode: m });
  },
  close() {
    set({ open: false });
  },
}));
