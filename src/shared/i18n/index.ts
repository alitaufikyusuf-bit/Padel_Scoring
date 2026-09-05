"use client";

/* ============================================================================
   BAHASA (Indonesia / English) dan TEMA

   Dua mekanisme terjemahan hidup berdampingan, sama seperti versi vanilla:

     t(kunci)   - label antarmuka, kunci pendek, diperiksa typecheck
     tx("teks") - pesan yang disusun saat berjalan, teks Indonesia jadi
                  kuncinya sendiri

   Kenapa yang kedua tidak diseragamkan dijelaskan panjang di dynamic.ts.
   ========================================================================== */

import { create } from "zustand";

import { KEY } from "@/shared/config";
import { lsGet, lsSet } from "@/shared/lib";
import type { Lang, Theme } from "@/shared/types";
import { UI, type UiKey } from "./static";
import { EN_DYN } from "./dynamic";
import { EN_EXTRA } from "./extra";

export { UI };
export type { UiKey };

interface I18nState {
  lang: Lang;
  theme: Theme;
  /** true setelah pilihan tersimpan dibaca dari perangkat */
  ready: boolean;
  setLang(v: Lang): void;
  toggleLang(): void;
  setTheme(v: Theme): void;
  cycleTheme(): void;
  boot(): void;
}

/** Urutan tema saat tombolnya ditekan berulang. */
const THEME_CYCLE: Theme[] = ["auto", "light", "dark"];

function applyThemeAttr(v: Theme): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  /* "auto" berarti TIDAK menulis atribut sama sekali, sehingga
     prefers-color-scheme yang menentukan. Menulis data-theme="auto" akan
     mengalahkan media query dan justru mengunci tampilan. */
  if (v === "auto") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", v);
}

export const useI18n = create<I18nState>((set, get) => ({
  lang: "en",
  theme: "auto",
  ready: false,

  setLang(v) {
    set({ lang: v });
    lsSet(KEY.lang, v);
    if (typeof document !== "undefined") document.documentElement.setAttribute("lang", v);
  },
  toggleLang() {
    get().setLang(get().lang === "id" ? "en" : "id");
  },
  setTheme(v) {
    set({ theme: v });
    lsSet(KEY.theme, v);
    applyThemeAttr(v);
  },
  cycleTheme() {
    const i = THEME_CYCLE.indexOf(get().theme);
    get().setTheme(THEME_CYCLE[(i + 1) % THEME_CYCLE.length]!);
  },

  boot() {
    if (get().ready) return;
    const l = lsGet(KEY.lang);
    const t = lsGet(KEY.theme);
    const lang: Lang = l === "id" ? "id" : "en";
    const theme: Theme = t === "light" || t === "dark" ? t : "auto";
    set({ lang, theme, ready: true });
    applyThemeAttr(theme);
    if (typeof document !== "undefined") document.documentElement.setAttribute("lang", lang);
  },
}));

/* ---------------------------------------------------------------------------
   Fungsi terjemahan bebas-hook, untuk dipakai di luar komponen (mis. di dalam
   aksi store). Membaca bahasa langsung dari store.
   --------------------------------------------------------------------------- */

export function tKey(key: UiKey, lang?: Lang): string {
  const L = lang ?? useI18n.getState().lang;
  /* UI dideklarasikan "as const" supaya kuncinya diperiksa typecheck, dan
     akibatnya tiap entri punya tipe literalnya sendiri. Di sini yang
     dibutuhkan hanya bentuk umumnya. */
  const e = (UI as Record<string, { id: string; en: string }>)[key];
  if (!e) return String(key);
  return L === "en" ? e.en || e.id : e.id;
}

export function tText(idText: string, lang?: Lang): string {
  const L = lang ?? useI18n.getState().lang;
  if (L !== "en") return idText;
  /* Kamus hasil salinan diperiksa lebih dulu, lalu yang baru di versi ini -
     supaya string asli v5.0 tidak mungkin tertimpa tanpa sengaja. */
  const v = EN_DYN[idText] ?? EN_EXTRA[idText];
  return typeof v === "string" ? v : idText;
}

/* ---------------------------------------------------------------------------
   Hook untuk komponen. Mengembalikan fungsi yang sudah terikat ke bahasa yang
   aktif, sehingga komponen ikut tergambar ulang saat bahasanya diganti.
   --------------------------------------------------------------------------- */

export interface Translator {
  lang: Lang;
  /** label antarmuka lewat kunci pendek */
  t(key: UiKey): string;
  /** pesan dinamis, teks Indonesia sebagai kunci */
  tx(idText: string): string;
  /**
   * Pesan dinamis dengan penanda {0}, {1}, ...
   *
   * Dipakai untuk kalimat yang menyisipkan angka atau nama. Menempelkan
   * potongan teks satu per satu (tx("butuh ") + n + tx(" orang")) menghasilkan
   * kalimat rusak begitu bahasanya berganti, karena urutan kata dan bentuk
   * jamaknya berbeda. Dengan satu kunci utuh, penerjemah bebas menyusun ulang
   * seluruh kalimatnya.
   */
  txf(idText: string, ...vals: (string | number)[]): string;
  /** angka dengan pemisah ribuan sesuai bahasa */
  num(v: number): string;
}

function fill(tpl: string, vals: (string | number)[]): string {
  return tpl.replace(/\{(\d+)\}/g, (m, i) => {
    const v = vals[Number(i)];
    return v === undefined ? m : String(v);
  });
}

export function useT(): Translator {
  const lang = useI18n((s) => s.lang);
  return {
    lang,
    t: (key) => tKey(key, lang),
    tx: (idText) => tText(idText, lang),
    txf: (idText, ...vals) => fill(tText(idText, lang), vals),
    num: (v) => {
      try {
        return v.toLocaleString(lang === "en" ? "en-GB" : "id-ID");
      } catch {
        return String(v);
      }
    },
  };
}
