"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import {
  coursesApi,
  COURSE_STATUS_META,
  TRAINER_STATUS_ACTIONS,
  type CourseOut,
  type LessonSummary,
  type ModuleSummary,
} from "@/lib/api/courses";

const LESSON_TYPES = [
  "TEXT",
  "VIDEO",
  "AUDIO",
  "DOCUMENT",
  "PRESENTATION",
  "EMBED",
  "MIXED",
];

function StatusBadge({ status }: { status: string }) {
  const meta = COURSE_STATUS_META[status as keyof typeof COURSE_STATUS_META];
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        meta?.classes ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {meta?.label ?? status}
    </span>
  );
}

function CourseBuilderInner() {
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;

  const [course, setCourse] = useState<CourseOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await coursesApi.detail(courseId);
      setCourse(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load the course");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, okMessage?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      await load();
      if (okMessage) setNotice(okMessage);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={["TRAINER", "ADMIN", "SUPERADMIN"]}>
        <AppShell>
          <p className="text-sm text-slate-400">Loading course…</p>
        </AppShell>
      </RouteGuard>
    );
  }

  if (!course) {
    return (
      <RouteGuard allowedRoles={["TRAINER", "ADMIN", "SUPERADMIN"]}>
        <AppShell>
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {error ?? "Course not found."}
            <div className="mt-3">
              <Link href="/trainer" className="font-medium underline">
                ← Back to my courses
              </Link>
            </div>
          </div>
        </AppShell>
      </RouteGuard>
    );
  }

  const submitAction = TRAINER_STATUS_ACTIONS[course.status];
  const editable = course.status === "DRAFT" || course.status === "CHANGES_REQUESTED";

  return (
    <RouteGuard allowedRoles={["TRAINER", "ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/trainer" className="text-xs text-slate-500 hover:underline">
                  ← My courses
                </Link>
                <StatusBadge status={course.status} />
              </div>
              <h1 className="mt-1 text-lg font-semibold text-slate-900">{course.title}</h1>
              <p className="text-xs text-slate-500">
                <span className="font-mono">{course.course_code}</span> · {course.course_type}
                {course.difficulty_level ? ` · ${course.difficulty_level}` : ""}
              </p>
            </div>
            {submitAction && (
              <button
                disabled={busy}
                onClick={() =>
                  run(
                    () => coursesApi.transition(course.id, submitAction.action),
                    "Submitted for review — an administrator will take it from here."
                  )
                }
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {busy ? "Working…" : submitAction.label}
              </button>
            )}
          </div>

          {course.status === "CHANGES_REQUESTED" && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
              The reviewer requested changes. Update the content below, then
              resubmit for review.
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {notice && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {notice}
            </div>
          )}

          <CourseInfoEditor course={course} editable={editable} busy={busy} run={run} />
          <CurriculumBuilder course={course} editable={editable} busy={busy} run={run} />

          {!editable && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
              Content is locked while the course is {COURSE_STATUS_META[course.status]?.label.toLowerCase() ?? course.status}.
            </div>
          )}
        </div>
      </AppShell>
    </RouteGuard>
  );
}

type RunFn = (fn: () => Promise<unknown>, okMessage?: string) => Promise<void>;

function CourseInfoEditor({
  course,
  editable,
  busy,
  run,
}: {
  course: CourseOut;
  editable: boolean;
  busy: boolean;
  run: RunFn;
}) {
  const [description, setDescription] = useState(course.description ?? "");
  const [objectives, setObjectives] = useState(course.learning_objectives.join("\n"));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDescription(course.description ?? "");
    setObjectives(course.learning_objectives.join("\n"));
    setDirty(false);
  }, [course.id, course.description, course.learning_objectives]);

  const save = () =>
    run(
      () =>
        coursesApi.update(course.id, {
          description,
          learning_objectives: objectives
            .split("\n")
            .map((s) => s.replace(/^\d+[.)]\s*/, "").trim())
            .filter(Boolean),
        }),
      "Course information saved."
    ).then(() => setDirty(false));

  const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-slate-900">Course information</h2>
      <div className="mt-4 space-y-4">
        <label className="block text-sm">
          <span className="text-slate-700">Description</span>
          <textarea
            disabled={!editable}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setDirty(true);
            }}
            rows={4}
            className={`mt-1 ${input}`}
            placeholder="What this course covers…"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Learning objectives (one per line)</span>
          <textarea
            disabled={!editable}
            value={objectives}
            onChange={(e) => {
              setObjectives(e.target.value);
              setDirty(true);
            }}
            rows={4}
            className={`mt-1 ${input}`}
          />
        </label>
        {editable && (
          <button
            disabled={busy || !dirty}
            onClick={save}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>
        )}
      </div>
    </section>
  );
}

function CurriculumBuilder({
  course,
  editable,
  busy,
  run,
}: {
  course: CourseOut;
  editable: boolean;
  busy: boolean;
  run: RunFn;
}) {
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const modules = course.modules ?? [];

  const addModule = () => {
    const title = newModuleTitle.trim();
    if (title.length < 2) return;
    void run(async () => {
      await coursesApi.addModule(course.id, title);
      setNewModuleTitle("");
    }, "Module added.");
  };

  const moveModule = (m: ModuleSummary, dir: -1 | 1) => {
    const target = m.order_index + dir;
    if (target < 1) return;
    void run(() => coursesApi.reorderModule(m.id, target));
  };

  const moveLesson = (m: ModuleSummary, l: LessonSummary, dir: -1 | 1) => {
    const target = l.order_index + dir;
    if (target < 1) return;
    void run(() => coursesApi.reorderLesson(l.id, target));
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">
          Curriculum — {modules.length} module{modules.length === 1 ? "" : "s"},{" "}
          {course.lesson_count} lesson{course.lesson_count === 1 ? "" : "s"}
        </h2>
      </div>

      {editable && (
        <div className="mt-4 flex gap-2">
          <input
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addModule()}
            placeholder="New module title (e.g. Introduction)"
            className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <button
            disabled={busy || newModuleTitle.trim().length < 2}
            onClick={addModule}
            className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Add module
          </button>
        </div>
      )}

      <ul className="mt-5 space-y-4">
        {modules.map((m) => (
          <li key={m.id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {m.order_index}. {m.title}
                </p>
                {m.description && (
                  <p className="text-xs text-slate-500">{m.description}</p>
                )}
              </div>
              {editable && (
                <div className="flex items-center gap-1">
                  <IconBtn
                    label="Move module up"
                    disabled={busy || m.order_index <= 1}
                    onClick={() => moveModule(m, -1)}
                  >
                    ↑
                  </IconBtn>
                  <IconBtn
                    label="Move module down"
                    disabled={busy || m.order_index >= modules.length}
                    onClick={() => moveModule(m, 1)}
                  >
                    ↓
                  </IconBtn>
                  <IconBtn
                    label="Delete module"
                    disabled={busy}
                    tone="danger"
                    onClick={() =>
                      run(() => coursesApi.deleteModule(m.id), "Module deleted.")
                    }
                  >
                    ✕
                  </IconBtn>
                </div>
              )}
            </div>

            <ol className="mt-3 space-y-2">
              {m.lessons.map((l) => (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-800">
                      {l.order_index}. {l.title}
                      {l.is_preview && (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          preview
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {l.content_type}
                      {l.duration_minutes ? ` · ${l.duration_minutes} min` : ""}
                    </p>
                  </div>
                  {editable && (
                    <div className="flex items-center gap-1">
                      <IconBtn
                        label="Move lesson up"
                        disabled={busy || l.order_index <= 1}
                        onClick={() => moveLesson(m, l, -1)}
                      >
                        ↑
                      </IconBtn>
                      <IconBtn
                        label="Move lesson down"
                        disabled={busy || l.order_index >= m.lessons.length}
                        onClick={() => moveLesson(m, l, 1)}
                      >
                        ↓
                      </IconBtn>
                      <IconBtn
                        label="Delete lesson"
                        disabled={busy}
                        tone="danger"
                        onClick={() => run(() => coursesApi.deleteLesson(l.id))}
                      >
                        ✕
                      </IconBtn>
                    </div>
                  )}
                </li>
              ))}
            </ol>

            {editable && <AddLessonForm moduleId={m.id} busy={busy} run={run} />}
          </li>
        ))}
      </ul>

      {modules.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">
          No modules yet. Add your first module above to start building the
          curriculum.
        </p>
      )}
    </section>
  );
}

function AddLessonForm({
  moduleId,
  busy,
  run,
}: {
  moduleId: string;
  busy: boolean;
  run: RunFn;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("TEXT");
  const [content, setContent] = useState("");
  const [duration, setDuration] = useState("");
  const [preview, setPreview] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        + Add lesson
      </button>
    );
  }

  const submit = () => {
    if (title.trim().length < 2) return;
    void run(async () => {
      await coursesApi.addLesson(moduleId, {
        title: title.trim(),
        content_type: type,
        content: content || (type === "TEXT" ? "<p></p>" : ""),
        duration_minutes: duration ? Number(duration) : null,
        is_preview: preview,
      });
      setTitle("");
      setContent("");
      setDuration("");
      setPreview(false);
      setOpen(false);
    }, "Lesson added.");
  };

  const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

  return (
    <div className="mt-3 space-y-3 rounded-md border border-slate-200 bg-slate-50/60 p-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Lesson title"
        className={input}
      />
      <div className="grid gap-2 sm:grid-cols-3">
        <select value={type} onChange={(e) => setType(e.target.value)} className={input}>
          {LESSON_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          value={duration}
          onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))}
          placeholder="Minutes (optional)"
          className={input}
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={preview}
            onChange={(e) => setPreview(e.target.checked)}
          />
          Free preview
        </label>
      </div>
      {type === "TEXT" ? (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder="<p>Lesson body (HTML allowed — sanitised on save)</p>"
          className={input}
        />
      ) : (
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="URL or reference for this lesson"
          className={input}
        />
      )}
      <div className="flex gap-2">
        <button
          disabled={busy || title.trim().length < 2}
          onClick={submit}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          Add lesson
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
  tone,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "danger";
}) {
  return (
    <button
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-7 w-7 place-items-center rounded-md border text-xs disabled:opacity-40 ${
        tone === "danger"
          ? "border-red-200 text-red-600 hover:bg-red-50"
          : "border-slate-300 text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

export default function CourseBuilderPage() {
  return <CourseBuilderInner />;
}
