"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, Clock, FileEdit, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatCard,
  StatusBadge,
} from "@/components/dashboard/ui";
import { Button, PageHeader } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import {
  coursesApi,
  COURSE_STATUS_META,
  TRAINER_STATUS_ACTIONS,
  type CourseOut,
  type CourseStatusValue,
} from "@/lib/api/courses";

function TrainerCoursesInner() {
  const toast = useToast();
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
      toast.success("Submitted for review");
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
      <PageHeader
        eyebrow="Teaching"
        title="My courses"
        description="Build course modules, upload learning materials, submit for review, and track approval."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard/trainer" }, { label: "My courses" }]}
        actions={
          <Button
            variant={showCreate ? "outline" : "primary"}
            icon={showCreate ? undefined : <Plus className="h-4 w-4" />}
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? "Close form" : "New course draft"}
          </Button>
        }
      />

      {error && <ErrorState title="Could not load courses" detail={error} onRetry={load} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total courses" value={courses.length} icon={<BookOpen className="h-4 w-4" />} tone="brand" />
        <StatCard label="Drafts" value={counts.DRAFT ?? 0} icon={<FileEdit className="h-4 w-4" />} />
        <StatCard
          label="Under review"
          value={(counts.SUBMITTED ?? 0) + (counts.UNDER_REVIEW ?? 0)}
          icon={<Clock className="h-4 w-4" />}
          tone="warn"
        />
        <StatCard label="Published" value={counts.PUBLISHED ?? 0} icon={<CheckCircle2 className="h-4 w-4" />} tone="good" />
      </div>

      {showCreate && (
        <CreateCourseForm
          onCreated={async () => {
            setShowCreate(false);
            toast.success("Course draft created");
            await load();
          }}
        />
      )}

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : courses.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title="You have no courses yet"
          detail="Create a draft to start building modules and lessons — an administrator will review it before publication."
        />
      ) : (
        <ul className="space-y-3">
          {courses.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-card)] transition-all hover:border-brand-200"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/trainer/courses/${c.id}`}
                      className="text-base font-bold text-ink-900 transition-colors hover:text-brand-700 hover:underline"
                    >
                      {c.title}
                    </Link>
                    <StatusBadge
                      status={c.status}
                      label={COURSE_STATUS_META[c.status as CourseStatusValue]?.label ?? c.status}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-brand-700">{c.course_code}</span> ·{" "}
                    {c.course_type}
                    {c.difficulty_level ? ` · ${c.difficulty_level}` : ""} · {c.module_count} module
                    {c.module_count === 1 ? "" : "s"} · {c.lesson_count} lesson
                    {c.lesson_count === 1 ? "" : "s"}
                  </p>
                  {c.short_description && (
                    <p className="mt-2 max-w-2xl text-sm text-slate-600">{c.short_description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {(() => {
                    const act = TRAINER_STATUS_ACTIONS[c.status as CourseStatusValue];
                    if (!act) return null;
                    return (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={busyId === c.id}
                        onClick={() => submitForReview(c.id)}
                      >
                        {act.label}
                      </Button>
                    );
                  })()}
                  <Link
                    href={`/trainer/courses/${c.id}`}
                    className="inline-flex h-8 items-center rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
                  >
                    Open builder →
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
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none";

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-[var(--shadow-card)]"
    >
      <h2 className="text-base font-bold text-ink-900">New course draft</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-ink-800">
          Title
          <input
            required
            minLength={3}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`mt-1.5 ${input}`}
            placeholder="Introduction to Broadcast Journalism"
          />
        </label>
        <label className="block text-xs font-semibold text-ink-800">
          Course code
          <input
            required
            minLength={2}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`mt-1.5 font-mono ${input}`}
            placeholder="BJN101"
          />
        </label>
        <label className="block text-xs font-semibold text-ink-800">
          Course type
          <select
            value={courseType}
            onChange={(e) => setCourseType(e.target.value)}
            className={`mt-1.5 ${input}`}
          >
            {["CORE", "ELECTIVE", "PRACTICAL", "WORKSHOP", "PROJECT", "GENERAL"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-ink-800">
          Difficulty
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className={`mt-1.5 ${input}`}
          >
            <option value="">—</option>
            {["BEGINNER", "INTERMEDIATE", "ADVANCED"].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-ink-800 sm:col-span-2">
          Short description
          <input
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            maxLength={500}
            className={`mt-1.5 ${input}`}
            placeholder="One-line summary shown to students"
          />
        </label>
        <label className="block text-xs font-semibold text-ink-800 sm:col-span-2">
          Learning objectives (one per line)
          <textarea
            value={objectives}
            onChange={(e) => setObjectives(e.target.value)}
            rows={3}
            className={`mt-1.5 ${input}`}
            placeholder={"Explain broadcast journalism principles\nWrite a broadcast news script"}
          />
        </label>
      </div>
      {error && <p className="mt-3 text-xs font-medium text-red-700">{error}</p>}
      <div className="mt-4">
        <Button type="submit" variant="primary" loading={submitting}>
          Create draft
        </Button>
      </div>
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
