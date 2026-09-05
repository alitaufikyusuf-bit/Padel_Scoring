"use client";

/* ============================================================================
   Provider tingkat aplikasi.

   Tugasnya empat: membaca pilihan bahasa/tema dari perangkat, memuat daftar
   turnamen, memulihkan turnamen yang terakhir dibuka, dan memasang service
   worker.

   Semuanya dijalankan SETELAH komponen terpasang, tidak saat modul dimuat.
   Alasannya: penyusun bagan memakai Math.random() dan pilihan tema ada di
   localStorage - keduanya tidak tersedia (atau berbeda) di server, dan
   menjalankannya lebih awal memicu galat hidrasi.
   ========================================================================== */

import * as React from "react";

import { useI18n } from "@/shared/i18n";
import { bootTournament, useTournament } from "@/entities/tournament/store";
import { useTrList } from "@/entities/tournament/list-store";
import { decodeCode } from "@/entities/draw-code";
import { useSync } from "@/features/sync-room/store";
import { ConfirmHost } from "@/features/confirm";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const bootLang = useI18n((s) => s.boot);
  const bootList = useTrList((s) => s.boot);

  React.useEffect(() => {
    bootLang();
    const cur = bootList();

    /* Kalau ada turnamen yang terakhir dibuka, bagannya dipulihkan dari
       rekamannya - BUKAN dibangun dari bawaan. Membangun bawaan lebih dulu lalu
       menimpanya akan terlihat sebagai kedipan bagan yang salah, dan di
       Mexicano bahkan menghasilkan ronde acak yang tidak pernah dimainkan. */
    if (cur) {
      const r = decodeCode(cur.code);
      if (r.ok) {
        useTournament.getState().fromDecoded(r.data);
        useTournament.setState({ hydrated: true });
        /* Ruangnya ikut disambung lagi, supaya penonton langsung mengikuti
           pencatat tanpa perlu menekan apa pun. */
        if (cur.room) {
          useSync.getState().join({
            room: cur.room,
            pin: cur.pin,
            role: cur.role === "viewer" ? "viewer" : "scorer",
            rev: cur.rev,
          });
        }
        return;
      }
      /* Kode rusak: turnamennya tidak dibuka, dan layar pembuka yang muncul
         dengan pesan di barisnya. */
      useTrList.getState().close();
    }
    bootTournament();
  }, [bootLang, bootList]);

  /* Service worker dipasang belakangan supaya tidak bersaing dengan permintaan
     pertama halaman. Kalau gagal, aplikasi tetap jalan - ia hanya kehilangan
     kemampuan buka-tanpa-internet, bukan fungsinya.

     TIDAK dipasang saat pengembangan: ia akan meng-cache aset dev yang namanya
     berubah setiap kali berkas disimpan, lalu beradu dengan hot reload -
     gejalanya perubahan yang seolah tidak muncul, dan itu jauh lebih memakan
     waktu daripada manfaat menguji offline lebih awal. */
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const t = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* diabaikan dengan sengaja: mode privat dan beberapa peramban menolak */
      });
    }, 1200);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <>
      {children}
      <ConfirmHost />
    </>
  );
}

/* ---------------------------------------------------------------------------
   Skrip tema yang berjalan sebelum halaman digambar.

   Tanpa ini, perangkat yang memilih tema gelap akan melihat kilatan terang
   selama satu frame - dan di pinggir lapangan pada malam hari itu menyilaukan.
   Dibuat sekecil mungkin dan dibungkus try/catch karena localStorage bisa
   melempar di jendela privat.
   --------------------------------------------------------------------------- */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("mnpadel.theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t);var l=localStorage.getItem("mnpadel.lang");if(l==="en"||l==="id")document.documentElement.setAttribute("lang",l);}catch(e){}`;
