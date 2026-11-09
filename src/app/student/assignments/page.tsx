"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import { studentApi, fileUrl, type Assignment, type StudentOffering, type Submission } from "@/lib/api/academic";

const STATUS_META: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-sky-50 text-sky-700",
  LATE: "bg-amber-50 text-amber-700",
  GRADED: "bg-emerald-50 text-emerald-700",
  RETURNED: "bg-indigo-50 text-indigo-700",
  RESUBMITTED: "bg-sky-50 text-sky-700",
};

function AssignmentsInner() {
  const [offerings, setOfferings] = useState<StudentOffering[]>([]);
  const [offeringId, setOfferingId] = useState<string>("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission[]>>({});
  const [answer, setAnswer] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Student-scoped offering list (the staff detail endpoint 403s for
        // students by design — /student/offerings is the entitled view).
        const offs = await studentApi.offerings().catch(() => []);
        if (cancelled) return;
        setOfferings(offs);
        if (offs.length > 0) setOfferingId(offs[0].id);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load assignments.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadAssignments = useCallback(async (oid: string) => {
    const rows = await studentApi.assignments(oid);
    setAssignments(rows);
    const subs: Record<string, Submission[]> = {};
    await Promise.all(
      rows.map(async (a) => {
        try {
          subs[a.id] = await studentApi.mySubmissions(a.id);
        } catch {
          subs[a.id] = [];
        }
      })
    );
    setSubmissions(subs);
  }, []);

  useEffect(() => {
    if (!offeringId) return;
    let cancelled = false;
    setItemsLoading(true);
    (async () => {
      try {
        await loadAssignments(offeringId);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load assignments.");
      } finally {
        if (!cancelled) setItemsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [offeringId, loadAssignments]);

  const submit = async (a: Assignment) => {
    setBusy(a.id);
    setMsg(null);
    setError(null);
    try {
      await studentApi.submitAssignment(a.id, { content: answer[a.id] ?? "", file: files[a.id] ?? null });
      setMsg(`Submitted “${a.title}”.`);
      setFiles((prev) => ({ ...prev, [a.id]: null }));
      await loadAssignments(offeringId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Submission failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Assignments</h1>
        <p className="mt-1 text-sm text-slate-500">Submit your work and track feedback.</p>
      </div>

      {msg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{msg}</div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : offerings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
          No course offerings are available for your enrollment yet.
        </div>
      ) : (
        <>
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
                  {o.code} · {o.delivery_mode}
                </option>
              ))}
            </select>
          </div>

          {itemsLoading ? (
            <p className="text-sm text-slate-400">Loading assignments…</p>
          ) : assignments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
              No published assignments in this offering.
            </div>
          ) : (
            <ul className="space-y-4">
              {assignments.map((a) => {
                const mine = submissions[a.id] ?? [];
                const latest = mine[mine.length - 1];
                const attemptsLeft = a.max_attempts - mine.length;
                return (
                  <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {a.total_marks} marks · due {a.due_at ? new Date(a.due_at).toLocaleString() : "—"}
                          {a.allow_late_submission ? " · late allowed" : ""}
                        </p>
                      </div>
                      {latest && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_META[latest.status] ?? "bg-slate-100 text-slate-700"}`}>
                          {latest.status}
                        </span>
                      )}
                    </div>
                    {a.instructions && <p className="mt-2 text-sm text-slate-600">{a.instructions}</p>}

                    {latest?.final_score !== null && latest?.final_score !== undefined && (
                      <p className="mt-2 text-sm text-emerald-700">
                        Score: {latest.final_score}/{a.total_marks}
                        {latest.feedback ? ` — “${latest.feedback}”` : ""}
                      </p>
                    )}

                    {mine.length > 0 && (
                      <p className="mt-2 text-xs text-slate-500">
                        {mine.length} of {a.max_attempts} attempts used
                      </p>
                    )}
                    {latest?.storage_key && (
                      <p className="mt-1 text-xs text-slate-600">
                        Attachment:{" "}
                        <a
                          href={fileUrl(latest.storage_key)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-700 underline"
                        >
                          {latest.original_filename ?? "download"}
                        </a>
                      </p>
                    )}

                    {attemptsLeft > 0 && a.status === "PUBLISHED" && (
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <div className="flex-1 space-y-2">
                          <label className="sr-only" htmlFor={`answer-${a.id}`}>
                            Your answer
                          </label>
                          <textarea
                            id={`answer-${a.id}`}
                            rows={3}
                            value={answer[a.id] ?? ""}
                            onChange={(e) => setAnswer((prev) => ({ ...prev, [a.id]: e.target.value }))}
                            placeholder="Type your submission…"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                          <label className="flex items-center gap-2 text-xs text-slate-600">
                            <span className="rounded-lg border border-slate-300 px-3 py-1.5">
                              Attach file
                            </span>
                            <input
                              id={`file-${a.id}`}
                              type="file"
                              className="hidden"
                              onChange={(e) => setFiles((prev) => ({ ...prev, [a.id]: e.target.files?.[0] ?? null }))}
                            />
                            <span className="truncate">{files[a.id]?.name ?? "optional — pdf, doc, ppt, xls, zip, txt, images, mp4, audio (max 25 MB)"}</span>
                          </label>
                        </div>
                        <button
                          onClick={() => submit(a)}
                          disabled={busy === a.id || (!(answer[a.id] ?? "").trim() && !files[a.id])}
                          className="self-start rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                        >
                          {busy === a.id ? "Submitting…" : "Submit"}
                        </button>
                      </div>
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

export default function StudentAssignmentsPage() {
  return (
    <RouteGuard allowedRoles={["STUDENT", "TRAINER", "ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <AssignmentsInner />
      </AppShell>
    </RouteGuard>
  );
}
