"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import { academicsApi, type AcademicSessionRow } from "@/lib/api/students";
import {
  coursesApi,
  curriculaApi,
  programsApi,
  type CourseOut,
  type CurriculumOut,
} from "@/lib/api/courses";

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  REVIEW: "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-700",
  ACTIVE: "bg-emerald-100 text-emerald-700",
  RETIRED: "bg-slate-200 text-slate-500",
};

export default function AdminCurriculaPage() {
  const [curricula, setCurricula] = useState<CurriculumOut[]>([]);
  const [programs, setPrograms] = useState<
    Array<{ id: string; slug: string; code: string; title: string }>
  >([]);
  const [sessions, setSessions] = useState<AcademicSessionRow[]>([]);
  const [courses, setCourses] = useState<CourseOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // create form
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [programId, setProgramId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [version, setVersion] = useState("1.0");

  // add-course form (per curriculum)
  const [openId, setOpenId] = useState<string | null>(null);
  const [addCourseId, setAddCourseId] = useState("");
  const [yearLevel, setYearLevel] = useState("1");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [c, p, s, k] = await Promise.all([
        curriculaApi.list(),
        programsApi.list(),
        academicsApi.sessions(),
        coursesApi.list({ limit: 200 }),
      ]);
      setCurricula(c);
      setPrograms(p);
      setSessions(s);
      setCourses(k);
      if (!programId && p.length > 0) setProgramId(p[0].id);
      if (!sessionId && s.length > 0) setSessionId(s[0].id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load curricula");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(ok);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const createCurriculum = () => {
    if (name.trim().length < 3 || code.trim().length < 2 || !programId || !sessionId) return;
    void run(
      () =>
        curriculaApi.create({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          program_id: programId,
          academic_session_id: sessionId,
          version: version.trim() || "1.0",
        }),
      "Curriculum created as a draft."
    ).then(() => {
      setName("");
      setCode("");
      setVersion("1.0");
    });
  };

  const courseTitle = (id: string | undefined) =>
    courses.find((c) => c.id === id)?.title ?? id ?? "";

  return (
    <RouteGuard allowedRoles={["ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <div className="space-y-6">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Curricula</h1>
            <p className="mt-1 text-sm text-slate-500">
              Group courses into versioned curricula per programme. Approving a
              draft, then activating it, makes its courses visible to enrolled
              students (one ACTIVE curriculum per programme).
            </p>
          </div>

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

          {/* Create form */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">New curriculum</h2>
            {programs.length === 0 || sessions.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                You need at least one programme and one academic session first —
                create them in Academic structure.
              </p>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-5">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name (e.g. Diploma Curriculum 2026)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
                />
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Code (e.g. DIP-2026)"
                  className="rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                />
                <select
                  value={programId}
                  onChange={(e) => setProgramId(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <select
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <input
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="w-16 rounded-lg border border-slate-300 px-2 py-2 font-mono text-sm"
                    aria-label="Version"
                  />
                </div>
                <button
                  disabled={
                    busy || name.trim().length < 3 || code.trim().length < 2 || !programId || !sessionId
                  }
                  onClick={createCurriculum}
                  className="justify-self-start rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 sm:col-span-5"
                >
                  Create curriculum
                </button>
              </div>
            )}
          </section>

          {/* List */}
          {loading ? (
            <p className="text-sm text-slate-400">Loading curricula…</p>
          ) : curricula.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
              No curricula yet.
            </div>
          ) : (
            <ul className="space-y-3">
              {curricula.map((cur) => (
                <li key={cur.id} className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {cur.name}{" "}
                          <span className="font-mono text-xs text-slate-400">
                            v{cur.version}
                          </span>
                        </p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            STATUS_BADGE[cur.status] ?? "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {cur.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        <span className="font-mono">{cur.code}</span>
                        {cur.program_title ? ` · ${cur.program_title}` : ""}
                        {cur.session_name ? ` · ${cur.session_name}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {cur.status === "DRAFT" && (
                        <button
                          disabled={busy}
                          onClick={() => run(() => curriculaApi.approve(cur.id), "Curriculum approved.")}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Approve
                        </button>
                      )}
                      {cur.status === "APPROVED" && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            run(
                              () => curriculaApi.activate(cur.id),
                              "Curriculum activated — enrolled students now see its published courses."
                            )
                          }
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                        >
                          Activate
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Courses in this curriculum */}
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Courses ({cur.courses.length})
                    </p>
                    {cur.courses.length === 0 ? (
                      <p className="mt-1 text-sm text-slate-500">
                        No courses placed yet.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1">
                        {cur.courses.map((row, i) => (
                          <li key={row.course_id ?? i} className="text-sm text-slate-700">
                            {row.course_code ? `${row.course_code} — ` : ""}
                            {(row.title as string | undefined) ?? courseTitle(row.course_id)}
                            {row.year_level ? ` · Year ${row.year_level}` : ""}
                            {row.is_required === false ? " · elective" : ""}
                          </li>
                        ))}
                      </ul>
                    )}

                    {cur.status === "DRAFT" && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {openId === cur.id ? (
                          <>
                            <select
                              value={addCourseId}
                              onChange={(e) => setAddCourseId(e.target.value)}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                            >
                              <option value="">Select a course…</option>
                              {courses.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.course_code} — {c.title}
                                </option>
                              ))}
                            </select>
                            <input
                              value={yearLevel}
                              onChange={(e) => setYearLevel(e.target.value.replace(/\D/g, ""))}
                              className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                              aria-label="Year level"
                              placeholder="Year"
                            />
                            <button
                              disabled={busy || !addCourseId}
                              onClick={() =>
                                run(
                                  () =>
                                    curriculaApi.addCourse(cur.id, addCourseId, {
                                      year_level: Number(yearLevel) || 1,
                                    }),
                                  "Course added to curriculum."
                                ).then(() => {
                                  setAddCourseId("");
                                  setOpenId(null);
                                })
                              }
                              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                            >
                              Add
                            </button>
                            <button
                              onClick={() => setOpenId(null)}
                              className="text-xs text-slate-500 hover:text-slate-700"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setOpenId(cur.id);
                              setAddCourseId("");
                            }}
                            className="text-xs font-medium text-slate-500 hover:text-slate-900"
                          >
                            + Add course
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </AppShell>
    </RouteGuard>
  );
}
