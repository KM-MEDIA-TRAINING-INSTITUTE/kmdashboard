"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/avatar";
import { RouteGuard } from "@/components/route-guard";
import { useAuth } from "@/components/auth-provider";
import { ApiError } from "@/lib/api/client";
import { staffApi } from "@/lib/api/endpoints";
import { programsApi } from "@/lib/api/courses";
import type { Role, StaffCreatePayload, UserOut } from "@/lib/api/types";

type TabKey = "ALL" | "TRAINER" | "ADMIN";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    TRAINER: "bg-blue-50 text-blue-700 ring-1 ring-blue-700/10",
    ADMIN: "bg-purple-50 text-purple-700 ring-1 ring-purple-700/10",
    SUPERADMIN: "bg-amber-50 text-amber-700 ring-1 ring-amber-700/10",
    STUDENT: "bg-slate-50 text-slate-700 ring-1 ring-slate-700/10",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
        styles[role] ?? "bg-slate-100 text-slate-700"
      }`}
    >
      {role}
    </span>
  );
}

function StaffManagementInner() {
  const { user: currentUser } = useAuth();
  const isSuperadmin = currentUser?.roles.includes("SUPERADMIN");

  const [users, setUsers] = useState<UserOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<TabKey>("ALL");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Add Staff Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [autoPassword, setAutoPassword] = useState(true);
  const [form, setForm] = useState<StaffCreatePayload>({
    full_name: "",
    email: "",
    phone: "",
    role: "TRAINER",
    default_password: "",
  });

  // Success view (temporary credentials)
  const [createdResult, setCreatedResult] = useState<{
    user: UserOut;
    temporary_password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset Password Modal state
  const [resettingUser, setResettingUser] = useState<UserOut | null>(null);
  const [resetResult, setResetResult] = useState<{
    user: UserOut;
    temporary_password: string;
  } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetCopied, setResetCopied] = useState(false);

  // Toggle status loading state
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  // Programme picker (for trainer assignment)
  const [availablePrograms, setAvailablePrograms] = useState<
    Array<{ id: string; slug: string; code: string; title: string }>
  >([]);
  const [selectedProgramIds, setSelectedProgramIds] = useState<string[]>([]);
  const [programsLoading, setProgramsLoading] = useState(false);

  // Edit Programs modal state (for existing trainers)
  const [editingProgramsUser, setEditingProgramsUser] = useState<UserOut | null>(null);
  const [editProgramIds, setEditProgramIds] = useState<string[]>([]);
  const [editProgramsLoading, setEditProgramsLoading] = useState(false);
  const [editProgramsError, setEditProgramsError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const roleParam = activeTab === "ALL" ? undefined : activeTab;
      const list = await staffApi.list({
        role: roleParam,
        exclude_role: activeTab === "ALL" ? "STUDENT" : undefined,
        search: search.trim() || undefined,
        limit: 200,
      });
      setUsers(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load staff list");
    } finally {
      setLoading(false);
    }
  }, [activeTab, search]);

  useEffect(() => {
    void load();
  }, [load]);

  // Load available programmes once on mount
  useEffect(() => {
    setProgramsLoading(true);
    programsApi
      .list()
      .then((list) => setAvailablePrograms(list))
      .catch(() => {})
      .finally(() => setProgramsLoading(false));
  }, []);

  // Client-side filtering by status (active vs inactive)
  const filteredUsers = users.filter((u) => {
    if (statusFilter === "ACTIVE") return u.is_active;
    if (statusFilter === "INACTIVE") return !u.is_active;
    return true;
  });

  // Counts for summary cards
  const trainerCount = users.filter((u) => u.roles.includes("TRAINER") && u.is_active).length;
  const adminCount = users.filter((u) => (u.roles.includes("ADMIN") || u.roles.includes("SUPERADMIN")) && u.is_active).length;
  const pendingPasswordCount = users.filter((u) => u.must_change_password).length;

  const resetAddForm = () => {
    setShowAddModal(false);
    setCreatedResult(null);
    setAddError(null);
    setCopied(false);
    setAutoPassword(true);
    setSelectedProgramIds([]);
    setForm({
      full_name: "",
      email: "",
      phone: "",
      role: "TRAINER",
      default_password: "",
    });
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError(null);
    try {
      const payload: StaffCreatePayload = {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone?.trim() || undefined,
        role: form.role,
        default_password: autoPassword ? undefined : form.default_password?.trim() || undefined,
        program_ids: form.role === "TRAINER" && selectedProgramIds.length > 0 ? selectedProgramIds : undefined,
      };

      const result = await staffApi.create(payload);
      setCreatedResult(result);
      void load();
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : "Failed to create staff account");
    } finally {
      setAddLoading(false);
    }
  };

  const handleCopyCredentials = (email: string, pass: string, isReset = false) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const text = `KM Media Training Institute - Staff Account Details\n\nLogin URL: ${origin}/login\nEmail: ${email}\nTemporary Password: ${pass}\n\nPlease sign in and update your password immediately upon first login.`;
    navigator.clipboard.writeText(text);
    if (isReset) {
      setResetCopied(true);
      setTimeout(() => setResetCopied(false), 2500);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleToggleStatus = async (user: UserOut) => {
    if (user.id === currentUser?.id) {
      alert("You cannot deactivate your own account.");
      return;
    }
    const newStatus = !user.is_active;
    const actionLabel = newStatus ? "activate" : "deactivate";
    if (!confirm(`Are you sure you want to ${actionLabel} ${user.full_name}'s account?`)) {
      return;
    }

    setStatusBusyId(user.id);
    try {
      await staffApi.setStatus(user.id, newStatus);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: newStatus } : u))
      );
    } catch (err) {
      alert(err instanceof ApiError ? err.message : `Failed to ${actionLabel} account`);
    } finally {
      setStatusBusyId(null);
    }
  };

  const openEditProgramsModal = (user: UserOut) => {
    setEditingProgramsUser(user);
    setEditProgramIds(user.assigned_programs ? user.assigned_programs.map((p) => p.id) : []);
    setEditProgramsError(null);
  };

  const handleSavePrograms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProgramsUser) return;
    setEditProgramsLoading(true);
    setEditProgramsError(null);
    try {
      const updated = await staffApi.updatePrograms(editingProgramsUser.id, editProgramIds);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditingProgramsUser(null);
    } catch (err) {
      setEditProgramsError(err instanceof ApiError ? err.message : "Failed to update assigned programmes");
    } finally {
      setEditProgramsLoading(false);
    }
  };

  const handleResetPassword = async (user: UserOut) => {
    setResettingUser(user);
    setResetResult(null);
    setResetError(null);
    setResetCopied(false);
    setResetLoading(true);
    try {
      const res = await staffApi.resetPassword(user.id);
      setResetResult({
        user,
        temporary_password: res.temporary_password,
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, must_change_password: true } : u))
      );
    } catch (err) {
      setResetError(err instanceof ApiError ? err.message : "Failed to reset password");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Staff &amp; Trainer Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create and manage trainer and staff accounts with temporary credentials that force a password update upon first login.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Staff / Trainer
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Total Staff Accounts</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{users.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Active Trainers</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">{trainerCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Administrators</p>
          <p className="mt-1 text-2xl font-bold text-purple-600">{adminCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">First-Login Pending</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{pendingPasswordCount}</p>
        </div>
      </div>

      {/* Tabs & Search Controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 sm:border-0 gap-2">
            {(
              [
                { key: "ALL", label: "All Staff" },
                { key: "TRAINER", label: "Trainers" },
                { key: "ADMIN", label: "Administrators" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-2 sm:pb-1.5 px-3 text-sm font-medium border-b-2 transition ${
                  activeTab === tab.key
                    ? "border-indigo-600 text-indigo-600 font-semibold"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px]">
              <input
                type="text"
                placeholder="Search name, email, phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-1.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <svg
                className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active only</option>
              <option value="INACTIVE">Inactive only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Staff Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 font-medium text-slate-600">
              <tr>
                <th className="px-5 py-3.5">Staff Member</th>
                <th className="px-5 py-3.5">Roles</th>
                <th className="px-5 py-3.5">Assigned Programmes</th>
                <th className="px-5 py-3.5">Phone</th>
                <th className="px-5 py-3.5">Account Status</th>
                <th className="px-5 py-3.5">First-Login Security</th>
                <th className="px-5 py-3.5">Date Added</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                    <p className="mt-2 text-sm">Loading staff directory…</p>
                  </td>
                </tr>
              )}

              {!loading && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                    <p className="text-base font-semibold text-slate-700">No staff accounts found</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {search ? "Try adjusting your search criteria" : "Click 'Add Staff / Trainer' above to create one"}
                    </p>
                  </td>
                </tr>
              )}

              {!loading &&
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition">
                    {/* User Identity */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.full_name} avatarUrl={u.avatar_url} size={36} />
                        <div>
                          <p className="font-medium text-slate-900">{u.full_name}</p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Roles */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <RoleBadge key={r} role={r} />
                        ))}
                      </div>
                    </td>

                    {/* Assigned Programmes */}
                    <td className="px-5 py-3.5">
                      {u.roles.includes("TRAINER") ? (
                        <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                          {u.assigned_programs && u.assigned_programs.length > 0 ? (
                            <>
                              {u.assigned_programs.map((p) => (
                                <span
                                  key={p.id}
                                  className="inline-flex items-center rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-700/10"
                                  title={p.title}
                                >
                                  {p.code}
                                </span>
                              ))}
                              <button
                                onClick={() => openEditProgramsModal(u)}
                                className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 ml-1 hover:underline"
                                title="Edit assigned programmes"
                              >
                                Edit
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => openEditProgramsModal(u)}
                              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 border border-dashed border-slate-300 rounded px-2 py-0.5 hover:border-indigo-400"
                              title="Assign to one or more academic programmes"
                            >
                              <span>+</span> Assign
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Institutional</span>
                      )}
                    </td>

                    {/* Phone */}
                    <td className="px-5 py-3.5 text-slate-600">
                      {u.phone || <span className="text-slate-400">—</span>}
                    </td>

                    {/* Account Status */}
                    <td className="px-5 py-3.5">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* First Login Security */}
                    <td className="px-5 py-3.5">
                      {u.must_change_password ? (
                        <span
                          title="User must change their default password on next sign-in"
                          className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-600/20"
                        >
                          <svg className="h-3 w-3 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                          </svg>
                          Must change password
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Password active</span>
                      )}
                    </td>

                    {/* Date Added */}
                    <td className="px-5 py-3.5 text-slate-500 text-xs">
                      {formatDate(u.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right space-x-2">
                      <button
                        onClick={() => void handleResetPassword(u)}
                        disabled={resetLoading && resettingUser?.id === u.id}
                        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-1"
                        title="Generate a new temporary password and email it to the user"
                      >
                        <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Reset &amp; Email
                      </button>

                      <button
                        onClick={() => void handleToggleStatus(u)}
                        disabled={statusBusyId === u.id || u.id === currentUser?.id}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium border transition disabled:opacity-50 ${
                          u.is_active
                            ? "border-red-200 text-red-600 hover:bg-red-50"
                            : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        {statusBusyId === u.id
                          ? "Saving…"
                          : u.is_active
                          ? "Deactivate"
                          : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- ADD STAFF / TRAINER MODAL ---- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={resetAddForm}>
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Add Staff or Trainer Account</h2>
              <button
                onClick={resetAddForm}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            {createdResult ? (
              /* Success View showing temporary credentials */
              <div className="space-y-4">
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm font-semibold text-emerald-900">
                      Staff account created successfully!
                    </p>
                  </div>
                  <div className="mt-2 text-xs text-emerald-800 space-y-1">
                    <p>Name: <span className="font-semibold">{createdResult.user.full_name}</span></p>
                    <p>Email: <span className="font-semibold">{createdResult.user.email}</span></p>
                    <p>Role: <span className="font-semibold">{createdResult.user.roles.join(", ")}</span></p>
                    {createdResult.user.assigned_programs && createdResult.user.assigned_programs.length > 0 && (
                      <p>
                        Assigned Programmes:{" "}
                        <span className="font-semibold text-emerald-950">
                          {createdResult.user.assigned_programs.map((p) => `${p.title} (${p.code})`).join(", ")}
                        </span>
                      </p>
                    )}
                    <p className="pt-1 text-emerald-700 font-medium">
                      ✓ An email with these login credentials has been sent to <span className="underline">{createdResult.user.email}</span>.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                    Default Temporary Password (Share with User)
                  </p>
                  <p className="mt-2 font-mono text-xl text-amber-950 font-bold select-all bg-amber-100/70 p-2.5 rounded-lg border border-amber-200">
                    {createdResult.temporary_password}
                  </p>
                  <p className="mt-2 text-xs text-amber-700">
                    The user will be required to change this temporary password immediately upon their first login.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleCopyCredentials(createdResult.user.email, createdResult.temporary_password)}
                    className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    {copied ? "✓ Copied to clipboard!" : "Copy login details"}
                  </button>
                  <button
                    onClick={resetAddForm}
                    className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Add Form */
              <form onSubmit={handleAddStaff} className="space-y-4">
                {addError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {addError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    value={form.full_name}
                    onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g. John Mensah"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    placeholder="trainer@kmmediainstitute.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={form.phone ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      placeholder="024 000 0000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Assigned Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
                    >
                      <option value="TRAINER">Trainer / Instructor</option>
                      <option value="ADMIN">Administrator</option>
                      {isSuperadmin && <option value="SUPERADMIN">Super Administrator</option>}
                    </select>
                  </div>
                </div>

                {/* Programme Assignment (Trainer Role) */}
                {form.role === "TRAINER" && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-indigo-900">
                          Assign to Academic Programme(s)
                        </label>
                        <p className="text-[11px] text-slate-500">
                          Select the programme(s) this trainer is assigned to facilitate.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setSelectedProgramIds(availablePrograms.map((p) => p.id))}
                          className="text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
                        >
                          Select all
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedProgramIds([])}
                          className="text-slate-500 hover:text-slate-700 hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 space-y-1">
                      {programsLoading ? (
                        <p className="text-xs text-slate-400 py-3 text-center">Loading programmes…</p>
                      ) : availablePrograms.length === 0 ? (
                        <p className="text-xs text-slate-400 py-3 text-center">No programmes available.</p>
                      ) : (
                        availablePrograms.map((p) => {
                          const checked = selectedProgramIds.includes(p.id);
                          return (
                            <label
                              key={p.id}
                              className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs cursor-pointer transition ${
                                checked
                                  ? "bg-indigo-50/80 text-indigo-950 font-medium"
                                  : "hover:bg-slate-50 text-slate-700"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedProgramIds((prev) => [...prev, p.id]);
                                  } else {
                                    setSelectedProgramIds((prev) => prev.filter((id) => id !== p.id));
                                  }
                                }}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700 shrink-0">
                                {p.code}
                              </span>
                              <span className="truncate">{p.title}</span>
                            </label>
                          );
                        })
                      )}
                    </div>

                    <p className="text-[11px] text-indigo-700 font-medium">
                      {selectedProgramIds.length === 0
                        ? "Optional: No programmes selected yet."
                        : `${selectedProgramIds.length} programme(s) selected.`}
                    </p>
                  </div>
                )}

                {/* Password Configuration */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-slate-600">
                      Default Account Password
                    </span>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 font-medium">
                      <input
                        type="checkbox"
                        checked={autoPassword}
                        onChange={(e) => setAutoPassword(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Auto-generate secure temporary password
                    </label>
                  </div>

                  {!autoPassword && (
                    <div>
                      <input
                        type="text"
                        value={form.default_password ?? ""}
                        minLength={8}
                        required={!autoPassword}
                        onChange={(e) => setForm((f) => ({ ...f, default_password: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
                        placeholder="Enter default password (min 8 characters)"
                      />
                    </div>
                  )}

                  <div className="flex items-start gap-2 text-xs text-slate-500">
                    <svg className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                    </svg>
                    <span>
                      The user will be prompted to change this temporary password immediately after their first login.
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={resetAddForm}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addLoading}
                    className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {addLoading ? "Creating Account…" : "Create Staff Account"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ---- RESET PASSWORD MODAL ---- */}
      {resettingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setResettingUser(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Reset Staff Password</h2>
              <button
                onClick={() => setResettingUser(null)}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            {resetError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">
                {resetError}
              </div>
            )}

            {resetLoading && (
              <div className="py-8 text-center text-slate-500">
                <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                <p className="mt-2 text-sm">Generating new temporary password…</p>
              </div>
            )}

            {resetResult && (
              <div className="space-y-4">
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                    New Temporary Password for {resetResult.user.full_name}
                  </p>
                  <p className="mt-2 font-mono text-xl text-amber-950 font-bold select-all bg-amber-100/70 p-2.5 rounded-lg border border-amber-200">
                    {resetResult.temporary_password}
                  </p>
                  <p className="mt-2 text-xs text-amber-700">
                    The user must use this temporary password to log in and will be forced to choose a new password upon entry.
                  </p>
                  <p className="mt-1 text-xs text-emerald-700 font-medium">
                    ✓ New temporary credentials have also been emailed to {resetResult.user.email}.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleCopyCredentials(resetResult.user.email, resetResult.temporary_password, true)}
                    className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {resetCopied ? "✓ Copied!" : "Copy login details"}
                  </button>
                  <button
                    onClick={() => setResettingUser(null)}
                    className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- EDIT TRAINER PROGRAMMES MODAL ---- */}
      {editingProgramsUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setEditingProgramsUser(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Assign Programmes</h2>
                <p className="text-xs text-slate-500">
                  Update assigned programmes for <span className="font-semibold text-slate-700">{editingProgramsUser.full_name}</span>
                </p>
              </div>
              <button
                onClick={() => setEditingProgramsUser(null)}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            {editProgramsError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">
                {editProgramsError}
              </div>
            )}

            <form onSubmit={handleSavePrograms} className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Select academic programme(s):</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditProgramIds(availablePrograms.map((p) => p.id))}
                    className="text-indigo-600 hover:underline font-medium"
                  >
                    Select all
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setEditProgramIds([])}
                    className="text-slate-500 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 space-y-1">
                {availablePrograms.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No programmes available.</p>
                ) : (
                  availablePrograms.map((p) => {
                    const checked = editProgramIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs cursor-pointer transition ${
                          checked
                            ? "bg-indigo-50 text-indigo-950 font-medium"
                            : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditProgramIds((prev) => [...prev, p.id]);
                            } else {
                              setEditProgramIds((prev) => prev.filter((id) => id !== p.id));
                            }
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700 shrink-0">
                          {p.code}
                        </span>
                        <span className="truncate">{p.title}</span>
                      </label>
                    );
                  })
                )}
              </div>

              <p className="text-xs text-slate-500">
                {editProgramIds.length} programme(s) currently selected.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingProgramsUser(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editProgramsLoading}
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {editProgramsLoading ? "Saving…" : "Save Assignments"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminStaffPage() {
  return (
    <RouteGuard allowedRoles={["ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <StaffManagementInner />
      </AppShell>
    </RouteGuard>
  );
}
