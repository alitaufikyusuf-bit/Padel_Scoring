"use client";

import { SettingsPanel } from "@/widgets/settings-panel";
import { RulesSheet } from "@/widgets/rules-sheet";
import { AppShell } from "@/views/shell";

export function AturView() {
  return (
    <AppShell>
      <div className="flex flex-col gap-3">
        <SettingsPanel />
        <RulesSheet />
        <footer className="noprint py-3 text-center">
          <p className="nb-label text-xs tracking-wider opacity-60">
            MN PADEL CLUB · VERSION 5.0
          </p>
        </footer>
      </div>
    </AppShell>
  );
}
