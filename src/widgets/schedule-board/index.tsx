"use client";

/* ============================================================================
   BAGAN PERTANDINGAN

   Satu kelompok berisi pertandingan yang jalan serentak di semua lapangan -
   "slot" di Fix Partner, "ronde" di Individu dan Mexicano.

   Keadaan kelompok ditandai tiga cara sekaligus (label, warna, dan garis),
   bukan warna saja: kelompok pertama yang belum lengkap adalah yang SEDANG
   dimainkan, yang di atasnya sudah selesai, yang di bawahnya menunggu.

   Pengisian skor: mengetik satu sisi mengisi sisi lawan sendiri kalau modenya
   "sum" (jumlah kedua skor harus tepat TARGET). Ini menghemat separuh
   ketukan, dan itulah yang paling sering dilakukan sepanjang acara.
   ========================================================================== */

import * as React from "react";

import { DRAW_PTS, WIN_PTS } from "@/shared/config";
import { clock } from "@/shared/lib";
import { useT } from "@/shared/i18n";
import { Button, Card, Empty, Note, Pill, cx } from "@/shared/ui";
import { isDone, validPair } from "@/entities/match";
import { useTournament } from "@/entities/tournament/store";
import { useKo, useRules } from "@/entities/tournament/derived";
import { draftKey, useSb } from "@/features/scoreboard/store";
import { useSync } from "@/features/sync-room/store";
import { useSwap } from "@/features/swap-player/store";
import type { MatchKind, Score } from "@/shared/types";

type GroupState = "done" | "now" | "next";

export function ScheduleBoard() {
  const { t, tx } = useT();
  const s = useTournament();
  const rules = useRules();
  const viewer = useSync((st) => st.role === "viewer");

  const solo = s.fmt === "solo";
  const groups = solo ? s.rnd.length : s.slots.length;

  if (!s.hydrated) {
    return (
      <Card title={t("cardSched")}>
        <Empty>{tx("Menyiapkan bagan…")}</Empty>
      </Card>
    );
  }
  if (!groups) {
    return (
      <Card title={t("cardSched")}>
        <Empty>{tx("Belum ada bagan.")}</Empty>
      </Card>
    );
  }

  /* Kelompok pertama yang belum lengkap = yang sedang dimainkan. */
  const groupDone: boolean[] = [];
  for (let g = 0; g < groups; g++) {
    const idxs = matchIndexes(g);
    groupDone.push(idxs.length > 0 && idxs.every((i) => isDone(scoreArr()[i])));
  }
  const firstOpen = groupDone.findIndex((x) => !x);

  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: groups }, (_, g) => {
        const st: GroupState =
          groupDone[g] ? "done" : g === firstOpen ? "now" : "next";
        return (
          <SlotGroup
            key={g}
            index={g}
            state={st}
            solo={solo}
            viewer={viewer}
            rules={rules}
          />
        );
      })}
    </div>
  );

  function scoreArr(): readonly Score[] {
    return solo ? s.sscores : s.scores;
  }
  function matchIndexes(g: number): number[] {
    const out: number[] = [];
    if (solo) {
      s.smatch.forEach((m, i) => {
        if (m.r === g) out.push(i);
      });
    } else {
      s.matches.forEach((m, i) => {
        if (m.s === g) out.push(i);
      });
    }
    return out;
  }
}

/* --------------------------------------------------------------------------- */

const GROUP_BG: Record<GroupState, string> = {
  done: "var(--nb-card-2)",
  now: "var(--nb-accent)",
  next: "var(--nb-warn)",
};
const GROUP_FG: Record<GroupState, string> = {
  done: "var(--nb-label)",
  now: "var(--nb-accent-ink)",
  next: "var(--nb-warn-ink)",
};

function SlotGroup({
  index,
  state,
  solo,
  viewer,
  rules,
}: {
  index: number;
  state: GroupState;
  solo: boolean;
  viewer: boolean;
  rules: { target: number; mode: "sum" | "first" };
}) {
  const { tx, txf } = useT();
  const s = useTournament();
  const [open, setOpen] = React.useState(true);

  const idxs: number[] = [];
  if (solo) s.smatch.forEach((m, i) => m.r === index && idxs.push(i));
  else s.matches.forEach((m, i) => m.s === index && idxs.push(i));

  const eff = idxs.length;
  const idle = Math.max(0, s.courts - eff);
  const start = s.startMin + index * s.slotMin;

  const label = solo ? tx("Ronde") : tx("Slot");
  const stateWord =
    state === "done" ? tx("selesai") : state === "now" ? tx("main sekarang") : tx("berikutnya");

  return (
    <section className="nb-card overflow-hidden p-0">
      <header
        className="nb-slot flex cursor-pointer flex-wrap items-center gap-2 border-b-[3px] p-2.5"
        data-state={state}
        style={{ background: GROUP_BG[state], color: GROUP_FG[state] }}
        onClick={() => setOpen((v) => !v)}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
      >
        <span className="nb-title text-[15px]">
          {label} {index + 1}
        </span>
        <span className="nb-label" style={{ color: "inherit", opacity: 0.85 }}>
          {clock(start)}–{clock(start + s.slotMin)}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <Pill tone={state === "done" ? "good" : "ink"}>
            {state === "done" ? "✓ " : ""}
            {stateWord}
          </Pill>
          <span aria-hidden className="nb-label" style={{ color: "inherit" }}>
            {open ? "▾" : "▸"}
          </span>
        </span>
      </header>

      {open && (
        <div className="grid gap-2.5 p-2.5 sm:grid-cols-2">
          {idxs.map((mi, ci) => (
            <CourtCard
              key={mi}
              matchIdx={mi}
              court={ci}
              kind={solo ? "solo" : "match"}
              viewer={viewer}
              rules={rules}
            />
          ))}
          {Array.from({ length: idle }, (_, k) => (
            <div
              key={"idle" + k}
              className="nb-border rounded-[var(--radius-nb)] border-dashed p-3 text-center"
              style={{ color: "var(--nb-label)" }}
            >
              <div className="nb-label">{txf("Lapangan {0}", eff + k + 1)}</div>
              <div className="mt-1 text-[13px] font-semibold">{tx("kosong")}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* --------------------------------------------------------------------------- */

export function CourtCard({
  matchIdx,
  court,
  kind,
  viewer,
  rules,
  titleOverride,
  sideNames,
}: {
  matchIdx: number;
  court: number;
  kind: MatchKind;
  viewer: boolean;
  rules: { target: number; mode: "sum" | "first" };
  titleOverride?: string;
  sideNames?: [string, string];
}) {
  const { tx, txf } = useT();
  const s = useTournament();
  const openSb = useSb((x) => x.open);
  const draft = useSb((x) => x.drafts[draftKey(kind, matchIdx)]);

  const score = pickScore();
  const done = isDone(score);
  const ok = done && validPair(score, rules.target, rules.mode);
  const names = sideNames ?? pickNames();

  return (
    <div
      className="nb-border rounded-[var(--radius-nb)] p-2.5"
      style={{
        background: done ? "var(--nb-card-2)" : "var(--nb-card)",
        borderColor: done && !ok ? "var(--nb-danger)" : "var(--nb-line)",
      }}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="nb-label">
          {titleOverride ?? txf("Lapangan {0}", court + 1)}
        </span>
        {draft && <Pill tone="warn">⏱ {draft.v[0]}–{draft.v[1]}</Pill>}
        <Button
          size="sm"
          variant={done ? "ghost" : "hl"}
          className="ml-auto"
          onClick={() => openSb(kind, matchIdx, score)}
        >
          {tx("Papan skor")}
        </Button>
      </div>

      {([0, 1] as const).map((side) => {
        const win = done && (score[side] as number) > (score[1 - side] as number);
        const draw = done && score[0] === score[1];
        /* ID pemain/tim di sisi ini, untuk tombol swap */
        const sideIds = pickSideIds(side);
        const canSwap = !viewer && !done && kind !== "ko";

        const isSolo = kind === "solo" && !sideNames && sideIds.length === 2;
        const p1Id = sideIds[0];
        const p2Id = sideIds[1];
        const p1Name = p1Id ? (s.pnames[p1Id - 1] ?? "Pemain " + p1Id) : "—";
        const p2Name = p2Id ? (s.pnames[p2Id - 1] ?? "Pemain " + p2Id) : "—";

        return (
          <div
            key={side}
            className="mb-1.5 flex items-center gap-2 rounded-[var(--radius-nb)] px-1.5 py-1"
            style={{
              background: win ? "var(--nb-good)" : "transparent",
              color: win ? "var(--nb-good-ink)" : "var(--nb-ink)",
            }}
          >
            {isSolo ? (
              <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[13.5px] font-semibold">
                <span className="inline-flex min-w-0 items-center gap-1">
                  {canSwap && p1Id && (
                    <SwapBtn
                      matchIdx={matchIdx}
                      pid={p1Id}
                      kind="solo"
                      label={txf("Ganti {0}", p1Name)}
                    />
                  )}
                  <span className="truncate">{p1Name}</span>
                </span>
                <span className="shrink-0 font-bold text-[var(--nb-label)]">+</span>
                <span className="inline-flex min-w-0 items-center gap-1">
                  {canSwap && p2Id && (
                    <SwapBtn
                      matchIdx={matchIdx}
                      pid={p2Id}
                      kind="solo"
                      label={txf("Ganti {0}", p2Name)}
                    />
                  )}
                  <span className="truncate">{p2Name}</span>
                </span>
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[13.5px] font-semibold">
                {canSwap && sideIds[0] && (
                  <SwapBtn
                    matchIdx={matchIdx}
                    pid={sideIds[0]}
                    kind={kind}
                    label={txf("Tukar {0}", names[side])}
                  />
                )}
                <span className="truncate">{names[side]}</span>
              </div>
            )}
            {/* Poin liga tidak dipakai di Mexicano - peringkatnya murni poin
                cetak - jadi lencana +10 di situ hanya menyesatkan. */}
            {win && !s.mexOn && <Pill tone="ink">+{WIN_PTS}</Pill>}
            {draw && !s.mexOn && <Pill tone="plain">+{DRAW_PTS}</Pill>}
            <input
              className="nb-input nb-score"
              data-state={done ? (ok ? (win ? "win" : "lose") : "bad") : undefined}
              type="number"
              min={0}
              max={99}
              inputMode="numeric"
              placeholder="–"
              disabled={viewer}
              value={score[side] === null ? "" : String(score[side])}
              aria-label={txf("Skor pertandingan {0} · {1}", matchIdx + 1, names[side]!)}
              onChange={(e) => onType(side, e.target.value)}
            />
          </div>
        );
      })}

      {done && !ok && (
        <Note tone="danger" className="mt-1.5">
          {rules.mode === "sum"
            ? txf("Jumlah kedua skor harus {0}.", rules.target)
            : txf("Salah satu tim harus tepat {0}.", rules.target)}
        </Note>
      )}
    </div>
  );

  function pickScore(): Score {
    if (kind === "solo") return s.sscores[matchIdx] ?? [null, null];
    if (kind === "ko") return s.koScores[matchIdx] ?? [null, null];
    return s.scores[matchIdx] ?? [null, null];
  }

  function pickNames(): [string, string] {
    if (kind === "solo") {
      const m = s.smatch[matchIdx];
      if (!m) return ["—", "—"];
      const nm = (id: number) => s.pnames[id - 1] ?? "Pemain " + id;
      return [nm(m.t1[0]) + " + " + nm(m.t1[1]), nm(m.t2[0]) + " + " + nm(m.t2[1])];
    }
    const m = s.matches[matchIdx];
    if (!m) return ["—", "—"];
    return [s.names[m.a - 1] ?? "Tim " + m.a, s.names[m.b - 1] ?? "Tim " + m.b];
  }

  /* Mengetik satu sisi mengisi sisi lawan sendiri kalau modenya "sum". */
  function onType(side: 0 | 1, raw: string): void {
    const v = raw.trim();
    const own = v === "" ? null : Math.max(0, Math.min(99, parseInt(v, 10) || 0));
    let other: number | null = pickScore()[1 - side];
    if (rules.mode === "sum") {
      if (own === null) other = null;
      else if (own <= rules.target) other = rules.target - own;
    }
    const a = side === 0 ? own : other;
    const b = side === 0 ? other : own;
    if (kind === "solo") s.setSScorePair(matchIdx, a, b);
    else if (kind === "ko") s.setKoScore(matchIdx, a, b);
    else s.setScorePair(matchIdx, a, b);
  }

  /** ID pemain/tim di sisi tertentu, untuk tombol swap. */
  function pickSideIds(side: 0 | 1): number[] {
    if (kind === "solo") {
      const m = s.smatch[matchIdx];
      if (!m) return [];
      const team = side === 0 ? m.t1 : m.t2;
      return [team[0], team[1]];
    }
    if (kind === "match") {
      const m = s.matches[matchIdx];
      if (!m) return [];
      return [side === 0 ? m.a : m.b];
    }
    return [];
  }
}

/* ============================================================================
   BABAK KNOCKOUT

   Digambar sebagai bagan tersendiri di bawah bagan liga, dan kolom skornya
   terkunci sampai seluruh pertandingan liga punya skor - kalau tidak,
   unggulannya belum pasti dan tim bisa terisi lalu berubah.
   ========================================================================== */

export function KnockoutBoard() {
  const { t, tx } = useT();
  const s = useTournament();
  const ko = useKo();
  const rules = useRules();
  const viewer = useSync((x) => x.role === "viewer");

  if (s.fmt !== "pair" || !ko.active) return null;

  return (
    <Card title={t("cardKo")} note={ko.leagueDone ? undefined : t("tipKoWait")}>
      {!ko.leagueDone ? (
        <Empty>{tx("Menunggu babak liga selesai.")}</Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {ko.layout.map((row, si) => (
            <section key={si} className="nb-border overflow-hidden rounded-[var(--radius-nb)]">
              <header
                className="flex flex-wrap items-center gap-2 border-b-[3px] p-2"
                style={{ background: "var(--nb-card-2)" }}
              >
                <span className="nb-title text-[14px]">
                  {tx("Slot")} {s.slots.length + si + 1}
                </span>
                <span className="nb-label">{clock(ko.startOf(si))}</span>
              </header>
              <div className="grid gap-2.5 p-2.5 sm:grid-cols-2">
                {row.map((ki, ci) => {
                  const pair = ko.pair(ki);
                  const ready = !!(pair[0] && pair[1]);
                  const nm = (id: number | null, ph: string) =>
                    id ? (s.names[id - 1] ?? "Tim " + id) : ph;
                  return ready ? (
                    <CourtCard
                      key={ki}
                      matchIdx={ki}
                      court={ci}
                      kind="ko"
                      viewer={viewer}
                      rules={rules}
                      titleOverride={koTitle(ki, tx)}
                      sideNames={[nm(pair[0], ""), nm(pair[1], "")]}
                    />
                  ) : (
                    <div
                      key={ki}
                      className="nb-border rounded-[var(--radius-nb)] border-dashed p-3"
                      style={{ color: "var(--nb-label)" }}
                    >
                      <div className="nb-label">{koTitle(ki, tx)}</div>
                      <div className="mt-1 text-[13px] font-semibold">
                        {koPlaceholder(ki, 0, tx)} {tx("vs")} {koPlaceholder(ki, 1, tx)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}

function koTitle(i: number, tx: (s: string) => string): string {
  if (i === 0) return tx("Semifinal") + " 1";
  if (i === 1) return tx("Semifinal") + " 2";
  if (i === 2) return tx("Perebutan Juara 3");
  return tx("Final");
}

function koPlaceholder(i: number, side: 0 | 1, tx: (s: string) => string): string {
  if (i === 0) return side === 0 ? tx("Peringkat 1 liga") : tx("Peringkat 3 liga");
  if (i === 1) return side === 0 ? tx("Peringkat 2 liga") : tx("Peringkat 4 liga");
  if (i === 2) return tx("Yang kalah SF") + (side + 1);
  return tx("Pemenang SF") + (side + 1);
}

export { cx };

/* --------------------------------------------------------------------------- */

/** Tombol swap bergaya Neo-Brutalism di samping nama pemain atau tim. */
function SwapBtn({
  matchIdx,
  pid,
  kind,
  label,
}: {
  matchIdx: number;
  pid: number;
  kind: MatchKind;
  label?: string;
}) {
  const openSwap = useSwap((x) => x.openSwap);
  const fmt = kind === "solo" ? "solo" : "pair";
  const tooltip = label ?? (kind === "solo" ? "Ganti pemain" : "Tukar tim");

  return (
    <button
      type="button"
      className="inline-flex size-[22px] shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-nb)] border-[1.5px] border-[var(--nb-line)] bg-[var(--nb-warn)] text-[var(--nb-warn-ink)] shadow-[1.5px_1.5px_0_var(--nb-line)] transition-all hover:-translate-x-[0.5px] hover:-translate-y-[0.5px] hover:bg-[var(--nb-accent)] hover:text-[var(--nb-accent-ink)] hover:shadow-[2px_2px_0_var(--nb-line)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--nb-hl)]"
      title={tooltip}
      aria-label={tooltip}
      onClick={(e) => {
        e.stopPropagation();
        openSwap(fmt as "solo" | "pair", matchIdx, pid);
      }}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-3 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
        <path d="M21 21v-5h-5" />
      </svg>
    </button>
  );
}
