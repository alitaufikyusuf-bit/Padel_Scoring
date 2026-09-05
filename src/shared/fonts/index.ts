/* ============================================================================
   Barlow dibundel lokal supaya tampilan tetap sama tanpa internet - aplikasi
   ini dipakai di pinggir lapangan yang sinyalnya sering buruk, dan huruf yang
   berganti di tengah acara membuat tata letak papan skor bergeser.

   Berkasnya sudah disubset (hanya glyph yang dipakai bahasa Indonesia dan
   Inggris), dari 152 KB jadi 54 KB untuk enam berat sekaligus.

   next/font/local yang dipakai, bukan @font-face manual: ia menyisipkan
   preload, memberi metrik fallback supaya tidak ada pergeseran tata letak saat
   huruf selesai dimuat, dan namanya diubah otomatis jadi variabel CSS.
   ========================================================================== */

import localFont from "next/font/local";

export const barlow = localFont({
  src: [
    { path: "./barlow-400.woff2", weight: "400", style: "normal" },
    { path: "./barlow-500.woff2", weight: "500", style: "normal" },
    { path: "./barlow-600.woff2", weight: "600", style: "normal" },
    { path: "./barlow-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--ff-body",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
});

export const barlowCond = localFont({
  src: [
    { path: "./barlow-cond-600.woff2", weight: "600", style: "normal" },
    { path: "./barlow-cond-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--ff-cond",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
});
