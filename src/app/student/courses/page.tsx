"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import { studentCoursesApi, type StudentCourseOut } from "@/lib/api/courses";

function StudentCoursesInner() {
  const [courses, setCourses] = useState<StudentCourseOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await studentCoursesApi.myCourses();
        if (!cancelled) setCourses(rows);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Could not load your courses. Is the API running?"
          );
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
        <h1 className="text-lg font-semibold text-slate-900">My courses</h1>
        <p className="mt-1 text-sm text-slate-500">
          Published courses from your enrolled programme&apos;s active curriculum.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading your courses…</p>
      ) : courses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
          No courses are available yet. Courses appear here once your programme
          office publishes them for your intake.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {courses.map((c) => (
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
              {c.short_description && (
                <p className="mt-2 text-sm text-slate-600">{c.short_description}</p>
              )}
              <p className="mt-3 text-xs text-slate-400">
                {c.curriculum ?? "Curriculum"}
                {c.year_level ? ` · Year ${c.year_level}` : ""}
                {c.term ? ` · ${c.term}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function StudentCoursesPage() {
  return (
    <RouteGuard allowedRoles={["STUDENT", "TRAINER", "ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <StudentCoursesInner />
      </AppShell>
    </RouteGuard>
  );
}
