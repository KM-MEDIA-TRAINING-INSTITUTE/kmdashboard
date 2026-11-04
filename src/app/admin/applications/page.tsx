"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import {
  applicationsApi,
  type ApplicationDetail,
  type ApplicationStats,
  type ApplicationSummary,
  type ApplicationStatusValue,
  type ReviewDecision,
} from "@/lib/api/admissions";

const STATUS_BADGES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-amber-100 text-amber-800",
  MORE_INFO: "bg-purple-100 text-purple-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

const FILTERS: Array<{ label: string; statuses: ApplicationStatusValue[] }> = [
  { label: "Needs action", statuses: ["SUBMITTED", "UNDER_REVIEW", "MORE_INFO"] },
  { label: "Submitted", statuses: ["SUBMITTED"] },
  { label: "Under review", statuses: ["UNDER_REVIEW"] },
  { label: "More info", statuses: ["MORE_INFO"] },
  { label: "Approved", statuses: ["APPROVED"] },
  { label: "Rejected", statuses: ["REJECTED"] },
];

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        STATUS_BADGES[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

export default function AdminApplicationsPage() {
  const [apps, setApps] = useState<ApplicationSummary[]>([]);
  const [stats, setStats] = useState<ApplicationStats | null>(null);
  const [filter, setFilter] = useState(FILTERS[0]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [note, setNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, s] = await Promise.all([
        applicationsApi.list({ status: filter.statuses, search: search.trim() || undefined }),
        applicationsApi.stats(),
      ]);
      setApps(list);
      setStats(s);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load applications");
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const openDetail = async (id: string) => {
    setActionError(null);
    setNote("");
    setDetail(null);
    try {
      setDetail(await applicationsApi.detail(id));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to load application");
    }
  };

  const act = async (id: string, decision: ReviewDecision) => {
    if (decision === "REQUEST_INFO" && note.trim().length < 5) {
      setActionError("A message is required when asking the applicant for more information.");
      return;
    }
    setBusyId(id);
    setActionError(null);
    try {
      await applicationsApi.decide(id, decision, note.trim() || undefined);
      setDetail(null);
      setNote("");
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const admit = async (id: string) => {
    setBusyId(id);
    setActionError(null);
    try {
      const result = await applicationsApi.admit(id);
      const delivered = result.deliveries
        .filter((d) => d.status === "SENT")
        .map((d) => d.channel)
        .join(", ");
      const handoff = result.credential_handoff_required
        ? "\n\n⚠ Login credentials could NOT be emailed/SMS'd automatically. Open this student under Students → “Reset & send login credentials” to generate a temporary password and share it with the student directly."
        : `\n\nTemporary credentials delivered via ${delivered || "email"}.`;
      window.alert(
        `Student provisioned.\n\nAdmission: ${result.admission_number}\nIndex: ${result.index_number}\nLMS email: ${result.user_email}${handoff}`
      );
      setDetail(null);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Admission failed");
    } finally {
      setBusyId(null);
    }
  };

  const chips = useMemo(
    () =>
      stats
        ? [
            { label: "Submitted", value: stats.SUBMITTED },
            { label: "Under review", value: stats.UNDER_REVIEW },
            { label: "More info", value: stats.MORE_INFO },
            { label: "Approved", value: stats.APPROVED },
            { label: "Rejected", value: stats.REJECTED },
          ]
        : [],
    [stats]
  );

  return (
    <RouteGuard allowedRoles={["ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Applications</h1>
              <p className="mt-1 text-sm text-slate-500">
                Review submissions, request information, and issue admissions.
              </p>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone, or number…"
              className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {chips.map((c) => (
              <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-2xl font-semibold text-slate-900">{c.value}</p>
                <p className="text-xs text-slate-500">{c.label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.label}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  filter.label === f.label
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="hidden px-4 py-3 sm:table-cell">Number</th>
                  <th className="px-4 py-3">Applicant</th>
                  <th className="hidden px-4 py-3 md:table-cell">Programme</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="hidden px-4 py-3 lg:table-cell">Submitted</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      Loading…
                    </td>
                  </tr>
                ) : apps.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      No applications match this view.
                    </td>
                  </tr>
                ) : (
                  apps.map((a) => (
                    <tr key={a.id} className="border-b border-slate-100 last:border-0">
                      <td className="hidden whitespace-nowrap px-4 py-3 font-mono text-xs sm:table-cell">
                        {a.application_number}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{a.full_name ?? "—"}</p>
                        <p className="text-xs text-slate-500">{a.email ?? "—"}</p>
                      </td>
                      <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{a.program_title ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={a.status} />
                        {a.status === "MORE_INFO" && a.info_response && (
                          <p className="mt-1 max-w-52 truncate text-xs text-purple-600">
                            answered ✓
                          </p>
                        )}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-xs text-slate-500 lg:table-cell">
                        {a.submitted_at
                          ? new Date(a.submitted_at).toLocaleDateString("en-GB")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openDetail(a.id)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {detail && (
            <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
              <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs text-slate-500">
                      {detail.application_number}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900">
                      {detail.full_name ?? "Unnamed applicant"}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {detail.program_title} · <StatusBadge status={detail.status} />
                    </p>
                  </div>
                  <button
                    onClick={() => setDetail(null)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>

                <dl className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  {[
                    ["Email", detail.email],
                    ["Phone", detail.phone],
                    ["Payment ref", detail.payment_reference],
                    ["Gender", detail.gender],
                    ["Date of birth", detail.date_of_birth],
                    ["Nationality", detail.nationality],
                    ["Hometown", detail.hometown],
                    ["Occupation", detail.occupation],
                    ["Address", detail.residential_address],
                    ["Education", detail.education_level],
                    ["Previous school", detail.previous_school],
                    ["Completion year", detail.completion_year],
                    ["Guardian", detail.guardian_name],
                    ["Guardian phone", detail.guardian_phone],
                    ["Preferred mode", detail.preferred_mode],
                    ["Hostel", detail.hostel_required],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
                      <dd className="mt-0.5 text-slate-700">{value || "—"}</dd>
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <dt className="text-xs uppercase tracking-wide text-slate-400">
                      Learning objectives
                    </dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-slate-700">
                      {detail.learning_objectives || "—"}
                    </dd>
                  </div>
                </dl>

                {detail.info_request && (
                  <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm">
                    <p className="font-medium text-purple-800">Information requested</p>
                    <p className="mt-1 text-purple-700">{detail.info_request}</p>
                    {detail.info_response && (
                      <p className="mt-2 rounded-md bg-white p-2 text-slate-700">
                        <span className="font-medium">Applicant replied:</span>{" "}
                        {detail.info_response}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-6">
                  <label
                    htmlFor="decision-note"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Decision note
                  </label>
                  <textarea
                    id="decision-note"
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Required when requesting more information; optional otherwise."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  />
                </div>

                {actionError && (
                  <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                    {actionError}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {detail.status === "SUBMITTED" && (
                    <button
                      disabled={busyId === detail.id}
                      onClick={() => act(detail.id, "START_REVIEW")}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                    >
                      Start review
                    </button>
                  )}
                  <button
                    disabled={busyId === detail.id}
                    onClick={() => act(detail.id, "APPROVE")}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    disabled={busyId === detail.id}
                    onClick={() => act(detail.id, "REJECT")}
                    className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    disabled={busyId === detail.id}
                    onClick={() => act(detail.id, "REQUEST_INFO")}
                    className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                  >
                    Request info
                  </button>
                  {detail.status === "APPROVED" && (
                    <button
                      disabled={busyId === detail.id}
                      onClick={() => admit(detail.id)}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                    >
                      Admit student
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </RouteGuard>
  );
}
