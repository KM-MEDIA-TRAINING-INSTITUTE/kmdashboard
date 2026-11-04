"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import {
  coursesApi,
  COURSE_STATUS_META,
  type CourseOut,
  type CourseStatusValue,
} from "@/lib/api/courses";

const STATUS_FILTERS: Array<CourseStatusValue | "ALL"> = [
  "ALL",
  "SUBMITTED",
  "UNDER_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "PUBLISHED",
  "DRAFT",
  "ARCHIVED",
];

function AdminCoursesInner() {
  const [courses, setCourses] = useState<CourseOut[]>([]);
  const [filter, setFilter] = useState<CourseStatusValue | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await coursesApi.list({
        status: filter === "ALL" ? undefined : filter,
        limit: 200,
      });
      setCourses(rows);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not load courses. Is the API running?"
      );
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (courseId: string, fn: () => Promise<unknown>) => {
    setBusyId(courseId);
    setActionError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const counts: Record<string, number> = {};
  for (const c of courses) counts[c.status] = (counts[c.status] ?? 0) + 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Course review</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review trainer submissions, request changes, and publish approved
          courses. Review, approval, and publication are admin-only — trainers
          can never self-approve.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => {
          const active = filter === s;
          const count =
            s === "ALL" ? courses.length : (counts[s as CourseStatusValue] ?? 0);
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {s === "ALL" ? "All" : (COURSE_STATUS_META[s as CourseStatusValue]?.label ?? s)}
              {active ? "" : ` (${count})`}
            </button>
          );
        })}
      </div>

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading courses…</p>
      ) : courses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
          No courses match this filter.
        </div>
      ) : (
        <ul className="space-y-3">
          {courses.map((c) => (
            <li key={c.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{c.title}</p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        COURSE_STATUS_META[c.status]?.classes ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {COURSE_STATUS_META[c.status]?.label ?? c.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    <span className="font-mono">{c.course_code}</span>
                    {c.trainers.length > 0
                      ? ` · Trainer: ${c.trainers.map((t) => t.name ?? t.email ?? "?").join(", ")}`
                      : " · No trainer assigned"}
                    {` · ${c.module_count} module${c.module_count === 1 ? "" : "s"} · ${c.lesson_count} lesson${c.lesson_count === 1 ? "" : "s"}`}
                  </p>
                </div>
                <CourseAdminActions
                  course={c}
                  busy={busyId === c.id}
                  onAction={act}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CourseAdminActions({
  course,
  busy,
  onAction,
}: {
  course: CourseOut;
  busy: boolean;
  onAction: (courseId: string, fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [showChanges, setShowChanges] = useState(false);
  const [feedback, setFeedback] = useState("");

  const btn =
    "rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 whitespace-nowrap";
  const outline = `${btn} border border-slate-300 text-slate-700 hover:bg-slate-50`;
  const primary = `${btn} bg-slate-900 text-white hover:bg-slate-700`;

  const disabledDuring =
    course.status === "DRAFT" || course.status === "PUBLISHED" || course.status === "ARCHIVED";

  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {course.status === "SUBMITTED" && (
          <button
            disabled={busy}
            className={primary}
            onClick={() => onAction(course.id, () => coursesApi.transition(course.id, "start-review"))}
          >
            Start review
          </button>
        )}
        {course.status === "UNDER_REVIEW" && (
          <>
            <button disabled={busy} className={outline} onClick={() => setShowChanges((v) => !v)}>
              Request changes
            </button>
            <button
              disabled={busy}
              className={primary}
              onClick={() => onAction(course.id, () => coursesApi.transition(course.id, "approve"))}
            >
              Approve
            </button>
          </>
        )}
        {course.status === "CHANGES_REQUESTED" && (
          <button disabled={busy} className={outline} onClick={() => setShowChanges((v) => !v)}>
            Add feedback
          </button>
        )}
        {course.status === "APPROVED" && (
          <button
            disabled={busy}
            className={primary}
            onClick={() => onAction(course.id, () => coursesApi.transition(course.id, "publish"))}
          >
            Publish
          </button>
        )}
        {course.status === "PUBLISHED" && (
          <button
            disabled={busy}
            className={outline}
            onClick={() => onAction(course.id, () => coursesApi.transition(course.id, "archive"))}
          >
            Archive
          </button>
        )}
      </div>

      {showChanges && !disabledDuring && (
        <div className="w-72 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="block text-xs font-medium text-slate-700" htmlFor={`fb-${course.id}`}>
            Feedback for the trainer (required)
          </label>
          <textarea
            id={`fb-${course.id}`}
            rows={3}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
            placeholder="What needs to change before approval?"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              className="rounded-md px-2 py-1 text-xs text-slate-500 hover:text-slate-700"
              onClick={() => {
                setShowChanges(false);
                setFeedback("");
              }}
            >
              Cancel
            </button>
            <button
              disabled={busy || feedback.trim().length < 5}
              className={`${btn} bg-orange-600 text-white hover:bg-orange-500`}
              onClick={async () => {
                await onAction(course.id, () =>
                  coursesApi.requestChanges(course.id, feedback.trim())
                );
                setShowChanges(false);
                setFeedback("");
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminCoursesPage() {
  return (
    <RouteGuard allowedRoles={["ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <AdminCoursesInner />
      </AppShell>
    </RouteGuard>
  );
}
