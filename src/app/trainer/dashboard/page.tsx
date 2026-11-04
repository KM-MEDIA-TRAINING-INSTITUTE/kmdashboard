"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import {
  assignmentsApi,
  offeringsApi,
  sessionsApi,
  type Assignment,
  type AttendanceAnalyticsRow,
  type ClassSession,
  type Offering,
  type Submission,
} from "@/lib/api/academic";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function TrainerDashboardInner() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [todayClasses, setTodayClasses] = useState<ClassSession[]>([]);
  const [upcoming, setUpcoming] = useState<ClassSession[]>([]);
  const [students, setStudents] = useState(0);
  const [avgAttendance, setAvgAttendance] = useState<number | null>(null);
  const [pendingGrades, setPendingGrades] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mine = await offeringsApi.mine();
        if (cancelled) return;
        setOfferings(mine);

        const today = new Date().toISOString().slice(0, 10);
        const allSessions: ClassSession[] = [];
        const analytics: AttendanceAnalyticsRow[] = [];
        let rosterTotal = 0;
        let pending = 0;

        await Promise.all(
          mine.map(async (o) => {
            const sessions = await offeringsApi.sessions(o.id).catch(() => [] as ClassSession[]);
            allSessions.push(...sessions);
            const rows = await offeringsApi.attendanceAnalytics(o.id).catch(() => [] as AttendanceAnalyticsRow[]);
            analytics.push(...rows);
            rosterTotal += rows.length;
            const assigns = await offeringsApi.assignments(o.id).catch(() => [] as Assignment[]);
            await Promise.all(
              assigns
                .filter((a) => a.status === "PUBLISHED")
                .map(async (a) => {
                  const subs = await assignmentsApi.submissions(a.id).catch(() => [] as Submission[]);
                  pending += subs.filter((s) => s.status !== "GRADED").length;
                })
            );
          })
        );
        if (cancelled) return;

        setTodayClasses(allSessions.filter((s) => s.session_date === today && s.status !== "CANCELLED"));
        setUpcoming(
          allSessions
            .filter((s) => s.session_date > today && s.status === "SCHEDULED")
            .sort((a, b) => a.session_date.localeCompare(b.session_date))
            .slice(0, 8)
        );
        setStudents(rosterTotal);
        const rates = analytics
          .map((r) => r.attendance_rate)
          .filter((r): r is number => r !== null && r !== undefined);
        setAvgAttendance(
          rates.length ? Math.round((rates.reduce((a, r) => a + r, 0) / rates.length) * 10) / 10 : null
        );
        setPendingGrades(pending);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Could not load the academic dashboard.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Teaching dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your live academic workload across assigned offerings.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Today's classes" value={todayClasses.length} />
            <StatCard label="My offerings" value={offerings.length} />
            <StatCard label="Students" value={students} />
            <StatCard
              label="Avg attendance"
              value={avgAttendance === null ? "—" : `${avgAttendance}%`}
            />
            <StatCard label="Pending grades" value={pendingGrades} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">Today&apos;s classes</h2>
              {todayClasses.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No classes today.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {todayClasses.map((s) => (
                    <li key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <span className="font-medium text-slate-900">{s.title}</span>
                      <span className="text-xs text-slate-500">
                        {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)} · {s.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">Upcoming</h2>
              {upcoming.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Nothing scheduled.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {upcoming.map((s) => (
                    <li key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <span className="font-medium text-slate-900">{s.title}</span>
                      <span className="text-xs text-slate-500">{s.session_date} · {s.start_time.slice(0, 5)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/trainer/classes" className="rounded-lg border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50">
              Manage classes
            </Link>
            <Link href="/trainer/attendance" className="rounded-lg border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50">
              Attendance
            </Link>
            <Link href="/trainer/assignments" className="rounded-lg border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50">
              Assignments
            </Link>
            <Link href="/trainer/assessments" className="rounded-lg border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50">
              Assessments
            </Link>
            <Link href="/trainer/gradebook" className="rounded-lg border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50">
              Gradebook
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function TrainerDashboardPage() {
  return (
    <RouteGuard allowedRoles={["TRAINER", "ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <TrainerDashboardInner />
      </AppShell>
    </RouteGuard>
  );
}
