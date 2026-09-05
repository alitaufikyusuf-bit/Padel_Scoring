"use client";

/* ============================================================================
   DAFTAR TURNAMEN — layar pembuka

   Menggantikan gerbang lama yang menanyakan peran dan kode ruang sebelum apa
   pun. Tiga hal yang salah di gerbang itu, dan cara ini memperbaikinya:

     1. Pertanyaan pertamanya teknis, bukan manusiawi. Tidak ada orang datang
        sambil berpikir "saya pencatat" - yang ada di kepalanya "Kamisan malam
        ini". Jadi yang ditanya sekarang TURNAMEN.
     2. Peran itu bukan sifat orang, tapi sifat hubungan orang dengan SATU
        turnamen. Jadi peran disimpan per rekaman, bukan satu nilai global.
     3. Riwayat sudah ada tapi terkubur dan manual. Sekarang tiap turnamen
        tercatat sendiri pada setiap perubahan.

   "Tanpa sinkronisasi" juga hilang sebagai pilihan: semua turnamen mulai
   lokal dan jadi bersama saat dibagikan.
   ========================================================================== */

import * as React from "react";

import { MAX_C, MAX_P, MAX_T, MIN_P, MIN_T } from "@/shared/config";
import { cleanRoom, stamp } from "@/shared/lib";
import { useT } from "@/shared/i18n";
import { Button, Card, Empty, Field, Input, Note, Pill, Segmented } from "@/shared/ui";
import { decodeCode, encodeCode, summarizeCode } from "@/entities/draw-code";
import {
  trDone,
  trFilterList,
  trFmtKey,
  trProgress,
  trResume,
  type TrFilter,
  type TrRecord,
} from "@/entities/tournament/model";
import { useTrList } from "@/entities/tournament/list-store";
import { useTournament } from "@/entities/tournament/store";
import { makeStandard } from "@/entities/schedule/pair";
import { makeSolo } from "@/entities/schedule/solo";
import { mexRound1 } from "@/entities/schedule/mexicano";
import { apiCall, syErrText } from "@/features/sync-room/api";
import { useSync } from "@/features/sync-room/store";
import { askConfirm } from "@/features/confirm";
import type { Fmt, ScoreSys } from "@/shared/types";

type Pane = "list" | "new" | "join";

export function TournamentList({ onOpen }: { onOpen(): void }) {
  const [pane, setPane] = React.useState<Pane>("list");
  const joinFrom = useJoinFromHash();

  React.useEffect(() => {
    if (joinFrom) setPane("join");
  }, [joinFrom]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 p-3 sm:p-4">
      {pane === "list" && <ListPane onOpen={onOpen} go={setPane} />}
      {pane === "new" && <NewPane onOpen={onOpen} back={() => setPane("list")} />}
      {pane === "join" && (
        <JoinPane onOpen={onOpen} back={() => setPane("list")} initialRoom={joinFrom} />
      )}
    </div>
  );
}

/* Tautan undangan #/join/KODE. Dibaca SEBELUM apa pun menulis alamat -
   di versi vanilla, showPage() menimpanya sebelum sempat dibaca. */
function useJoinFromHash(): string {
  const [room, setRoom] = React.useState("");
  React.useEffect(() => {
    const h = window.location.hash || "";
    const m = h.match(/^#\/join\/([^/?&]+)/);
    if (m) setRoom(cleanRoom(decodeURIComponent(m[1]!)));
  }, []);
  return room;
}

/* ------------------------------------------------------------- daftar ---- */

function ListPane({ onOpen, go }: { onOpen(): void; go(p: Pane): void }) {
  const { t, tx, txf, lang } = useT();
  const list = useTrList((s) => s.list);
  const filter = useTrList((s) => s.filter);
  const setFilter = useTrList((s) => s.setFilter);
  const open = useTrList((s) => s.open);
  const remove = useTrList((s) => s.remove);
  const fromDecoded = useTournament((s) => s.fromDecoded);
  const sync = useSync();

  const rows = trFilterList(list, filter);
  const resume = trResume(list);
  const [err, setErr] = React.useState("");

  const openRec = (rec: TrRecord) => {
    const r = decodeCode(rec.code);
    if (!r.ok) {
      /* Rekaman dengan kode rusak dulu dibuka tanpa kabar: loadCode menolaknya
         dengan benar, tapi pesannya menclok di layar yang sedang tidak
         terlihat, sehingga mengetuk barisnya seolah tidak melakukan apa-apa. */
      setErr(txf("Turnamen “{0}” tidak bisa dibuka: kode bagannya rusak.", rec.name));
      return;
    }
    open(rec.id);
    fromDecoded(r.data);
    if (rec.room) {
      sync.join({
        room: rec.room,
        pin: rec.pin,
        role: rec.role === "viewer" ? "viewer" : "scorer",
        rev: rec.rev,
      });
    } else {
      sync.off();
    }
    onOpen();
  };

  return (
    <>
      <Card
        title={t("hmTitle")}
        note={t("hmSub")}
        actions={
          <>
            <Button size="sm" variant="primary" onClick={() => go("new")}>
              {t("hmNew")}
            </Button>
            <Button size="sm" onClick={() => go("join")}>
              {t("hmJoin")}
            </Button>
          </>
        }
      >
        <Segmented
          value={filter}
          onChange={(v: TrFilter) => setFilter(v)}
          ariaLabel={t("hmAll")}
          options={[
            { value: "all", label: t("hmAll") },
            { value: "active", label: t("hmRun") },
            { value: "past", label: t("hmEnd") },
          ]}
        />

        {err && (
          <Note tone="danger" className="mt-3">
            {err}
          </Note>
        )}

        {resume && filter === "all" && (
          <div className="mt-3">
            <p className="nb-label mb-1.5">{tx("Lanjutkan")}</p>
            <Row rec={resume} lang={lang} onOpen={openRec} onDelete={askDelete} highlight />
          </div>
        )}

        <div className="mt-3 flex flex-col gap-2">
          {!rows.length ? (
            <Empty>
              {filter === "active"
                ? tx("Tidak ada yang berlangsung.")
                : filter === "past"
                  ? tx("Belum ada yang selesai.")
                  : tx("Belum ada turnamen. Tekan “+ Turnamen baru” untuk mulai.")}
            </Empty>
          ) : (
            rows.map((r) => (
              <Row key={r.id} rec={r} lang={lang} onOpen={openRec} onDelete={askDelete} />
            ))
          )}
        </div>
      </Card>
    </>
  );

  function askDelete(rec: TrRecord) {
    askConfirm({
      title: tx("Hapus turnamen ini?"),
      body: tx(
        "Rekamannya hilang dari perangkat ini. Kalau turnamennya sudah dibagikan, bagannya masih aman di ruang dan bisa dipanggil kembali lewat Gabung.",
      ),
      risk: rec.name,
      okLabel: tx("Ya, hapus"),
      onOk: () => remove(rec.id),
    });
  }
}

function Row({
  rec,
  lang,
  onOpen,
  onDelete,
  highlight,
}: {
  rec: TrRecord;
  lang: "id" | "en";
  onOpen(r: TrRecord): void;
  onDelete(r: TrRecord): void;
  highlight?: boolean;
}) {
  const { tx, txf } = useT();
  const p = trProgress(rec);
  const done = trDone(rec);
  const fk = trFmtKey(rec);
  const sum = summarizeCode(rec.code);

  const fmtName =
    fk === "mexicano" ? "Mexicano" : fk === "americano" ? tx("Americano") : tx("Fix Partner");

  return (
    <div
      className="nb-border nb-shadow-sm flex flex-wrap items-center gap-2 rounded-[var(--radius-nb)] p-2.5"
      style={{ background: highlight ? "var(--nb-accent)" : "var(--nb-card)" }}
    >
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={() => onOpen(rec)}
        aria-label={txf("Buka {0}", rec.name)}
      >
        <div className="nb-title truncate text-[15px]">{rec.name || tx("Turnamen")}</div>
        <div className="nb-label mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 normal-case tracking-normal">
          <span>{rec.date || stamp(rec.at, lang)}</span>
          <span aria-hidden>·</span>
          <span>{fmtName}</span>
          {sum && (
            <>
              <span aria-hidden>·</span>
              <span>
                {fk === "pair" ? txf("{0} tim", sum.count) : txf("{0} pemain", sum.count)}
              </span>
            </>
          )}
          <span aria-hidden>·</span>
          <span>{txf("{0} laga terisi", p.isi + "/" + p.total)}</span>
        </div>
      </button>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <Pill tone={done ? "good" : "hl"}>{done ? tx("Selesai") : tx("Berlangsung")}</Pill>
        {rec.room ? (
          <Pill tone="ink">{rec.room}</Pill>
        ) : (
          <Pill tone="plain">{tx("Belum dibagikan")}</Pill>
        )}
        {rec.role !== "solo" && (
          <Pill tone="plain">
            {rec.role === "scorer" ? tx("Pencatat") : tx("Penonton")}
          </Pill>
        )}
        <Button
          size="sm"
          variant="ghost"
          aria-label={txf("Hapus {0}", rec.name)}
          onClick={() => onDelete(rec)}
        >
          🗑
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- buat baru ---- */

function NewPane({ onOpen, back }: { onOpen(): void; back(): void }) {
  const { t, tx, txf } = useT();
  const create = useTrList((s) => s.create);
  const fromDecoded = useTournament((s) => s.fromDecoded);
  const sync = useSync();

  const [name, setName] = React.useState("");
  const [date, setDate] = React.useState("");
  const [kind, setKind] = React.useState<"pair" | "solo" | "mex">("pair");
  const [count, setCount] = React.useState(8);
  const [courts, setCourts] = React.useState(2);
  const [sys, setSys] = React.useState<ScoreSys>("points");
  const [err, setErr] = React.useState("");

  const solo = kind !== "pair";
  const min = solo ? MIN_P : MIN_T;
  const max = solo ? MAX_P : MAX_T;
  const clamped = Math.max(min, Math.min(max, count));

  return (
    <Card
      title={t("hmNewTitle")}
      note={t("hmNewSub")}
      actions={
        <Button size="sm" onClick={back}>
          {t("hmBack")}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label={t("hmName")} htmlFor="nwName">
          <Input
            id="nwName"
            className="min-w-0 flex-1"
            placeholder={tx("Kamisan TH")}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label={t("hmDate")} htmlFor="nwDate">
          <Input
            id="nwDate"
            className="min-w-0 flex-1"
            placeholder={tx("4 September 2026")}
            value={date}
            maxLength={40}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label={t("hmFmt")}>
          <Segmented
            value={kind}
            onChange={(v) => {
              setKind(v);
              /* Jumlah bawaan berbeda per format, dan mengubahnya bersama
                 formatnya menghindari kombinasi yang tidak mungkin. */
              setCount(v === "pair" ? 6 : 8);
            }}
            options={[
              { value: "pair", label: t("btnFmtPair") },
              { value: "solo", label: t("btnFmtSolo") },
              { value: "mex", label: t("btnFmtMex") },
            ]}
          />
        </Field>
        {/* Satu kunci kamus untuk dua hal berbeda akan salah di salah satunya:
            Fix Partner menghitung TIM, dua format lainnya menghitung ORANG. */}
        <Field label={solo ? tx("Jumlah pemain") : tx("Jumlah tim")} htmlFor="nwCount">
          <Input
            id="nwCount"
            type="number"
            min={min}
            max={max}
            className="w-24"
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value, 10) || min)}
          />
          <Pill tone="plain">
            {min}–{max}
          </Pill>
        </Field>
        <Field label={t("hmCourts")}>
          <Segmented<number>
            value={courts}
            onChange={setCourts}
            options={Array.from({ length: MAX_C }, (_, i) => ({
              value: i + 1,
              label: String(i + 1),
            }))}
          />
        </Field>
        <Field label={t("hmScore")}>
          <Segmented
            value={sys}
            onChange={(v: ScoreSys) => setSys(v)}
            options={[
              { value: "points", label: t("btnSysPt") },
              { value: "tennis", label: t("btnSysTn") },
            ]}
          />
        </Field>

        {err && <Note tone="danger">{err}</Note>}

        <Note tone="info">
          {tx("Dibuat lokal dulu. Anda otomatis pencatatnya, dan berbagi jadi langkah tersendiri di dalam turnamen.")}
        </Note>

        <Button
          variant="primary"
          onClick={() => {
            const code = buildCode();
            if (!code) return;
            const r = decodeCode(code);
            if (!r.ok) {
              setErr(tx("Bagan tidak bisa disusun dengan pilihan itu. Coba ubah jumlah peserta atau lapangan."));
              return;
            }
            create({ name: name.trim() || tx("Turnamen"), date: date.trim(), code });
            fromDecoded(r.data);
            sync.off();
            onOpen();
          }}
        >
          {t("hmCreateGo")}
        </Button>
      </div>
    </Card>
  );

  function buildCode(): string | null {
    const fmt: Fmt = kind === "pair" ? "pair" : "solo";
    const mexOn = kind === "mex";
    if (mexOn && clamped < 8) {
      setErr(txf("Mexicano butuh minimal {0} pemain.", 8));
      return null;
    }

    const names: string[] = [];
    for (let i = 1; i <= MAX_T; i++) names.push("Tim " + i);
    const pnames: string[] = [];
    for (let i = 1; i <= MAX_P; i++) pnames.push("Pemain " + i);

    const rounds = solo ? Math.max(3, Math.min(24, clamped % 4 === 0 ? clamped - 1 : 8)) : 0;

    const slots = fmt === "pair" ? makeStandard(clamped, courts) : [];
    let rnd = [] as ReturnType<typeof makeSolo>;
    if (fmt === "solo") {
      if (mexOn) {
        const first = mexRound1(clamped, courts, {}, false);
        if (!first) {
          const lap = Math.max(1, Math.min(courts, Math.floor(clamped / 4)));
          setErr(
            txf(
              "Pemain yang hadir kurang: butuh {0} orang untuk {1} lapangan, yang hadir baru {2}. Kurangi lapangan atau tandai ada yang hadir lagi.",
              4 * lap,
              lap,
              clamped,
            ),
          );
          return null;
        }
        rnd = [first];
      } else {
        rnd = makeSolo(clamped, rounds, false, courts);
      }
    }

    const nMatches = fmt === "pair" ? (clamped * (clamped - 1)) / 2 : rnd.reduce((a, b) => a + b.length, 0);
    const blank = Array.from({ length: nMatches }, () => [null, null] as [null, null]);

    return encodeCode({
      fmt,
      mode: sys === "tennis" ? "first" : "sum",
      courts,
      startMin: 8 * 60,
      slotMin: 15,
      evTitle: name.trim() || tx("Turnamen"),
      evDate: date.trim(),
      n: clamped,
      names,
      slots,
      scores: blank,
      koScores: [
        [null, null],
        [null, null],
        [null, null],
        [null, null],
      ],
      koOn: fmt === "pair" && clamped >= 4,
      thirdOn: false,
      np: clamped,
      rounds: rounds || 7,
      pnames,
      rnd,
      sscores: blank,
      soloRank: "points",
      mexOn,
      scoreSys: sys,
      ptTarget: 21,
      gmTarget: 4,
      mexDeuce: false,
      mexOut: {},
    });
  }
}

/* -------------------------------------------------------------- gabung ---- */

function JoinPane({
  onOpen,
  back,
  initialRoom,
}: {
  onOpen(): void;
  back(): void;
  initialRoom: string;
}) {
  const { t, tx, txf } = useT();
  const adopt = useTrList((s) => s.adopt);
  const fromDecoded = useTournament((s) => s.fromDecoded);
  const sync = useSync();

  const [room, setRoom] = React.useState(initialRoom);
  const [pin, setPin] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [found, setFound] = React.useState<{
    room: string;
    rev: number;
    locked: boolean;
    code: string;
    name: string;
    date: string;
    fmt: string;
    matches: string;
  } | null>(null);

  /* Tautan undangan langsung diperiksa, jadi orang tidak perlu menekan apa
     pun kalau dia datang lewat tautan. */
  React.useEffect(() => {
    if (initialRoom) void lookup(initialRoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoom]);

  return (
    <Card
      title={t("hmJoinTitle")}
      note={t("hmJoinSub")}
      actions={
        <Button size="sm" onClick={back}>
          {t("hmBack")}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label={t("hmCode")} htmlFor="jnRoom">
          <Input
            id="jnRoom"
            className="min-w-0 flex-1"
            placeholder="KAMISAN-TH-957"
            value={room}
            onChange={(e) => {
              setRoom(e.target.value.toUpperCase());
              setFound(null);
            }}
          />
          <Button size="sm" disabled={busy || !room.trim()} onClick={() => void lookup(room)}>
            {t("hmLookup")}
          </Button>
        </Field>

        {err && <Note tone="danger">{err}</Note>}

        {/* Ruangnya DIPERIKSA dulu dan isinya ditampilkan, BARU perannya
            ditanyakan. Gerbang lama menyuruh mengetik kode lalu langsung
            menekan tombol peran, dan kesalahannya baru muncul sesudah
            terlanjur. */}
        {found && (
          <>
            <Note tone="good">
              {found.name} · {found.date || "—"} · {found.fmt} · {found.matches} ·{" "}
              {txf("versi {0}", found.rev)} ·{" "}
              {found.locked ? tx("ruang berkunci") : tx("ruang terbuka")}
            </Note>

            {found.locked && (
              <Field label={t("hmPin")} htmlFor="jnPin">
                <Input
                  id="jnPin"
                  className="min-w-0 flex-1"
                  type="password"
                  placeholder={t("hmPinPh")}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />
              </Field>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={busy || (found.locked && !pin)}
                onClick={() => void go("scorer")}
              >
                {t("hmAsScorer")}
              </Button>
              <Button disabled={busy} onClick={() => void go("viewer")}>
                {t("hmAsViewer")}
              </Button>
            </div>
            {found.locked && (
              <p className="nb-label normal-case tracking-normal">
                {tx("Ruang berkunci: yang tahu kuncinya bisa ikut mencatat, sisanya menonton saja.")}
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  );

  async function lookup(v: string) {
    const rm = cleanRoom(v);
    if (!rm) {
      setErr(tx("Isi dulu kode ruangnya, misalnya MN-PADEL-17AGT."));
      return;
    }
    setBusy(true);
    setErr("");
    setFound(null);
    const r = await apiCall("GET", "?room=" + encodeURIComponent(rm));
    setBusy(false);
    if (!r.ok) {
      setErr(syErrText(r, tx));
      return;
    }
    if (!r.exists) {
      setErr(tx("Ruang tidak ditemukan."));
      return;
    }
    const code = String(r.code || "");
    const sum = summarizeCode(code);
    const dec = decodeCode(code);
    setFound({
      room: rm,
      rev: Number(r.rev || 0),
      locked: !!r.locked,
      code,
      name: dec.ok ? dec.data.evTitle : tx("Turnamen"),
      date: dec.ok ? dec.data.evDate : "",
      fmt: !sum
        ? "—"
        : sum.mexOn
          ? "Mexicano"
          : sum.fmt === "solo"
            ? tx("Americano")
            : tx("Fix Partner"),
      matches: sum ? txf("{0} laga", sum.matches) : "—",
    });
  }

  async function go(role: "scorer" | "viewer") {
    if (!found) {
      setErr(tx("Periksa dulu kode ruangnya."));
      return;
    }
    setBusy(true);
    /* Kunci diperiksa di server sebelum peran dipasang, supaya "Ikut mencatat"
       tidak pernah terlihat berhasil padahal kuncinya salah. */
    if (role === "scorer") {
      const chk = await apiCall("POST", "", {
        act: "check",
        room: found.room,
        pin: found.locked ? pin : "",
      });
      if (!chk.ok) {
        setBusy(false);
        setErr(syErrText(chk, tx));
        return;
      }
    }
    setBusy(false);
    const r = decodeCode(found.code);
    if (!r.ok) {
      setErr(tx("kode bagannya rusak."));
      return;
    }
    adopt({
      name: found.name,
      date: found.date,
      code: found.code,
      room: found.room,
      pin: role === "scorer" ? pin : "",
      role,
      rev: found.rev,
    });
    fromDecoded(r.data);
    sync.join({ room: found.room, pin: role === "scorer" ? pin : "", role, rev: found.rev });
    onOpen();
  }
}
