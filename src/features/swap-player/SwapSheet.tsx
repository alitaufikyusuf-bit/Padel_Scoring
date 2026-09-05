"use client";

/* ============================================================================
   SHEET GANTI PEMAIN / TUKAR TIM

   Dua tab untuk mode Individu/Mexicano:
     1. Ganti di laga ini — pilih satu pengganti
     2. Tidak hadir beberapa ronde — pilih rentang ronde, pengganti otomatis

   Satu mode untuk Fix Partner:
     Pilih tim yang mau ditukar posisinya.

   Sebelum swap dilakukan, popup menampilkan rekomendasi pemain pengganti
   beserta jumlah porsi main masing-masing.
   ========================================================================== */

import * as React from "react";

import { useT } from "@/shared/i18n";
import { Button, Note, Overlay, Pill, Segmented, Sheet } from "@/shared/ui";
import { isDone } from "@/entities/match";
import { useTournament } from "@/entities/tournament/store";
import { useSwapCandidates, usePlayerGames } from "@/entities/tournament/derived";
import { soloGamesOf } from "@/entities/schedule/mexicano";
import { useSwap, type SwapMode } from "./store";
import { askConfirm } from "@/features/confirm";

/* ---------------------------------------------------------------------------
   HOST — diletakkan sekali di BaganView
   --------------------------------------------------------------------------- */

export function SwapHost() {
  const open = useSwap((s) => s.open);
  if (!open) return null;
  return <SwapSheetInner />;
}

/* ---------------------------------------------------------------------------
   ISI SHEET
   --------------------------------------------------------------------------- */

function SwapSheetInner() {
  const { t, tx, txf } = useT();
  const sw = useSwap();
  const s = useTournament();

  const close = sw.close;

  if (sw.fmt === "pair") return <PairSwapBody onClose={close} />;
  return <SoloSwapBody onClose={close} />;
}

/* ===========================================================================
   INDIVIDU / MEXICANO
   =========================================================================== */

function SoloSwapBody({ onClose }: { onClose(): void }) {
  const { t, tx, txf } = useT();
  const sw = useSwap();
  const s = useTournament();
  const [msg, setMsg] = React.useState("");

  const pid = sw.pid;
  const matchIdx = sw.matchIdx;
  const m = s.smatch[matchIdx];
  const roundIdx = m?.r ?? 0;
  const name = s.pnames[pid - 1] ?? "Pemain " + pid;
  const games = usePlayerGames(pid);

  const tabs: { value: SwapMode; label: string }[] = [
    { value: "one", label: t("swTabOne") },
    { value: "abs", label: t("swTabAbs") },
  ];

  return (
    <Overlay open onClose={onClose} label={tx("Ganti pemain")} full>
      <Sheet
        title={txf("Ganti {0}", name)}
        kicker={txf("porsi main sekarang: {0}×", games)}
        onClose={onClose}
      >
        <Segmented
          value={sw.mode}
          options={tabs}
          onChange={(v) => sw.setMode(v)}
          className="mb-4"
          ariaLabel={tx("Mode ganti pemain")}
        />

        {sw.mode === "one" ? (
          <OneMatchSwap
            matchIdx={matchIdx}
            roundIdx={roundIdx}
            pid={pid}
            name={name}
            onClose={onClose}
            onMsg={setMsg}
          />
        ) : (
          <AbsentSwap pid={pid} name={name} onClose={onClose} onMsg={setMsg} />
        )}

        {msg && (
          <Note tone="info" className="mt-3">
            {msg}
          </Note>
        )}
      </Sheet>
    </Overlay>
  );
}

/* ---------- Ganti di satu laga ---------- */

function OneMatchSwap({
  matchIdx,
  roundIdx,
  pid,
  name,
  onClose,
  onMsg,
}: {
  matchIdx: number;
  roundIdx: number;
  pid: number;
  name: string;
  onClose(): void;
  onMsg(m: string): void;
}) {
  const { tx, txf } = useT();
  const s = useTournament();
  const candidates = useSwapCandidates(roundIdx, pid);
  const sc = s.sscores[matchIdx];

  if (isDone(sc)) {
    return (
      <Note tone="danger">
        {tx(
          "Laga ini sudah punya skor, jadi susunannya tidak bisa diubah. Kosongkan dulu skornya kalau memang salah catat.",
        )}
      </Note>
    );
  }

  if (!candidates.length) {
    return (
      <Note tone="warn">
        {tx(
          "Tidak ada pemain yang istirahat di ronde ini, jadi tidak ada yang bisa menggantikan. Kurangi jumlah lapangan supaya ada yang istirahat, atau ganti saja namanya di tab Pemain kalau ada orang lain yang menggantikan.",
        )}
      </Note>
    );
  }

  const doSwap = (newPid: number) => {
    const newName = s.pnames[newPid - 1] ?? "Pemain " + newPid;
    const ok = s.swapSoloMatch(matchIdx, pid, newPid);
    if (ok) {
      onMsg(
        txf("{0} menggantikan {1} di ronde {2} lapangan {3}",
          newName, name, roundIdx + 1, (s.smatch[matchIdx]?.c ?? 0) + 1),
      );
      onClose();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="nb-label normal-case tracking-normal">
        {txf("Pilih pengganti untuk {0} di ronde {1}:", name, roundIdx + 1)}
      </p>
      <CandidateList candidates={candidates} onPick={doSwap} />
    </div>
  );
}

/* ---------- Tidak hadir beberapa ronde ---------- */

function AbsentSwap({
  pid,
  name,
  onClose,
  onMsg,
}: {
  pid: number;
  name: string;
  onClose(): void;
  onMsg(m: string): void;
}) {
  const { tx, txf } = useT();
  const s = useTournament();
  const totalRounds = s.rnd.length;
  const [from, setFrom] = React.useState(0);
  const [to, setTo] = React.useState(Math.max(0, totalRounds - 1));

  /* Hitung berapa laga yang terlibat */
  let affected = 0;
  let scoredCount = 0;
  for (let r = from; r <= to && r < totalRounds; r++) {
    s.smatch.forEach((m, idx) => {
      if (m.r !== r) return;
      if (!m.t1.includes(pid) && !m.t2.includes(pid)) return;
      if (isDone(s.sscores[idx])) scoredCount++;
      else affected++;
    });
  }

  const doAbsent = () => {
    askConfirm({
      title: txf("Ganti {0}", name),
      body: txf(
        "{0} di rentang ronde itu akan diisi pemain lain, dipilih dari yang porsi mainnya paling sedikit. Laga yang skornya sudah masuk tidak disentuh.",
        name,
      ),
      risk: affected
        ? txf("{0} laga akan diubah", affected) +
          (scoredCount ? " · " + txf("dilewati karena skornya sudah masuk: {0}", scoredCount) : "")
        : undefined,
      okLabel: tx("Ya, atur penggantinya"),
      onOk() {
        const res = s.swapSoloAbsent(pid, from, to);
        if (res.ok) {
          let summary = name + tx(" dilepas · laga yang diganti: ") + res.replaced;
          if (res.skippedScore) summary += " · " + tx("dilewati karena skornya sudah masuk: ") + res.skippedScore;
          if (res.skippedNoSub) summary += " · " + tx("tanpa pengganti karena tidak ada yang istirahat: ") + res.skippedNoSub;
          if (res.changes.length) {
            summary +=
              "\n" +
              res.changes
                .map(
                  (c) =>
                    c.newName +
                    tx(" menggantikan ") +
                    name +
                    tx(" di ronde ") +
                    (c.round + 1) +
                    tx(" lapangan ") +
                    (c.court + 1),
                )
                .join("\n");
          }
          onMsg(summary);
        }
        onClose();
      },
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="nb-label normal-case tracking-normal">
        {txf("{0} tidak hadir ronde {1} sampai {2}.", name, from + 1, to + 1)}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="nb-label">
          {tx("Dari ronde")}
          <select
            className="nb-select ml-2"
            value={from}
            onChange={(e) => {
              const v = Number(e.target.value);
              setFrom(v);
              if (v > to) setTo(v);
            }}
          >
            {Array.from({ length: totalRounds }, (_, i) => (
              <option key={i} value={i}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
        <label className="nb-label">
          {tx("Sampai ronde")}
          <select
            className="nb-select ml-2"
            value={to}
            onChange={(e) => {
              const v = Number(e.target.value);
              setTo(v);
              if (v < from) setFrom(v);
            }}
          >
            {Array.from({ length: totalRounds }, (_, i) => (
              <option key={i} value={i}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-[13px] font-semibold">
        {affected > 0
          ? txf("{0} laga akan diubah", affected) +
            (scoredCount ? " · " + txf("dilewati karena skornya sudah masuk: {0}", scoredCount) : "")
          : tx("Tidak ada laga yang bisa diubah di rentang ronde ini.")}
      </p>

      <Button
        variant="primary"
        disabled={affected === 0}
        onClick={doAbsent}
      >
        {tx("Ya, atur penggantinya")}
      </Button>
    </div>
  );
}

/* ===========================================================================
   FIX PARTNER — tukar posisi tim
   =========================================================================== */

function PairSwapBody({ onClose }: { onClose(): void }) {
  const { tx, txf } = useT();
  const sw = useSwap();
  const s = useTournament();

  const teamA = sw.pid;
  const nameA = s.names[teamA - 1] ?? "Tim " + teamA;

  const doSwap = (teamB: number) => {
    const nameB = s.names[teamB - 1] ?? "Tim " + teamB;
    askConfirm({
      title: txf("Tukar posisi {0} ↔ {1}?", nameA, nameB),
      body: tx("Posisi kedua tim di seluruh bagan akan ditukar. Skor yang sudah ada tetap mengikuti pasangan timnya."),
      okLabel: tx("Ya, tukar posisi"),
      onOk() {
        s.swapTeams(teamA, teamB);
        onClose();
      },
    });
  };

  return (
    <Overlay open onClose={onClose} label={tx("Tukar posisi tim")} full>
      <Sheet
        title={txf("Tukar posisi {0}", nameA)}
        onClose={onClose}
      >
        <p className="nb-label mb-3 normal-case tracking-normal">
          {tx("Pilih tim yang mau ditukar posisi:")}
        </p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {Array.from({ length: s.n }, (_, i) => i + 1)
            .filter((id) => id !== teamA)
            .map((id) => (
              <li key={id}>
                <button
                  type="button"
                  className="nb-border flex w-full items-center gap-2 rounded-[var(--radius-nb)] p-2.5 text-left"
                  style={{ background: "var(--nb-card-2)" }}
                  onClick={() => doSwap(id)}
                >
                  <span
                    className="nb-border grid size-7 shrink-0 place-items-center rounded-[var(--radius-nb)] text-[12px] font-bold"
                    style={{ background: "var(--nb-card)", borderWidth: 2 }}
                  >
                    {id}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                    {s.names[id - 1] ?? "Tim " + id}
                  </span>
                  <Pill tone="plain">{txf("Tukar ↔ {0}", nameA)}</Pill>
                </button>
              </li>
            ))}
        </ul>
      </Sheet>
    </Overlay>
  );
}

/* ===========================================================================
   DAFTAR KANDIDAT — dipakai di mode "satu laga"
   =========================================================================== */

function CandidateList({
  candidates,
  onPick,
}: {
  candidates: { id: number; name: string; gamesPlayed: number; recommended: boolean }[];
  onPick(id: number): void;
}) {
  const { tx, txf } = useT();

  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {candidates.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            className="nb-border flex w-full items-center gap-2 rounded-[var(--radius-nb)] p-2.5 text-left"
            style={{ background: c.recommended ? "var(--nb-good)" : "var(--nb-card-2)" }}
            onClick={() => onPick(c.id)}
          >
            <span
              className="nb-border grid size-7 shrink-0 place-items-center rounded-[var(--radius-nb)] text-[12px] font-bold"
              style={{
                background: c.recommended ? "var(--nb-good)" : "var(--nb-card)",
                color: c.recommended ? "var(--nb-good-ink)" : "var(--nb-ink)",
                borderWidth: 2,
              }}
            >
              {c.id}
            </span>
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold"
              style={{ color: c.recommended ? "var(--nb-good-ink)" : "var(--nb-ink)" }}
            >
              {c.name}
            </span>
            <Pill tone={c.recommended ? "good" : "plain"}>
              {txf("main {0}×", c.gamesPlayed)}
              {c.recommended ? tx(" · disarankan") : ""}
            </Pill>
          </button>
        </li>
      ))}
    </ul>
  );
}
