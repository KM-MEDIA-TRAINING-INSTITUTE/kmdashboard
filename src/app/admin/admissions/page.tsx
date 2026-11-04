"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import { admissionsApi, type AdmissionRow } from "@/lib/api/admissions";

const ADMISSION_BADGES: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  DEFERRED: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-blue-100 text-blue-700",
  WITHDRAWN: "bg-red-100 text-red-700",
};

export default function AdminAdmissionsPage() {
  const [rows, setRows] = useState<AdmissionRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await admissionsApi.list({ search: search.trim() || undefined }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load admissions");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  return (
    <RouteGuard allowedRoles={["ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Admissions</h1>
              <p className="mt-1 text-sm text-slate-500">
                Every student account issued from an approved application.
              </p>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search admission no., index no., applicant…"
              className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
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
                  <th className="hidden px-4 py-3 sm:table-cell">Admission no.</th>
                  <th className="hidden px-4 py-3 md:table-cell">Index no.</th>
                  <th className="px-4 py-3">Applicant</th>
                  <th className="hidden px-4 py-3 lg:table-cell">Programme</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="hidden px-4 py-3 md:table-cell">Admitted</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      No admissions yet. Admit an approved application to create one.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0">
                      <td className="hidden whitespace-nowrap px-4 py-3 font-mono text-xs sm:table-cell">
                        {r.admission_number}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600 md:table-cell">
                        {r.index_number}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{r.applicant_name ?? "—"}</p>
                        <p className="text-xs text-slate-500">{r.applicant_email ?? "—"}</p>
                      </td>
                      <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">
                        {r.program_title ?? "—"}
                        {r.program_code && (
                          <span className="ml-1 text-xs text-slate-400">({r.program_code})</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            ADMISSION_BADGES[r.status] ?? "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-xs text-slate-500 md:table-cell">
                        {new Date(r.admitted_at).toLocaleDateString("en-GB")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </AppShell>
    </RouteGuard>
  );
}
