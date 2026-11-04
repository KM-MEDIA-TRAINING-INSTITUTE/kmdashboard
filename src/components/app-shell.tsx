"use client";

import { WorkspaceShell } from "@/components/dashboard/shell";

/**
 * Header for authenticated workspace pages — delegates to the shared
 * dashboard shell so every view uses the same demo-style layout
 * (vertical sidebar + full-width main column).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
