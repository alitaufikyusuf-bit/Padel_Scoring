"use client";

/* ============================================================================
   KLASEMEN

   Dua tabel dengan pembeda berbeda, tapi satu aturan tampilan: tiga teratas
   ditandai medali DAN warna baris, sehingga peringkat tetap terbaca oleh yang
   tidak bisa membedakan warna.

   Kolom yang hanya berarti di satu mode disembunyikan, tidak dikosongkan -
   kolom kosong membuat orang mencari isinya.
   ========================================================================== */

import { useT } from "@/shared/i18n";
import { Bar, Card, Empty, Pill, Table } from "@/shared/ui";
import { isDone } from "@/entities/match";
import { useTournament } from "@/entities/tournament/store";
import { useKo, useProgress, useSoloTable, useTable } from "@/entities/tournament/derived";
import { WIN_PTS } from "@/shared/config";

const MEDAL = ["🥇", "🥈", "🥉"];

export function StandingsTable() {
  const fmt = useTournament((s) => s.fmt);
  return fmt === "solo" ? <SoloStandings /> : <PairStandings />;
}

/* ------------------------------------------------------------ Fix Partner -- */

function PairStandings() {
  const { tx, txf } = useT();
  const s = useTournament();
  const table = useTable();
  const ko = useKo();
  const prog = useProgress();

  /* Poin liga maksimum: menang seluruh pertandingan melawan n-1 tim lain. */
  const maxLP = (s.n - 1) * WIN_PTS;
  let draws = 0;
  for (const x of s.scores) if (isDone(x) && x[0] === x[1]) draws++;

  if (!table.length) return null;

  return (
    <Card
      title={tx("Klasemen")}
      actions={
        <Pill tone={prog.complete ? "good" : "plain"}>
          {txf("{0} laga terisi", prog.done + "/" + prog.total)}
        </Pill>
      }
    >
      <Table>
        <thead>
          <tr>
            <th style={{ width: "2.5rem" }}>#</th>
            <th>{tx("Tim")}</th>
            <th className="num">{tx("M")}</th>
            <th className="num">{tx("W")}</th>
            {draws > 0 && <th className="num">{tx("S")}</th>}
            <th className="num">{tx("L")}</th>
            <th className="num">{tx("Liga")}</th>
            <th className="num">{tx("Cetak")}</th>
            <th className="num">{tx("Selisih")}</th>
            <th style={{ minWidth: "5rem" }}>{tx("Progres")}</th>
          </tr>
        </thead>
        <tbody>
          {table.map((x, i) => {
            /* Saat knockout aktif, empat teratas adalah UNGGULAN yang lolos,
               bukan juara - medali disimpan untuk hasil knockout. */
            const seeded = ko.active && i < 4;
            const rank = !ko.active && i < 3 && x.p > 0 ? i + 1 : 0;
            return (
              <tr key={x.id} data-rank={rank || undefined}>
                <td>
                  {seeded ? (
                    <Pill tone="hl">S{i + 1}</Pill>
                  ) : rank ? (
                    <span aria-label={txf("Peringkat {0}", rank)}>{MEDAL[rank - 1]}</span>
                  ) : (
                    i + 1
                  )}
                </td>
                <td className="font-semibold">{x.name}</td>
                <td className="num">{x.p}</td>
                <td className="num">{x.w}</td>
                {draws > 0 && <td className="num">{x.d}</td>}
                <td className="num">{x.l}</td>
                <td className="num" style={{ color: "var(--nb-hl)" }}>
                  {x.lp}
                </td>
                <td className="num">{x.tp}</td>
                <td className="num">{(x.sp > 0 ? "+" : "") + x.sp}</td>
                <td>
                  <Bar pct={(x.lp / Math.max(1, maxLP)) * 100} full={x.lp === maxLP} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <p className="nb-label mt-3 normal-case tracking-normal">
        {txf("{0} dari {1} pertandingan selesai · poin liga maksimum {2}", prog.done, prog.total, maxLP)}
        {draws > 0 ? " · " + txf("{0} hasil seri", draws) : ""}
        {prog.invalid > 0 ? " · " + txf("{0} skor tidak sah", prog.invalid) : ""}
      </p>
    </Card>
  );
}

/* --------------------------------------------------------------- Individu -- */

function SoloStandings() {
  const { tx, txf } = useT();
  const s = useTournament();
  const table = useSoloTable();
  const prog = useProgress();

  /* Di Mexicano peringkat SELALU dari poin cetak, dan urutannya juga yang
     dipakai menyusun ronde berikutnya - jadi kolom Poin Liga tidak relevan. */
  const byWin = !s.mexOn && s.soloRank === "wins";
  let draws = 0;
  for (const x of s.sscores) if (isDone(x) && x[0] === x[1]) draws++;

  const max = Math.max(1, table[0] ? (byWin ? table[0].lp : table[0].tp) : 1);

  return (
    <Card
      title={s.mexOn ? tx("Klasemen Mexicano") : tx("Klasemen Individu")}
      actions={
        <Pill tone={prog.complete ? "good" : "plain"}>
          {txf("{0} laga terisi", prog.done + "/" + prog.total)}
        </Pill>
      }
      note={s.mexOn ? tx("Urutan ini yang dipakai menyusun ronde berikutnya.") : undefined}
    >
      {!table.length ? (
        <Empty>{tx("Belum ada bagan.")}</Empty>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <th style={{ width: "2.5rem" }}>#</th>
                <th>{tx("Pemain")}</th>
                <th className="num">{tx("Main")}</th>
                <th className="num">{tx("W")}</th>
                {draws > 0 && <th className="num">{tx("S")}</th>}
                <th className="num">{tx("L")}</th>
                {byWin && <th className="num">{tx("Liga")}</th>}
                <th className="num">{tx("Poin")}</th>
                <th className="num">{tx("Rata²")}</th>
                <th className="num">{tx("Selisih")}</th>
                <th style={{ minWidth: "5rem" }}>{tx("Progres")}</th>
              </tr>
            </thead>
            <tbody>
              {table.map((x, i) => {
                const rank = i < 3 && x.p > 0 ? i + 1 : 0;
                const out = !!s.mexOut[x.id];
                return (
                  <tr key={x.id} data-rank={rank || undefined} style={out ? { opacity: 0.55 } : undefined}>
                    <td>
                      {rank ? (
                        <span aria-label={txf("Peringkat {0}", rank)}>{MEDAL[rank - 1]}</span>
                      ) : (
                        i + 1
                      )}
                    </td>
                    <td className="font-semibold">
                      {x.name}
                      {out && (
                        <>
                          {" "}
                          <Pill tone="plain">{tx("tidak hadir")}</Pill>
                        </>
                      )}
                    </td>
                    <td className="num">{x.p}</td>
                    <td className="num">{x.w}</td>
                    {draws > 0 && <td className="num">{x.d}</td>}
                    <td className="num">{x.l}</td>
                    {byWin && (
                      <td className="num" style={{ color: "var(--nb-hl)" }}>
                        {x.lp}
                      </td>
                    )}
                    <td className="num">{x.tp}</td>
                    <td className="num">{x.p ? x.avg.toFixed(1) : "–"}</td>
                    <td className="num">{(x.sp > 0 ? "+" : "") + x.sp}</td>
                    <td>
                      <Bar pct={((byWin ? x.lp : x.tp) / max) * 100} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <p className="nb-label mt-3 normal-case tracking-normal">
            {txf("{0} dari {1} pertandingan selesai", prog.done, prog.total)}
            {prog.invalid > 0 ? " · " + txf("{0} skor tidak sah", prog.invalid) : ""}
          </p>
        </>
      )}
    </Card>
  );
}

/* ============================================================================
   PODIUM

   Kalau knockout aktif, juara ditentukan dari knockout - BUKAN dari klasemen
   liga. Klasemen di situ cuma penentu unggulan. Tanpa perebutan juara 3, dua
   tim yang kalah di semifinal sama-sama peringkat 3 dan keduanya disebut.
   ========================================================================== */

export function Podium() {
  const { t, tx } = useT();
  const s = useTournament();
  const ko = useKo();
  const table = useTable();
  const soloT = useSoloTable();
  const prog = useProgress();

  const nm = (id: number | null) => (id ? (s.names[id - 1] ?? "Tim " + id) : "—");

  if (s.fmt === "solo") {
    if (!prog.complete || !soloT.length) return null;
    return (
      <Card title={t("cardPodium")} note={t("tipPod")}>
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {soloT.slice(0, 3).map((x, i) => (
            <li
              key={x.id}
              className="nb-border flex items-center gap-3 rounded-[var(--radius-nb)] p-2.5"
              data-rank={i + 1}
              style={{ background: podiumBg(i) }}
            >
              <span className="text-[22px]">{MEDAL[i]}</span>
              <span className="nb-title flex-1 truncate">{x.name}</span>
              <Pill tone="ink">
                {x.tp} {tx("poin")}
              </Pill>
            </li>
          ))}
        </ol>
      </Card>
    );
  }

  if (!ko.active) {
    if (!prog.complete || !table.length) return null;
    return (
      <Card title={t("cardPodium")} note={tx("Juara 1, 2, dan 3 langsung diambil dari tiga teratas klasemen liga.")}>
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {table.slice(0, 3).map((x, i) => (
            <li
              key={x.id}
              className="nb-border flex items-center gap-3 rounded-[var(--radius-nb)] p-2.5"
              style={{ background: podiumBg(i) }}
            >
              <span className="text-[22px]">{MEDAL[i]}</span>
              <span className="nb-title flex-1 truncate">{x.name}</span>
              <Pill tone="ink">
                {x.lp} {tx("poin liga")}
              </Pill>
            </li>
          ))}
        </ol>
      </Card>
    );
  }

  const p = ko.podium;
  if (!p.first) return null;

  return (
    <Card title={t("cardPodium")} note={t("tipPod")}>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        <li
          className="nb-border flex items-center gap-3 rounded-[var(--radius-nb)] p-2.5"
          style={{ background: podiumBg(0) }}
        >
          <span className="text-[22px]">{MEDAL[0]}</span>
          <span className="nb-title flex-1 truncate">{nm(p.first)}</span>
          <Pill tone="ink">{tx("Juara")}</Pill>
        </li>
        {p.second && (
          <li
            className="nb-border flex items-center gap-3 rounded-[var(--radius-nb)] p-2.5"
            style={{ background: podiumBg(1) }}
          >
            <span className="text-[22px]">{MEDAL[1]}</span>
            <span className="nb-title flex-1 truncate">{nm(p.second)}</span>
          </li>
        )}
        {p.third && (
          <li
            className="nb-border flex items-center gap-3 rounded-[var(--radius-nb)] p-2.5"
            style={{ background: podiumBg(2) }}
          >
            <span className="text-[22px]">{MEDAL[2]}</span>
            <span className="nb-title flex-1 truncate">{nm(p.third)}</span>
          </li>
        )}
        {p.thirdAlt && (p.thirdAlt[0] || p.thirdAlt[1]) && (
          <li
            className="nb-border flex flex-wrap items-center gap-2 rounded-[var(--radius-nb)] p-2.5"
            style={{ background: podiumBg(2) }}
          >
            <span className="text-[22px]">{MEDAL[2]}</span>
            <span className="nb-label">{tx("Peringkat 3 bersama")}</span>
            <span className="nb-title flex-1">
              {[p.thirdAlt[0], p.thirdAlt[1]].filter(Boolean).map(nm).join(" · ")}
            </span>
          </li>
        )}
      </ol>
    </Card>
  );
}

function podiumBg(i: number): string {
  if (i === 0) return "color-mix(in srgb, var(--color-gold) 34%, transparent)";
  if (i === 1) return "color-mix(in srgb, var(--color-silver) 40%, transparent)";
  return "color-mix(in srgb, var(--color-bronze) 28%, transparent)";
}
