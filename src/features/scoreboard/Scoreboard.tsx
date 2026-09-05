"use client";

/* ============================================================================
   PAPAN SKOR — layar penuh di HP

   Dua tombol besar, satu per sisi. Angkanya sebesar mungkin supaya terbaca
   sambil berdiri di pinggir lapangan, dan tidak ada satu pun angka yang perlu
   diketik.

   Di sistem tenis, yang BESAR adalah skor game berjalan (0/15/30/40/Adv) dan
   jumlah game jadi lencana di samping nama. Itu cara orang membaca papan skor
   padel; kebalikannya pernah dicoba dan salah.
   ========================================================================== */

import * as React from "react";

import { useT } from "@/shared/i18n";
import { Button, Note, Pill, cx } from "@/shared/ui";
import { TN_LBL } from "@/shared/config";
import { tennisAtDeuce, tennisLabel } from "@/entities/score";
import { useSb, sbCanAdd, sbComplete, tennisStateOf, type SbRules } from "./store";

export interface SbLabels {
  kicker: string;
  a: string;
  b: string;
}

export interface ScoreboardProps {
  rules: SbRules;
  labels: SbLabels;
  /** true kalau perangkat ini hanya menonton */
  readOnly: boolean;
  onSave(val: [number, number]): void;
  onClose(): void;
}

export function Scoreboard({ rules, labels, readOnly, onSave, onClose }: ScoreboardProps) {
  const { tx, txf } = useT();
  const val = useSb((s) => s.val);
  const hist = useSb((s) => s.hist);
  const clearArm = useSb((s) => s.clearArm);
  const tap = useSb((s) => s.tap);
  const undo = useSb((s) => s.undo);
  const clear = useSb((s) => s.clear);
  const armClear = useSb((s) => s.armClear);

  const done = sbComplete(val, rules.target, rules.mode);
  const tn = rules.tennis ? tennisStateOf(hist, rules.target, rules.deuce) : null;
  const tot = val[0] + val[1];

  /* Layar dijaga tetap menyala selama papan skor terbuka: pencatat memegang HP
     di tangan dan layar yang mati tiap 30 detik membuatnya tak terpakai.
     Kalau peramban tidak mendukung, tidak ada ruginya. */
  React.useEffect(() => {
    let lock: { release(): Promise<void> } | null = null;
    let cancelled = false;
    const nav = navigator as Navigator & {
      wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> };
    };
    if (nav.wakeLock) {
      nav.wakeLock
        .request("screen")
        .then((l) => {
          if (cancelled) void l.release();
          else lock = l;
        })
        .catch(() => {
          /* ditolak izinnya atau tidak didukung; diabaikan dengan sengaja */
        });
    }
    return () => {
      cancelled = true;
      void lock?.release().catch(() => {});
    };
  }, []);

  /* Ketukan kedua tombol "Mulai dari 0" batal sendiri setelah 4 detik. */
  React.useEffect(() => {
    if (!clearArm) return;
    const id = window.setTimeout(() => armClear(false), 4000);
    return () => window.clearTimeout(id);
  }, [clearArm, armClear]);

  const pct = rules.mode === "sum"
    ? Math.min(100, Math.round((tot / rules.target) * 100))
    : Math.min(100, Math.round((Math.max(val[0], val[1]) / rules.target) * 100));

  const canAdd = !readOnly && !done && sbCanAdd(val, rules.target, rules.mode);

  const big = (side: 0 | 1): string => {
    if (!tn) return String(val[side]);
    if (done) return String(val[side]);
    return tennisLabel(tn, side, rules.target, rules.deuce, tx("emas"), tx("Adv"));
  };

  const leads = (side: 0 | 1): boolean => {
    if (tn && !done) {
      if (tn.adv === side) return true;
      if (tn.adv >= 0) return false;
      return tn.pt[side] > tn.pt[1 - side];
    }
    return val[side] > val[1 - side] && tot > 0;
  };

  const onClear = () => {
    if (!clearArm && (val[0] || val[1])) {
      armClear(true);
      return;
    }
    clear();
  };

  return (
    <div className="nb-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-none sm:rounded-[var(--radius-nb-lg)]">
      <header
        className="flex items-start justify-between gap-3 border-b-[3px] p-3"
        style={{ background: "var(--nb-card-2)" }}
      >
        <div className="min-w-0">
          <div className="nb-label">{labels.kicker}</div>
          <div className="nb-title mt-0.5">{tx("Papan skor")}</div>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose} aria-label={tx("Tutup")}>
          ✕
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-3">
          {([0, 1] as const).map((i) => (
            <div
              key={i}
              className={cx(
                "nb-border flex flex-col rounded-[var(--radius-nb-lg)] p-2.5 transition-colors",
              )}
              style={{
                background: leads(i) ? "var(--nb-accent)" : "var(--nb-card-2)",
                color: leads(i) ? "var(--nb-accent-ink)" : "var(--nb-ink)",
              }}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="nb-title min-w-0 flex-1 truncate text-[13px]">
                  {i === 0 ? labels.a : labels.b}
                </span>
                {tn && (
                  <Pill tone={leads(i) ? "ink" : "hl"}>{val[i]} G</Pill>
                )}
              </div>

              <button
                type="button"
                disabled={!canAdd}
                onClick={() => tap(i, 1, rules)}
                aria-label={tx("Tekan sisi yang menang reli") + " — " + (i === 0 ? labels.a : labels.b)}
                className="tnum my-2 grid min-h-[26vh] place-items-center rounded-[var(--radius-nb)] font-cond text-[clamp(3.5rem,18vw,7rem)] font-bold leading-none disabled:opacity-100"
                style={{ fontFamily: "var(--font-cond)" }}
              >
                {big(i)}
              </button>

              <Button
                size="sm"
                disabled={readOnly || !hist.includes(i)}
                onClick={() => tap(i, -1, rules)}
              >
                − {tx("Batalkan reli")}
              </Button>
            </div>
          ))}
        </div>

        <div className="nb-bar mt-3" data-full={done ? "true" : "false"}>
          <i style={{ width: pct + "%" }} />
        </div>

        <p className="nb-label mt-2 normal-case tracking-normal">{infoLine()}</p>

        {done && (
          <Note tone="good" className="mt-3">
            {txf(
              "Selesai — {0} menang {1}–{2}. Tekan Catat ke bagan.",
              val[0] > val[1] ? labels.a : labels.b,
              Math.max(val[0], val[1]),
              Math.min(val[0], val[1]),
            )}
          </Note>
        )}
        {!done && tn && tennisAtDeuce(tn) && (
          <Note tone="warn" className="mt-3">
            {rules.deuce
              ? "40-40 · " + tx("deuce")
              : tx("Poin penentu — satu reli ini menentukan game.")}
          </Note>
        )}
        {!done && !tn && rules.mode === "sum" && tot === Math.ceil(rules.target / 2) && (
          <Note tone="warn" className="mt-3">
            {txf("Total {0} poin — saatnya bertukar sisi lapangan.", tot)}
          </Note>
        )}
        {readOnly && (
          <Note tone="info" className="mt-3">
            {tx("Perangkat ini penonton, jadi bagannya ikut pencatat.")}
          </Note>
        )}
      </div>

      <footer
        className="flex flex-wrap items-center justify-between gap-2 border-t-[3px] p-3"
        style={{ background: "var(--nb-card-2)" }}
      >
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={readOnly || !hist.length}
            onClick={() => undo(rules)}
          >
            ↶ {tx("Batalkan")}
          </Button>
          <Button
            size="sm"
            variant={clearArm ? "danger" : "default"}
            disabled={readOnly}
            onClick={onClear}
          >
            {clearArm ? tx("Klik lagi untuk kosongkan") : tx("Mulai dari 0")}
          </Button>
        </div>
        <Button
          variant="primary"
          disabled={readOnly || !done}
          onClick={() => onSave([val[0], val[1]])}
        >
          {done ? tx("Catat ke bagan") : tx("Belum selesai")}
        </Button>
      </footer>
    </div>
  );

  function infoLine(): string {
    if (tn) {
      if (done) return txf("Laga selesai · {0}–{1} game", val[0], val[1]);
      const inGame =
        TN_LBL[Math.min(3, tn.pt[0])] + "–" + TN_LBL[Math.min(3, tn.pt[1])];
      return (
        txf("Game {0} · first to {1} · skor game {2}", tot + 1, rules.target, inGame) +
        (tn.adv >= 0 ? " · " + txf("AD {0}", tn.adv === 0 ? 1 : 2) : "")
      );
    }
    if (rules.mode === "sum") {
      return txf(
        "Total {0} dari {1} poin · sisa {2} reli",
        tot,
        rules.target,
        Math.max(0, rules.target - tot),
      );
    }
    return txf("Pertama mencapai {0} menang · total reli {1}", rules.target, tot);
  }
}
