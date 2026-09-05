"use client";

/* ============================================================================
   /join/KODE — tautan undangan

   Halaman ini tidak menggambar apa pun sendiri: ia menaruh kode ruang ke
   alamat lalu menyerahkannya ke shell, yang membuka layar Gabung dengan
   ruangnya sudah dicari sendiri.

   Kenapa lewat hash, bukan prop: layar Gabung hidup di dalam layar pembuka,
   dan layar pembuka bisa muncul dari mana saja - membuka /bagan dengan daftar
   turnamen kosong juga menampilkannya. Satu jalur masuk lebih sedikit yang
   bisa salah.
   ========================================================================== */

import * as React from "react";

import { cleanRoom } from "@/shared/lib";
import { useTrList } from "@/entities/tournament/list-store";
import { AppShell } from "@/views/shell";

export function JoinView({ room }: { room: string }) {
  const close = useTrList((s) => s.close);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const rm = cleanRoom(decodeURIComponent(room || ""));
    if (rm) {
      /* Alamat ditulis SEBELUM layar pembuka dipasang. Di versi vanilla,
         penulisan alamat oleh navigasi awal menimpa tautan undangan sebelum
         sempat dibaca - persis masalah yang dulu terjadi pada tautan bagan. */
      window.location.hash = "#/join/" + rm;
    }
    /* Layar pembuka harus terbuka, bukan bagan turnamen terakhir. */
    close();
    setReady(true);
  }, [room, close]);

  if (!ready) return null;
  return <AppShell>{null}</AppShell>;
}
