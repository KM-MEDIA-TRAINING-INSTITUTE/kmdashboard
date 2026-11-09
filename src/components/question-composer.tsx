"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import {
  assessmentsApi,
  type Assessment,
  type AssessmentQuestionDto,
  type QuestionInput,
  type QuestionType,
} from "@/lib/api/academic";

/* ------------------------------------------------------------------ model */

type OptionRow = { key: string; option_text: string; is_correct: boolean };

const TYPE_META: Record<
  QuestionType,
  { label: string; blurb: string; grading: "Auto" | "Manual"; kind: "choice" | "text" | "file" }
> = {
  SINGLE_CHOICE: { label: "Single choice", blurb: "One correct option", grading: "Auto", kind: "choice" },
  MULTIPLE_CHOICE: { label: "Multiple choice", blurb: "Several correct options", grading: "Auto", kind: "choice" },
  TRUE_FALSE: { label: "True / False", blurb: "Fixed statement, one key", grading: "Auto", kind: "choice" },
  SHORT_ANSWER: { label: "Short answer", blurb: "Exact-phrase match or manual", grading: "Auto", kind: "text" },
  LONG_ANSWER: { label: "Long answer", blurb: "Essay, graded by you", grading: "Manual", kind: "text" },
  FILE_UPLOAD: { label: "File upload", blurb: "Student attaches a document", grading: "Manual", kind: "file" },
};

const TYPE_ORDER: QuestionType[] = [
  "SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "LONG_ANSWER", "FILE_UPLOAD",
];

const blankOptions = (type: QuestionType): OptionRow[] =>
  type === "TRUE_FALSE"
    ? [{ key: "o1", option_text: "True", is_correct: true }, { key: "o2", option_text: "False", is_correct: false }]
    : [
        { key: "o1", option_text: "", is_correct: true },
        { key: "o2", option_text: "", is_correct: false },
      ];

function seedFrom(question: AssessmentQuestionDto): Draft {
  const type = (question.question_type as QuestionType) || "SINGLE_CHOICE";
  const opts: OptionRow[] = (question.options ?? []).map((o, i) => ({
    key: o.id ?? `o${i + 1}`,
    option_text: o.option_text,
    is_correct: Boolean(o.is_correct),
  }));
  return {
    type,
    prompt: question.prompt,
    marks: String(question.marks),
    help_text: question.help_text ?? "",
    required: question.is_required,
    model_answer: question.model_answer ?? "",
    options: opts.length >= 2 ? opts : blankOptions(type),
  };
}

interface Draft {
  type: QuestionType;
  prompt: string;
  marks: string;
  help_text: string;
  required: boolean;
  model_answer: string;
  options: OptionRow[];
}

const EMPTY: Draft = {
  type: "SINGLE_CHOICE",
  prompt: "",
  marks: "1",
  help_text: "",
  required: true,
  model_answer: "",
  options: blankOptions("SINGLE_CHOICE"),
};

/* -------------------------------------------------------------- validation */

function validate(draft: Draft): Partial<Record<keyof Draft | "options", string>> {
  const meta = TYPE_META[draft.type];
  const errors: Partial<Record<keyof Draft | "options", string>> = {};
  if (!draft.prompt.trim()) errors.prompt = "Write the question students will see.";
  const marks = Number(draft.marks);
  if (!Number.isFinite(marks) || marks < 0 || marks > 1000) errors.marks = "Enter marks between 0 and 1000.";
  if (meta.kind === "choice") {
    const filled = draft.options.filter((o) => o.option_text.trim());
    if (filled.length < 2) errors.options = "Add at least two non-empty options.";
    else if (filled.length !== draft.options.length) errors.options = "Remove the blank option rows.";
    else if (draft.type === "SINGLE_CHOICE" || draft.type === "TRUE_FALSE") {
      if (draft.options.filter((o) => o.is_correct).length !== 1) {
        errors.options = "Mark exactly one option as the correct answer.";
      }
    } else if (!draft.options.some((o) => o.is_correct)) {
      errors.options = "Mark at least one option as correct.";
    }
  }
  return errors;
}

function toPayload(draft: Draft): QuestionInput {
  const meta = TYPE_META[draft.type];
  const body: QuestionInput = {
    question_type: draft.type,
    prompt: draft.prompt.trim(),
    marks: Number(draft.marks) || 0,
    help_text: draft.help_text.trim() || null,
    is_required: draft.required,
  };
  if (meta.kind === "choice") {
    body.options = draft.options.map((o) => ({ option_text: o.option_text.trim(), is_correct: o.is_correct }));
    body.model_answer = null;
  } else {
    body.options = null;
    body.model_answer = draft.model_answer.trim() || null;
  }
  return body;
}

/* ------------------------------------------------------------------- icons */

function Icon({ path, className = "h-4 w-4" }: { path: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={path} />
    </svg>
  );
}
const ICON = {
  plus: "M12 5v14M5 12h14",
  up: "M6 15l6-6 6 6",
  down: "M6 9l6 6 6-6",
  close: "M6 6l12 12M18 6L6 18",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  bolt: "M13 2L4 14h6l-1 8 9-12h-6l1-8",
};

/* -------------------------------------------------------------- component */

export function QuestionComposer({
  open,
  assessmentId,
  questionNumber,
  editing,
  currentTotalMarks,
  onClose,
  onSaved,
}: {
  open: boolean;
  assessmentId: string;
  questionNumber: number;
  editing?: AssessmentQuestionDto | null;
  currentTotalMarks: number;
  onClose: () => void;
  onSaved: (assessment: Assessment, keepOpen: boolean) => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<ReturnType<typeof validate>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [askDiscard, setAskDiscard] = useState(false);
  const [dirty, setDirty] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const meta = TYPE_META[draft.type];

  useEffect(() => {
    if (!open) return;
    setDraft(editing ? seedFrom(editing) : EMPTY);
    setErrors({});
    setFormError(null);
    setAskDiscard(false);
    setDirty(false);
    const t = setTimeout(() => firstFieldRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open, editing]);

  const patch = useCallback((next: Partial<Draft>) => {
    setDraft((prev) => ({ ...prev, ...next }));
    setDirty(true);
  }, []);

  const changeType = (type: QuestionType) => {
    const wasChoice = TYPE_META[draft.type].kind === "choice";
    const isChoice = TYPE_META[type].kind === "choice";
    setDraft((prev) => ({
      ...prev,
      type,
      options: isChoice ? (type === "TRUE_FALSE" ? blankOptions(type) : wasChoice ? prev.options : blankOptions(type)) : prev.options,
    }));
    setDirty(true);
    setErrors({});
  };

  const marksNum = Number(draft.marks) || 0;
  const projectedTotal = useMemo(() => {
    const previous = editing?.marks ?? 0;
    return Math.max(0, currentTotalMarks - previous + marksNum);
  }, [currentTotalMarks, marksNum, editing]);

  if (!open) return null;

  const requestClose = () => {
    if (dirty) setAskDiscard(true);
    else onClose();
  };

  const save = async (keepOpen: boolean) => {
    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFormError(null);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = toPayload(draft);
      if (editing) {
        const updated = await assessmentsApi.updateQuestion(assessmentId, editing.id, payload);
        onSaved(updated, false);
        return;
      }
      await assessmentsApi.addQuestion(assessmentId, payload);
      const fresh = await assessmentsApi.get(assessmentId);
      onSaved(fresh, keepOpen);
      if (keepOpen) {
        setDraft({ ...EMPTY, marks: draft.marks, type: draft.type });
        setDirty(false);
        setErrors({});
        setTimeout(() => firstFieldRef.current?.focus(), 40);
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not save the question.");
    } finally {
      setSaving(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      requestClose();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void save(true);
    }
  };

  const setOptionText = (key: string, value: string) =>
    patch({ options: draft.options.map((o) => (o.key === key ? { ...o, option_text: value } : o)) });

  const setKey = (key: string) =>
    patch({
      options: draft.options.map((o) =>
        o.key === key
          ? { ...o, is_correct: true }
          : draft.type === "MULTIPLE_CHOICE"
            ? o
            : { ...o, is_correct: false }
      ),
    });

  const toggleKey = (key: string) =>
    patch({ options: draft.options.map((o) => (o.key === key ? { ...o, is_correct: !o.is_correct } : o)) });

  const addOption = () =>
    patch({ options: [...draft.options, { key: `o${Date.now()}`, option_text: "", is_correct: false }] });

  const removeOption = (key: string) =>
    patch({ options: draft.options.filter((o) => o.key !== key) });

  const moveOption = (index: number, dir: -1 | 1) => {
    const next = [...draft.options];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    patch({ options: next });
  };

  const inputCls = "w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="composer-title"
      onKeyDown={onKey}
    >
      <div className="my-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
              Question {questionNumber} · {editing ? "Editing" : "New question"}
            </p>
            <h2 id="composer-title" className="mt-0.5 text-base font-semibold text-slate-900">
              {meta.label}
            </h2>
          </div>
          <button
            onClick={requestClose}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <Icon path={ICON.close} />
          </button>
        </div>

        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* ------------------------------------------------------- editor */}
          <div className="space-y-5 px-6 py-5">
            <fieldset>
              <legend className="text-xs font-medium text-slate-600">Question type</legend>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TYPE_ORDER.map((t) => {
                  const m = TYPE_META[t];
                  const active = draft.type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => changeType(t)}
                      aria-pressed={active}
                      className={`rounded-xl border px-3 py-2.5 text-left transition ${
                        active
                          ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className={`block text-xs font-semibold ${active ? "text-brand-700" : "text-slate-800"}`}>
                        {m.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-tight text-slate-500">{m.blurb}</span>
                      <span
                        className={`mt-1.5 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          m.grading === "Auto" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {m.grading === "Auto" ? "Auto-graded" : "You grade"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label htmlFor="q-prompt" className="text-xs font-medium text-slate-600">Question</label>
              <textarea
                id="q-prompt"
                ref={(el) => { firstFieldRef.current = el; }}
                value={draft.prompt}
                onChange={(e) => patch({ prompt: e.target.value })}
                rows={3}
                placeholder="e.g. Which of the following is an example of dead air?"
                className={`${inputCls} mt-1 resize-y ${errors.prompt ? "border-red-400" : "border-slate-300"}`}
              />
              <div className="mt-1 flex justify-between">
                {errors.prompt ? (
                  <p className="text-xs text-red-600">{errors.prompt}</p>
                ) : <span />}
                <p className="text-[11px] text-slate-400">{draft.prompt.trim().length} chars</p>
              </div>
            </div>

            {meta.kind === "choice" && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-600">
                    {draft.type === "TRUE_FALSE" ? "Answer key" : "Options"}
                    <span className="ml-1 font-normal text-slate-400">
                      {draft.type === "MULTIPLE_CHOICE" ? "— tick every correct one" : "— mark the correct one"}
                    </span>
                  </label>
                  {draft.type !== "TRUE_FALSE" && (
                    <button
                      type="button"
                      onClick={addOption}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Icon path={ICON.plus} className="h-3.5 w-3.5" /> Add option
                    </button>
                  )}
                </div>
                {errors.options && <p className="mt-1 text-xs text-red-600">{errors.options}</p>}
                <ul className="mt-2 space-y-2">
                  {draft.options.map((opt, i) => (
                    <li
                      key={opt.key}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-2"
                    >
                      <button
                        type="button"
                        onClick={() => (draft.type === "MULTIPLE_CHOICE" ? toggleKey(opt.key) : setKey(opt.key))}
                        aria-pressed={opt.is_correct}
                        aria-label={`Mark option ${i + 1} as correct`}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center border text-[11px] font-semibold ${
                          draft.type === "MULTIPLE_CHOICE" ? "rounded-md" : "rounded-full"
                        } ${
                          opt.is_correct
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-slate-300 bg-white text-slate-400 hover:border-emerald-400"
                        }`}
                      >
                        {opt.is_correct ? "✓" : String.fromCharCode(65 + i)}
                      </button>
                      <input
                        value={opt.option_text}
                        onChange={(e) => setOptionText(opt.key, e.target.value)}
                        disabled={draft.type === "TRUE_FALSE"}
                        placeholder={`Option ${i + 1}`}
                        aria-label={`Option ${i + 1} text`}
                        className={`${inputCls} ${draft.type === "TRUE_FALSE" ? "border-slate-200 bg-slate-100 text-slate-500" : "border-slate-300"}`}
                      />
                      {draft.type !== "TRUE_FALSE" && (
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button type="button" onClick={() => moveOption(i, -1)} disabled={i === 0}
                                  aria-label="Move up" className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30">
                            <Icon path={ICON.up} className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => moveOption(i, 1)} disabled={i === draft.options.length - 1}
                                  aria-label="Move down" className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30">
                            <Icon path={ICON.down} className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => removeOption(opt.key)} disabled={draft.options.length <= 2}
                                  aria-label="Remove option" className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30">
                            <Icon path={ICON.trash} className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {draft.type === "SHORT_ANSWER" && (
              <div>
                <label htmlFor="q-model" className="text-xs font-medium text-slate-600">
                  Expected answer <span className="font-normal text-slate-400">(optional — enables auto-marking)</span>
                </label>
                <input
                  id="q-model"
                  value={draft.model_answer}
                  onChange={(e) => patch({ model_answer: e.target.value })}
                  placeholder="e.g. planning"
                  className={`${inputCls} mt-1 border-slate-300`}
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Matched ignoring case and extra spaces. Leave blank to grade this answer yourself.
                </p>
              </div>
            )}

            {(draft.type === "LONG_ANSWER" || draft.type === "FILE_UPLOAD") && (
              <div>
                <label htmlFor="q-rubric" className="text-xs font-medium text-slate-600">
                  Marking guide <span className="font-normal text-slate-400">(staff only — never shown to students)</span>
                </label>
                <textarea
                  id="q-rubric"
                  value={draft.model_answer}
                  onChange={(e) => patch({ model_answer: e.target.value })}
                  rows={3}
                  placeholder="What a full-mark answer should cover…"
                  className={`${inputCls} mt-1 resize-y border-slate-300`}
                />
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="q-marks" className="text-xs font-medium text-slate-600">Marks</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id="q-marks"
                    type="number"
                    min={0}
                    max={1000}
                    value={draft.marks}
                    onChange={(e) => patch({ marks: e.target.value })}
                    className={`${inputCls} w-24 ${errors.marks ? "border-red-400" : "border-slate-300"}`}
                  />
                  <div className="flex gap-1">
                    {[1, 2, 5, 10].map((n) => (
                      <button key={n} type="button" onClick={() => patch({ marks: String(n) })}
                              className={`rounded-lg border px-2 py-1 text-xs ${
                                Number(draft.marks) === n
                                  ? "border-brand-500 bg-brand-50 text-brand-700"
                                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
                              }`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                {errors.marks && <p className="mt-1 text-xs text-red-600">{errors.marks}</p>}
              </div>
              <div>
                <label htmlFor="q-help" className="text-xs font-medium text-slate-600">
                  Guidance <span className="font-normal text-slate-400">(optional, shown to students)</span>
                </label>
                <input
                  id="q-help"
                  value={draft.help_text}
                  onChange={(e) => patch({ help_text: e.target.value })}
                  placeholder="e.g. Choose the best answer"
                  className={`${inputCls} mt-1 border-slate-300`}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={draft.required}
                onChange={(e) => patch({ required: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300"
              />
              Student must answer this question
            </label>
          </div>

          {/* ------------------------------------------------------ preview */}
          <aside className="border-t border-slate-200 bg-slate-50 px-5 py-5 lg:border-l lg:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Student preview</p>
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-snug whitespace-pre-wrap text-slate-900">
                  {draft.prompt.trim() || <span className="text-slate-400">Your question appears here</span>}
                </p>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {marksNum} {marksNum === 1 ? "mark" : "marks"}
                </span>
              </div>
              {!draft.required && (
                <p className="mt-1 text-[11px] text-slate-400">Optional — can be left blank</p>
              )}
              {draft.help_text.trim() && (
                <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500">{draft.help_text}</p>
              )}
              <div className="mt-3 space-y-2">
                {meta.kind === "choice" &&
                  draft.options.map((o, i) => (
                    <div key={o.key} className="flex items-center gap-2 text-sm text-slate-700">
                      <span className={`h-3.5 w-3.5 border-slate-300 ${draft.type === "MULTIPLE_CHOICE" ? "rounded" : "rounded-full"} border`} />
                      <span className="truncate">{o.option_text.trim() || `Option ${i + 1}`}</span>
                    </div>
                  ))}
                {meta.kind === "text" && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-400">
                    {draft.type === "SHORT_ANSWER" ? "Single-line text box" : "Multi-line text box"}
                  </div>
                )}
                {meta.kind === "file" && (
                  <div className="rounded-lg border border-dashed border-slate-300 px-3 py-3 text-center text-xs text-slate-400">
                    Choose file to upload
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-500">Paper total after saving</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">
                {projectedTotal} marks
                <span className="ml-2 font-normal text-slate-500">
                  · {editing ? "unchanged count" : `${questionNumber} questions`}
                </span>
              </p>
            </div>
          </aside>
        </div>

        {/* --------------------------------------------------------- footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4">
          {askDiscard ? (
            <div className="flex w-full items-center justify-between gap-3">
              <p className="text-sm text-slate-700">Discard this unsaved question?</p>
              <div className="flex gap-2">
                <button onClick={() => setAskDiscard(false)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Keep editing
                </button>
                <button onClick={onClose}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
                  Discard
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <Icon path={ICON.bolt} className="h-3.5 w-3.5 text-slate-400" />
                Ctrl / ⌘ + Enter to save
              </p>
              <div className="flex items-center gap-2">
                {formError && <span className="mr-2 text-xs text-red-600">{formError}</span>}
                <button onClick={requestClose}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                {!editing && (
                  <button onClick={() => save(true)} disabled={saving}
                          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50">
                    Save &amp; add another
                  </button>
                )}
                <button onClick={() => save(false)} disabled={saving}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
                  {saving ? "Saving…" : editing ? "Save changes" : "Save question"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
