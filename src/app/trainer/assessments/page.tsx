"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { QuestionComposer } from "@/components/question-composer";
import { QuestionOutline } from "@/components/question-outline";
import { ConfirmationDialog, StatusBadge } from "@/components/dashboard/ui";
import { ApiError } from "@/lib/api/client";
import {
  assessmentsApi,
  offeringsApi,
  type Assessment,
  type AssessmentQuestionDto,
  type Attempt,
  type AttemptReview,
  type Offering,
  type QuestionInput,
} from "@/lib/api/academic";

/** Ordered question ids for a reorder request after moving one row. */
function reorderedIds(questions: AssessmentQuestionDto[], index: number, dir: -1 | 1): string[] {
  const sorted = [...questions].sort((a, b) => a.order_index - b.order_index);
  const target = index + dir;
  if (target < 0 || target >= sorted.length) return [];
  const ids = sorted.map((q) => q.id);
  [ids[index], ids[target]] = [ids[target], ids[index]];
  return ids;
}

function questionPayload(q: AssessmentQuestionDto): QuestionInput {
  const isChoice = ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"].includes(q.question_type);
  return {
    question_type: q.question_type as QuestionInput["question_type"],
    prompt: q.prompt,
    marks: q.marks,
    help_text: q.help_text ?? null,
    is_required: q.is_required,
    options: isChoice
      ? [...(q.options ?? [])]
          .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
          .map((o) => ({ option_text: o.option_text, is_correct: Boolean(o.is_correct) }))
      : null,
    model_answer: isChoice ? null : q.model_answer ?? null,
  };
}

function TrainerAssessmentsInner() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [offeringId, setOfferingId] = useState("");
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [paper, setPaper] = useState<Assessment | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [reviews, setReviews] = useState<Record<string, AttemptReview>>({});
  const [gradeInputs, setGradeInputs] = useState<Record<string, Record<string, string>>>({});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "", assessment_type: "QUIZ", duration_minutes: "30", max_attempts: "1",
  });
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<AssessmentQuestionDto | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AssessmentQuestionDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await offeringsApi.mine();
        if (!cancelled && rows.length > 0) {
          setOfferings(rows);
          setOfferingId(rows[0].id);
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
    return rows;
  }, []);

  useEffect(() => {
    if (!offeringId) return;
    load(offeringId).catch((err) =>
      setError(err instanceof ApiError ? err.message : "Could not load assessments.")
    );
  }, [offeringId, load]);

  const fail = (err: unknown, fallback: string) =>
    setError(err instanceof ApiError ? err.message : fallback);

  /* ------------------------------------------------------------ authoring */

  const openPaper = async (a: Assessment) => {
    setError(null);
    setMsg(null);
    setReviews({});
    setGradeInputs({});
    try {
      const full = await assessmentsApi.get(a.id);
      setPaper(full);
      if (full.status !== "DRAFT") setAttempts(await assessmentsApi.attempts(a.id));
      else setAttempts([]);
    } catch (err) {
      fail(err, "Could not open the assessment.");
    }
  };

  const closePaper = () => {
    setPaper(null);
    setAttempts([]);
    setReviews({});
  };

  const afterMutation = async (updated: Assessment) => {
    setPaper(updated);
    await load(offeringId);
  };

  const saveQuestion = async (updated: Assessment, keepOpen: boolean) => {
    await afterMutation(updated);
    setEditing(null);
    if (!keepOpen) setComposerOpen(false);
    setMsg(
      updated.questions?.length
        ? `Question paper now has ${updated.questions.length} question(s) · ${updated.total_marks} marks.`
        : "Saved."
    );
  };

  const duplicateQuestion = async (q: AssessmentQuestionDto) => {
    if (!paper) return;
    setBusy(true);
    setError(null);
    try {
      await assessmentsApi.addQuestion(paper.id, questionPayload(q));
      const fresh = await assessmentsApi.get(paper.id);
      await afterMutation(fresh);
      setMsg("Question duplicated at the end of the paper.");
    } catch (err) {
      fail(err, "Could not duplicate the question.");
    } finally {
      setBusy(false);
    }
  };

  const deleteQuestion = async (q: AssessmentQuestionDto) => {
    if (!paper) return;
    setBusy(true);
    setError(null);
    try {
      const fresh = await assessmentsApi.deleteQuestion(paper.id, q.id);
      await afterMutation(fresh);
      setMsg("Question removed and the paper renumbered.");
    } catch (err) {
      fail(err, "Could not delete the question.");
    } finally {
      setBusy(false);
      setPendingDelete(null);
    }
  };

  const moveQuestion = async (index: number, dir: -1 | 1) => {
    if (!paper) return;
    const questions = [...(paper.questions ?? [])].sort((a, b) => a.order_index - b.order_index);
    const ids = reorderedIds(questions, index, dir);
    if (ids.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const fresh = await assessmentsApi.reorderQuestions(paper.id, ids);
      setPaper(fresh);
    } catch (err) {
      fail(err, "Could not reorder the questions.");
    } finally {
      setBusy(false);
    }
  };

  const transition = async (action: "publish" | "open" | "close") => {
    if (!paper) return;
    setBusy(true);
    setError(null);
    try {
      await assessmentsApi[action](paper.id);
      const fresh = await assessmentsApi.get(paper.id);
      setPaper(fresh);
      await load(offeringId);
      if (action === "publish") {
        setAttempts(await assessmentsApi.attempts(paper.id).catch(() => []));
        setMsg("Published — students were notified and can now start attempts.");
      } else {
        setMsg(action === "open" ? "Assessment is open for sittings." : "Assessment closed.");
      }
    } catch (err) {
      fail(err, action === "publish" ? "Publish failed." : "State change failed.");
    } finally {
      setBusy(false);
    }
    setBusy(false);
  };

  const create = async () => {
    setError(null);
    try {
      const created = await assessmentsApi.create(offeringId, {
        title: form.title,
        assessment_type: form.assessment_type,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
        max_attempts: Number(form.max_attempts),
      });
      setShowForm(false);
      setForm({ title: "", assessment_type: "QUIZ", duration_minutes: "30", max_attempts: "1" });
      await load(offeringId);
      setPaper(created);
      setAttempts([]);
      setComposerOpen(true);
      setMsg(`Draft “${created.title}” created. Add your first question.`);
    } catch (err) {
      fail(err, "Could not create the assessment.");
    }
  };

  /* ------------------------------------------------------------ grading */

  const openReview = async (attemptId: string) => {
    setError(null);
    try {
      const review = await assessmentsApi.attemptReview(attemptId);
      setReviews((prev) => ({ ...prev, [attemptId]: review }));
      setGradeInputs((prev) => ({
        ...prev,
        [attemptId]: Object.fromEntries(
          review.answers.map((ans) => [
            ans.question_id,
            ans.marks_awarded !== null ? String(ans.marks_awarded) : "",
          ])
        ),
      }));
    } catch (err) {
      fail(err, "Could not load the attempt answers.");
    }
  };

  const submitGrade = async (attemptId: string) => {
    const review = reviews[attemptId];
    if (!review || !paper) return;
    setError(null);
    const inputs = gradeInputs[attemptId] ?? {};
    const question_marks: Record<string, number> = {};
    for (const ans of review.answers) {
      const raw = inputs[ans.question_id];
      if (raw === "" || raw === undefined) continue;
      const v = Number(raw);
      if (!Number.isFinite(v) || v < 0 || v > (ans.question_marks ?? 0)) {
        setError(`Marks must be between 0 and ${ans.question_marks ?? 0}.`);
        return;
      }
      question_marks[ans.question_id] = v;
    }
    if (Object.keys(question_marks).length === 0) {
      setError("Enter marks for at least one manually graded question.");
      return;
    }
    try {
      const updated = await assessmentsApi.gradeAttempt(attemptId, question_marks);
      setAttempts((prev) => prev.map((r) => (r.id === attemptId ? updated : r)));
      setReviews((prev) => ({ ...prev, [attemptId]: { ...review, ...updated } }));
      setMsg("Attempt graded.");
    } catch (err) {
      fail(err, "Grading failed.");
    }
  };

  /* ------------------------------------------------------------- render */

  const sortedQuestions = [...(paper?.questions ?? [])].sort((a, b) => a.order_index - b.order_index);

  if (paper) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <button onClick={closePaper} className="text-xs font-medium text-slate-500 hover:text-slate-800">
              ← All assessments
            </button>
            <h1 className="mt-1 text-lg font-semibold text-slate-900">{paper.title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <StatusBadge status={paper.status} />
              <span>{paper.assessment_type.replace("_", " ")}</span>
              <span>·</span>
              <span>{paper.total_marks} marks</span>
              {paper.duration_minutes ? (
                <>
                  <span>·</span>
                  <span>{paper.duration_minutes} min</span>
                </>
              ) : null}
              <span>·</span>
              <span>{paper.max_attempts} attempt{paper.max_attempts > 1 ? "s" : ""}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {paper.status === "DRAFT" && (
              <>
                <button
                  onClick={() => { setEditing(null); setComposerOpen(true); }}
                  disabled={busy}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Add question
                </button>
                <button
                  onClick={() => transition("publish")}
                  disabled={busy || sortedQuestions.length === 0}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  Publish
                </button>
              </>
            )}
            {paper.status === "PUBLISHED" && (
              <button onClick={() => transition("open")} disabled={busy}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
                Open for attempts
              </button>
            )}
            {paper.status === "OPEN" && (
              <button onClick={() => transition("close")} disabled={busy}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                Close
              </button>
            )}
          </div>
        </div>

        {msg && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{msg}</div>
        )}
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {paper.status === "DRAFT" && sortedQuestions.length === 0 && !msg && (
          <p className="text-sm text-slate-500">
            Nothing is visible to students until you publish, so experiment freely — every change here is reversible.
          </p>
        )}

        <QuestionOutline
          assessment={paper}
          busy={busy}
          onAdd={() => { setEditing(null); setComposerOpen(true); }}
          onEdit={(q) => { setEditing(q); setComposerOpen(true); }}
          onDuplicate={duplicateQuestion}
          onDelete={(q) => setPendingDelete(q)}
          onMove={moveQuestion}
        />

        {paper.status !== "DRAFT" && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">Attempts &amp; grading</h2>
            {attempts.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No attempts yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {attempts.map((at) => {
                  const review = reviews[at.id];
                  const inputs = gradeInputs[at.id] ?? {};
                  return (
                    <li key={at.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-slate-500">
                          Student {at.student_id.slice(0, 8)}… · attempt {at.attempt_number} · {at.status.replace("_", " ")}
                        </p>
                        <div className="flex items-center gap-3">
                          <p className="text-xs font-medium">
                            {at.score !== null ? `${at.score}/${paper.total_marks} (${at.percentage ?? 0}%)` : "ungraded"}
                          </p>
                          {(at.status === "SUBMITTED" || at.status === "AUTO_GRADED") && (
                            <button
                              onClick={() => openReview(at.id)}
                              className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700"
                            >
                              {review ? "Refresh answers" : "View answers & grade"}
                            </button>
                          )}
                        </div>
                      </div>
                      {review && (
                        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                          {review.answers.map((ans) => {
                            const manual =
                              ans.question_type === "LONG_ANSWER" ||
                              ans.question_type === "FILE_UPLOAD" ||
                              (ans.question_type === "SHORT_ANSWER" && ans.is_correct === null);
                            return (
                              <div key={ans.question_id} className="text-xs">
                                <p className="font-medium text-slate-800">
                                  {ans.prompt ?? "Question"} ({ans.question_marks ?? 0} marks)
                                </p>
                                <p className="mt-1 whitespace-pre-wrap text-slate-600">
                                  {ans.answer_text ??
                                    (ans.selected_option_texts ?? []).filter(Boolean).join(", ") ??
                                    (ans.selected_option_ids.length
                                      ? ans.selected_option_ids.join(", ")
                                      : "— no answer recorded —")}
                                </p>
                                {!manual && (
                                  <p className="mt-1 text-slate-500">
                                    Auto-graded: {ans.marks_awarded ?? 0}/{ans.question_marks ?? 0}
                                  </p>
                                )}
                                {manual && (
                                  <label className="mt-1 flex items-center gap-2 text-slate-600">
                                    Marks (0–{ans.question_marks ?? 0})
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.25"
                                      max={ans.question_marks ?? 0}
                                      value={inputs[ans.question_id] ?? ""}
                                      onChange={(e) =>
                                        setGradeInputs((prev) => ({
                                          ...prev,
                                          [at.id]: { ...inputs, [ans.question_id]: e.target.value },
                                        }))
                                      }
                                      className="w-20 rounded-lg border border-slate-300 px-2 py-1"
                                    />
                                  </label>
                                )}
                              </div>
                            );
                          })}
                          <button
                            onClick={() => submitGrade(at.id)}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
                          >
                            Submit grade
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <QuestionComposer
          open={composerOpen}
          assessmentId={paper.id}
          questionNumber={editing ? sortedQuestions.findIndex((q) => q.id === editing.id) + 1 : sortedQuestions.length + 1}
          editing={editing}
          currentTotalMarks={paper.total_marks}
          onClose={() => { setComposerOpen(false); setEditing(null); }}
          onSaved={saveQuestion}
        />

        <ConfirmationDialog
          open={pendingDelete !== null}
          title="Delete this question?"
          detail={
            pendingDelete
              ? `“${pendingDelete.prompt.slice(0, 80)}${pendingDelete.prompt.length > 80 ? "…" : ""}” will be removed and the remaining questions renumbered. This cannot be undone.`
              : undefined
          }
          confirmLabel="Delete question"
          danger
          onConfirm={() => pendingDelete && deleteQuestion(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      </div>
    );
  }

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
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          <div>
            <label htmlFor="offering" className="block text-xs font-medium text-slate-600">Offering</label>
            <select
              id="offering"
              value={offeringId}
              onChange={(e) => {
                setOfferingId(e.target.value);
                setPaper(null);
              }}
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {offerings.map((o) => (
                <option key={o.id} value={o.id}>{o.code}</option>
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
              No assessments yet for this offering.
            </div>
          ) : (
            <ul className="space-y-3">
              {assessments.map((a) => (
                <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300">
                  <button onClick={() => openPaper(a)} className="w-full text-left">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {a.assessment_type.replace("_", " ")} · {a.total_marks} marks · {a.questions?.length ?? 0} questions ·{" "}
                          {a.duration_minutes ? `${a.duration_minutes} min · ` : ""}
                          {a.max_attempts} attempt{a.max_attempts > 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={a.status} />
                        <span className="text-xs font-medium text-slate-500">Open →</span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
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
