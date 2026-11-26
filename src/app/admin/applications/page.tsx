"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Clock, FileCheck2, Inbox, X, XCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ErrorState, StatCard, StatusBadge } from "@/components/dashboard/ui";
import { MOTION_EASE } from "@/components/ui/motion";
import { Button, PageHeader, SearchInput } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import {
  applicationsApi,
  type ApplicationDetail,
  type ApplicationStats,
  type ApplicationStatusValue,
  type ApplicationSummary,
  type ReviewDecision,
} from "@/lib/api/admissions";

const FILTERS: Array<{ label: string; statuses: ApplicationStatusValue[] }> = [
  { label: "Needs action", statuses: ["SUBMITTED", "UNDER_REVIEW", "MORE_INFO"] },
  { label: "Submitted", statuses: ["SUBMITTED"] },
  { label: "Under review", statuses: ["UNDER_REVIEW"] },
  { label: "More info", statuses: ["MORE_INFO"] },
  { label: "Approved", statuses: ["APPROVED"] },
  { label: "Rejected", statuses: ["REJECTED"] },
];

export default function AdminApplicationsPage() {
  const toast = useToast();
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
      toast.success("Decision recorded", `Application ${decision.replace("_", " ").toLowerCase()}`);
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
      toast.success("Student admitted", result.index_number);
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
            { label: "Submitted", value: stats.SUBMITTED, icon: <Inbox className="h-4 w-4" />, tone: "brand" as const },
            { label: "Under review", value: stats.UNDER_REVIEW, icon: <Clock className="h-4 w-4" />, tone: "warn" as const },
            { label: "More info", value: stats.MORE_INFO, icon: <FileCheck2 className="h-4 w-4" />, tone: "default" as const },
            { label: "Approved", value: stats.APPROVED, icon: <CheckCircle2 className="h-4 w-4" />, tone: "good" as const },
            { label: "Rejected", value: stats.REJECTED, icon: <XCircle className="h-4 w-4" />, tone: "bad" as const },
          ]
        : [],
    [stats]
  );

  return (
    <RouteGuard allowedRoles={["ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <div className="space-y-6">
          <PageHeader
            eyebrow="Administration"
            title="Applications"
            description="Review submissions, request additional information, and issue admissions."
            breadcrumbs={[{ label: "Dashboard", href: "/dashboard/admin" }, { label: "Applications" }]}
            actions={
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search name, email, phone, or number…"
                className="w-72"
              />
            }
          />

          {chips.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {chips.map((c) => (
                <StatCard key={c.label} label={c.label} value={c.value} icon={c.icon} tone={c.tone} />
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.label}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  filter.label === f.label
                    ? "bg-brand-600 text-white shadow-2xs"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {error && <ErrorState title="Could not load applications" detail={error} onRetry={load} />}

          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-card)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="hidden px-4 py-3 sm:table-cell">Number</th>
                    <th className="px-4 py-3">Applicant</th>
                    <th className="hidden px-4 py-3 md:table-cell">Programme</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="hidden px-4 py-3 lg:table-cell">Submitted</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={6} className="px-4 py-3">
                          <div className="h-8 animate-pulse rounded-lg bg-slate-100" />
                        </td>
                      </tr>
                    ))
                  ) : apps.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                        No applications match this view.
                      </td>
                    </tr>
                  ) : (
                    apps.map((a) => (
                      <tr key={a.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="hidden whitespace-nowrap px-4 py-3.5 font-mono text-xs text-slate-600 sm:table-cell">
                          {a.application_number}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-ink-900">{a.full_name ?? "—"}</p>
                          <p className="text-xs text-slate-500">{a.email ?? "—"}</p>
                        </td>
                        <td className="hidden px-4 py-3.5 text-slate-600 md:table-cell">
                          {a.program_title ?? "—"}
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={a.status} />
                          {a.status === "MORE_INFO" && a.info_response && (
                            <p className="mt-1 max-w-52 truncate text-xs font-medium text-purple-600">
                              answered ✓
                            </p>
                          )}
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3.5 text-xs text-slate-500 lg:table-cell">
                          {a.submitted_at
                            ? new Date(a.submitted_at).toLocaleDateString("en-GB")
                            : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <Button size="sm" variant="outline" onClick={() => openDetail(a.id)}>
                            Review
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <AnimatePresence>
            {detail && (
              <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]"
                  onClick={() => setDetail(null)}
                />
                <motion.div
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ duration: 0.25, ease: MOTION_EASE }}
                  className="relative z-10 h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl"
                >
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <p className="font-mono text-xs font-semibold text-brand-600">
                        {detail.application_number}
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-ink-900">
                        {detail.full_name ?? "Unnamed applicant"}
                      </h2>
                      <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                        <span>{detail.program_title}</span>
                        <StatusBadge status={detail.status} />
                      </div>
                    </div>
                    <button
                      onClick={() => setDetail(null)}
                      aria-label="Close drawer"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink-900"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <dl className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
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
                      <div key={label as string} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                        <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          {label}
                        </dt>
                        <dd className="mt-0.5 font-medium text-ink-900">{value || "—"}</dd>
                      </div>
                    ))}
                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:col-span-2">
                      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Learning objectives
                      </dt>
                      <dd className="mt-0.5 whitespace-pre-wrap text-ink-800">
                        {detail.learning_objectives || "—"}
                      </dd>
                    </div>
                  </dl>

                  {detail.info_request && (
                    <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm">
                      <p className="font-semibold text-purple-900">Information requested</p>
                      <p className="mt-1 text-purple-800">{detail.info_request}</p>
                      {detail.info_response && (
                        <p className="mt-2 rounded-lg bg-white p-2.5 text-ink-800">
                          <span className="font-semibold">Applicant replied:</span>{" "}
                          {detail.info_response}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-6">
                    <label
                      htmlFor="decision-note"
                      className="block text-xs font-semibold text-ink-800"
                    >
                      Decision note
                    </label>
                    <textarea
                      id="decision-note"
                      rows={3}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Required when requesting more information; optional otherwise."
                      className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                    />
                  </div>

                  {actionError && (
                    <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                      {actionError}
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    {detail.status === "SUBMITTED" && (
                      <Button
                        variant="outline"
                        disabled={busyId === detail.id}
                        onClick={() => act(detail.id, "START_REVIEW")}
                      >
                        Start review
                      </Button>
                    )}
                    <Button
                      variant="primary"
                      disabled={busyId === detail.id}
                      onClick={() => act(detail.id, "APPROVE")}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      disabled={busyId === detail.id}
                      onClick={() => act(detail.id, "REJECT")}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busyId === detail.id}
                      onClick={() => act(detail.id, "REQUEST_INFO")}
                    >
                      Request info
                    </Button>
                    {detail.status === "APPROVED" && (
                      <Button
                        variant="secondary"
                        disabled={busyId === detail.id}
                        onClick={() => admit(detail.id)}
                      >
                        Admit student
                      </Button>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </AppShell>
    </RouteGuard>
  );
}
