"use client";

import type { Assessment, AssessmentQuestionDto } from "@/lib/api/academic";

const TYPE_LABEL: Record<string, string> = {
  SINGLE_CHOICE: "Single choice",
  MULTIPLE_CHOICE: "Multiple choice",
  TRUE_FALSE: "True / False",
  SHORT_ANSWER: "Short answer",
  LONG_ANSWER: "Long answer",
  FILE_UPLOAD: "File upload",
};

const AUTO_TYPES = new Set(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"]);

function keySummary(q: AssessmentQuestionDto): string {
  const options = q.options ?? [];
  if (options.length > 0) {
    const keys = options.filter((o) => o.is_correct).length;
    return `${keys} of ${options.length} marked correct`;
  }
  if (q.question_type === "SHORT_ANSWER") {
    return q.model_answer ? `auto-match: “${q.model_answer}”` : "you grade it";
  }
  if (q.question_type === "LONG_ANSWER" || q.question_type === "FILE_UPLOAD") {
    return q.model_answer ? "marking guide saved · you grade" : "you grade";
  }
  return "you grade";
}

function Chevron({ dir }: { dir: "up" | "down" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-3.5 w-3.5">
      <path d={dir === "up" ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
    </svg>
  );
}

export function QuestionOutline({
  assessment,
  busy = false,
  onAdd,
  onEdit,
  onDuplicate,
  onDelete,
  onMove,
}: {
  assessment: Assessment;
  busy?: boolean;
  onAdd: () => void;
  onEdit: (q: AssessmentQuestionDto, index: number) => void;
  onDuplicate: (q: AssessmentQuestionDto) => void;
  onDelete: (q: AssessmentQuestionDto, index: number) => void;
  onMove: (index: number, dir: -1 | 1) => void;
}) {
  const questions = [...(assessment.questions ?? [])].sort((a, b) => a.order_index - b.order_index);
  const totalMarks = questions.reduce((sum, q) => sum + (q.marks ?? 0), 0);
  const autoCount = questions.filter(
    (q) => AUTO_TYPES.has(q.question_type) || (q.question_type === "SHORT_ANSWER" && Boolean(q.model_answer))
  ).length;
  const missingKeys = questions.filter((q) => {
    const opts = q.options ?? [];
    if (opts.length > 0) return !opts.some((o) => o.is_correct);
    return false;
  }).length;

  const ready = questions.length > 0 && missingKeys === 0 && totalMarks > 0;

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Question paper</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {questions.length} {questions.length === 1 ? "question" : "questions"} · {totalMarks} marks ·{" "}
            {autoCount} auto-graded · {questions.length - autoCount} marked by you
          </p>
        </div>
        <button
          onClick={onAdd}
          disabled={busy}
          className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          + Add question
        </button>
      </header>

      {questions.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">No questions yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
            Build the paper one question at a time. Choose a type, write the question, mark the correct answer —
            you can edit or reorder anything until you publish.
          </p>
          <button
            onClick={onAdd}
            disabled={busy}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Write the first question
          </button>
        </div>
      ) : (
        <ol className="divide-y divide-slate-100">
          {questions.map((q, i) => (
            <li key={q.id} className="group px-5 py-3.5 transition hover:bg-slate-50/70">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900" title={q.prompt}>{q.prompt}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                      {TYPE_LABEL[q.question_type] ?? q.question_type}
                    </span>
                    <span className={
                      AUTO_TYPES.has(q.question_type) || (q.question_type === "SHORT_ANSWER" && q.model_answer)
                        ? "rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700"
                        : "rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800"
                    }>
                      {(AUTO_TYPES.has(q.question_type) || (q.question_type === "SHORT_ANSWER" && q.model_answer))
                        ? "Auto" : "Manual"}
                    </span>
                    <span>{keySummary(q)}</span>
                    {!q.is_required && <span className="text-slate-400">optional</span>}
                  </div>
                  {q.help_text && <p className="mt-1 text-[11px] text-slate-400">Guidance: {q.help_text}</p>}
                </div>
                <span className="shrink-0 text-xs font-medium text-slate-600">
                  {q.marks} {q.marks === 1 ? "mark" : "marks"}
                </span>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                  <button onClick={() => onMove(i, -1)} disabled={busy || i === 0} aria-label="Move up"
                          className="rounded p-1.5 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30">
                    <Chevron dir="up" />
                  </button>
                  <button onClick={() => onMove(i, 1)} disabled={busy || i === questions.length - 1} aria-label="Move down"
                          className="rounded p-1.5 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30">
                    <Chevron dir="down" />
                  </button>
                  <button onClick={() => onEdit(q, i)} disabled={busy}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white hover:text-slate-900">
                    Edit
                  </button>
                  <button onClick={() => onDuplicate(q)} disabled={busy}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white hover:text-slate-900">
                    Duplicate
                  </button>
                  <button onClick={() => onDelete(q, i)} disabled={busy}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3.5">
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <li className={questions.length > 0 ? "text-emerald-700" : "text-slate-400"}>
            {questions.length > 0 ? "✓" : "○"} Has questions
          </li>
          <li className={missingKeys === 0 && questions.length > 0 ? "text-emerald-700" : "text-red-600"}>
            {missingKeys === 0 ? "✓" : "!"} {missingKeys === 0 ? "Every choice has a key" : `${missingKeys} choice question(s) missing a correct answer`}
          </li>
          <li className={totalMarks > 0 ? "text-emerald-700" : "text-slate-400"}>
            {totalMarks > 0 ? "✓" : "○"} Total marks {totalMarks}
          </li>
        </ul>
        <p className="text-[11px] text-slate-400">
          {ready
            ? "Ready to publish — students will see this order."
            : "Finish the checklist before publishing."}
        </p>
      </footer>
    </section>
  );
}
