"use client";

/* ============================================================================
   KOTAK KONFIRMASI

   Sengaja BUKAN tombol yang sama diklik dua kali: di HP, ketukan nyasar lalu
   ketukan refleks di titik yang sama sudah cukup untuk mengosongkan seluruh
   turnamen.

   Empat penjagaan yang dipertahankan dari v3.3 dan semuanya penting:
     - tombol Batal besar dan berada di bawah jari
     - tombol merusaknya kecil dan di sisi lain
     - tombol merusak baru hidup setelah 700 ms, jadi ketukan ganda tidak bisa
       menembusnya
     - Escape dan ketukan di latar sama artinya dengan Batal

   Dipakai lewat fungsi: askConfirm({...}). Tidak perlu prop apa pun di
   komponen pemanggil, karena tindakan merusak bisa datang dari mana saja.
   ========================================================================== */

import * as React from "react";
import { create } from "zustand";

import { useT } from "@/shared/i18n";
import { lockBodyScroll, unlockBodyScroll } from "@/shared/lib";
import { Button, Note } from "@/shared/ui";

export interface ConfirmReq {
  title: string;
  body?: string;
  /** satu baris yang menyebut kerugiannya secara lugas */
  risk?: string;
  okLabel?: string;
  cancelLabel?: string;
  onOk(): void;
  onCancel?(): void;
}

interface ConfirmState {
  req: ConfirmReq | null;
  armed: boolean;
  ask(r: ConfirmReq): void;
  arm(): void;
  close(cancelled: boolean): void;
}

const useConfirm = create<ConfirmState>((set, get) => ({
  req: null,
  armed: false,
  ask(r) {
    set({ req: r, armed: false });
  },
  arm() {
    set({ armed: true });
  },
  close(cancelled) {
    const r = get().req;
    set({ req: null, armed: false });
    if (cancelled && r?.onCancel) r.onCancel();
  },
}));

/** Meminta konfirmasi. Aman dipanggil dari mana saja, termasuk dari store. */
export function askConfirm(r: ConfirmReq): void {
  useConfirm.getState().ask(r);
}

/** Terpasang sekali di provider. */
export function ConfirmHost() {
  const { tx } = useT();
  const req = useConfirm((s) => s.req);
  const armed = useConfirm((s) => s.armed);
  const arm = useConfirm((s) => s.arm);
  const close = useConfirm((s) => s.close);
  const noRef = React.useRef<HTMLButtonElement>(null);

  /* Jeda 700 ms sebelum tombol merusak hidup. */
  React.useEffect(() => {
    if (!req) return;
    const id = window.setTimeout(arm, 700);
    return () => window.clearTimeout(id);
  }, [req, arm]);

  /* Fokus jatuh ke Batal, bukan ke tombol merusak. */
  React.useEffect(() => {
    if (!req) return;
    noRef.current?.focus();
  }, [req]);

  React.useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    document.addEventListener("keydown", onKey);
    lockBodyScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockBodyScroll();
    };
  }, [req, close]);

  if (!req) return null;

  const ok = () => {
    const fn = req.onOk;
    close(false);
    fn();
  };

  return (
    <div
      className="nb-overlay noprint"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cf-title"
      onClick={(e) => {
        /* klik latar = batal, sama seperti Escape */
        if (e.target === e.currentTarget) close(true);
      }}
    >
      <div className="nb-card nb-shadow-lg m-auto w-[min(94vw,30rem)] p-4">
        <h2 id="cf-title" className="nb-title m-0">
          {req.title}
        </h2>
        {req.body && (
          <p className="mt-2 text-[13.5px] font-medium leading-snug">{req.body}</p>
        )}
        {req.risk && (
          <Note tone="danger" className="mt-3">
            {req.risk}
          </Note>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          {/* Batal besar dan di kiri, tempat jempol berada. */}
          <Button ref={noRef} size="lg" onClick={() => close(true)}>
            {req.cancelLabel || tx("Batal, jangan diubah")}
          </Button>
          {/* Yang merusak kecil, di sisi lain, dan mati selama 700 ms. */}
          <Button size="sm" variant="danger" disabled={!armed} onClick={ok}>
            {req.okLabel || tx("Ya, lanjutkan")}
          </Button>
        </div>
        <p className="nb-label mt-3 min-h-[1em] normal-case tracking-normal">
          {armed ? "" : tx("tunggu sebentar sebelum menekan")}
        </p>
      </div>
    </div>
  );
}
