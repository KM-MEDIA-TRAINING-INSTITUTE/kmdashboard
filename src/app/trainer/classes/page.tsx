"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import {
  offeringsApi,
  sessionsApi,
  sessionStatusMeta,
  type ClassSession,
  type Offering,
} from "@/lib/api/academic";

function ClassesInner() {
  const search = useSearchParams();
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [offeringId, setOfferingId] = useState("");
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", session_date: "", start_time: "09:00", end_time: "11:00", location: "", meeting_url: "" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await offeringsApi.mine();
        if (!cancelled) {
          setOfferings(rows);
          // Deep-link support: /trainer/classes?offering=<id> preselects a course
          // (the trainer dashboard's "My courses" rows link here).
          const wanted = search.get("offering");
          if (rows.length > 0) {
            setOfferingId(wanted && rows.some((r) => r.id === wanted) ? wanted : rows[0].id);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load your offerings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSessions = useCallback(async (oid: string) => {
    const rows = await offeringsApi.sessions(oid);
    setSessions(rows);
  }, []);

  useEffect(() => {
    if (!offeringId) return;
    loadSessions(offeringId).catch((err) =>
      setError(err instanceof ApiError ? err.message : "Could not load sessions.")
    );
  }, [offeringId, loadSessions]);

  const create = async () => {
    setError(null);
    setMsg(null);
    try {
      await offeringsApi.createSession(offeringId, form);
      setMsg(`Session “${form.title}” scheduled.`);
      setShowForm(false);
      setForm({ title: "", session_date: "", start_time: "09:00", end_time: "11:00", location: "", meeting_url: "" });
      await loadSessions(offeringId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the session.");
    }
  };

  const transition = async (id: string, status: string) => {
    try {
      await sessionsApi.setStatus(id, status);
      await loadSessions(offeringId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Status change failed.");
    }
  };

  const cancel = async (id: string) => {
    const reason = window.prompt("Reason for cancellation?");
    if (reason === null) return;
    try {
      await sessionsApi.cancel(id, reason || "cancelled by trainer");
      await loadSessions(offeringId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Cancellation failed.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">My classes</h1>
          <p className="mt-1 text-sm text-slate-500">Schedule and manage sessions for your offerings.</p>
        </div>
        {offeringId && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            {showForm ? "Close" : "New session"}
          </button>
        )}
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
          You have no offerings assigned yet. Ask the academic office to assign you.
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="offering" className="block text-xs font-medium text-slate-600">
              Course offering
            </label>
            <select
              id="offering"
              value={offeringId}
              onChange={(e) => setOfferingId(e.target.value)}
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {offerings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.code} · {o.status}
                </option>
              ))}
            </select>
          </div>

          {showForm && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-600">
                  Title
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Date
                  <input
                    type="date"
                    value={form.session_date}
                    onChange={(e) => setForm({ ...form, session_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Start
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-slate-600">
                  End
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-slate-600 sm:col-span-2">
                  Location (offline/hybrid)
                  <input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-slate-600 sm:col-span-2">
                  Meeting URL (online/hybrid)
                  <input
                    value={form.meeting_url}
                    onChange={(e) => setForm({ ...form, meeting_url: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <button
                onClick={create}
                disabled={!form.title || !form.session_date}
                className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                Create session
              </button>
            </div>
          )}

          {sessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
              No sessions yet for this offering.
            </div>
          ) : (
            <ul className="space-y-2">
              {sessions.map((s) => {
                const meta = sessionStatusMeta[s.status] ?? sessionStatusMeta.SCHEDULED;
                return (
                  <li key={s.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{s.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {s.session_date} · {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)} · {s.delivery_mode}
                          {s.location ? ` · ${s.location}` : ""}
                        </p>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.className}`}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {s.status === "SCHEDULED" && (
                        <button onClick={() => transition(s.id, "ONGOING")} className="rounded-lg border border-slate-300 px-3 py-1 hover:bg-slate-50">
                          Start class
                        </button>
                      )}
                      {s.status === "ONGOING" && (
                        <button onClick={() => transition(s.id, "COMPLETED")} className="rounded-lg border border-slate-300 px-3 py-1 hover:bg-slate-50">
                          Mark completed
                        </button>
                      )}
                      {(s.status === "SCHEDULED" || s.status === "ONGOING") && (
                        <>
                          <a
                            href={`/trainer/attendance?session=${s.id}`}
                            className="rounded-lg border border-slate-300 px-3 py-1 hover:bg-slate-50"
                          >
                            Attendance
                          </a>
                          <button onClick={() => cancel(s.id)} className="rounded-lg border border-red-200 px-3 py-1 text-red-700 hover:bg-red-50">
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export default function TrainerClassesPage() {
  return (
    <RouteGuard allowedRoles={["TRAINER", "ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <ClassesInner />
      </AppShell>
    </RouteGuard>
  );
}
