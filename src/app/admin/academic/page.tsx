"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import { staffApi } from "@/lib/api/endpoints";
import type { UserOut } from "@/lib/api/types";
import {
  offeringsApi,
  reportsApi,
  type AttendanceAnalyticsRow,
  type Offering,
} from "@/lib/api/academic";

type Tab = "offerings" | "attendance" | "reports";

function AdminAcademicInner() {
  const [tab, setTab] = useState<Tab>("offerings");
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [selected, setSelected] = useState<Offering | null>(null);
  const [analytics, setAnalytics] = useState<AttendanceAnalyticsRow[]>([]);
  const [report, setReport] = useState<Record<string, unknown>[]>([]);
  const [trainers, setTrainers] = useState<UserOut[]>([]);
  const [selectedTrainer, setSelectedTrainer] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOfferings = useCallback(async () => {
    const rows = await offeringsApi.list();
    setOfferings(rows);
    return rows;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [_, trainerList] = await Promise.all([
          loadOfferings(),
          staffApi.list({ role: "TRAINER", limit: 200 }).catch(() => [] as UserOut[]),
        ]);
        if (!cancelled) {
          setTrainers(trainerList);
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
  }, [loadOfferings]);

  const openAttendance = async (o: Offering) => {
    setSelected(o);
    setTab("attendance");
    setError(null);
    try {
      setAnalytics(await offeringsApi.attendanceAnalytics(o.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load attendance.");
    }
  };

  const loadReport = useCallback(async () => {
    setReport(await reportsApi.attendance());
  }, []);

  useEffect(() => {
    if (tab === "reports") {
      loadReport().catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load the report.")
      );
    }
  }, [tab, loadReport]);

  const assignTrainer = async (o: Offering) => {
    const tid = selectedTrainer[o.id]?.trim();
    if (!tid) return;
    try {
      await offeringsApi.assignTrainer(o.id, tid, "PRIMARY");
      setMsg(`Trainer assigned to ${o.code} (audited).`);
      setSelectedTrainer((prev) => ({ ...prev, [o.id]: "" }));
      await loadOfferings();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Assignment failed.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Academic operations</h1>
        <p className="mt-1 text-sm text-slate-500">
          Offerings, trainer assignments, attendance monitoring and institution reports.
        </p>
      </div>

      {msg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{msg}</div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {(
          [
            ["offerings", "Offerings"],
            ["attendance", "Attendance"],
            ["reports", "Reports"],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              tab === t ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : tab === "offerings" ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Course offerings</caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-4 py-3">Code</th>
                <th scope="col" className="px-4 py-3">Mode</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Trainers</th>
                <th scope="col" className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {offerings.map((o) => (
                <tr key={o.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-slate-900">{o.code}</td>
                  <td className="px-4 py-3 text-xs">{o.delivery_mode}</td>
                  <td className="px-4 py-3 text-xs">{o.status}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {o.trainers.map((t) => t.name ?? t.trainer_id.slice(0, 8)).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <select
                        value={selectedTrainer[o.id] || ""}
                        onChange={(e) => setSelectedTrainer((prev) => ({ ...prev, [o.id]: e.target.value }))}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs max-w-[200px]"
                        aria-label={`Select trainer for ${o.code}`}
                      >
                        <option value="">Select trainer…</option>
                        {trainers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.full_name} ({t.email})
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={!selectedTrainer[o.id]}
                        onClick={() => assignTrainer(o)}
                        className="rounded-lg bg-slate-900 px-2.5 py-1 text-white hover:bg-slate-700 disabled:opacity-40"
                      >
                        Assign
                      </button>
                      <button onClick={() => openAttendance(o)} className="rounded-lg border border-slate-300 px-2 py-1 hover:bg-slate-50">
                        Attendance
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === "attendance" ? (
        selected ? (
          <>
            <p className="text-sm text-slate-600">
              Attendance for <span className="font-mono font-medium">{selected.code}</span>
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Per-student attendance</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-4 py-3">Student</th>
                    <th scope="col" className="px-4 py-3">Marked</th>
                    <th scope="col" className="px-4 py-3">Attended</th>
                    <th scope="col" className="px-4 py-3">Rate</th>
                    <th scope="col" className="px-4 py-3">Alert</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.map((r) => (
                    <tr key={r.student_id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 font-medium text-slate-900">{r.name ?? "—"}</td>
                      <td className="px-4 py-3">{r.marked ?? 0}</td>
                      <td className="px-4 py-3">{r.attended ?? 0}</td>
                      <td className="px-4 py-3">{r.attendance_rate === null ? "—" : `${r.attendance_rate}%`}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            r.alert === "CRITICAL"
                              ? "bg-red-50 text-red-700"
                              : r.alert === "WARNING"
                                ? "bg-amber-50 text-amber-700"
                                : r.alert === "OK"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {r.alert}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">Pick an offering from the Offerings tab.</p>
        )
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Institution attendance report</caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-4 py-3">Offering</th>
                <th scope="col" className="px-4 py-3">Students marked</th>
                <th scope="col" className="px-4 py-3">Average rate</th>
                <th scope="col" className="px-4 py-3">Critical</th>
                <th scope="col" className="px-4 py-3">Warning</th>
              </tr>
            </thead>
            <tbody>
              {report.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                    No data yet.
                  </td>
                </tr>
              ) : (
                report.map((r) => (
                  <tr key={String(r.offering_id)} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{String(r.code)}</td>
                    <td className="px-4 py-3">{String(r.students_marked ?? 0)}</td>
                    <td className="px-4 py-3">{r.average_rate === null ? "—" : `${r.average_rate}%`}</td>
                    <td className="px-4 py-3 text-red-700">{String(r.critical_count ?? 0)}</td>
                    <td className="px-4 py-3 text-amber-700">{String(r.warning_count ?? 0)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminAcademicPage() {
  return (
    <RouteGuard allowedRoles={["ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <AdminAcademicInner />
      </AppShell>
    </RouteGuard>
  );
}
