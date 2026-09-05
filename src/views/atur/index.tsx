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
      </div>
    </AppShell>
  );
}
