"use client";

/* ============================================================================
   PENGHUBUNG SESI

   Di versi vanilla, syncCode() dipanggil di ujung setiap perubahan dan
   melakukan tiga hal sekaligus: menulis kode bagan ke kotak teks, menyimpan
   rekaman turnamen, dan mengirim ke ruang. Setiap jalur yang lupa
   memanggilnya menghasilkan bug "perubahan tidak tersimpan".

   Di sini urusannya dibalik: satu efek mengawasi state turnamen dan
   mengerjakan ketiganya begitu ada yang berubah. Tidak ada lagi jalur yang
   bisa lupa, karena tidak ada yang perlu memanggil apa pun.
   ========================================================================== */

import * as React from "react";

import { useTournament } from "@/entities/tournament/store";
import { useTrList } from "@/entities/tournament/list-store";
import { decodeCode } from "@/entities/draw-code";
import { useSync, wireSyncWake } from "./store";

/** Kode bagan v9 dari state yang sedang aktif. */
export function useCode(): string {
  /* Berlangganan SELURUH state, bukan daftar bidang.

     Selektor yang mengembalikan array bidang terlihat lebih hemat, tapi array
     itu objek baru pada tiap render - dan Zustand v5 membandingkan hasil
     selektor dengan kesamaan identitas, jadi hasilnya selalu dianggap berubah
     dan komponen menggambar ulang tanpa henti. Identitas objek state sendiri
     hanya berubah kalau memang ada yang di-set, jadi inilah yang benar. */
  const s = useTournament();
  return React.useMemo(() => s.toCode(), [s]);
}

/**
 * Dipasang sekali di shell aplikasi. Menyimpan rekaman turnamen dan mengirim
 * bagan ke ruang setiap kali kodenya berubah, serta menerapkan bagan yang
 * datang dari pencatat lain.
 */
export function useSession(): { code: string } {
  const code = useCode();
  const hydrated = useTournament((s) => s.hydrated);
  const evTitle = useTournament((s) => s.evTitle);
  const evDate = useTournament((s) => s.evDate);
  const fromDecoded = useTournament((s) => s.fromDecoded);
  const setSchedMsg = useTournament((s) => s.setSchedMsg);

  const current = useTrList((s) => s.current);
  const touch = useTrList((s) => s.touch);

  const room = useSync((s) => s.room);
  const pin = useSync((s) => s.pin);
  const role = useSync((s) => s.role);
  const rev = useSync((s) => s.rev);
  const push = useSync((s) => s.push);
  const setOnRemote = useSync((s) => s.setOnRemote);
  const bootSync = useSync((s) => s.boot);

  React.useEffect(() => {
    bootSync();
    wireSyncWake();
  }, [bootSync]);

  /* Bagan yang datang dari pencatat lain. Kalau kodenya sama dengan yang
     sekarang, tidak ada yang perlu dikerjakan - itu terjadi tiap kali
     perangkat ini sendiri yang baru mengirim. */
  React.useEffect(() => {
    setOnRemote((incoming, newRev, by) => {
      if (incoming === useTournament.getState().toCode()) return;
      const r = decodeCode(incoming);
      if (!r.ok) {
        /* Kode rusak dari server tidak boleh menghapus bagan yang sedang
           dipakai; cukup dilaporkan. */
        setSchedMsg("__kode-server-rusak__");
        return;
      }
      fromDecoded(r.data);
      setSchedMsg("__dari-pencatat__" + (by || "") + "|" + newRev);
    });
    return () => setOnRemote(null);
  }, [setOnRemote, fromDecoded, setSchedMsg]);

  /* Simpan rekaman turnamen. */
  React.useEffect(() => {
    if (!hydrated || !current) return;
    touch({ code, name: evTitle, date: evDate, room, pin, role, rev });
  }, [code, hydrated, current, touch, evTitle, evDate, room, pin, role, rev]);

  /* Kirim ke ruang. Penundaan 1,5 detik ada di dalam push(). */
  React.useEffect(() => {
    if (!hydrated) return;
    push(code);
  }, [code, hydrated, push]);

  return { code };
}
