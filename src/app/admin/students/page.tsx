"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, GraduationCap, UserCheck, UserPlus, Users, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { StatCard, StatusBadge, ErrorState } from "@/components/dashboard/ui";
import { AnimatedModal } from "@/components/ui/motion";
import { Button, PageHeader, Pagination, SearchInput } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import {
  academicsApi,
  studentsApi,
  type CampusRow,
  type IntakeRow,
  type ManualStudentCreated,
  type StudentCreatePayload,
  type StudentMetrics,
  type StudentRow,
  type StudentStatusValue,
} from "@/lib/api/students";
import { programsApi } from "@/lib/api/courses";

const STUDENT_STATUSES = [
  "ADMITTED",
  "ENROLLED",
  "ACTIVE",
  "SUSPENDED",
  "DEFERRED",
  "WITHDRAWN",
  "COMPLETED",
  "GRADUATED",
  "EXPELLED",
];

const PAGE_SIZE = 25;

export default function AdminStudentsPage() {
  const toast = useToast();
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

  useEffect(() => {
    if (showAddModal && programs.length === 0) {
      programsApi
        .list()
        .then((p) => setPrograms(p.map((pr) => ({ id: pr.id, title: pr.title, code: pr.code }))))
        .catch(() => {});
    }
  }, [showAddModal, programs.length]);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError(null);
    setAddResult(null);
    try {
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
      toast.success("Student created", `Index ${result.student.index_number}`);
      load();
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : "Failed to create student");
    } finally {
      setAddLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      full_name: "",
      email: "",
      phone: "",
      program_id: "",
      campus_id: "",
      gender: "",
      date_of_birth: "",
      nationality: "",
    });
    setAddResult(null);
    setAddError(null);
    setShowAddModal(false);
  };

  const resetToFirstPage = () => setPage(0);

  return (
    <RouteGuard allowedRoles={["ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <div className="space-y-6">
          <PageHeader
            eyebrow="Administration"
            title="Students"
            description="Every admitted student, their academic status, campus, and enrolment."
            breadcrumbs={[{ label: "Dashboard", href: "/dashboard/admin" }, { label: "Students" }]}
            actions={
              <>
                <a
                  href={studentsApi.exportUrl({
                    search: search || undefined,
                    status: statusFilter || undefined,
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-ink-800 shadow-2xs transition-colors hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                  Export CSV
                </a>
                <Button
                  variant="primary"
                  size="md"
                  icon={<UserPlus className="h-4 w-4" />}
                  onClick={() => setShowAddModal(true)}
                >
                  Add Student
                </Button>
              </>
            }
          />

          {metrics && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <StatCard label="Total" value={metrics.total} icon={<Users className="h-4 w-4" />} tone="brand" />
              <StatCard label="Active" value={metrics.ACTIVE} icon={<UserCheck className="h-4 w-4" />} tone="good" />
              <StatCard label="Admitted" value={metrics.ADMITTED + metrics.ENROLLED} />
              <StatCard label="Suspended" value={metrics.SUSPENDED} tone={metrics.SUSPENDED > 0 ? "warn" : "default"} />
              <StatCard label="Graduated" value={metrics.GRADUATED} icon={<GraduationCap className="h-4 w-4" />} />
            </div>
          )}

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-[var(--shadow-card)]">
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                resetToFirstPage();
              }}
              placeholder="Search name, index no., email, phone…"
              className="w-full sm:w-64"
            />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                resetToFirstPage();
              }}
              aria-label="Filter by status"
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-ink-900 focus:border-brand-500 focus:outline-none"
            >
              <option value="">All statuses</option>
              {STUDENT_STATUSES.map((s) => (
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
              aria-label="Filter by campus"
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-ink-900 focus:border-brand-500 focus:outline-none"
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
              aria-label="Filter by intake"
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-ink-900 focus:border-brand-500 focus:outline-none"
            >
              <option value="">All intakes</option>
              {intakes.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>

          {error && <ErrorState title="Could not load students" detail={error} onRetry={load} />}

          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-card)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="hidden px-4 py-3 sm:table-cell">Index no.</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="hidden px-4 py-3 md:table-cell">Programme</th>
                    <th className="hidden px-4 py-3 md:table-cell">Campus</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={6} className="px-4 py-3">
                          <div className="h-8 animate-pulse rounded-lg bg-slate-100" />
                        </td>
                      </tr>
                    ))
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                        No students match these filters.
                      </td>
                    </tr>
                  ) : (
                    rows.map((s) => (
                      <tr key={s.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="hidden whitespace-nowrap px-4 py-3.5 font-mono text-xs font-medium text-slate-600 sm:table-cell">
                          {s.index_number}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-ink-900">{s.full_name ?? "—"}</p>
                          <p className="text-xs text-slate-500">{s.email ?? "—"}</p>
                        </td>
                        <td className="hidden px-4 py-3.5 text-slate-600 md:table-cell">
                          {s.program_title ?? "—"}
                        </td>
                        <td className="hidden px-4 py-3.5 text-slate-600 md:table-cell">
                          {s.campus_name ?? "—"}
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <Link
                            href={`/admin/students/${s.id}`}
                            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-ink-800 transition-colors hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700"
                          >
                            Open →
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
          </div>
        </div>

        <AnimatedModal open={showAddModal} onClose={resetForm} labelledBy="add-student-title">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="add-student-title" className="text-lg font-bold text-ink-900">
              Add Student
            </h2>
            <button
              onClick={resetForm}
              aria-label="Close modal"
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-ink-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {addResult ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-900">Student created successfully</p>
                <p className="mt-1 text-sm text-emerald-800">
                  Index: <span className="font-mono font-semibold">{addResult.student.index_number}</span>
                </p>
                <p className="mt-1 text-xs text-emerald-700">
                  Login credentials have been sent to{" "}
                  <span className="font-semibold">{addResult.student.email}</span> via email.
                </p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                  Temporary Password (share with student)
                </p>
                <p className="mt-1 select-all font-mono text-lg font-bold text-amber-950">
                  {addResult.temporary_password}
                </p>
              </div>
              <Button variant="primary" className="w-full" onClick={resetForm}>
                Done
              </Button>
            </div>
          ) : (
            <form onSubmit={handleAddStudent} className="space-y-4">
              {addError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                  {addError}
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-800">Full Name *</label>
                <input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  placeholder="Kofi Asante"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-800">Email *</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  placeholder="student@example.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-800">Phone</label>
                  <input
                    value={form.phone ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                    placeholder="0201234567"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-800">Gender</label>
                  <select
                    value={form.gender ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-800">Programme *</label>
                <select
                  required
                  value={form.program_id}
                  onChange={(e) => setForm((f) => ({ ...f, program_id: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Select a programme</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-800">Campus</label>
                  <select
                    value={form.campus_id ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, campus_id: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-800">Date of Birth</label>
                  <input
                    type="date"
                    value={form.date_of_birth ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-800">Nationality</label>
                <input
                  value={form.nationality ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  placeholder="Ghanaian"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={resetForm}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={addLoading}
                  disabled={!form.full_name || !form.email || !form.program_id}
                  className="flex-1"
                >
                  {addLoading ? "Creating…" : "Create Student"}
                </Button>
              </div>
            </form>
          )}
        </AnimatedModal>
      </AppShell>
    </RouteGuard>
  );
}

export type { StudentStatusValue };
