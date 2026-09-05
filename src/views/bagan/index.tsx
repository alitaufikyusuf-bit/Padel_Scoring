"use client";

/* ============================================================================
   TAB BAGAN

   Isinya: kendali penyusunan bagan, bagan itu sendiri, dan (di Fix Partner)
   babak knockout di bawahnya.

   Tombol Acak dijaga konfirmasi kalau ada yang dipertaruhkan, karena mengacak
   bagan MENGOSONGKAN skor - dan di tengah acara itu tidak bisa dibatalkan.
   ========================================================================== */

import * as React from "react";

import { useT } from "@/shared/i18n";
import { Button, Card, Note, Pill } from "@/shared/ui";
import { useTournament } from "@/entities/tournament/store";
import { atStakeOf, useMex } from "@/entities/tournament/derived";
import { KnockoutBoard, ScheduleBoard } from "@/widgets/schedule-board";
import { RosterSheet } from "@/widgets/roster-card";
import { useSb } from "@/features/scoreboard/store";
import { useSync } from "@/features/sync-room/store";
import { askConfirm } from "@/features/confirm";
import { SwapHost } from "@/features/swap-player/SwapSheet";
import { AppShell } from "@/views/shell";

export function BaganView() {
  const [rosterOpen, setRosterOpen] = React.useState(false);

  return (
    <AppShell>
      <div className="flex flex-col gap-3">
        <SchedControls onOpenRoster={() => setRosterOpen(true)} />
        <ScheduleBoard />
        <KnockoutBoard />
      </div>
      <RosterSheet open={rosterOpen} onClose={() => setRosterOpen(false)} />
      <SwapHost />
    </AppShell>
  );
}

function SchedControls({ onOpenRoster }: { onOpenRoster(): void }) {
  const { t, tx, txf } = useT();
  const s = useTournament();
  const mex = useMex();
  const viewer = useSync((x) => x.role === "viewer");
  const drafts = useSb((x) => Object.keys(x.drafts).length);
  const [msg, setMsg] = React.useState("");

  /* Pesan dari store dipakai apa adanya kecuali yang berkode - itu pesan yang
     lahir di lapisan tanpa akses terjemahan, jadi diterjemahkan di sini. */
  const storeMsg = useTournament((x) => x.schedMsg);
  const shownMsg = React.useMemo(() => decode(storeMsg, tx), [storeMsg, tx]);

  const guard = (title: string, okLabel: string, run: () => void) => {
    if (viewer) {
      setMsg(
        tx("Mode penonton — hanya pencatat yang boleh mengubah. Putuskan sinkronisasi di tab Atur kalau mau mengubah sendiri."),
      );
      return;
    }
    const st = atStakeOf(s, drafts);
    if (!st.any) {
      run();
      return;
    }
    askConfirm({
      title,
      body: tx("Semua skor dikosongkan setiap kali bagan diacak."),
      risk:
        txf("{0} laga berskor", st.done) +
        (st.drafts ? " · " + txf("{0} hitungan belum dicatat", st.drafts) : ""),
      okLabel,
      onOk: run,
    });
  };

  return (
    <Card
      title={t("cardSched")}
      tip={s.mexOn ? t("tipSchedMex") : s.fmt === "solo" ? t("tipSchedSolo") : t("tipSched")}
      actions={
        <>
          <Button
            size="sm"
            variant="hl"
            onClick={onOpenRoster}
            title={s.fmt === "solo" ? t("navPemain") : t("navTim")}
          >
            {s.fmt === "solo" ? `👥 ${txf("{0} pemain", s.np)}` : `👥 ${txf("{0} tim", s.n)}`}
          </Button>

          {s.mexOn ? (
            <>
              <Pill tone="plain">{txf("{0}/{1} ronde", s.rnd.length, s.rounds)}</Pill>
              <Button
                size="sm"
                variant="primary"
                disabled={viewer || !mex.canNext}
                onClick={onMexNext}
              >
                {t("btnMexNext")}
              </Button>
              <Button
                size="sm"
                disabled={viewer}
                onClick={() =>
                  guard(tx("Acak ulang ronde 1?"), tx("Ya, acak"), () => {
                    if (!s.mexStart(true)) setMsg(whyStuck());
                    else setMsg(tx("Ronde 1 diacak ulang."));
                  })
                }
              >
                {t("btnRandom")}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="primary"
              disabled={viewer}
              onClick={() =>
                guard(tx("Acak bagan?"), tx("Ya, acak bagan"), () => {
                  if (s.fmt === "pair") s.buildPair("random", false);
                  else s.buildSolo("random", false);
                  setMsg(tx("Bagan disusun ulang."));
                })
              }
            >
              {t("btnRandom")}
            </Button>
          )}
          <Button
            size="sm"
            variant="danger"
            disabled={viewer}
            onClick={() =>
              guard(tx("Kosongkan semua skor?"), tx("Ya, kosongkan"), () => {
                s.clearScores();
                useSb.setState({ drafts: {} });
                setMsg(tx("Skor dikosongkan."));
              })
            }
          >
            {t("btnReset")}
          </Button>
        </>
      }
    >
      {(msg || shownMsg) && <Note tone="info">{msg || shownMsg}</Note>}
      {s.mexOn && !mex.canNext && mex.ready && s.rnd.length >= s.rounds && (
        <Note tone="warn" className="mt-2">
          {txf("Sudah mencapai {0} ronde. Tambah jumlah ronde di Setelan kalau mau lanjut.", s.rounds)}
        </Note>
      )}
    </Card>
  );

  function onMexNext() {
    const r = s.mexNext();
    if (r.ok) {
      const names = r.resting.map((i) => s.pnames[i - 1] ?? "Pemain " + i);
      setMsg(
        txf("Ronde {0} dibuat dari klasemen terkini.", r.round) +
          (names.length ? " " + txf("Istirahat: {0}.", names.join(", ")) : "") +
          " · " +
          (mex.spread.min === mex.spread.max
            ? txf("porsi main: {0}× · merata", mex.spread.min)
            : txf("porsi main: {0}–{1}× · selisih {2} laga", mex.spread.min, mex.spread.max, mex.spread.gap)),
      );
      return;
    }
    if (r.why === "belum-lengkap") {
      setMsg(
        txf(
          "Masih ada {0} laga yang skornya belum masuk. Klasemen belum utuh, jadi ronde berikutnya belum bisa disusun.",
          r.sisa ?? 0,
        ),
      );
      return;
    }
    if (r.why === "cukup-ronde") {
      setMsg(txf("Sudah mencapai {0} ronde. Tambah jumlah ronde di Setelan kalau mau lanjut.", s.rounds));
      return;
    }
    setMsg(whyStuck());
  }

  function whyStuck(): string {
    if (s.np < 8) return txf("Mexicano butuh minimal {0} pemain.", 8);
    if (mex.present < mex.seatsNeeded) {
      return txf(
        "Pemain yang hadir kurang: butuh {0} orang untuk {1} lapangan, yang hadir baru {2}. Kurangi lapangan atau tandai ada yang hadir lagi.",
        mex.seatsNeeded,
        mex.courts,
        mex.present,
      );
    }
    return tx("Ronde berikutnya belum bisa dibuat.");
  }
}

/** Mengisi penanda pada teks yang sudah diterjemahkan. */
function fill(tpl: string, a: string, b: string, tx: (s: string) => string): string {
  return tx(tpl).replace("{0}", a).replace("{1}", b);
}

/** Pesan berkode dari lapisan tanpa akses terjemahan. */
function decode(m: string, tx: (s: string) => string): string {
  if (!m) return "";
  if (m === "__kode-server-rusak__") {
    return tx("Bagan dari ruang tidak bisa dibaca, jadi bagan di perangkat ini dibiarkan apa adanya.");
  }
  if (m.startsWith("__dari-pencatat__")) {
    const rest = m.slice("__dari-pencatat__".length);
    const [by, rev] = rest.split("|");
    return fill("Bagan diperbarui dari {0} · versi {1}.", by || tx("pencatat"), rev ?? "?", tx);
  }
  return m;
}
