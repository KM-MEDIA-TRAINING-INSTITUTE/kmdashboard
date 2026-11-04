"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import {
  assignmentsApi,
  assessmentsApi,
  formatPercent,
  offeringsApi,
  type Assignment,
  type Assessment,
  type GradebookRow,
  type Offering,
} from "@/lib/api/academic";

interface GradebookData {
  course_offering_id: string;
  state: string;
  components: { kind: string; ref_id?: string | null; label?: string | null; weight: number }[];
  totals: Record<string, GradebookRow>;
}

const STATE_ACTIONS: { action: string; label: string }[] = [
  { action: "IN_REVIEW", label: "Send for review" },
  { action: "FINALIZED", label: "Finalize" },
  { action: "LOCKED", label: "Lock" },
];

function GradebookInner() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [offeringId, setOfferingId] = useState("");
  const [book, setBook] = useState<GradebookData | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [rows, setRows] = useState<{ kind: string; ref_id: string; label: string; weight: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const offs = await offeringsApi.mine();
        if (!cancelled) {
          setOfferings(offs);
          if (offs.length > 0) setOfferingId(offs[0].id);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadBook = useCallback(async (oid: string) => {
    const data = await offeringsApi.gradebook(oid);
    setBook(data);
    setRows(
      data.components.map((c) => ({
        kind: c.kind,
        ref_id: c.ref_id ?? "",
        label: c.label ?? "",
        weight: String(c.weight),
      }))
    );
    const [as, ss] = await Promise.all([
      offeringsApi.assignments(oid).catch(() => [] as Assignment[]),
      offeringsApi.assessments(oid).catch(() => [] as Assessment[]),
    ]);
    setAssignments(as);
    setAssessments(ss);
  }, []);

  useEffect(() => {
    if (!offeringId) return;
    loadBook(offeringId).catch((err) =>
      setError(err instanceof ApiError ? err.message : "Could not load the gradebook.")
    );
  }, [offeringId, loadBook]);

  const totalWeight = rows.reduce((a, r) => a + (Number(r.weight) || 0), 0);

  const saveComponents = async () => {
    setError(null);
    try {
      await offeringsApi.setComponents(
        offeringId,
        rows.map((r) => ({
          kind: r.kind,
          ref_id: r.ref_id || null,
          label: r.label || null,
          weight: Number(r.weight),
        }))
      );
      setMsg("Components saved.");
      await loadBook(offeringId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save components.");
    }
  };

  const transition = async (action: string) => {
    setError(null);
    try {
      let reason: string | undefined;
      if (book?.state === "LOCKED" && action === "IN_REVIEW") {
        reason = window.prompt("Reason for unlocking (audited)?") ?? undefined;
        if (!reason) return;
      }
      const res = await offeringsApi.gradebookStatus(offeringId, action, reason);
      setMsg(`Gradebook is now ${res.state}.`);
      await loadBook(offeringId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Transition failed.");
    }
  };

  const publish = async () => {
    try {
      await offeringsApi.publishResults(offeringId);
      setMsg("Results published — students notified.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Publishing results failed.");
    }
  };

  const titleFor = (r: { kind: string; ref_id: string }) => {
    if (r.kind === "ATTENDANCE") return "Attendance";
    if (r.kind === "ASSIGNMENT") return assignments.find((a) => a.id === r.ref_id)?.title ?? "assignment";
    return assessments.find((a) => a.id === r.ref_id)?.title ?? "assessment";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Gradebook</h1>
        <p className="mt-1 text-sm text-slate-500">
          Weighted components must total exactly 100%. Finalized grades lock; unlocking is audited.
        </p>
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
          No offerings assigned to you yet.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="offering" className="block text-xs font-medium text-slate-600">
                Offering
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
            {book && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                State: {book.state.replace("_", " ")}
              </span>
            )}
          </div>

          {book && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">Weighted components</h2>
              <ul className="mt-3 space-y-2">
                {rows.map((r, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label="Component type"
                      value={r.kind}
                      onChange={(e) => setRows((p) => p.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))}
                      disabled={book.state !== "DRAFT"}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    >
                      <option value="ATTENDANCE">Attendance</option>
                      <option value="ASSIGNMENT">Assignment</option>
                      <option value="ASSESSMENT">Assessment</option>
                    </select>
                    {r.kind !== "ATTENDANCE" && (
                      <select
                        aria-label="Reference"
                        value={r.ref_id}
                        onChange={(e) => setRows((p) => p.map((x, j) => (j === i ? { ...x, ref_id: e.target.value } : x)))}
                        disabled={book.state !== "DRAFT"}
                        className="max-w-52 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                      >
                        <option value="">Select…</option>
                        {(r.kind === "ASSIGNMENT" ? assignments : assessments).map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.title}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      type="number"
                      min={1}
                      max={100}
                      aria-label="Weight %"
                      value={r.weight}
                      onChange={(e) => setRows((p) => p.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))}
                      disabled={book.state !== "DRAFT"}
                      className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <span className="text-xs text-slate-500">{titleFor(r)}</span>
                    <button
                      onClick={() => setRows((p) => p.filter((_, j) => j !== i))}
                      disabled={book.state !== "DRAFT"}
                      className="text-xs text-red-600 hover:underline disabled:opacity-40"
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
              <p className={`mt-2 text-xs ${totalWeight === 100 ? "text-emerald-700" : "text-red-700"}`}>
                Total: {totalWeight}% {totalWeight === 100 ? "✓" : "(must equal 100%)"}
              </p>
              {book.state === "DRAFT" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      setRows((p) => [...p, { kind: "ATTENDANCE", ref_id: "", label: "", weight: "30" }])
                    }
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
                  >
                    Add component
                  </button>
                  <button
                    onClick={saveComponents}
                    disabled={totalWeight !== 100 || rows.length === 0}
                    className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    Save components
                  </button>
                </div>
              )}
            </div>
          )}

          {book && (
            <div className="flex flex-wrap gap-2">
              {STATE_ACTIONS.filter((a) =>
                a.action === "IN_REVIEW"
                  ? book.state === "DRAFT" || book.state === "LOCKED" || book.state === "FINALIZED"
                  : a.action === "FINALIZED"
                    ? book.state === "IN_REVIEW"
                    : book.state === "FINALIZED"
              ).map((a) => (
                <button
                  key={a.action}
                  onClick={() => transition(a.action)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                >
                  {a.label}
                </button>
              ))}
              {book.state === "FINALIZED" && (
                <button
                  onClick={publish}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
                >
                  Publish results
                </button>
              )}
            </div>
          )}

          {book && Object.keys(book.totals).length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Weighted totals per student</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-4 py-3">Student</th>
                    {book.components.map((c, i) => (
                      <th key={i} scope="col" className="px-4 py-3">
                        {c.label || c.kind} ({c.weight}%)
                      </th>
                    ))}
                    <th scope="col" className="px-4 py-3">Weighted total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(book.totals).map(([sid, t]) => (
                    <tr key={sid} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{sid.slice(0, 8)}…</td>
                      {book!.components.map((c, i) => (
                        <td key={i} className="px-4 py-3">
                          {formatPercent(t.components[c.label || `${c.kind}:${c.ref_id}`] ?? null)}
                        </td>
                      ))}
                      <td className="px-4 py-3 font-semibold">{formatPercent(t.weighted)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function TrainerGradebookPage() {
  return (
    <RouteGuard allowedRoles={["TRAINER", "ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <GradebookInner />
      </AppShell>
    </RouteGuard>
  );
}
