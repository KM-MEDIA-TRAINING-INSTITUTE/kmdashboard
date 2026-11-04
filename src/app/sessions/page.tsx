"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { FullPageSpinner } from "@/components/route-guard";
import { authApi } from "@/lib/api/endpoints";
import type { SessionOut } from "@/lib/api/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function SessionsInner() {
  const [sessions, setSessions] = useState<SessionOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSessions(await authApi.listSessions());
    } catch {
      setError("Could not load sessions. Is the API running?");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = async (id: string) => {
    setBusyId(id);
    try {
      await authApi.revokeSession(id);
      await load();
    } catch {
      setError("Could not revoke that session.");
    } finally {
      setBusyId(null);
    }
  };

  if (sessions === null && !error) {
    return <FullPageSpinner label="Loading sessions…" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Active sessions
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Devices currently signed in to your account. Revoking a session
          signs that device out immediately.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {(sessions ?? []).map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">
                {s.device_name ?? "Unknown device"}
                {s.is_current && (
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    This device
                  </span>
                )}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {s.user_agent ?? "—"} · IP {s.ip_address ?? "unknown"}
              </p>
              <p className="text-xs text-slate-400">
                Started {formatDate(s.created_at)} · Last active{" "}
                {formatDate(s.last_used_at)}
              </p>
            </div>
            {!s.is_current && (
              <button
                onClick={() => revoke(s.id)}
                disabled={busyId === s.id}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {busyId === s.id ? "Revoking…" : "Revoke"}
              </button>
            )}
          </li>
        ))}
        {sessions !== null && sessions.length === 0 && (
          <li className="px-5 py-8 text-center text-sm text-slate-500">
            No active sessions.
          </li>
        )}
      </ul>
    </div>
  );
}

export default function SessionsPage() {
  return (
    <AppShell>
      <SessionsInner />
    </AppShell>
  );
}
