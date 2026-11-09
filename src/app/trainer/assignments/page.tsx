"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import {
  assignmentsApi,
  offeringsApi,
  fileUrl,
  type Assignment,
  type Offering,
  type Submission,
} from "@/lib/api/academic";

function TrainerAssignmentsInner() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [offeringId, setOfferingId] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [grades, setGrades] = useState<Record<string, { score: string; feedback: string }>>({});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "", total_marks: "20", due_at: "", instructions: "",
    allow_late_submission: false, max_attempts: "1",
  });
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await offeringsApi.mine();
        if (!cancelled) {
          setOfferings(rows);
          if (rows.length > 0) setOfferingId(rows[0].id);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadAssignments = useCallback(async (oid: string) => {
    const rows = await offeringsApi.assignments(oid);
    setAssignments(rows);
  }, []);

  useEffect(() => {
    if (!offeringId) return;
    loadAssignments(offeringId).catch((err) =>
      setError(err instanceof ApiError ? err.message : "Could not load assignments.")
    );
  }, [offeringId, loadAssignments]);

  const openSubmissions = async (a: Assignment) => {
    setSelected(a);
    setError(null);
    try {
      const rows = await assignmentsApi.submissions(a.id);
      setSubmissions(rows);
      setGrades(
        Object.fromEntries(
          rows.filter((s) => s.status !== "GRADED").map((s) => [s.id, { score: "", feedback: "" }])
        )
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load submissions.");
    }
  };

  const create = async () => {
    setError(null);
    try {
      await assignmentsApi.create(offeringId, {
        title: form.title,
        total_marks: Number(form.total_marks),
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        instructions: form.instructions,
        allow_late_submission: form.allow_late_submission,
        max_attempts: Number(form.max_attempts),
      });
      setMsg(`Assignment “${form.title}” created as draft.`);
      setShowForm(false);
      setForm({ title: "", total_marks: "20", due_at: "", instructions: "", allow_late_submission: false, max_attempts: "1" });
      await loadAssignments(offeringId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the assignment.");
    }
  };

  const gradeOne = async (s: Submission) => {
    const entry = grades[s.id];
    if (!entry || entry.score === "") return;
    try {
      await assignmentsApi.grade(s.id, Number(entry.score), entry.feedback || undefined);
      setMsg("Grade saved.");
      await openSubmissions(selected!);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Grading failed.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Assignments</h1>
          <p className="mt-1 text-sm text-slate-500">Create, publish and grade coursework for your offerings.</p>
        </div>
        {offeringId && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            {showForm ? "Close" : "New assignment"}
          </button>
        )}
      </div>

      {msg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{msg}</div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          <div>
            <label htmlFor="offering" className="block text-xs font-medium text-slate-600">
              Offering
            </label>
            <select
              id="offering"
              value={offeringId}
              onChange={(e) => {
                setOfferingId(e.target.value);
                setSelected(null);
              }}
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {offerings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.code}
                </option>
              ))}
            </select>
          </div>

          {showForm && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-600">
                  Title
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Total marks
                  <input type="number" min={1} value={form.total_marks} onChange={(e) => setForm({ ...form, total_marks: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Due (local time)
                  <input type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Max attempts
                  <input type="number" min={1} value={form.max_attempts} onChange={(e) => setForm({ ...form, max_attempts: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-medium text-slate-600 sm:col-span-2">
                  Instructions
                  <textarea rows={3} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={form.allow_late_submission} onChange={(e) => setForm({ ...form, allow_late_submission: e.target.checked })} />
                  Allow late submissions (penalty applies)
                </label>
              </div>
              <button
                onClick={create}
                disabled={!form.title}
                className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                Create draft
              </button>
            </div>
          )}

          {assignments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
              No assignments yet.
            </div>
          ) : (
            <ul className="space-y-3">
              {assignments.map((a) => (
                <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {a.total_marks} marks · {a.status} · due {a.due_at ? new Date(a.due_at).toLocaleString() : "—"}
                      </p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      {a.status === "DRAFT" && (
                        <button
                          onClick={async () => {
                            try {
                              await assignmentsApi.publish(a.id);
                              setMsg("Assignment published — students notified.");
                              await loadAssignments(offeringId);
                            } catch (err) {
                              setError(err instanceof ApiError ? err.message : "Publish failed.");
                            }
                          }}
                          className="rounded-lg border border-slate-300 px-3 py-1 hover:bg-slate-50"
                        >
                          Publish
                        </button>
                      )}
                      {a.status === "PUBLISHED" && (
                        <button
                          onClick={async () => {
                            try {
                              await assignmentsApi.close(a.id);
                              await loadAssignments(offeringId);
                            } catch (err) {
                              setError(err instanceof ApiError ? err.message : "Close failed.");
                            }
                          }}
                          className="rounded-lg border border-slate-300 px-3 py-1 hover:bg-slate-50"
                        >
                          Close
                        </button>
                      )}
                      <button onClick={() => openSubmissions(a)} className="rounded-lg border border-slate-300 px-3 py-1 hover:bg-slate-50">
                        Submissions
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {selected && (
            <div className="rounded-xl border border-slate-300 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">Submissions — {selected.title}</h2>
              {submissions.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No submissions yet.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {submissions.map((s) => (
                    <li key={s.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-slate-500">
                          Student {s.student_id.slice(0, 8)}… · attempt {s.attempt_number} · {s.status}
                          {s.is_late ? " · LATE" : ""}
                        </p>
                        {s.final_score !== null && (
                          <p className="text-xs font-medium text-emerald-700">
                            {s.final_score}/{selected.total_marks}
                            {s.penalty_marks > 0 ? ` (−${s.penalty_marks} penalty)` : ""}
                          </p>
                        )}
                      </div>
                      {s.content && <p className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-2 text-sm">{s.content}</p>}
                      {s.storage_key && (
                        <p className="mt-1 text-xs text-slate-600">
                          Attachment:{" "}
                          <a href={fileUrl(s.storage_key)} target="_blank" rel="noreferrer" className="text-sky-700 underline">
                            {s.original_filename ?? "download"}
                          </a>
                        </p>
                      )}
                      {s.status !== "GRADED" && (
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <input
                            type="number"
                            min={0}
                            step="0.25"
                            max={selected.total_marks}
                            placeholder={`Score /${selected.total_marks}`}
                            value={grades[s.id]?.score ?? ""}
                            onChange={(e) => setGrades((p) => ({ ...p, [s.id]: { ...p[s.id], score: e.target.value } }))}
                            className="w-32 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                            aria-label="Score"
                          />
                          <input
                            placeholder="Feedback"
                            value={grades[s.id]?.feedback ?? ""}
                            onChange={(e) => setGrades((p) => ({ ...p, [s.id]: { ...p[s.id], feedback: e.target.value } }))}
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                            aria-label="Feedback"
                          />
                          <button
                            onClick={() => gradeOne(s)}
                            disabled={grades[s.id]?.score === ""}
                            className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                          >
                            Save grade
                          </button>
                        </div>
                      )}
                      {s.status === "GRADED" && s.feedback && (
                        <p className="mt-1 text-xs text-slate-500">Feedback: {s.feedback}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function TrainerAssignmentsPage() {
  return (
    <RouteGuard allowedRoles={["TRAINER", "ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <TrainerAssignmentsInner />
      </AppShell>
    </RouteGuard>
  );
}
