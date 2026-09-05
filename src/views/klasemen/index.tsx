"use client";

import { Podium, StandingsTable } from "@/widgets/standings-table";
import { AppShell } from "@/views/shell";

export function KlasemenView() {
  return (
    <AppShell>
      <div className="flex flex-col gap-3">
        <StandingsTable />
        <Podium />
      </div>
    </AppShell>
  );
}
