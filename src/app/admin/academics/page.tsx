"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import {
  academicsApi,
  type AcademicSessionRow,
  type CampusRow,
  type IntakeRow,
} from "@/lib/api/students";

const INTAKE_BADGES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  OPEN: "bg-emerald-100 text-emerald-700",
  ACTIVE: "bg-blue-100 text-blue-700",
  CLOSED: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-teal-100 text-teal-700",
  ARCHIVED: "bg-slate-100 text-slate-400",
};

export default function AdminAcademicsPage() {
  const [campuses, setCampuses] = useState<CampusRow[]>([]);
  const [sessions, setSessions] = useState<AcademicSessionRow[]>([]);
  const [intakes, setIntakes] = useState<IntakeRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // create forms
  const [campusName, setCampusName] = useState("");
  const [campusCode, setCampusCode] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [sessionCode, setSessionCode] = useState("");
  const [intakeName, setIntakeName] = useState("");
  const [intakeCode, setIntakeCode] = useState("");
  const [intakeSessionId, setIntakeSessionId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [c, s, i] = await Promise.all([
        academicsApi.campuses(),
        academicsApi.sessions(),
        academicsApi.intakes(),
      ]);
      setCampuses(c);
      setSessions(s);
      setIntakes(i);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load academic structure");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (kind: "campus" | "session" | "intake") => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (kind === "campus") {
        await academicsApi.createCampus({ name: campusName, code: campusCode });
        setCampusName("");
        setCampusCode("");
        setNotice("Campus created.");
      } else if (kind === "session") {
        await academicsApi.createSession({ name: sessionName, code: sessionCode, status: "DRAFT" });
        setSessionName("");
        setSessionCode("");
        setNotice("Academic session created.");
      } else {
        await academicsApi.createIntake({
          name: intakeName,
          code: intakeCode,
          academic_session_id: intakeSessionId,
          status: "DRAFT",
        });
        setIntakeName("");
        setIntakeCode("");
        setNotice("Intake created (DRAFT — set it OPEN/ACTIVE before enrolling).");
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900";

  return (
    <RouteGuard allowedRoles={["ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <div className="space-y-6">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Academic structure</h1>
            <p className="mt-1 text-sm text-slate-500">
              Campuses, academic sessions, and intakes — the configuration that drives enrollment.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {notice && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {notice}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Campuses */}
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">Campuses ({campuses.length})</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {campuses.map((c) => (
                  <li key={c.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                    <span>
                      <span className="font-medium text-slate-800">{c.name}</span>
                      <span className="ml-2 font-mono text-xs text-slate-400">{c.code}</span>
                    </span>
                    <span className={c.is_active ? "text-xs text-emerald-600" : "text-xs text-slate-400"}>
                      {c.is_active ? "active" : "inactive"}
                    </span>
                  </li>
                ))}
                {campuses.length === 0 && <li className="text-slate-400">No campuses yet.</li>}
              </ul>
              <form
                className="mt-4 border-t border-slate-100 pt-4"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  create("campus");
                }}
              >
                <input
                  required
                  value={campusName}
                  onChange={(e) => setCampusName(e.target.value)}
                  placeholder="Campus name"
                  className={inputCls}
                />
                <input
                  required
                  value={campusCode}
                  onChange={(e) => setCampusCode(e.target.value.toUpperCase())}
                  placeholder="Code (e.g. HO)"
                  className={inputCls}
                />
                <button
                  type="submit"
                  disabled={busy || !campusName || !campusCode}
                  className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  Add campus
                </button>
              </form>
            </section>

            {/* Sessions */}
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">Academic sessions ({sessions.length})</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {sessions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                    <span className="font-medium text-slate-800">{s.name}</span>
                    <span className="text-xs text-slate-500">{s.status}</span>
                  </li>
                ))}
                {sessions.length === 0 && <li className="text-slate-400">No sessions yet.</li>}
              </ul>
              <form
                className="mt-4 border-t border-slate-100 pt-4"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  create("session");
                }}
              >
                <input
                  required
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="2027/2028"
                  className={inputCls}
                />
                <input
                  required
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                  placeholder="Code (e.g. 2728)"
                  className={inputCls}
                />
                <button
                  type="submit"
                  disabled={busy || !sessionName || !sessionCode}
                  className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  Add session
                </button>
              </form>
            </section>

            {/* Intakes */}
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">Intakes ({intakes.length})</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {intakes.map((i) => (
                  <li key={i.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                    <span>
                      <span className="font-medium text-slate-800">{i.name}</span>
                      <span className="block text-xs text-slate-400">{i.session_name ?? ""}</span>
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${INTAKE_BADGES[i.status] ?? ""}`}>
                      {i.status}
                    </span>
                  </li>
                ))}
                {intakes.length === 0 && <li className="text-slate-400">No intakes yet.</li>}
              </ul>
              <form
                className="mt-4 border-t border-slate-100 pt-4"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  create("intake");
                }}
              >
                <input
                  required
                  value={intakeName}
                  onChange={(e) => setIntakeName(e.target.value)}
                  placeholder="January 2028 Intake"
                  className={inputCls}
                />
                <input
                  required
                  value={intakeCode}
                  onChange={(e) => setIntakeCode(e.target.value.toUpperCase())}
                  placeholder="Code (e.g. JAN-2028)"
                  className={inputCls}
                />
                <select
                  required
                  value={intakeSessionId}
                  onChange={(e) => setIntakeSessionId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Select session…</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={busy || !intakeName || !intakeCode || !intakeSessionId}
                  className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  Add intake
                </button>
              </form>
            </section>
          </div>
        </div>
      </AppShell>
    </RouteGuard>
  );
}
