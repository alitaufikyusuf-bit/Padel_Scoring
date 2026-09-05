"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT, type UiKey } from "@/shared/i18n";

export function BottomNav() {
  const { t } = useT();
  const pathname = usePathname();

  const TABS: { href: string; key: UiKey; icon: React.ReactNode }[] = [
    { href: "/bagan", key: "navBagan", icon: <DrawIcon /> },
    { href: "/klasemen", key: "navKlasemen", icon: <StandingsIcon /> },
    { href: "/atur", key: "navAtur", icon: <SetupIcon /> },
    { href: "/live", key: "navLive", icon: <LiveIcon /> },
  ];

  return (
    <nav
      className="noprint fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 gap-1 sm:gap-2 rounded-[20px] border-[3px] p-1.5 sm:p-2"
      style={{
        background: "var(--nb-card)",
        borderColor: "var(--nb-line)",
        boxShadow: "4px 4px 0 var(--nb-line)",
      }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="group relative flex flex-col items-center justify-center rounded-[12px] min-w-[72px] sm:min-w-[84px] py-1.5 transition-all"
            style={{
              background: active ? "var(--nb-accent)" : "transparent",
              color: active ? "var(--nb-accent-ink)" : "var(--nb-ink)",
              border: active ? "2.5px solid var(--nb-accent-ink)" : "2.5px solid transparent",
            }}
          >
            {/* If active, give a tiny pop effect */}
            <div className={`transition-transform ${active ? "scale-110" : "group-hover:scale-110"}`}>
              {tab.icon}
            </div>
            <span
              className="mt-1 text-[10px] sm:text-[11px]"
              style={{
                fontFamily: "var(--font-cond)",
                fontWeight: 800,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              {t(tab.key)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function DrawIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 3H3v18h18V3z" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}

function StandingsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}

function SetupIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function LiveIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h4l2-9 5 18 3-10 3 3h5" />
    </svg>
  );
}
