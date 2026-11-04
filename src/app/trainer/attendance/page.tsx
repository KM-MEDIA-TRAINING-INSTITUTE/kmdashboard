"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import {
  offeringsApi,
  sessionsApi,
  attendanceStatusMeta,
  type AttendanceStatusValue,
  type ClassSession,
  type Offering,
  type RosterRow,
} from "@/lib/api/academic";

const STATUSES: AttendanceStatusValue[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED", "REMOTE"];

function AttendanceInner() {
  const params = useSearchParams();
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [offeringId, setOfferingId] = useState("");
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [marks, setMarks] = useState<Record<string, AttendanceStatusValue>>({});
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await offeringsApi.mine();
        if (!cancelled) {
          setOfferings(rows);
          if (rows.length > 0) setOfferingId(rows[0].id);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load offerings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!offeringId) return;
    let cancelled = false;
    offeringsApi
      .sessions(offeringId)
      .then((rows) => {
        if (cancelled) return;
        setSessions(rows);
        const preselect = params.get("session");
        if (preselect && rows.some((s) => s.id === preselect)) {
          setSessionId(preselect);
        } else if (rows.length > 0) {
          setSessionId(rows[0].id);
        } else {
          setSessionId("");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load sessions.");
      });
    return () => {
      cancelled = true;
    };
  }, [offeringId, params]);

  const loadRoster = useCallback(async (sid: string) => {
    if (!sid) {
      setRoster([]);
      setLocked(false);
      return;
    }
    const rows = await sessionsApi.roster(sid);
    setRoster(rows);
    setMarks(
      Object.fromEntries(rows.map((r) => [r.student_id, (r.status ?? "PRESENT") as AttendanceStatusValue]))
    );
    const session = sessions.find((s) => s.id === sid);
    setLocked(Boolean(session?.attendance_locked_at));
  }, [sessions]);

  useEffect(() => {
    loadRoster(sessionId).catch((err) =>
      setError(err instanceof ApiError ? err.message : "Could not load the roster.")
    );
  }, [sessionId, loadRoster]);

  const save = async () => {
    setError(null);
    setMsg(null);
    try {
      await sessionsApi.mark(
        sessionId,
        roster.map((r) => ({ student_id: r.student_id, status: marks[r.student_id] ?? "PRESENT" }))
      );
      setMsg("Attendance saved.");
      await loadRoster(sessionId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save attendance.");
    }
  };

  const lock = async () => {
    try {
      await sessionsApi.lock(sessionId);
      setLocked(true);
      setMsg("Attendance locked.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not lock attendance.");
    }
  };

  const unlock = async () => {
    const reason = window.prompt("Reason for unlocking (audited)?");
    if (!reason) return;
    try {
      await sessionsApi.unlock(sessionId, reason);
      setLocked(false);
      setMsg("Attendance unlocked (audited).");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not unlock attendance.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Attendance register</h1>
        <p className="mt-1 text-sm text-slate-500">
          Mark, save and lock attendance for your sessions. Locked registers need an admin override to change.
        </p>
      </div>

      {msg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{msg}</div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : offerings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
          No offerings assigned to you yet.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="offering" className="block text-xs font-medium text-slate-600">
                Offering
              </label>
              <select
                id="offering"
                value={offeringId}
                onChange={(e) => setOfferingId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {offerings.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="session" className="block text-xs font-medium text-slate-600">
                Session
              </label>
              <select
                id="session"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {sessions.length === 0 && <option value="">No sessions</option>}
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.session_date} · {s.title} ({s.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {roster.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
              {sessionId
                ? "No enrolled students in this offering's roster yet."
                : "Select a session to open its register."}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Attendance register</caption>
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th scope="col" className="px-4 py-3">Student</th>
                      <th scope="col" className="px-4 py-3">Index</th>
                      <th scope="col" className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((r) => (
                      <tr key={r.student_id} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3 font-medium text-slate-900">{r.name ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.index_number ?? "—"}</td>
                        <td className="px-4 py-3">
                          <fieldset className="flex flex-wrap gap-2" disabled={locked}>
                            <legend className="sr-only">Attendance status</legend>
                            {STATUSES.map((st) => (
                              <label key={st} className="flex items-center gap-1 text-xs">
                                <input
                                  type="radio"
                                  name={`status-${r.student_id}`}
                                  value={st}
                                  checked={(marks[r.student_id] ?? "PRESENT") === st}
                                  onChange={() => setMarks((prev) => ({ ...prev, [r.student_id]: st }))}
                                  disabled={locked}
                                />
                                {attendanceStatusMeta[st].label}
                              </label>
                            ))}
                          </fieldset>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={save}
                  disabled={locked}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  Save attendance
                </button>
                {locked ? (
                  <button onClick={unlock} className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50">
                    Unlock (admin, audited)
                  </button>
                ) : (
                  <button
                    onClick={lock}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Lock register
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function TrainerAttendancePage() {
  return (
    <RouteGuard allowedRoles={["TRAINER", "ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <AttendanceInner />
      </AppShell>
    </RouteGuard>
  );
}
