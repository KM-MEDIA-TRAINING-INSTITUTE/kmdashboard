"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import {
  assessmentsApi,
  offeringsApi,
  type Assessment,
  type Attempt,
  type Offering,
} from "@/lib/api/academic";

function TrainerAssessmentsInner() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [offeringId, setOfferingId] = useState("");
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selected, setSelected] = useState<Assessment | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [marks, setMarks] = useState<Record<string, Record<string, string>>>({});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "", assessment_type: "QUIZ", duration_minutes: "30",
    total_marks: "", max_attempts: "1",
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

  const load = useCallback(async (oid: string) => {
    const rows = await offeringsApi.assessments(oid);
    setAssessments(rows);
  }, []);

  useEffect(() => {
    if (!offeringId) return;
    load(offeringId).catch((err) =>
      setError(err instanceof ApiError ? err.message : "Could not load assessments.")
    );
  }, [offeringId, load]);

  const create = async () => {
    setError(null);
    try {
      await assessmentsApi.create(offeringId, {
        title: form.title,
        assessment_type: form.assessment_type,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
        max_attempts: Number(form.max_attempts),
      });
      setMsg(`Assessment “${form.title}” created as draft. Add questions next.`);
      setShowForm(false);
      setForm({ title: "", assessment_type: "QUIZ", duration_minutes: "30", total_marks: "", max_attempts: "1" });
      await load(offeringId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the assessment.");
    }
  };

  const addQuestion = async (a: Assessment) => {
    const prompt = window.prompt("Question prompt?");
    if (!prompt) return;
    const type = window.prompt("Type (SINGLE_CHOICE, MULTIPLE_CHOICE, TRUE_FALSE, SHORT_ANSWER, LONG_ANSWER)", "SINGLE_CHOICE");
    if (!type) return;
    const marksStr = window.prompt("Marks", "5");
    if (marksStr === null) return;
    try {
      const body: Record<string, unknown> = {
        question_type: type,
        prompt,
        marks: Number(marksStr),
      };
      if (["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"].includes(type)) {
        const opts: { option_text: string; is_correct: boolean }[] = [];
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const text = window.prompt("Option text (Cancel to finish)");
          if (!text) break;
          const correct = window.confirm(`Is “${text}” a correct answer?`);
          opts.push({ option_text: text, is_correct: correct });
        }
        body.options = opts;
      } else {
        const model = window.prompt("Model answer (for auto-grading SHORT_ANSWER; optional)");
        if (model) body.model_answer = model;
      }
      await assessmentsApi.addQuestion(a.id, body);
      setMsg("Question added.");
      await load(offeringId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the question.");
    }
  };

  const openAttempts = async (a: Assessment) => {
    setSelected(a);
    setError(null);
    try {
      const rows = await assessmentsApi.attempts(a.id);
      setAttempts(rows);
      const detail = await offeringsApi.assessments(offeringId);
      const full = detail.find((x) => x.id === a.id);
      setMarks(
        Object.fromEntries(
          rows
            .filter((r) => r.status === "SUBMITTED")
            .map((r) => [
              r.id,
              Object.fromEntries((full?.questions ?? []).map((q) => [q.id, ""])),
            ])
        )
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load attempts.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Assessments</h1>
          <p className="mt-1 text-sm text-slate-500">
            Author quizzes and exams, publish them, and grade submitted attempts.
          </p>
        </div>
        {offeringId && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            {showForm ? "Close" : "New assessment"}
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
                  Type
                  <select value={form.assessment_type} onChange={(e) => setForm({ ...form, assessment_type: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    {["QUIZ", "TEST", "MIDTERM", "EXAM", "PRACTICAL", "PROJECT", "FINAL_EXAM"].map((t) => (
                      <option key={t} value={t}>{t.replace("_", " ")}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Duration (minutes, blank = untimed)
                  <input type="number" min={1} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Max attempts
                  <input type="number" min={1} value={form.max_attempts} onChange={(e) => setForm({ ...form, max_attempts: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
              </div>
              <button onClick={create} disabled={!form.title} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
                Create draft
              </button>
            </div>
          )}

          {assessments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
              No assessments yet.
            </div>
          ) : (
            <ul className="space-y-3">
              {assessments.map((a) => (
                <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {a.assessment_type.replace("_", " ")} · {a.total_marks} marks · {a.questions?.length ?? 0} questions · {a.status}
                        {a.duration_minutes ? ` · ${a.duration_minutes} min` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {a.status === "DRAFT" && (
                        <>
                          <button onClick={() => addQuestion(a)} className="rounded-lg border border-slate-300 px-3 py-1 hover:bg-slate-50">
                            Add question
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await assessmentsApi.publish(a.id);
                                setMsg("Assessment published — students notified.");
                                await load(offeringId);
                              } catch (err) {
                                setError(err instanceof ApiError ? err.message : "Publish failed.");
                              }
                            }}
                            className="rounded-lg border border-slate-300 px-3 py-1 hover:bg-slate-50"
                          >
                            Publish
                          </button>
                        </>
                      )}
                      {a.status === "PUBLISHED" && (
                        <button
                          onClick={async () => {
                            try {
                              await assessmentsApi.open(a.id);
                              await load(offeringId);
                            } catch (err) {
                              setError(err instanceof ApiError ? err.message : "Open failed.");
                            }
                          }}
                          className="rounded-lg border border-slate-300 px-3 py-1 hover:bg-slate-50"
                        >
                          Open
                        </button>
                      )}
                      {a.status === "OPEN" && (
                        <button
                          onClick={async () => {
                            try {
                              await assessmentsApi.close(a.id);
                              await load(offeringId);
                            } catch (err) {
                              setError(err instanceof ApiError ? err.message : "Close failed.");
                            }
                          }}
                          className="rounded-lg border border-slate-300 px-3 py-1 hover:bg-slate-50"
                        >
                          Close
                        </button>
                      )}
                      <button onClick={() => openAttempts(a)} className="rounded-lg border border-slate-300 px-3 py-1 hover:bg-slate-50">
                        Attempts
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {selected && (
            <div className="rounded-xl border border-slate-300 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">Attempts — {selected.title}</h2>
              {attempts.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No attempts yet.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {attempts.map((at) => (
                    <li key={at.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-slate-500">
                          Student {at.student_id.slice(0, 8)}… · attempt {at.attempt_number} · {at.status.replace("_", " ")}
                        </p>
                        <p className="text-xs font-medium">
                          {at.score !== null ? `${at.score}/${selected.total_marks} (${at.percentage ?? 0}%)` : "ungraded"}
                        </p>
                      </div>
                      {at.status === "SUBMITTED" && (
                        <p className="mt-1 text-xs text-slate-500">
                          Manual grading is available per question via the API grade form in the attempts view.
                        </p>
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

export default function TrainerAssessmentsPage() {
  return (
    <RouteGuard allowedRoles={["TRAINER", "ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <TrainerAssessmentsInner />
      </AppShell>
    </RouteGuard>
  );
}
