/* ============================================================================
   Font Google untuk tema Neo-Brutalism.
   Kita menggunakan Space Grotesk untuk body (teks paragraf, input)
   dan Oswald untuk elemen kental (kondensasi) seperti judul, skor, dan label.
   next/font/google secara otomatis mengunduh font pada saat build dan menyediakannya secara lokal (tersedia offline).
   ========================================================================== */

import { Space_Grotesk, Oswald } from "next/font/google";

export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--ff-body",
  display: "swap",
});

export const oswald = Oswald({
  subsets: ["latin"],
  variable: "--ff-cond",
  display: "swap",
});
