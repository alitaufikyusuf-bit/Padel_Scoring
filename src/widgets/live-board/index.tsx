"use client";

/* ============================================================================
   LAYAR LIVE

   Untuk tablet atau TV yang ditaruh di pinggir lapangan. Isinya hanya tiga
   hal, dan urutannya sudah dipikirkan: yang sedang dimainkan, skor terakhir
   yang masuk, lalu lima besar klasemen.

   Angka dibuat sebesar mungkin dan tidak ada satu pun kontrol - layar ini
   memang untuk dilihat, bukan disentuh.

   Entri papan skor berjalan dinilai umurnya dengan jam SERVER, bukan jam
   perangkat: jam HP bisa meleset berjam-jam, dan kalau itu dipakai, angka
   yang baru masuk bisa dianggap basi atau sebaliknya angka mati bertahan di
   layar sepanjang acara.
   ========================================================================== */

import { useT } from "@/shared/i18n";
import { Card, Empty, Pill, RankBadge, Table, cx } from "@/shared/ui";
import { isDone } from "@/entities/match";
import { useTournament } from "@/entities/tournament/store";
import { useSoloTable, useTable } from "@/entities/tournament/derived";
import { liveFresh, useSync } from "@/features/sync-room/store";

export function LiveBoard() {
  const { tx, txf } = useT();
  const s = useTournament();
  const live = useSync((x) => x.live);
  const table = useTable();
  const soloT = useSoloTable();
  const solo = s.fmt === "solo";

  const running = Object.entries(live)
    .filter(([, e]) => liveFresh(e))
    .sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 p-3 sm:p-4">
      <Card title={tx("Sedang dimainkan")}>
        {!running.length ? (
          <Empty>{tx("Belum ada laga yang sedang dimainkan.")}</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {running.map(([court, e]) => (
              <div
                key={court}
                className="nb-border rounded-[var(--radius-nb-lg)] p-3"
                style={{ background: "var(--nb-accent)", color: "var(--nb-accent-ink)" }}
              >
                <div className="nb-label" style={{ color: "inherit" }}>
                  {txf("Lapangan {0}", Number(court) + 1)}
                </div>
                <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-2">
                  <span
                    className="nb-title truncate text-[clamp(0.95rem,2.6vw,1.35rem)]"
                    style={{ color: "inherit" }}
                  >
                    {e.na || "—"}
                  </span>
                  <span
                    className="tnum text-[clamp(2rem,7vw,3.5rem)] font-bold leading-none"
                    style={{ fontFamily: "var(--font-cond)" }}
                  >
                    {e.a}
                  </span>
                  <span
                    className="nb-title truncate text-[clamp(0.95rem,2.6vw,1.35rem)]"
                    style={{ color: "inherit" }}
                  >
                    {e.nb || "—"}
                  </span>
                  <span
                    className="tnum text-[clamp(2rem,7vw,3.5rem)] font-bold leading-none"
                    style={{ fontFamily: "var(--font-cond)" }}
                  >
                    {e.b}
                  </span>
                </div>
                {e.by && (
                  <div className="nb-label mt-2" style={{ color: "inherit", opacity: 0.8 }}>
                    {txf("dicatat {0}", e.by)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={tx("Skor terakhir masuk")}>
        {latest().length === 0 ? (
          <Empty>{tx("Turnamen belum dimulai.")}</Empty>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {latest().map((r) => (
              <li
                key={r.key}
                className="nb-border flex items-center gap-2 rounded-[var(--radius-nb)] p-2.5"
                style={{ background: "var(--nb-card-2)" }}
              >
                <Pill tone="plain">{r.where}</Pill>
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
                  {r.a}
                </span>
                <span className="tnum shrink-0 font-bold" style={{ fontFamily: "var(--font-cond)" }}>
                  {r.sa}–{r.sb}
                </span>
                <span className="min-w-0 flex-1 truncate text-right text-[13.5px] font-semibold">
                  {r.b}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={tx("Klasemen")}>
        <Table>
          <thead>
            <tr>
              <th style={{ width: "3.25rem", minWidth: "3.25rem" }}>#</th>
              <th>{solo ? tx("Pemain") : tx("Tim")}</th>
              <th className="num">{tx("Main")}</th>
              <th className="num">{tx("W")}</th>
              <th className="num">{solo ? tx("Poin") : tx("Liga")}</th>
            </tr>
          </thead>
          <tbody>
            {(solo ? soloT : table).slice(0, 5).map((x, i) => {
              const rank = i < 3 && x.p > 0 ? i + 1 : 0;
              return (
                <tr key={x.id} data-rank={rank || undefined}>
                  <td>
                    <RankBadge rank={rank || i + 1} />
                  </td>
                  <td className={cx("font-semibold", rank === 1 && "font-black tracking-wide")}>{x.name}</td>
                  <td className="num">{x.p}</td>
                  <td className="num">{x.w}</td>
                  <td className="num">{solo ? x.tp : (x as { lp: number }).lp}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );

  /** Lima hasil terakhir yang skornya sudah masuk, urut dari belakang. */
  function latest() {
    const out: {
      key: string;
      where: string;
      a: string;
      b: string;
      sa: number;
      sb: number;
    }[] = [];
    if (solo) {
      for (let i = s.smatch.length - 1; i >= 0 && out.length < 5; i--) {
        const sc = s.sscores[i];
        const m = s.smatch[i];
        if (!m || !isDone(sc)) continue;
        const nm = (id: number) => s.pnames[id - 1] ?? "Pemain " + id;
        out.push({
          key: "s" + i,
          where: tx("Ronde") + " " + (m.r + 1),
          a: nm(m.t1[0]) + " + " + nm(m.t1[1]),
          b: nm(m.t2[0]) + " + " + nm(m.t2[1]),
          sa: sc![0] as number,
          sb: sc![1] as number,
        });
      }
    } else {
      for (let i = s.matches.length - 1; i >= 0 && out.length < 5; i--) {
        const sc = s.scores[i];
        const m = s.matches[i];
        if (!m || !isDone(sc)) continue;
        out.push({
          key: "m" + i,
          where: tx("Slot") + " " + (m.s + 1),
          a: s.names[m.a - 1] ?? "Tim " + m.a,
          b: s.names[m.b - 1] ?? "Tim " + m.b,
          sa: sc![0] as number,
          sb: sc![1] as number,
        });
      }
    }
    return out;
  }
}
