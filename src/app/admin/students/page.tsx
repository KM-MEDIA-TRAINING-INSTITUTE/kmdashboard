"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import {
  academicsApi,
  studentsApi,
  type CampusRow,
  type IntakeRow,
  type StudentCreatePayload,
  type StudentMetrics,
  type StudentRow,
  type StudentStatusValue,
  type ManualStudentCreated,
} from "@/lib/api/students";
import { programsApi } from "@/lib/api/courses";

const STATUS_BADGES: Record<string, string> = {
  ADMITTED: "bg-sky-100 text-sky-700",
  ENROLLED: "bg-blue-100 text-blue-700",
  ACTIVE: "bg-emerald-100 text-emerald-700",
  SUSPENDED: "bg-amber-100 text-amber-800",
  DEFERRED: "bg-purple-100 text-purple-700",
  WITHDRAWN: "bg-red-100 text-red-700",
  COMPLETED: "bg-teal-100 text-teal-700",
  GRADUATED: "bg-indigo-100 text-indigo-700",
  EXPELLED: "bg-rose-100 text-rose-700",
};

const PAGE_SIZE = 25;

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        STATUS_BADGES[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}

export default function AdminStudentsPage() {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [metrics, setMetrics] = useState<StudentMetrics | null>(null);
  const [campuses, setCampuses] = useState<CampusRow[]>([]);
  const [intakes, setIntakes] = useState<IntakeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [campusFilter, setCampusFilter] = useState("");
  const [intakeFilter, setIntakeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Add Student modal state ---
  const [showAddModal, setShowAddModal] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addResult, setAddResult] = useState<ManualStudentCreated | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [programs, setPrograms] = useState<Array<{ id: string; title: string; code: string }>>([]);
  const [form, setForm] = useState<StudentCreatePayload>({
    full_name: "",
    email: "",
    phone: "",
    program_id: "",
    campus_id: "",
    gender: "",
    date_of_birth: "",
    nationality: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, m] = await Promise.all([
        studentsApi.list({
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          campus_id: campusFilter || undefined,
          intake_id: intakeFilter || undefined,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        }),
        studentsApi.metrics(),
      ]);
      setRows(list.items);
      setTotal(list.total);
      setMetrics(m);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load students");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, campusFilter, intakeFilter, page]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    (async () => {
      try {
        const [c, i] = await Promise.all([academicsApi.campuses(), academicsApi.intakes()]);
        setCampuses(c);
        setIntakes(i);
      } catch {
        /* filters degrade gracefully */
      }
    })();
  }, []);

  // Load programs when modal opens
  useEffect(() => {
    if (showAddModal && programs.length === 0) {
      programsApi.list().then((p) =>
        setPrograms(p.map((pr) => ({ id: pr.id, title: pr.title, code: pr.code })))
      ).catch(() => {});
    }
  }, [showAddModal, programs.length]);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError(null);
    setAddResult(null);
    try {
      // Strip empty strings so the backend receives undefined for optional fields
      const payload: StudentCreatePayload = {
        ...form,
        phone: form.phone || undefined,
        campus_id: form.campus_id || undefined,
        gender: form.gender || undefined,
        date_of_birth: form.date_of_birth || undefined,
        nationality: form.nationality || undefined,
      };
      const result = await studentsApi.create(payload);
      setAddResult(result);
      // Reload the student list
      load();
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : "Failed to create student");
    } finally {
      setAddLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ full_name: "", email: "", phone: "", program_id: "", campus_id: "", gender: "", date_of_birth: "", nationality: "" });
    setAddResult(null);
    setAddError(null);
    setShowAddModal(false);
  };

  const resetToFirstPage = () => setPage(0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <RouteGuard allowedRoles={["ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Students</h1>
              <p className="mt-1 text-sm text-slate-500">
                Every admitted student, their status and enrollment.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddModal(true)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                + Add Student
              </button>
              <a
                href={studentsApi.exportUrl({ search: search || undefined, status: statusFilter || undefined })}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Export CSV
              </a>
            </div>
          </div>

          {metrics && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(
                [
                  ["Total", metrics.total],
                  ["Active", metrics.ACTIVE],
                  ["Admitted", metrics.ADMITTED + metrics.ENROLLED],
                  ["Suspended", metrics.SUSPENDED],
                  ["Graduated", metrics.GRADUATED],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-2xl font-semibold text-slate-900">{value}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetToFirstPage();
              }}
              placeholder="Search name, index no., email, phone…"
              className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                resetToFirstPage();
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              {Object.keys(STATUS_BADGES).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={campusFilter}
              onChange={(e) => {
                setCampusFilter(e.target.value);
                resetToFirstPage();
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All campuses</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={intakeFilter}
              onChange={(e) => {
                setIntakeFilter(e.target.value);
                resetToFirstPage();
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All intakes</option>
              {intakes.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
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
                  <th className="hidden px-4 py-3 sm:table-cell">Index no.</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="hidden px-4 py-3 md:table-cell">Programme</th>
                  <th className="hidden px-4 py-3 md:table-cell">Campus</th>
                  <th className="px-4 py-3">Status</th>
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
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      No students match these filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 last:border-0">
                      <td className="hidden whitespace-nowrap px-4 py-3 font-mono text-xs sm:table-cell">{s.index_number}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{s.full_name ?? "—"}</p>
                        <p className="text-xs text-slate-500">{s.email ?? "—"}</p>
                      </td>
                      <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{s.program_title ?? "—"}</td>
                      <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{s.campus_name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={`/admin/students/${s.id}`}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                        >
                          Open
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              {total} student{total === 1 ? "" : "s"} · page {page + 1} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 hover:bg-slate-50"
              >
                Previous
              </button>
              <button
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* ---- Add Student Modal ---- */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={resetForm}>
            <div
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Add Student</h2>
                <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
              </div>

              {addResult ? (
                /* ---- Success: show temp credentials ---- */
                <div className="space-y-4">
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
                    <p className="text-sm font-medium text-emerald-800">Student created successfully</p>
                    <p className="mt-1 text-sm text-emerald-700">
                      Index: <span className="font-mono">{addResult.student.index_number}</span>
                    </p>
                  </div>
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                    <p className="text-xs font-medium text-amber-800 uppercase">Temporary Password (share with student)</p>
                    <p className="mt-1 font-mono text-lg text-amber-900 select-all">{addResult.temporary_password}</p>
                  </div>
                  <button
                    onClick={resetForm}
                    className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Done
                  </button>
                </div>
              ) : (
                /* ---- Form ---- */
                <form onSubmit={handleAddStudent} className="space-y-4">
                  {addError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {addError}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                    <input
                      required
                      value={form.full_name}
                      onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                      placeholder="Kofi Asante"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                      placeholder="student@example.com"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                      <input
                        value={form.phone ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                        placeholder="0201234567"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                      <select
                        value={form.gender ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="">—</option>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Programme *</label>
                    <select
                      required
                      value={form.program_id}
                      onChange={(e) => setForm((f) => ({ ...f, program_id: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">Select a programme</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.id}>{p.title} ({p.code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Campus</label>
                      <select
                        value={form.campus_id ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, campus_id: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="">—</option>
                        {campuses.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
                      <input
                        type="date"
                        value={form.date_of_birth ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nationality</label>
                    <input
                      value={form.nationality ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                      placeholder="Ghanaian"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addLoading || !form.full_name || !form.email || !form.program_id}
                      className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {addLoading ? "Creating…" : "Create Student"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </AppShell>
    </RouteGuard>
  );
}

export type { StudentStatusValue };
