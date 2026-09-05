"use client";

/* ============================================================================
   SHELL APLIKASI

   Satu tempat yang memasang bilah atas, penghubung sesi, dan host papan skor,
   lalu menyisipkan halaman di tengahnya.

   Layar pembuka BUKAN halaman tersendiri di router: ia lapisan di atas shell.
   Alasannya sama dengan alasan gerbang lama dulu selalu muncul - orang harus
   memilih turnamen sebelum melihat bagan apa pun, dan mengandalkan alamat
   untuk itu berarti membuka /bagan langsung akan menampilkan bagan kosong yang
   membingungkan.
   ========================================================================== */

import * as React from "react";

import { useT } from "@/shared/i18n";
import { Overlay } from "@/shared/ui";
import { useTournament } from "@/entities/tournament/store";
import { useKo, useRules } from "@/entities/tournament/derived";
import { useTrList } from "@/entities/tournament/list-store";
import { AppBar } from "@/widgets/app-bar";
import { TournamentList } from "@/widgets/tournament-list";
import { Scoreboard } from "@/features/scoreboard/Scoreboard";
import { useSb } from "@/features/scoreboard/store";
import { useSession } from "@/features/sync-room/useSession";
import { useSync } from "@/features/sync-room/store";
import { askConfirm } from "@/features/confirm";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { tx } = useT();
  useSession();

  const current = useTrList((s) => s.current);
  const listReady = useTrList((s) => s.ready);
  const close = useTrList((s) => s.close);
  const bootSb = useSb((s) => s.boot);

  React.useEffect(() => {
    bootSb();
  }, [bootSb]);

  /* Selama daftar belum terbaca dari perangkat, jangan menampilkan apa pun
     yang bisa langsung berganti - kedipan layar pembuka lalu bagan terasa
     seperti kesalahan. */
  if (!listReady) {
    return (
      <main className="grid min-h-dvh place-items-center p-6">
        <p className="nb-label">{tx("Menyiapkan…")}</p>
      </main>
    );
  }

  if (!current) {
    return (
      <main className="min-h-dvh">
        <TournamentList onOpen={() => undefined} />
      </main>
    );
  }

  return (
    <>
      <AppBar onHome={close} />
      <main className="mx-auto w-full max-w-5xl p-3 sm:p-4">{children}</main>
      <ScoreboardHost />
      <footer className="noprint mx-auto w-full max-w-5xl px-3 pb-8 pt-2">
        <p className="nb-label normal-case tracking-normal">
          MN Padel Club · {tx("Aplikasi versi ")}5.0 · {tx("kode bagan v9")}
        </p>
      </footer>
    </>
  );
}

/* --------------------------------------------------------------------------- */

function ScoreboardHost() {
  const { tx } = useT();
  const s = useTournament();
  const rules = useRules();
  const ko = useKo();
  const kind = useSb((x) => x.kind);
  const idx = useSb((x) => x.idx);
  const val = useSb((x) => x.val);
  const closeSb = useSb((x) => x.close);
  const dropDraft = useSb((x) => x.dropDraft);
  const viewer = useSync((x) => x.role === "viewer");
  const pushLive = useSync((x) => x.pushLive);
  const clearLive = useSync((x) => x.clearLive);

  const open = kind !== null && idx >= 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const labels = React.useMemo(() => sbLabels(), [kind, idx, s, ko]);

  /* Papan skor berjalan dikirim ke ruang tiap kali angkanya berubah. Batas
     3 detik per perangkat ada di dalam pushLive, jadi tidak perlu diatur di
     sini - dan kiriman terakhir selalu menyusul. */
  React.useEffect(() => {
    if (!open || viewer || kind === null) return;
    const court = courtOf();
    if (court === null) return;
    pushLive(String(court), {
      idx,
      kind: kind === "solo" ? "solo" : kind === "ko" ? "ko" : "league",
      a: val[0],
      b: val[1],
      na: labels.a,
      nb: labels.b,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, viewer, kind, idx, val[0], val[1]]);

  if (!open || kind === null) return null;

  return (
    <Overlay open onClose={askClose} label={tx("Papan skor")} full>
      <Scoreboard
        rules={{
          target: rules.target,
          mode: rules.mode,
          tennis: s.scoreSys === "tennis",
          deuce: s.mexDeuce,
        }}
        labels={labels}
        readOnly={viewer}
        onSave={(v) => {
          if (kind === "solo") s.setSScorePair(idx, v[0], v[1]);
          else if (kind === "ko") s.setKoScore(idx, v[0], v[1]);
          else s.setScorePair(idx, v[0], v[1]);
          /* Laga yang skornya sudah masuk tidak lagi "sedang berjalan": entri
             live-nya dibuang supaya angka lama tidak menggantung di layar
             penonton kalau pencatat menutup aplikasi. */
          const c = courtOf();
          if (c !== null) clearLive(String(c));
          dropDraft(kind, idx);
          closeSb();
        }}
        onClose={askClose}
      />
    </Overlay>
  );

  function askClose() {
    if (val[0] === 0 && val[1] === 0) {
      closeSb();
      return;
    }
    askConfirm({
      title: tx("Tutup papan skor?"),
      body: tx(
        "Hitungan yang sedang berjalan disimpan sebagai catatan sementara, jadi bisa dilanjutkan nanti.",
      ),
      okLabel: tx("Ya, tutup"),
      cancelLabel: tx("Lanjut mencatat"),
      onOk: closeSb,
    });
  }

  /** Lapangan mana yang dipakai laga ini. Kunci entri live memakai angka itu. */
  function courtOf(): number | null {
    if (kind === "solo") return s.smatch[idx]?.c ?? null;
    if (kind === "match") return s.matches[idx]?.c ?? null;
    /* Laga knockout tidak punya nomor lapangan di bagan; indeksnya dipakai
       supaya empat laga knockout tidak saling menimpa slot live-nya. */
    if (kind === "ko") return 90 + idx;
    return null;
  }

  function sbLabels(): { kicker: string; a: string; b: string } {
    if (kind === "solo") {
      const m = s.smatch[idx];
      if (!m) return { kicker: "", a: "—", b: "—" };
      const nm = (id: number) => s.pnames[id - 1] ?? "Pemain " + id;
      return {
        kicker: tx("Ronde") + " " + (m.r + 1) + " · " + tx("Lapangan ") + (m.c + 1),
        a: nm(m.t1[0]) + " + " + nm(m.t1[1]),
        b: nm(m.t2[0]) + " + " + nm(m.t2[1]),
      };
    }
    if (kind === "ko") {
      const nmK = [
        tx("Semifinal") + " 1",
        tx("Semifinal") + " 2",
        tx("Perebutan Juara 3"),
        tx("Final"),
      ];
      /* Nama tim knockout tidak ada di bagan - ia diturunkan dari klasemen
         liga, jadi harus diminta lewat koPair, bukan dibaca dari daftar. */
      const pr = ko.pair(idx);
      const nm = (id: number | null) => (id ? (s.names[id - 1] ?? "Tim " + id) : "—");
      return { kicker: nmK[idx] ?? "", a: nm(pr[0]), b: nm(pr[1]) };
    }
    const m = s.matches[idx];
    if (!m) return { kicker: "", a: "—", b: "—" };
    return {
      kicker: tx("Slot") + " " + (m.s + 1) + " · " + tx("Lapangan ") + (m.c + 1),
      a: s.names[m.a - 1] ?? "Tim " + m.a,
      b: s.names[m.b - 1] ?? "Tim " + m.b,
    };
  }
}

