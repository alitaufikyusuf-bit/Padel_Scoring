import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /* Seluruh state turnamen hidup di localStorage perangkat masing-masing dan
     papan skornya digambar di klien, jadi tidak ada gunanya membuat halaman
     ini statis-tapi-dinamis di dua tempat. Halaman dibiarkan client-rendered
     dan hanya /api/bagan yang berjalan di server. */
  headers: async () => [
    {
      /* Service worker harus boleh mengatur seluruh cakupan situs, dan tidak
         boleh ikut di-cache oleh CDN - kalau tidak, versi baru tidak pernah
         sampai ke perangkat yang sudah memasang aplikasinya. */
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
    {
      source: "/fonts/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    },
  ],
};

export default nextConfig;
