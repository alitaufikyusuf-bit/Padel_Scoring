import type { Metadata, Viewport } from "next";

import { barlow, barlowCond } from "@/shared/fonts";
import { AppProviders, THEME_BOOT_SCRIPT } from "./providers";
import "./globals.css";

/* ============================================================================
   Lapisan app FSD. Di Next.js App Router, root layout INILAH lapisan app:
   dia yang memasang provider, gaya global, dan huruf. Karena itu tidak ada
   src/app/ tersendiri - Next melarang app/ dan src/app/ hidup berdampingan,
   dan memaksakannya cuma menghasilkan satu lapisan tipuan.

   Lapisan FSD lainnya ada di src/: views, widgets, features, entities, shared.
   ========================================================================== */

export const metadata: Metadata = {
  title: "MN Padel Club — Turnamen Padel",
  description:
    "Bagan, jadwal, klasemen, dan papan skor turnamen padel Americano, Fix Partner, dan Mexicano. Jalan penuh tanpa internet.",
  applicationName: "MN Padel",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MN Padel",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-96.png", sizes: "96x96", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  /* Zoom TIDAK dikunci. Papan skor memang dibuat besar, tapi daftar pemain
     dan klasemen kadang perlu diperbesar - mengunci zoom akan mengurung
     pengguna dengan penglihatan terbatas. */
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdf6e8" },
    { media: "(prefers-color-scheme: dark)", color: "#14131a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* Tema dipasang sebelum halaman digambar supaya tidak ada kilatan
            terang di perangkat yang memilih gelap. Lihat providers.tsx. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className={`${barlow.variable} ${barlowCond.variable} antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
