"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import {
  studentCoursesApi,
  type LessonSummary,
  type ModuleSummary,
} from "@/lib/api/courses";

interface CourseDetail {
  id: string;
  title: string;
  course_code: string;
  short_description: string | null;
  description: string | null;
  trainers: Array<{ name: string | null; email: string | null }>;
  modules: ModuleSummary[];
  learning_objectives?: string[];
}

function CourseDetailInner() {
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [completing, setCompleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await studentCoursesApi.courseDetail(courseId);
      setCourse(data);
      const map: Record<string, boolean> = {};
      for (const m of data.modules ?? []) {
        for (const l of m.lessons ?? []) {
          if (l.completed) map[l.id] = true;
        }
      }
      setCompleted(map);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load the course");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const markComplete = async (lessonId: string) => {
    setCompleting(lessonId);
    try {
      await studentCoursesApi.completeLesson(lessonId);
      setCompleted((prev) => ({ ...prev, [lessonId]: true }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record progress");
    } finally {
      setCompleting(null);
    }
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={["STUDENT", "TRAINER", "ADMIN", "SUPERADMIN"]}>
        <AppShell>
          <p className="text-sm text-slate-400">Loading course…</p>
        </AppShell>
      </RouteGuard>
    );
  }

  if (!course) {
    return (
      <RouteGuard allowedRoles={["STUDENT", "TRAINER", "ADMIN", "SUPERADMIN"]}>
        <AppShell>
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {error ?? "Course not found or you are not enrolled."}
            <div className="mt-3">
              <Link href="/student/courses" className="font-medium underline">
                ← Back to my courses
              </Link>
            </div>
          </div>
        </AppShell>
      </RouteGuard>
    );
  }

  const allLessons = (course.modules ?? []).flatMap((m) => m.lessons ?? []);
  const doneCount = allLessons.filter((l) => completed[l.id]).length;
  const pct = allLessons.length === 0 ? 0 : Math.round((doneCount / allLessons.length) * 100);

  return (
    <RouteGuard allowedRoles={["STUDENT", "TRAINER", "ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <div className="space-y-6">
          <div>
            <Link href="/student/courses" className="text-xs text-slate-500 hover:underline">
              ← My courses
            </Link>
            <h1 className="mt-1 text-lg font-semibold text-slate-900">{course.title}</h1>
            <p className="text-xs text-slate-500">
              <span className="font-mono">{course.course_code}</span>
              {course.trainers.length > 0
                ? ` · ${course.trainers.map((t) => t.name ?? t.email ?? "").join(", ")}`
                : ""}
            </p>
            {course.short_description && (
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                {course.short_description}
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Progress */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">Your progress</span>
              <span className="text-slate-500">
                {doneCount} of {allLessons.length} lessons · {pct}%
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Modules + lessons */}
          <div className="space-y-4">
            {(course.modules ?? []).map((m, mi) => (
              <section key={m.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-slate-900">
                  Module {mi + 1}: {m.title}
                </h2>
                {m.description && <p className="mt-1 text-xs text-slate-500">{m.description}</p>}
                <ol className="mt-3 space-y-2">
                  {(m.lessons ?? []).map((l, li) => (
                    <LessonRow
                      key={l.id}
                      lesson={l}
                      index={li}
                      completed={!!completed[l.id]}
                      completing={completing === l.id}
                      open={openLessonId === l.id}
                      onToggle={async () => {
                        const next = openLessonId === l.id ? null : l.id;
                        setOpenLessonId(next);
                      }}
                      onComplete={() => markComplete(l.id)}
                    />
                  ))}
                  {(m.lessons ?? []).length === 0 && (
                    <li className="text-sm text-slate-400">No lessons in this module yet.</li>
                  )}
                </ol>
              </section>
            ))}
            {(course.modules ?? []).length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
                Content for this course is being prepared. Check back soon.
              </div>
            )}
          </div>
        </div>
      </AppShell>
    </RouteGuard>
  );
}

function LessonRow({
  lesson,
  index,
  completed,
  completing,
  open,
  onToggle,
  onComplete,
}: {
  lesson: LessonSummary;
  index: number;
  completed: boolean;
  completing: boolean;
  open: boolean;
  onToggle: () => void | Promise<void>;
  onComplete: () => void | Promise<void>;
}) {
  const [detail, setDetail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || detail !== null) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    studentCoursesApi
      .lesson(lesson.id)
      .then((l) => {
        if (!cancelled) setDetail(l.content ?? "");
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : "Could not load the lesson");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, detail, lesson.id]);

  return (
    <li className="rounded-lg border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
        <button
          onClick={() => void onToggle()}
          className="flex min-w-0 items-center gap-3 text-left"
        >
          <span
            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs ${
              completed
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}
            aria-hidden
          >
            {completed ? "✓" : index + 1}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm text-slate-800">{lesson.title}</span>
            <span className="block text-xs text-slate-500">
              {lesson.content_type}
              {lesson.duration_minutes ? ` · ${lesson.duration_minutes} min` : ""}
            </span>
          </span>
        </button>
        <div className="flex items-center gap-2">
          {!completed && (
            <button
              disabled={completing}
              onClick={() => void onComplete()}
              className="rounded-md border border-emerald-300 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              {completing ? "Saving…" : "Mark complete"}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
          {loading ? (
            <p className="text-sm text-slate-400">Loading lesson…</p>
          ) : loadError ? (
            <p className="text-sm text-red-700">{loadError}</p>
          ) : (
            <LessonContent content={detail ?? ""} contentType={lesson.content_type} />
          )}
        </div>
      )}
    </li>
  );
}

function LessonContent({ content, contentType }: { content: string; contentType: string }) {
  if (contentType === "TEXT") {
    return (
      <div
        className="prose prose-sm max-w-none text-slate-700"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }
  if (/^https?:\/\//.test(content)) {
    return (
      <a
        href={content}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-blue-700 underline"
      >
        Open {contentType.toLowerCase()} resource ↗
      </a>
    );
  }
  return <p className="whitespace-pre-wrap text-sm text-slate-700">{content}</p>;
}

export default function StudentCourseDetailPage() {
  return <CourseDetailInner />;
}
