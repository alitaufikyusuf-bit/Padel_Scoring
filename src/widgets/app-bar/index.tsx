"use client";

/* ============================================================================
   BILAH ATAS, NAVIGASI, DAN TEKS BERJALAN

   Bilah ini tinggi tetap dan lengket di atas: di HP, tombol yang paling sering
   dipakai (Segarkan untuk penonton, Kirim bagan untuk pencatat) harus bisa
   dijangkau tanpa berpindah tab. Itu pelajaran dari v1.3 - dulu keduanya
   terkubur di tab Atur dan pencatat harus bolak-balik sepanjang acara.

   Teks berjalan di bawahnya memuat ringkasan yang tidak layak memakan satu
   kartu sendiri: jumlah laga, jam, progres, slot yang sedang jalan, dan
   pemimpin klasemen.
   ========================================================================== */

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { clock } from "@/shared/lib";
import { useI18n, useT, type UiKey } from "@/shared/i18n";
import { Button, Pill } from "@/shared/ui";
import { useTournament } from "@/entities/tournament/store";
import {
  useKo,
  useProgress,
  useSoloTable,
  useTable,
} from "@/entities/tournament/derived";
import { useTrList } from "@/entities/tournament/list-store";
import { useSync } from "@/features/sync-room/store";
import { useCode } from "@/features/sync-room/useSession";
import { syErrText } from "@/features/sync-room/api";

const TABS: { href: string; key: UiKey }[] = [
  { href: "/bagan", key: "navBagan" },
  { href: "/klasemen", key: "navKlasemen" },
  { href: "/atur", key: "navAtur" },
  { href: "/live", key: "navLive" },
];

export function AppBar({ onHome }: { onHome(): void }) {
  const { t, tx, txf } = useT();
  const lang = useI18n((s) => s.lang);
  const theme = useI18n((s) => s.theme);
  const toggleLang = useI18n((s) => s.toggleLang);
  const cycleTheme = useI18n((s) => s.cycleTheme);
  const pathname = usePathname();

  const evTitle = useTournament((s) => s.evTitle);
  const evDate = useTournament((s) => s.evDate);
  const rec = useTrList((s) => s.get(null));
  const sync = useSync();
  const code = useCode();
  const [busy, setBusy] = React.useState(false);
  const [flash, setFlash] = React.useState("");

  React.useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(""), 4000);
    return () => window.clearTimeout(id);
  }, [flash]);

  const themeWord =
    theme === "auto" ? tx("ikut perangkat") : theme === "dark" ? tx("gelap") : tx("terang");

  return (
    <header
      className="noprint sticky top-0 z-40 border-b-[3px]"
      style={{ background: "var(--nb-card)", borderColor: "var(--nb-line)" }}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onHome}
          className="min-w-0 shrink-0 text-left"
          aria-label={tx("Buka daftar turnamen")}
        >
          <span className="nb-label block">MN Padel Club</span>
          <span className="nb-title block max-w-[46vw] truncate text-[15px] sm:max-w-none">
            {rec?.name || evTitle}
          </span>
        </button>

        {evDate && <Pill tone="plain">{evDate}</Pill>}

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {sync.room && (
            <Pill tone={sync.fail > 0 ? "danger" : sync.role === "scorer" ? "good" : "hl"}>
              {sync.room} · {sync.role === "scorer" ? tx("Pencatat") : tx("Penonton")}
              {sync.fail > 0 ? tx(" · terputus") : ""}
            </Pill>
          )}

          {/* Penonton hanya perlu Segarkan; pencatat perlu Kirim bagan. */}
          {sync.room && sync.role === "viewer" && (
            <Button
              size="sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await sync.tick();
                setBusy(false);
                setFlash(
                  useSync.getState().fail === 0
                    ? txf("Sudah paling baru (versi {0}).", useSync.getState().rev)
                    : tx("Tidak ada koneksi ke server. Bagan tetap aman di perangkat ini."),
                );
              }}
            >
              {t("btnRefresh")}
            </Button>
          )}
          {sync.room && sync.role === "scorer" && (
            <Button
              size="sm"
              variant="hl"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const r = await sync.pushFull(code);
                setBusy(false);
                setFlash(r.ok ? txf("✓ Bagan terkirim · versi {0}", r.rev ?? "?") : syErrText(r, tx));
              }}
            >
              {t("btnSendTop")}
            </Button>
          )}

          <Button size="sm" variant="ghost" onClick={toggleLang} title={tx("Bahasa")}>
            {lang === "en" ? "ID" : "EN"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={cycleTheme}
            title={tx("Tema") + ": " + themeWord}
            aria-label={tx("Tema") + ": " + themeWord}
          >
            {theme === "dark" ? "🌙" : theme === "light" ? "☀" : "◐"}
          </Button>
        </div>
      </div>

      <nav className="mx-auto flex w-full max-w-5xl gap-0 overflow-x-auto px-3 pb-2">
        <span className="nb-seg">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              data-on={pathname === tab.href}
              className="nb-seg-link"
              style={{
                appearance: "none",
                borderLeft: "3px solid var(--nb-line)",
                padding: "0.4375rem 0.75rem",
                fontFamily: "var(--font-cond)",
                fontWeight: 700,
                fontSize: "0.75rem",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                background: pathname === tab.href ? "var(--nb-ink)" : "transparent",
                color: pathname === tab.href ? "var(--nb-bg)" : "var(--nb-ink)",
              }}
            >
              {t(tab.key)}
            </Link>
          ))}
        </span>
      </nav>

      {flash && (
        <p
          className="mx-auto w-full max-w-5xl px-3 pb-2 text-[12.5px] font-semibold"
          role="status"
          style={{ color: "var(--nb-hl)" }}
        >
          {flash}
        </p>
      )}

      <Ticker />
    </header>
  );
}

/* --------------------------------------------------------------------------- */

function Ticker() {
  const { tx, txf } = useT();
  const s = useTournament();
  const prog = useProgress();
  const ko = useKo();
  const table = useTable();
  const soloT = useSoloTable();

  const bits: string[] = [];
  const solo = s.fmt === "solo";

  bits.push(
    (solo ? txf("{0} pemain", s.np) : txf("{0} tim", s.n)) +
      " · " +
      txf("{0} laga", prog.total) +
      " · " +
      txf("Lapangan {0}", s.courts),
  );

  const groups = solo ? s.rnd.length : s.slots.length;
  if (groups) {
    const end = s.startMin + (groups + ko.slotCount) * s.slotMin;
    bits.push(clock(s.startMin) + "–" + clock(end));
  }

  bits.push(txf("{0} laga terisi", prog.done + "/" + prog.total));

  const leader = solo ? soloT[0] : table[0];
  if (leader && leader.p > 0) {
    bits.push(
      tx("Pemimpin: ") +
        leader.name +
        " · " +
        (solo ? leader.tp + tx(" poin") : (leader as { lp: number }).lp + tx(" poin liga")),
    );
  }

  if (s.mexOn) bits.push("Mexicano · " + txf("{0}/{1} ronde", s.rnd.length, s.rounds));
  if (ko.active && !ko.leagueDone) bits.push(tx("menunggu babak liga selesai"));

  const text = bits.join("   ·   ");

  return (
    <div
      className="nb-ticker border-t-[3px] px-3 py-1.5 text-[12px] font-semibold"
      style={{ background: "var(--nb-card-2)", borderColor: "var(--nb-line)" }}
      aria-live="off"
    >
      <span>{text}</span>
    </div>
  );
}
