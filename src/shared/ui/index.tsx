"use client";

/* ============================================================================
   UI KIT NEO-BRUTALISM

   Satu tempat untuk seluruh gaya komponen. Halaman TIDAK menempelkan kelas
   .nb-* langsung; kalau nanti tema diganti lagi, yang berubah cuma berkas ini
   dan globals.css.
   ========================================================================== */

import * as React from "react";

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export { cx };

/* -------------------------------------------------------------- Button ---- */

export type ButtonVariant = "default" | "primary" | "hl" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant = "default", size = "md", className, type, ...rest }, ref) {
    return (
      <button
        ref={ref}
        /* type="button" sebagai bawaan: tombol di dalam <form> yang tidak
           menyebut type-nya akan mengirim form dan memuat ulang halaman. */
        type={type ?? "button"}
        data-variant={variant}
        data-size={size}
        className={cx("nb-btn", className)}
        {...rest}
      />
    );
  },
);

/* ----------------------------------------------------------------- Card ---- */

/* "title" bawaan HTMLAttributes bertipe string (atribut tooltip peramban),
   sementara judul kartu di sini boleh berisi elemen. Karena itu yang bawaan
   dikecualikan, bukan ditimpa. */
export interface CardProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /** judul kartu; kalau ada, header ikut digambar */
  title?: React.ReactNode;
  /** ditaruh di sisi kanan header */
  actions?: React.ReactNode;
  /** keterangan singkat di bawah judul */
  note?: React.ReactNode;
  /** tooltip ⓘ di samping judul kartu */
  tip?: string;
  as?: "section" | "div" | "article";
}

export function Card({
  title,
  actions,
  note,
  tip,
  as = "section",
  className,
  children,
  ...rest
}: CardProps) {
  const Tag = as;
  return (
    <Tag className={cx("nb-card p-3 sm:p-4", className)} {...rest}>
      {(title || actions) && (
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title ? (
            <h2 className="nb-title m-0 flex items-center gap-1.5">
              {title}
              {tip && <Tip text={tip} />}
            </h2>
          ) : (
            <span />
          )}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {note && <p className="nb-label mb-3 normal-case tracking-normal">{note}</p>}
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------- Segmented --- */

export interface SegOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
  title?: string;
}

export interface SegmentedProps<T extends string | number> {
  value: T;
  options: readonly SegOption<T>[];
  onChange(v: T): void;
  className?: string;
  ariaLabel?: string;
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  className,
  ariaLabel,
}: SegmentedProps<T>) {
  return (
    <span className={cx("nb-seg", className)} role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          data-on={o.value === value}
          disabled={o.disabled}
          title={o.title}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

/* ----------------------------------------------------------------- Field --- */

export interface FieldProps {
  label: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
  /** tooltip ⓘ di samping label */
  tip?: string;
}

export function Field({ label, htmlFor, children, className, tip }: FieldProps) {
  return (
    <span className={cx("flex flex-wrap items-center gap-2", className)}>
      <label className="nb-label flex items-center gap-1" htmlFor={htmlFor}>
        {label}
        {tip && <Tip text={tip} />}
      </label>
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- Input --- */

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx("nb-input", className)} {...rest} />;
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...rest }, ref) {
  return <select ref={ref} className={cx("nb-select", className)} {...rest} />;
});

export const TextArea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cx("nb-input w-full font-mono text-xs leading-relaxed", className)}
      {...rest}
    />
  );
});

/* ------------------------------------------------------------------ Pill --- */

export type PillTone = "plain" | "accent" | "hl" | "warn" | "danger" | "good" | "ink";

const PILL_STYLE: Record<PillTone, React.CSSProperties> = {
  plain: { background: "var(--nb-card-2)", color: "var(--nb-ink)" },
  accent: { background: "var(--nb-accent)", color: "var(--nb-accent-ink)" },
  hl: { background: "var(--nb-hl)", color: "var(--nb-hl-ink)" },
  warn: { background: "var(--nb-warn)", color: "var(--nb-warn-ink)" },
  danger: { background: "var(--nb-danger)", color: "var(--nb-danger-ink)" },
  good: { background: "var(--nb-good)", color: "var(--nb-good-ink)" },
  ink: { background: "var(--nb-ink)", color: "var(--nb-bg)" },
};

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
}

export function Pill({ tone = "plain", className, style, ...rest }: PillProps) {
  return (
    <span
      className={cx("nb-pill", className)}
      style={{ ...PILL_STYLE[tone], ...style }}
      {...rest}
    />
  );
}

/* ------------------------------------------------------------------- Bar --- */

export function Bar({ pct, full }: { pct: number; full?: boolean }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="nb-bar" data-full={full ? "true" : "false"} role="presentation">
      <i style={{ width: v + "%" }} />
    </div>
  );
}

/* ------------------------------------------------------------------- Tip --- */

/* Tooltip ⓘ: penjelasan panjang disembunyikan sampai diminta. Ini bawaan dari
   v2.0 dan sengaja dipertahankan - kartu jadi jauh lebih tenang, tapi
   keterangannya tetap ada untuk yang butuh.

   Dibuat sebagai <details> supaya bekerja tanpa JavaScript dan bisa dibuka
   dengan papan tuts tanpa penanganan tombol sendiri. */
export function Tip({ text }: { text: string }) {
  return (
    <details className="relative inline-block align-middle">
      <summary
        className="nb-border grid size-[18px] cursor-pointer list-none place-items-center rounded-full text-[11px] font-bold leading-none [&::-webkit-details-marker]:hidden"
        style={{ background: "var(--nb-card-2)", color: "var(--nb-ink)", borderWidth: 2 }}
        aria-label="Penjelasan"
      >
        i
      </summary>
      <div
        className="nb-card absolute left-0 top-6 z-50 w-[min(78vw,20rem)] p-2.5 text-[12.5px] font-medium normal-case leading-snug tracking-normal"
        style={{ color: "var(--nb-ink)" }}
      >
        {text}
      </div>
    </details>
  );
}

/* ----------------------------------------------------------------- Table --- */

export function Table({
  className,
  children,
  ...rest
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    /* Tabel lebar harus menggulir di dalam wadahnya sendiri; badan halaman
       tidak boleh ikut menggulir ke samping. */
    <div className="nb-border overflow-x-auto rounded-[var(--radius-nb)]">
      <table className={cx("nb-table", className)} {...rest}>
        {children}
      </table>
    </div>
  );
}

/* --------------------------------------------------------------- Overlay --- */

export interface OverlayProps {
  open: boolean;
  onClose(): void;
  children: React.ReactNode;
  /** label untuk pembaca layar */
  label: string;
  /** true = lembar penuh layar (papan skor), false = kotak di tengah */
  full?: boolean;
}

export function Overlay({ open, onClose, children, label, full }: OverlayProps) {
  /* Esc menutup, dan gulir badan halaman dibekukan selama lapisan terbuka -
     kalau tidak, menggulir di dalam lembar akan menggeser halaman di
     belakangnya begitu ujungnya tercapai. */
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="nb-overlay noprint"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={
          full
            ? "m-0 flex h-full w-full flex-col sm:m-auto sm:h-auto sm:max-h-[94dvh] sm:w-[min(96vw,44rem)]"
            : "m-auto w-[min(94vw,32rem)]"
        }
      >
        {children}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Sheet ---- */

/** Badan lapisan dengan kepala dan tombol tutup. */
export function Sheet({
  title,
  kicker,
  onClose,
  children,
  footer,
  className,
}: {
  title: React.ReactNode;
  kicker?: React.ReactNode;
  onClose(): void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "nb-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-none sm:rounded-[var(--radius-nb-lg)]",
        className,
      )}
    >
      <header
        className="flex items-start justify-between gap-3 border-b-[3px] p-3"
        style={{ background: "var(--nb-card-2)" }}
      >
        <div className="min-w-0">
          {kicker && <div className="nb-label">{kicker}</div>}
          <div className="nb-title mt-0.5 truncate">{title}</div>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose} aria-label="Tutup">
          ✕
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">{children}</div>
      {footer && (
        <footer
          className="flex flex-wrap items-center justify-end gap-2 border-t-[3px] p-3"
          style={{ background: "var(--nb-card-2)" }}
        >
          {footer}
        </footer>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Note --- */

export type NoteTone = "info" | "warn" | "danger" | "good";

const NOTE_BG: Record<NoteTone, string> = {
  info: "var(--nb-hl-soft)",
  warn: "var(--nb-warn)",
  danger: "var(--nb-danger)",
  good: "var(--nb-good)",
};
const NOTE_FG: Record<NoteTone, string> = {
  info: "var(--nb-ink)",
  warn: "var(--nb-warn-ink)",
  danger: "var(--nb-danger-ink)",
  good: "var(--nb-good-ink)",
};

export function Note({
  tone = "info",
  children,
  className,
}: {
  tone?: NoteTone;
  children: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p
      className={cx("nb-border nb-shadow-sm m-0 rounded-[var(--radius-nb)] p-2.5 text-[13px] font-semibold leading-snug", className)}
      style={{ background: NOTE_BG[tone], color: NOTE_FG[tone] }}
      role={tone === "danger" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}

/* ------------------------------------------------------------- Empty state - */

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="nb-border rounded-[var(--radius-nb)] border-dashed p-6 text-center text-[13px] font-semibold"
      style={{ color: "var(--nb-label)" }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------- RankBadge --- */

export function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span
        className="inline-flex items-center justify-center gap-1 rounded-[var(--radius-nb)] border-2 border-[var(--nb-line)] px-2 py-0.5 text-[11px] font-black tracking-tight shadow-[2px_2px_0_var(--nb-line)]"
        style={{
          background: "#ffcf33",
          color: "#101014",
          fontFamily: "var(--font-cond)",
        }}
        title="Peringkat 1"
      >
        <svg className="size-3.5 fill-current shrink-0" viewBox="0 0 24 24">
          <path d="M5 18h14v2H5v-2zm14-11l-3.5 5.5L12 6l-3.5 6.5L5 7l1.5 9h11L19 7z" />
        </svg>
        <span>1ST</span>
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span
        className="inline-flex items-center justify-center gap-1 rounded-[var(--radius-nb)] border-2 border-[var(--nb-line)] px-1.5 py-0.5 text-[11px] font-black tracking-tight shadow-[2px_2px_0_var(--nb-line)]"
        style={{
          background: "#e2e8f0",
          color: "#101014",
          fontFamily: "var(--font-cond)",
        }}
        title="Peringkat 2"
      >
        <svg className="size-3.5 stroke-current fill-none shrink-0" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="6" />
          <path d="m9 13.5-3 8.5 6-3 6 3-3-8.5" />
        </svg>
        <span>2ND</span>
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span
        className="inline-flex items-center justify-center gap-1 rounded-[var(--radius-nb)] border-2 border-[var(--nb-line)] px-1.5 py-0.5 text-[11px] font-black tracking-tight shadow-[2px_2px_0_var(--nb-line)]"
        style={{
          background: "#f6ad55",
          color: "#101014",
          fontFamily: "var(--font-cond)",
        }}
        title="Peringkat 3"
      >
        <svg className="size-3.5 stroke-current fill-none shrink-0" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="6" />
          <path d="m9 13.5-3 8.5 6-3 6 3-3-8.5" />
        </svg>
        <span>3RD</span>
      </span>
    );
  }
  return (
    <span
      className="inline-block min-w-[1.25rem] text-center font-bold text-[12px] opacity-75"
      style={{ fontFamily: "var(--font-cond)" }}
    >
      {rank}
    </span>
  );
}
