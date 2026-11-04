"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import { attendanceStatusMeta, studentApi, type AttendanceStatusValue } from "@/lib/api/academic";

interface MyRecord {
  record_id: string;
  session_id: string;
  session_title: string;
  session_date: string;
  start_time: string;
  end_time: string;
  delivery_mode: string;
  status: AttendanceStatusValue;
  notes: string | null;
  course_offering_id: string;
}

function AttendanceInner() {
  const [records, setRecords] = useState<MyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = (await studentApi.attendance()) as unknown as MyRecord[];
        if (!cancelled) setRecords(rows);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Could not load your attendance.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    const attended = records.filter((r) =>
      ["PRESENT", "LATE", "REMOTE"].includes(r.status)
    ).length;
    const excused = records.filter((r) => r.status === "EXCUSED").length;
    const eligible = records.length - excused;
    return {
      total: records.length,
      attended,
      rate: eligible > 0 ? Math.round((attended / eligible) * 1000) / 10 : null,
    };
  }, [records]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">My attendance</h1>
        <p className="mt-1 text-sm text-slate-500">Your recorded attendance across all classes.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!loading && records.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sessions marked</p>
            <p className="mt-1 text-xl font-semibold">{summary.total}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Attended</p>
            <p className="mt-1 text-xl font-semibold">{summary.attended}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Attendance rate</p>
            <p className="mt-1 text-xl font-semibold">{summary.rate === null ? "—" : `${summary.rate}%`}</p>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
          No attendance recorded yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {records.map((r) => {
            const meta = attendanceStatusMeta[r.status] ?? {
              label: r.status,
              className: "bg-slate-100 text-slate-700 border-slate-200",
            };
            return (
              <li
                key={r.record_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{r.session_title}</p>
                  <p className="text-xs text-slate-500">
                    {r.session_date} · {r.start_time?.slice(0, 5)}–{r.end_time?.slice(0, 5)} · {r.delivery_mode}
                  </p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.className}`}>
                  {meta.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function StudentAttendancePage() {
  return (
    <RouteGuard allowedRoles={["STUDENT", "TRAINER", "ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <AttendanceInner />
      </AppShell>
    </RouteGuard>
  );
}
