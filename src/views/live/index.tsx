"use client";

import { LiveBoard } from "@/widgets/live-board";
import { AppShell } from "@/views/shell";

export function LiveView() {
  return (
    <AppShell>
      <LiveBoard />
    </AppShell>
  );
}
