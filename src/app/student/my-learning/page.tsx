"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import { studentApi, type ProgressMetrics, type StudentResult, type StudentOffering } from "@/lib/api/academic";
import { studentCoursesApi, type StudentCourseOut } from "@/lib/api/courses";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function MyLearningInner() {
  const [courses, setCourses] = useState<StudentCourseOut[]>([]);
  const [offerings, setOfferings] = useState<StudentOffering[]>([]);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [progress, setProgress] = useState<Record<string, ProgressMetrics>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [myCourses, myOfferings, myResults] = await Promise.all([
          studentCoursesApi.myCourses(),
          studentApi.offerings().catch(() => []),
          studentApi.results().catch(() => []),
        ]);
        if (cancelled) return;
        setCourses(myCourses);
        setResults(myResults);
        // Student-scoped offerings (the staff detail endpoint 403s for
        // students by design) — matched to courses by course_id below.
        const offs = myOfferings;
        if (!cancelled) setOfferings(offs);
        // progress per offering (best effort)
        const prog: Record<string, ProgressMetrics> = {};
        await Promise.all(
          offs.map(async (o) => {
            try {
              prog[o.id] = await studentApi.progress(o.id);
            } catch {
              /* not enrolled for this offering */
            }
          })
        );
        if (!cancelled) setProgress(prog);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Could not load your learning dashboard.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const avgScore = results.length
    ? results.reduce((acc, r) => acc + (r.percentage ?? 0), 0) / results.length
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">My learning</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your courses, classes, results and progress — all derived from your enrollment.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Courses" value={String(courses.length)} />
            <StatCard label="Average score" value={avgScore === null ? "—" : `${avgScore.toFixed(1)}%`} />
            <StatCard
              label="Attendance"
              value={
                Object.keys(progress).length
                  ? `${
                      Math.round(
                        (Object.values(progress).reduce(
                          (a, p) => a + (p.attendance?.attendance_rate ?? 0),
                          0
                        ) /
                          Object.keys(progress).length) *
                          10
                      ) / 10
                    }%`
                  : "—"
              }
            />
            <StatCard label="Published results" value={String(results.length)} />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-900">Current courses</h2>
            {courses.length === 0 ? (
              <div className="mt-2 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
                No published courses yet. Courses appear once your programme office publishes them.
              </div>
            ) : (
              <ul className="mt-2 grid gap-4 sm:grid-cols-2">
                {courses.map((c) => {
                  const offering = offerings.find((o) => o.course_id === c.course_id);
                  const p = offering ? progress[offering.id] : undefined;
                  return (
                    <li key={c.course_id} className="rounded-xl border border-slate-200 bg-white p-5">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/student/courses/${c.course_id}`}
                          className="text-sm font-semibold text-slate-900 hover:underline"
                        >
                          {c.title}
                        </Link>
                        {c.is_required && (
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                            required
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        <span className="font-mono">{c.course_code}</span>
                        {c.trainer ? ` · ${c.trainer}` : ""}
                      </p>
                      {p && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>Content progress</span>
                            <span>{p.content_progress.toFixed(0)}%</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-slate-900"
                              style={{ width: `${Math.min(100, p.content_progress)}%` }}
                            />
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            Lessons {p.lessons_completed}/{p.lessons_total} · Attendance{" "}
                            {p.attendance?.attendance_rate === null || p.attendance?.attendance_rate === undefined
                              ? "—"
                              : `${p.attendance.attendance_rate}%`}
                          </p>
                        </div>
                      )}
                      {offering && (
                        <div className="mt-3 flex flex-wrap gap-3 text-xs">
                          <Link href="/student/classes" className="font-medium text-slate-900 underline">
                            Classes
                          </Link>
                          <Link href="/student/assignments" className="font-medium text-slate-900 underline">
                            Assignments
                          </Link>
                          <Link href="/student/assessments" className="font-medium text-slate-900 underline">
                            Assessments
                          </Link>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/student/classes" className="rounded-lg border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50">
              My classes
            </Link>
            <Link href="/student/calendar" className="rounded-lg border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50">
              Calendar
            </Link>
            <Link href="/student/attendance" className="rounded-lg border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50">
              Attendance
            </Link>
            <Link href="/student/results" className="rounded-lg border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50">
              Results
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function StudentMyLearningPage() {
  return (
    <RouteGuard allowedRoles={["STUDENT", "TRAINER", "ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <MyLearningInner />
      </AppShell>
    </RouteGuard>
  );
}
