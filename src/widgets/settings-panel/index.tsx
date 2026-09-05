"use client";

/* ============================================================================
   ATUR

   Tiga kartu, tiga urusan berbeda, dan urutannya mengikuti urutan orang
   memakainya: bentuk turnamen dulu, ruang belakangan, berbagi paling akhir.

   Kartu "Ruang" tidak menanyakan peran lagi seperti gerbang lama - peran
   sudah ditentukan saat turnamen dibuka atau digabung, dan di sini hanya bisa
   dilepas atau kuncinya diganti.
   ========================================================================== */

import * as React from "react";

import { GM_OPTS, MAX_C, MEX_MIN, PT_OPTS } from "@/shared/config";
import { cleanRoom, clock, fileSafe } from "@/shared/lib";
import { useT } from "@/shared/i18n";
import { Button, Card, Field, Input, Note, Pill, Segmented, TextArea } from "@/shared/ui";
import { useTournament } from "@/entities/tournament/store";
import { atStakeOf, useCourtInfo, useProgress } from "@/entities/tournament/derived";
import { decodeCode } from "@/entities/draw-code";
import { defaultRounds } from "@/entities/schedule/solo";
import { useSb } from "@/features/scoreboard/store";
import { useSync } from "@/features/sync-room/store";
import { useCode } from "@/features/sync-room/useSession";
import { apiCall, syErrText } from "@/features/sync-room/api";
import { askConfirm } from "@/features/confirm";
import { useTrList } from "@/entities/tournament/list-store";
import type { Fmt, ScoreMode, ScoreSys } from "@/shared/types";

export function SettingsPanel() {
  return (
    <div className="flex flex-col gap-3">
      <FormatCard />
      <ScoreSystemCard />
      <CourtsCard />
      <RoomCard />
      <ShareCard />
    </div>
  );
}

/* ------------------------------------------------------------- 1. format --- */

function FormatCard() {
  const { t, tx } = useT();
  const s = useTournament();
  const viewer = useSync((x) => x.role === "viewer");
  const drafts = useSb((x) => Object.keys(x.drafts).length);

  const cur: "pair" | "solo" | "mex" = s.mexOn ? "mex" : s.fmt === "solo" ? "solo" : "pair";

  const change = (v: "pair" | "solo" | "mex") => {
    if (v === cur) return;
    const run = () => {
      const fmt: Fmt = v === "pair" ? "pair" : "solo";
      s.setFmt(fmt, v === "mex");
    };
    /* Mexicano butuh minimal dua lapangan penuh supaya ada yang bisa ditukar
       antar lapangan; di bawah itu formatnya tidak punya arti. */
    if (v === "mex" && s.np < MEX_MIN) {
      s.setSchedMsg(tx("Mexicano butuh minimal ") + MEX_MIN + tx(" pemain."));
      return;
    }
    const st = atStakeOf(s, drafts);
    if (!st.any) {
      run();
      return;
    }
    askConfirm({
      title: tx("Ganti format turnamen?"),
      body: tx(
        "Format lain memakai bagan yang berbeda, jadi bagannya disusun dari nol dan skor yang sudah masuk dikosongkan.",
      ),
      risk: st.done + tx(" laga berskor"),
      okLabel: tx("Ya, ganti format"),
      onOk: run,
    });
  };

  return (
    <Card title={t("grpFmt")} note={t("tipSetup")}>
      <div className="flex flex-col gap-3">
        <Field label={t("lblFmt")}>
          <Segmented
            value={cur}
            onChange={change}
            ariaLabel={t("lblFmt")}
            options={[
              { value: "pair", label: t("btnFmtPair"), disabled: viewer },
              { value: "solo", label: t("btnFmtSolo"), disabled: viewer },
              { value: "mex", label: t("btnFmtMex"), disabled: viewer },
            ]}
          />
        </Field>

        <Note tone="info">{fmtNote()}</Note>

        <Field label={t("lblEvent")} htmlFor="inTitle">
          <Input
            id="inTitle"
            className="min-w-0 flex-1"
            value={s.evTitle}
            disabled={viewer}
            maxLength={80}
            onChange={(e) => s.setEvent({ evTitle: e.target.value })}
          />
        </Field>
        <Field label={t("lblDate")} htmlFor="inDate">
          <Input
            id="inDate"
            className="min-w-0 flex-1"
            value={s.evDate}
            disabled={viewer}
            maxLength={40}
            onChange={(e) => s.setEvent({ evDate: e.target.value })}
          />
        </Field>

        {s.fmt === "pair" && (
          <>
            <Field label={t("lblChamp")} tip={t("tipKo")}>
              <Segmented
                value={s.koOn ? "on" : "off"}
                onChange={(v) => s.setKo(v === "on")}
                options={[
                  { value: "off", label: t("btnKoOff"), disabled: viewer },
                  { value: "on", label: t("btnKoYes"), disabled: viewer },
                ]}
              />
            </Field>
            {s.koOn && (
              <Field label={t("lblThird")} tip={t("tipKoThird")}>
                <Segmented
                  value={s.thirdOn ? "on" : "off"}
                  onChange={(v) => s.setThird(v === "on")}
                  options={[
                    { value: "off", label: t("btnNo"), disabled: viewer },
                    { value: "on", label: t("btnYes"), disabled: viewer },
                  ]}
                />
              </Field>
            )}
          </>
        )}

        {s.fmt === "solo" && !s.mexOn && (
          <Field label={t("lblRank")} tip={t("tipStandSoloPts")}>
            <Segmented
              value={s.soloRank}
              onChange={(v) => s.setSoloRank(v)}
              options={[
                { value: "points", label: t("btnRk0"), disabled: viewer },
                { value: "wins", label: t("btnRk1"), disabled: viewer },
              ]}
            />
          </Field>
        )}
      </div>
    </Card>
  );

  function fmtNote(): string {
    if (s.mexOn) return t("tipSchedMex");
    if (s.fmt === "solo") return t("heroTagSolo");
    return t("heroTag");
  }
}

/* -------------------------------------------------------- 2. sistem skor --- */

function ScoreSystemCard() {
  const { t, tx, txf } = useT();
  const s = useTournament();
  const viewer = useSync((x) => x.role === "viewer");
  const drafts = useSb((x) => Object.keys(x.drafts).length);

  /* Mengubah sistem skor mengubah batas skor yang sah - 11-10 tidak punya arti
     kalau satu laga cuma 4 game. Jadi skor lama dikosongkan, dengan
     konfirmasi kalau memang ada isinya. */
  const guard = (run: () => void) => {
    const st = atStakeOf(s, drafts);
    if (!st.any) {
      run();
      return;
    }
    askConfirm({
      title: tx("Ganti sistem skor?"),
      body: tx(
        "Skor yang sudah tercatat memakai aturan lama, jadi tidak lagi sah di aturan baru dan akan dikosongkan. Bagan dan daftar pemain tidak berubah.",
      ),
      risk: tx("semua skor yang sudah masuk akan hilang"),
      okLabel: tx("Ya, ganti dan kosongkan skor"),
      onOk: () => {
        run();
        s.clearScores();
        useSb.setState({ drafts: {} });
      },
    });
  };

  return (
    <Card title={tx("Sistem skor")} note={sysNote()}>
      <div className="flex flex-col gap-3">
        <Field label={t("lblSys")}>
          <Segmented
            value={s.scoreSys}
            onChange={(v: ScoreSys) => guard(() => s.setScoreSys(v))}
            options={[
              { value: "points", label: t("btnSysPt"), disabled: viewer },
              { value: "tennis", label: t("btnSysTn"), disabled: viewer },
            ]}
          />
        </Field>

        {s.scoreSys === "points" ? (
          <>
            <Field label={t("lblPtTarget")}>
              <Segmented
                value={s.ptTarget}
                onChange={(v) => guard(() => s.setPtTarget(v))}
                options={PT_OPTS.map((n) => ({ value: n, label: String(n), disabled: viewer }))}
              />
            </Field>
            <Field label={t("lblMode")} htmlFor="inMode">
              <Segmented
                value={s.mode}
                onChange={(v: ScoreMode) => guard(() => s.setMode(v))}
                options={[
                  { value: "sum", label: t("optSum"), disabled: viewer },
                  { value: "first", label: t("optFirst"), disabled: viewer },
                ]}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label={t("lblGmTarget")}>
              <Segmented
                value={s.gmTarget}
                onChange={(v) => guard(() => s.setGmTarget(v))}
                options={GM_OPTS.map((n) => ({ value: n, label: String(n), disabled: viewer }))}
              />
            </Field>
            <Field label={t("lblDeuce")}>
              <Segmented
                value={s.mexDeuce ? "adv" : "gold"}
                onChange={(v) => guard(() => s.setDeuce(v === "adv"))}
                options={[
                  { value: "gold", label: t("btnGold"), disabled: viewer },
                  { value: "adv", label: t("btnAdv"), disabled: viewer },
                ]}
              />
            </Field>
          </>
        )}
      </div>
    </Card>
  );

  function sysNote(): string {
    if (s.scoreSys === "tennis") {
      return txf(
        "Tiap game dihitung 0-15-30-40. Laga selesai begitu satu sisi mengumpulkan {0} game. Angka yang tersimpan di bagan adalah jumlah game.",
        s.gmTarget,
      );
    }
    return s.mode === "sum"
      ? txf("Satu tekan = satu reli, dan laga selesai saat jumlah kedua skor tepat {0}.", s.ptTarget)
      : txf("Satu tekan = satu reli, dan laga selesai saat satu sisi lebih dulu mencapai {0}.", s.ptTarget);
  }
}

/* ----------------------------------------------------- 3. lapangan/waktu --- */

function CourtsCard() {
  const { t, txf } = useT();
  const s = useTournament();
  const viewer = useSync((x) => x.role === "viewer");
  const ci = useCourtInfo();

  return (
    <Card title={t("grpCourts")}>
      <div className="flex flex-col gap-3">
        <Field label={t("lblCourts")}>
          <Segmented
            value={s.courts}
            onChange={(v) => s.setCourts(v)}
            options={Array.from({ length: MAX_C }, (_, i) => ({
              value: i + 1,
              label: String(i + 1),
              disabled: viewer,
            }))}
          />
        </Field>
        {ci.idle > 0 && (
          <Note tone="warn">
            {txf(
              "Hanya {0} lapangan yang benar-benar terpakai — satu peserta tidak bisa main di dua tempat, jadi {1} lapangan sisanya menganggur.",
              ci.eff,
              ci.idle,
            )}
          </Note>
        )}

        <Field label={t("lblStart")} htmlFor="startTime">
          <Input
            id="startTime"
            type="time"
            value={clock(s.startMin)}
            disabled={viewer}
            onChange={(e) => {
              const [h, m] = e.target.value.split(":").map(Number);
              if (Number.isFinite(h) && Number.isFinite(m)) s.setStartMin(h! * 60 + m!);
            }}
          />
        </Field>
        <Field label={t("lblSlotMin")} htmlFor="slotMin">
          <Input
            id="slotMin"
            type="number"
            min={5}
            max={60}
            value={s.slotMin}
            disabled={viewer}
            className="w-24"
            onChange={(e) => s.setSlotMin(parseInt(e.target.value, 10))}
          />
        </Field>

        {s.fmt === "solo" && (
          <Field label={t("lblRounds")} htmlFor="inRounds">
            <Input
              id="inRounds"
              type="number"
              min={3}
              max={24}
              value={s.rounds}
              disabled={viewer}
              className="w-24"
              onChange={(e) => s.setRounds(parseInt(e.target.value, 10))}
            />
            <Pill tone="plain">{txf("bawaan {0}", defaultRounds(s.np, s.courts))}</Pill>
          </Field>
        )}
      </div>
    </Card>
  );
}

/* --------------------------------------------------------------- 4. ruang --- */

function RoomCard() {
  const { t, tx, txf } = useT();
  const s = useTournament();
  const sync = useSync();
  const code = useCode();
  const trTouch = useTrList((x) => x.touch);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  const defaultRoom = React.useMemo(
    () => cleanRoom(s.evTitle ? `${s.evTitle}-${Math.floor(100 + Math.random() * 900)}` : "PADEL-1"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [newRoom, setNewRoom] = React.useState(defaultRoom);
  const [newPin, setNewPin] = React.useState("");
  const [newErr, setNewErr] = React.useState("");

  const joined = !!sync.room && sync.role !== "off";

  const handleCreateRoom = async () => {
    const rm = cleanRoom(newRoom || defaultRoom);
    if (!rm) {
      setNewErr(tx("Isi dulu kode ruangnya, misalnya MN-PADEL-17AGT."));
      return;
    }
    setBusy(true);
    setNewErr("");
    const r = await apiCall("POST", "", {
      act: "create",
      room: rm,
      code,
      pin: newPin,
      by: sync.dev || "HP Host",
    });
    setBusy(false);
    if (!r.ok) {
      if (r.error === "sudah-ada") {
        setNewErr(tx("Kode ruang itu sudah dipakai. Pilih kode lain."));
      } else {
        setNewErr(syErrText(r, tx));
      }
      return;
    }
    sync.join({ room: rm, pin: newPin, role: "scorer", rev: 1 });
    trTouch({ code, room: rm, pin: newPin, role: "scorer", rev: 1 });
    const inviteUrl = window.location.origin + "/join/" + rm;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setMsg(tx("Ruang dibuat dan tautan undangannya disalin."));
    } catch {
      setMsg(tx("Ruang dibuat. Kode ruang: ") + rm);
    }
  };

  return (
    <Card title={t("cardSync")} note={t("tipSync")}>
      <div className="flex flex-col gap-3">
        {!joined ? (
          <div className="flex flex-col gap-3">
            <Note tone="info">
              {tx("Turnamen ini belum dibagikan ke ruang. Buat kode ruang agar perangkat lain bisa ikut mencatat atau menonton live:")}
            </Note>

            <Field label={t("lblRoom")} htmlFor="newRoomInput">
              <div className="flex w-full gap-2">
                <Input
                  id="newRoomInput"
                  className="min-w-0 flex-1 font-mono uppercase"
                  placeholder="ASD-PADEL-123"
                  value={newRoom}
                  onChange={(e) => {
                    setNewRoom(cleanRoom(e.target.value));
                    setNewErr("");
                  }}
                />
              </div>
            </Field>

            <Field label={t("lblPin")} htmlFor="newPinInput" tip={t("tipSync")}>
              <div className="flex w-full gap-2">
                <Input
                  id="newPinInput"
                  type="password"
                  className="min-w-0 flex-1"
                  placeholder={t("phPin")}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                />
              </div>
            </Field>

            <Field label={t("lblDev")} htmlFor="inDevInit">
              <div className="flex w-full gap-2">
                <Input
                  id="inDevInit"
                  className="min-w-0 flex-1"
                  value={sync.dev}
                  maxLength={40}
                  placeholder={tx("HP Andre")}
                  onChange={(e) => sync.setDev(e.target.value)}
                />
              </div>
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={busy || !newRoom.trim()}
                onClick={handleCreateRoom}
              >
                {t("btnShare")}
              </Button>
            </div>

            {newErr && <Note tone="danger">{newErr}</Note>}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="ink">{sync.room}</Pill>
              <Pill tone={sync.role === "scorer" ? "good" : "plain"}>
                {sync.role === "scorer" ? tx("Pencatat") : tx("Penonton")}
              </Pill>
              <Pill tone={sync.fail > 0 ? "danger" : "plain"}>
                {txf("versi {0}", sync.rev)}
              </Pill>
            </div>

            <Field label={t("lblDev")} htmlFor="inDev">
              <Input
                id="inDev"
                className="min-w-0 flex-1"
                value={sync.dev}
                maxLength={40}
                placeholder={tx("HP Andre")}
                onChange={(e) => sync.setDev(e.target.value)}
              />
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setMsg(tx("Menyegarkan…"));
                  await sync.tick();
                  setBusy(false);
                  setMsg(
                    useSync.getState().fail === 0
                      ? txf("Sudah paling baru (versi {0}).", useSync.getState().rev)
                      : tx("Tidak ada koneksi ke server. Bagan tetap aman di perangkat ini."),
                  );
                }}
              >
                {t("btnSyncNow")}
              </Button>

              {sync.role === "scorer" && (
                <Button
                  size="sm"
                  variant="hl"
                  disabled={busy}
                  onClick={() => {
                    askConfirm({
                      title: tx("Kirim bagan ini ke ruang?"),
                      body: tx(
                        "Bagan di ruang diganti seluruhnya oleh bagan di perangkat ini, termasuk skor yang kosong. Pakai ini kalau bagan di ruang sudah tidak benar.",
                      ),
                      risk: txf("versi ruang sekarang: v{0}", sync.rev),
                      okLabel: tx("Ya, kirim"),
                      onOk: async () => {
                        setBusy(true);
                        const r = await sync.pushFull(code);
                        setBusy(false);
                        setMsg(
                          r.ok ? txf("✓ Bagan terkirim · versi {0}", r.rev ?? "?") : syErrText(r, tx),
                        );
                      },
                    });
                  }}
                >
                  {t("btnSendTop")}
                </Button>
              )}

              <Button
                size="sm"
                variant="danger"
                onClick={() =>
                  askConfirm({
                    title: tx("Putuskan dari ruang?"),
                    body: tx(
                      "Perangkat ini berhenti mengikuti ruang dan boleh mengubah bagannya sendiri. Bagan di ruang tidak dihapus.",
                    ),
                    okLabel: tx("Ya, putuskan"),
                    onOk: () => {
                      sync.off();
                      trTouch({ code, room: "", pin: "" });
                      setMsg(tx("Sudah terputus dari ruang."));
                    },
                  })
                }
              >
                {t("btnSyncOff")}
              </Button>
            </div>
          </>
        )}
        {msg && <Note tone="info">{msg}</Note>}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------ 5. berbagi --- */

function ShareCard() {
  const { t, tx, txf } = useT();
  const s = useTournament();
  const sync = useSync();
  const code = useCode();
  const prog = useProgress();
  const [msg, setMsg] = React.useState("");
  const [paste, setPaste] = React.useState("");

  const copy = async (text: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMsg(okMsg);
    } catch {
      setMsg(tx("Gagal menyalin. Salin manual dari kotak kode."));
    }
  };

  const download = (name: string, text: string, mime: string) => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  return (
    <Card title={t("cardShare")} note={t("tipShare")}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {sync.room && (
            <Button
              size="sm"
              variant="primary"
              onClick={() =>
                copy(
                  window.location.origin + "/join/" + sync.room,
                  tx("Tautan undangan disalin."),
                )
              }
            >
              {tx("🔗 Salin tautan ruang")} ({sync.room})
            </Button>
          )}
          <Button size="sm" onClick={() => copy(code, tx("Kode bagan disalin."))}>
            {t("btnCopyCode")}
          </Button>
          <Button
            size="sm"
            onClick={() =>
              copy(
                window.location.origin + "/bagan#b=" + encodeURIComponent(code),
                tx("Tautan bagan disalin."),
              )
            }
          >
            {t("btnLink")}
          </Button>
          <Button
            size="sm"
            onClick={() =>
              download(
                fileSafe(s.evTitle) + ".json",
                JSON.stringify({ app: "mnpadel", ver: 9, code }, null, 2),
                "application/json",
              )
            }
          >
            {t("btnExpJson")}
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            {t("btnPrint")}
          </Button>
        </div>

        <Field label={t("sumCode")} htmlFor="codeBox">
          <span className="w-full" />
        </Field>
        <TextArea
          id="codeBox"
          rows={3}
          readOnly
          value={code}
          onFocus={(e) => e.currentTarget.select()}
        />
        <p className="nb-label normal-case tracking-normal">
          {txf("{0} laga terisi", prog.done + "/" + prog.total)} ·{" "}
          {txf("{0} karakter", code.length)}
        </p>

        <hr className="border-t-[3px]" style={{ borderColor: "var(--nb-line)" }} />

        <Field label={t("btnLoadCode")} htmlFor="pasteBox">
          <span className="w-full" />
        </Field>
        <TextArea
          id="pasteBox"
          rows={3}
          placeholder="v9;;…"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="primary"
            disabled={!paste.trim()}
            onClick={() => {
              const r = decodeCode(paste);
              if (!r.ok) {
                setMsg(errText(r.error, tx));
                return;
              }
              const run = () => {
                s.fromDecoded(r.data);
                setPaste("");
                setMsg(tx("Bagan dimuat dari kode."));
              };
              const st = atStakeOf(s, 0);
              if (!st.any) {
                run();
                return;
              }
              askConfirm({
                title: tx("Ganti bagan dengan kode ini?"),
                body: tx("Bagan dan skor yang sekarang diganti seluruhnya oleh isi kode itu."),
                risk: st.done + tx(" laga berskor"),
                okLabel: tx("Ya, muat"),
                onOk: run,
              });
            }}
          >
            {t("btnLoadCode")}
          </Button>
          <label className="nb-btn" data-size="sm">
            {t("btnImport")}
            <input
              type="file"
              accept=".json,.txt,application/json,text/plain"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const text = await f.text();
                /* Berkas .json berisi objek dengan bidang code; berkas .txt
                   berisi kodenya langsung. Keduanya diterima. */
                let raw = text.trim();
                try {
                  const j = JSON.parse(raw) as { code?: string };
                  if (j && typeof j.code === "string") raw = j.code;
                } catch {
                  /* bukan JSON: perlakukan sebagai kode mentah */
                }
                setPaste(raw);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {msg && <Note tone="info">{msg}</Note>}
      </div>
    </Card>
  );
}

function errText(e: string, tx: (s: string) => string): string {
  switch (e) {
    case "terlalu-baru":
      return tx("Kode ini dari versi aplikasi yang lebih baru — perbarui halaman ini dulu.");
    case "terpotong":
      return tx("Kode tidak lengkap — ada bagian yang terpotong saat disalin.");
    case "lapangan":
      return tx("Jumlah lapangan di dalam kode tidak valid.");
    case "jumlah-pemain":
      return tx("Jumlah pemain di dalam kode tidak valid.");
    case "jumlah-tim":
      return tx("Jumlah tim di dalam kode tidak valid.");
    case "bagan-solo":
      return tx("Bagan individu di dalam kode tidak valid.");
    case "bagan-pair":
      return tx("Bagan di dalam kode tidak valid.");
    default:
      return tx("Kode tidak dikenali. Pastikan seluruh kode tersalin, dari v7/v8/v9 sampai tanda terakhir.");
  }
}
