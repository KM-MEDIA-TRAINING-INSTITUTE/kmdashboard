"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import {
  coursesApi,
  COURSE_STATUS_META,
  TRAINER_STATUS_ACTIONS,
  type CourseOut,
  type CourseStatusValue,
} from "@/lib/api/courses";

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function TrainerCoursesInner() {
  const [courses, setCourses] = useState<CourseOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const mine = await coursesApi.list({ mine: true, limit: 100 });
      setCourses(mine);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not load your courses. Is the API running?"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submitForReview = async (courseId: string) => {
    setBusyId(courseId);
    setError(null);
    try {
      await coursesApi.transition(courseId, "submit");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Submit failed");
    } finally {
      setBusyId(null);
    }
  };

  const counts: Record<string, number> = {};
  for (const c of courses) counts[c.status] = (counts[c.status] ?? 0) + 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">My courses</h1>
          <p className="mt-1 text-sm text-slate-500">
            Build content, submit for review, and track the approval workflow.
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          {showCreate ? "Close form" : "New course draft"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Total courses" value={courses.length} tone="text-slate-900" />
        <StatCard label="Drafts" value={counts.DRAFT ?? 0} tone="text-slate-700" />
        <StatCard
          label="Under review"
          value={(counts.SUBMITTED ?? 0) + (counts.UNDER_REVIEW ?? 0)}
          tone="text-amber-700"
        />
        <StatCard label="Published" value={counts.PUBLISHED ?? 0} tone="text-teal-700" />
      </div>

      {showCreate && (
        <CreateCourseForm
          onCreated={async () => {
            setShowCreate(false);
            await load();
          }}
        />
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading your courses…</p>
      ) : courses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
          You have no courses yet. Create a draft to start building modules and
          lessons — an administrator will review it before publication.
        </div>
      ) : (
        <ul className="space-y-3">
          {courses.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/trainer/courses/${c.id}`}
                      className="text-sm font-semibold text-slate-900 hover:underline"
                    >
                      {c.title}
                    </Link>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        COURSE_STATUS_META[c.status as CourseStatusValue]?.classes ??
                        "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {COURSE_STATUS_META[c.status as CourseStatusValue]?.label ?? c.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    <span className="font-mono">{c.course_code}</span> · {c.course_type}
                    {c.difficulty_level ? ` · ${c.difficulty_level}` : ""} ·{" "}
                    {c.module_count} module{c.module_count === 1 ? "" : "s"} ·{" "}
                    {c.lesson_count} lesson{c.lesson_count === 1 ? "" : "s"}
                  </p>
                  {c.short_description && (
                    <p className="mt-2 max-w-2xl text-sm text-slate-600">
                      {c.short_description}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {(() => {
                    const act = TRAINER_STATUS_ACTIONS[c.status as CourseStatusValue];
                    if (!act) return null;
                    return (
                      <button
                        disabled={busyId === c.id}
                        onClick={() => submitForReview(c.id)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {busyId === c.id ? "Submitting…" : act.label}
                      </button>
                    );
                  })()}
                  <Link
                    href={`/trainer/courses/${c.id}`}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
                  >
                    Open builder
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateCourseForm({ onCreated }: { onCreated: () => void | Promise<void> }) {
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [objectives, setObjectives] = useState("");
  const [courseType, setCourseType] = useState("CORE");
  const [difficulty, setDifficulty] = useState("BEGINNER");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await coursesApi.create({
        title: title.trim(),
        course_code: code.trim().toUpperCase(),
        short_description: shortDescription.trim() || null,
        learning_objectives: objectives
          .split("\n")
          .map((s) => s.replace(/^\d+[.)]\s*/, "").trim())
          .filter(Boolean),
        course_type: courseType as CourseOut["course_type"],
        difficulty_level: difficulty || null,
      });
      await onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the course");
    } finally {
      setSubmitting(false);
    }
  };

  const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-slate-200 bg-white p-6"
    >
      <h2 className="text-sm font-semibold text-slate-900">New course draft</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-slate-700">Title</span>
          <input
            required
            minLength={3}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`mt-1 ${input}`}
            placeholder="Introduction to Broadcast Journalism"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Course code</span>
          <input
            required
            minLength={2}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`mt-1 font-mono ${input}`}
            placeholder="BJN101"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Course type</span>
          <select
            value={courseType}
            onChange={(e) => setCourseType(e.target.value)}
            className={`mt-1 ${input}`}
          >
            {["CORE", "ELECTIVE", "PRACTICAL", "WORKSHOP", "PROJECT", "GENERAL"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Difficulty</span>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className={`mt-1 ${input}`}
          >
            <option value="">—</option>
            {["BEGINNER", "INTERMEDIATE", "ADVANCED"].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-slate-700">Short description</span>
          <input
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            maxLength={500}
            className={`mt-1 ${input}`}
            placeholder="One-line summary shown to students"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-slate-700">
            Learning objectives (one per line)
          </span>
          <textarea
            value={objectives}
            onChange={(e) => setObjectives(e.target.value)}
            rows={3}
            className={`mt-1 ${input}`}
            placeholder={"Explain broadcast journalism principles\nWrite a broadcast news script"}
          />
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Create draft"}
      </button>
    </form>
  );
}

export default function TrainerCoursesPage() {
  return (
    <RouteGuard allowedRoles={["TRAINER", "ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <TrainerCoursesInner />
      </AppShell>
    </RouteGuard>
  );
}
