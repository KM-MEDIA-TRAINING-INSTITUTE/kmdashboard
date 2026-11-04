"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import {
  studentApi,
  type Assessment,
  type Attempt,
  type StudentOffering,
} from "@/lib/api/academic";

const STATUS_META: Record<string, string> = {
  IN_PROGRESS: "bg-emerald-50 text-emerald-700",
  SUBMITTED: "bg-sky-50 text-sky-700",
  AUTO_GRADED: "bg-emerald-50 text-emerald-700",
  MANUALLY_GRADED: "bg-emerald-50 text-emerald-700",
  EXPIRED: "bg-red-50 text-red-700",
  VOIDED: "bg-slate-100 text-slate-500",
};

function countdown(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface ActiveAttempt {
  assessmentId: string;
  attempt: Attempt;
  questions: NonNullable<Assessment["questions"]>;
}

function AssessmentsInner() {
  const [offerings, setOfferings] = useState<StudentOffering[]>([]);
  const [offeringId, setOfferingId] = useState("");
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [active, setActive] = useState<ActiveAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Student-scoped offerings (staff detail endpoint is 403 by design).
        const offs = await studentApi.offerings().catch(() => []);
        if (cancelled) return;
        setOfferings(offs);
        if (offs.length > 0) setOfferingId(offs[0].id);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadList = useCallback(async (oid: string) => {
    const rows = await studentApi.assessments(oid);
    setAssessments(rows);
  }, []);

  useEffect(() => {
    if (!offeringId) return;
    setItemsLoading(true);
    loadList(offeringId)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load assessments."))
      .finally(() => setItemsLoading(false));
  }, [offeringId, loadList]);

  useEffect(() => {
    if (!active) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [active]);
  void tick;

  const start = async (a: Assessment) => {
    setError(null);
    try {
      const attempt = await studentApi.startAttempt(a.id);
      const full = await studentApi.assessment(a.id);
      setActive({ assessmentId: a.id, attempt, questions: full.questions ?? [] });
      setAnswers({});
      setTextAnswers({});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start the attempt.");
    }
  };

  const save = async (questionId: string, optionId?: string) => {
    if (!active) return;
    const selected = optionId
      ? [...(answers[questionId] ?? []), optionId]
      : undefined;
    if (optionId) setAnswers((prev) => ({ ...prev, [questionId]: selected! }));
    try {
      await studentApi.saveAnswer(active.attempt.id, {
        question_id: questionId,
        selected_option_ids: selected,
        answer_text: optionId ? undefined : (textAnswers[questionId] ?? ""),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the answer.");
    }
  };

  const submit = async () => {
    if (!active) return;
    try {
      const done = await studentApi.submitAttempt(active.attempt.id);
      setMsg(
        done.status === "AUTO_GRADED"
          ? `Submitted — auto-graded ${done.score ?? 0} pts (${done.percentage ?? 0}%).`
          : `Attempt ${done.status.toLowerCase()}.`
      );
      setActive(null);
      await loadList(offeringId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Submission failed.");
    }
  };

  const remaining = active ? countdown(active.attempt.expires_at) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Assessments</h1>
        <p className="mt-1 text-sm text-slate-500">
          Quizzes, tests and exams. The timer is server-side — refresh-safe.
        </p>
      </div>

      {msg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{msg}</div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {active ? (
        <div className="rounded-xl border border-slate-300 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">
              Attempt {active.attempt.attempt_number}
            </p>
            <p
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                remaining === "expired" ? "bg-red-50 text-red-700" : "bg-slate-900 text-white"
              }`}
              role="timer"
              aria-live="off"
            >
              {remaining === "expired" ? "Time expired — submit now" : `⏱ ${remaining}`}
            </p>
          </div>
          <ol className="mt-4 space-y-5">
            {active.questions.map((q, idx) => (
              <li key={q.id}>
                <p className="text-sm font-medium text-slate-900">
                  {idx + 1}. {q.prompt} <span className="text-xs text-slate-400">({q.marks} marks)</span>
                </p>
                {q.options && q.options.length > 0 ? (
                  <fieldset className="mt-2 space-y-1">
                    <legend className="sr-only">Answer for question {idx + 1}</legend>
                    {q.options.map((o) => (
                      <label key={o.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          checked={(answers[q.id] ?? []).includes(o.id)}
                          onChange={() => {
                            setAnswers((prev) => ({ ...prev, [q.id]: [o.id] }));
                            studentApi
                              .saveAnswer(active.attempt.id, { question_id: q.id, selected_option_ids: [o.id] })
                              .catch(() => undefined);
                          }}
                        />
                        {o.option_text}
                      </label>
                    ))}
                  </fieldset>
                ) : (
                  <textarea
                    rows={3}
                    aria-label={`Answer for question ${idx + 1}`}
                    value={textAnswers[q.id] ?? ""}
                    onChange={(e) => setTextAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    onBlur={() => save(q.id)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                )}
              </li>
            ))}
          </ol>
          <button
            onClick={submit}
            className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Submit attempt
          </button>
        </div>
      ) : (
        <>
          {offerings.length > 1 && (
            <div>
              <label htmlFor="offering" className="block text-xs font-medium text-slate-600">
                Course offering
              </label>
              <select
                id="offering"
                value={offeringId}
                onChange={(e) => setOfferingId(e.target.value)}
                className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {offerings.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.code}
                  </option>
                ))}
              </select>
            </div>
          )}
          {itemsLoading ? (
            <p className="text-sm text-slate-400">Loading assessments…</p>
          ) : assessments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
              No assessments published for this offering.
            </div>
          ) : (
            <ul className="space-y-3">
              {assessments.map((a) => {
                const last = a.my_attempts?.[a.my_attempts.length - 1];
                const attemptsLeft = a.max_attempts - (a.my_attempts?.length ?? 0);
                return (
                  <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {a.assessment_type.replace("_", " ")} · {a.total_marks} marks
                          {a.duration_minutes ? ` · ${a.duration_minutes} min` : ""}
                        </p>
                      </div>
                      {last && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_META[last.status] ?? "bg-slate-100 text-slate-700"}`}>
                          {last.status.replace("_", " ")}
                          {last.percentage !== null && last.percentage !== undefined ? ` · ${last.percentage}%` : ""}
                        </span>
                      )}
                    </div>
                    {attemptsLeft > 0 && a.status !== "CLOSED" && !active && (
                      <button
                        onClick={() => start(a)}
                        className="mt-3 rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
                      >
                        {a.my_attempts?.length ? "New attempt" : "Start"}
                      </button>
                    )}
                    {attemptsLeft === 0 && (
                      <p className="mt-2 text-xs text-slate-500">Maximum attempts reached.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export default function StudentAssessmentsPage() {
  return (
    <RouteGuard allowedRoles={["STUDENT", "TRAINER", "ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <AssessmentsInner />
      </AppShell>
    </RouteGuard>
  );
}
