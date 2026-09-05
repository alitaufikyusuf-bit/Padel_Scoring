"use client";

/* ============================================================================
   DAFTAR TIM / PEMAIN

   Nama bisa diubah kapan saja tanpa menyentuh bagan - itu penting karena
   penyelenggara sering mengisi "Tim 1..6" dulu lalu menamainya saat orangnya
   datang.

   Menambah atau mengurangi peserta MENYUSUN ULANG bagan, jadi tindakan itu
   dijaga konfirmasi kalau sudah ada skor.

   Di Mexicano, tiap pemain punya penanda kehadiran. Yang tidak hadir tidak
   ikut diundi tapi riwayatnya tetap utuh, jadi dia bisa dikembalikan kapan
   saja tanpa kehilangan poin.
   ========================================================================== */

import { MAX_P, MAX_T, MIN_P, MIN_T } from "@/shared/config";
import { useT } from "@/shared/i18n";
import { Button, Card, Input, Note, Pill } from "@/shared/ui";
import { useTournament } from "@/entities/tournament/store";
import { useMex, useSoloStats, atStakeOf } from "@/entities/tournament/derived";
import { useSb } from "@/features/scoreboard/store";
import { useSync } from "@/features/sync-room/store";
import { askConfirm } from "@/features/confirm";

export function RosterCard() {
  const { t, tx, txf } = useT();
  const s = useTournament();
  const viewer = useSync((x) => x.role === "viewer");
  const drafts = useSb((x) => Object.keys(x.drafts).length);
  const solo = s.fmt === "solo";

  const count = solo ? s.np : s.n;
  const min = solo ? MIN_P : MIN_T;
  const max = solo ? MAX_P : MAX_T;
  const names = solo ? s.pnames : s.names;

  /* Tindakan yang menyusun ulang bagan diminta konfirmasi kalau ada yang
     dipertaruhkan - termasuk hitungan yang masih berjalan di papan skor. */
  const guard = (title: string, run: () => void) => {
    const st = atStakeOf(s, drafts);
    if (!st.any) {
      run();
      return;
    }
    askConfirm({
      title,
      body: tx(
        "Bagan disusun ulang, jadi skor yang sudah masuk tidak lagi cocok dengan pertandingannya dan akan dikosongkan.",
      ),
      risk:
        st.done +
        tx(" laga berskor") +
        (st.drafts ? " · " + st.drafts + tx(" hitungan belum dicatat") : ""),
      okLabel: tx("Ya, lanjutkan"),
      onOk: run,
    });
  };

  return (
    <Card
      title={solo ? t("navPemain") : t("navTim")}
      note={solo ? t("tipRosterSolo") : t("tipRoster")}
      actions={
        <>
          <Pill tone="plain">
            {solo ? txf("{0} pemain", count) : txf("{0} tim", count)}
          </Pill>
          <Button
            size="sm"
            disabled={viewer || count >= max}
            onClick={() =>
              guard(
                solo ? tx("Tambah pemain?") : tx("Tambah tim?"),
                () => (solo ? s.setPlayerCount(count + 1) : s.setTeamCount(count + 1)),
              )
            }
          >
            {solo ? tx("+ Tambah pemain") : tx("+ Tambah tim")}
          </Button>
          <Button
            size="sm"
            disabled={viewer || count <= min}
            onClick={() =>
              guard(
                solo ? tx("Kurangi pemain?") : tx("Kurangi tim?"),
                () => (solo ? s.setPlayerCount(count - 1) : s.setTeamCount(count - 1)),
              )
            }
          >
            {solo ? tx("− Kurangi pemain") : tx("− Kurangi tim")}
          </Button>
        </>
      }
    >
      <ol className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
        {Array.from({ length: count }, (_, i) => (
          <RosterRow
            key={i}
            index={i}
            name={names[i] ?? (solo ? "Pemain " + (i + 1) : "Tim " + (i + 1))}
            solo={solo}
            viewer={viewer}
            canRemove={count > min}
            onRemove={() =>
              guard(
                txf("Keluarkan {0}?", names[i] ?? ""),
                () => (solo ? s.removePlayer(i) : s.removeTeam(i)),
              )
            }
          />
        ))}
      </ol>

      {solo && !s.mexOn && <SoloQuality />}
      {solo && s.mexOn && <MexAttendance />}
    </Card>
  );
}

function RosterRow({
  index,
  name,
  solo,
  viewer,
  canRemove,
  onRemove,
}: {
  index: number;
  name: string;
  solo: boolean;
  viewer: boolean;
  canRemove: boolean;
  onRemove(): void;
}) {
  const { tx, txf } = useT();
  const s = useTournament();
  const mexOn = s.mexOn;
  const out = !!s.mexOut[index + 1];

  return (
    <li className="flex items-center gap-2">
      <span
        className="nb-border grid size-7 shrink-0 place-items-center rounded-[var(--radius-nb)] text-[12px] font-bold"
        style={{ background: "var(--nb-card-2)", borderWidth: 2 }}
      >
        {index + 1}
      </span>
      <Input
        className="min-w-0 flex-1"
        value={name}
        disabled={viewer}
        maxLength={40}
        aria-label={solo ? txf("Nama pemain {0}", index + 1) : txf("Nama tim {0}", index + 1)}
        onChange={(e) =>
          solo ? s.renamePlayer(index, e.target.value) : s.renameTeam(index, e.target.value)
        }
        style={out ? { opacity: 0.55 } : undefined}
      />
      {mexOn && (
        <Button
          size="sm"
          variant={out ? "default" : "ghost"}
          disabled={viewer}
          title={out ? tx("Tandai hadir") : tx("Tandai tidak hadir")}
          onClick={() => s.toggleOut(index + 1)}
        >
          {out ? tx("Hadir") : tx("Absen")}
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        disabled={viewer || !canRemove}
        aria-label={txf("Keluarkan {0}", name)}
        onClick={onRemove}
      >
        ✕
      </Button>
    </li>
  );
}

/* --------------------------------------------------------------------------- */

function SoloQuality() {
  const { txf } = useT();
  const st = useSoloStats();
  if (!st.pairsTotal) return null;
  const rata = st.minG === st.maxG;
  return (
    <p className="nb-label mt-3 normal-case tracking-normal">
      {rata
        ? txf("Porsi main {0}× · {1} dari {2} kemungkinan pasangan terpakai", st.minG, st.pairsMet, st.pairsTotal)
        : txf("Porsi main {0}–{1}× · {2} dari {3} kemungkinan pasangan terpakai", st.minG, st.maxG, st.pairsMet, st.pairsTotal)}
      {st.repeat > 0 ? " · " + txf("{0} pasangan terulang", st.repeat) : ""}
    </p>
  );
}

function MexAttendance() {
  const { txf } = useT();
  const s = useTournament();
  const mex = useMex();
  const cukup = mex.present >= mex.seatsNeeded;

  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="nb-label normal-case tracking-normal">
        {txf(
          "{0} hadir dari {1} pemain · butuh {2} orang untuk {3} lapangan",
          mex.present,
          s.np,
          mex.seatsNeeded,
          mex.courts,
        )}
      </p>
      {!cukup && (
        <Note tone="warn">
          {txf(
            "Pemain yang hadir kurang: butuh {0} orang untuk {1} lapangan, yang hadir baru {2}. Kurangi lapangan atau tandai ada yang hadir lagi.",
            mex.seatsNeeded,
            mex.courts,
            mex.present,
          )}
        </Note>
      )}
      {mex.spread.gap > 1 && (
        <p className="nb-label normal-case tracking-normal">
          {txf("porsi main: {0}–{1}× · selisih {2} laga", mex.spread.min, mex.spread.max, mex.spread.gap)}
        </p>
      )}
    </div>
  );
}

