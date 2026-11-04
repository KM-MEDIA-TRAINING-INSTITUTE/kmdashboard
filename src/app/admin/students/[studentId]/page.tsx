"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import {
  academicsApi,
  enrollmentsApi,
  studentsApi,
  type CampusRow,
  type EnrollmentRow,
  type IntakeRow,
  type StudentDetail,
  type StudentStatusValue,
} from "@/lib/api/students";
import { financeApi, formatMoney } from "@/lib/api/finance";

const REASON_ACTIONS = new Set(["SUSPENDED", "DEFERRED", "WITHDRAWN", "EXPELLED"]);

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-700">{value || "—"}</dd>
    </div>
  );
}

export default function StudentDetailPage() {
  const params = useParams<{ studentId: string }>();
  const studentId = params.studentId;

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Enrollment action state
  const [dialogAction, setDialogAction] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [activeEnrollmentId, setActiveEnrollmentId] = useState<string | null>(null);

  // Enroll-from-admission dialog state
  const [enrollDialog, setEnrollDialog] = useState(false);
  const [intakes, setIntakes] = useState<IntakeRow[]>([]);
  const [campuses, setCampuses] = useState<CampusRow[]>([]);
  const [enrollIntakeId, setEnrollIntakeId] = useState("");
  const [enrollCampusId, setEnrollCampusId] = useState("");

  // Credential handoff state
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [credBusy, setCredBusy] = useState(false);

  // Tuition invoicing state
  const [tuitionBusyId, setTuitionBusyId] = useState<string | null>(null);
  const [tuitionNotice, setTuitionNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [detail, enr] = await Promise.all([
        studentsApi.detail(studentId),
        enrollmentsApi.list({ student_id: studentId }),
      ]);
      setStudent(detail);
      setEnrollments(enr);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load student");
    }
  }, [studentId]);

  useEffect(() => {
    load();
  }, [load]);

  const runStudentStatus = async (status: StudentStatusValue) => {
    if (!student) return;
    if (REASON_ACTIONS.has(status) && reason.trim().length < 3) {
      setActionError("A reason (min 3 chars) is required for this action.");
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await studentsApi.changeStatus(studentId, status, reason.trim() || undefined);
      setDialogAction(null);
      setReason("");
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const runEnrollmentAction = async (enrollmentId: string, action: string) => {
    const needsReason = ["SUSPENDED", "DEFERRED", "WITHDRAWN"].includes(action);
    if (needsReason && reason.trim().length < 3) {
      setActionError("A reason (min 3 chars) is required for this action.");
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      if (action === "CONFIRM") {
        await enrollmentsApi.confirm(enrollmentId);
      } else {
        await enrollmentsApi.changeStatus(
          enrollmentId,
          action as EnrollmentRow["status"],
          reason.trim() || undefined
        );
      }
      setDialogAction(null);
      setReason("");
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const issueTuitionFor = async (enrollmentId: string) => {
    setTuitionBusyId(enrollmentId);
    setActionError(null);
    setTuitionNotice(null);
    try {
      const inv = await financeApi.issueTuition(enrollmentId);
      setTuitionNotice(
        `Tuition invoice ${inv.invoice_number} issued — ${formatMoney(inv.total_minor, inv.currency)}. The student now sees it under My finance.`
      );
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not issue tuition invoice");
    } finally {
      setTuitionBusyId(null);
    }
  };

  const openEnroll = async () => {
    setActionError(null);
    try {
      const [its, cs] = await Promise.all([academicsApi.intakes(), academicsApi.campuses()]);
      setIntakes(its.filter((i) => i.status === "OPEN" || i.status === "ACTIVE"));
      setCampuses(cs.filter((c) => c.is_active));
      setEnrollIntakeId("");
      setEnrollCampusId("");
      setEnrollDialog(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to load intakes" as string);
    }
  };

  const submitEnroll = async () => {
    if (!enrollIntakeId) {
      setActionError("Choose an intake to enroll the student into.");
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const created = await enrollmentsApi.create({
        student_id: studentId,
        intake_id: enrollIntakeId,
        campus_id: enrollCampusId || undefined,
      });
      // Activate immediately so the student can see their programme.
      await enrollmentsApi.confirm(created.id);
      setEnrollDialog(false);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Enrollment failed");
    } finally {
      setBusy(false);
    }
  };

  const issueCredentials = async () => {
    if (!student || !student.user_id) {
      setActionError("No linked LMS user account for this student.");
      return;
    }
    setCredBusy(true);
    setActionError(null);
    try {
      const res = await studentsApi.resetCredentials(student.user_id);
      setCredentials({ email: student.email ?? "", password: res.temporary_password });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not issue credentials");
    } finally {
      setCredBusy(false);
    }
  };

  if (error) {
    return (
      <RouteGuard allowedRoles={["ADMIN", "SUPERADMIN"]}>
        <AppShell>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        </AppShell>
      </RouteGuard>
    );
  }

  if (!student) {
    return (
      <RouteGuard allowedRoles={["ADMIN", "SUPERADMIN"]}>
        <AppShell>
          <p className="text-sm text-slate-400">Loading student…</p>
        </AppShell>
      </RouteGuard>
    );
  }

  const nextStudentStatuses: StudentStatusValue[] =
    student.status === "ACTIVE"
      ? ["SUSPENDED", "DEFERRED", "COMPLETED", "WITHDRAWN", "EXPELLED"]
      : student.status === "SUSPENDED" || student.status === "DEFERRED"
        ? ["ACTIVE", "WITHDRAWN", "EXPELLED"]
        : student.status === "COMPLETED"
          ? ["GRADUATED"]
          : student.status === "ADMITTED" || student.status === "ENROLLED"
            ? ["ACTIVE", "DEFERRED", "WITHDRAWN"]
            : [];

  return (
    <RouteGuard allowedRoles={["ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <div className="space-y-6">
          <a href="/admin/students" className="text-sm text-slate-500 hover:text-slate-900">
            ← All students
          </a>

          {/* Profile header */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-slate-500">{student.index_number}</p>
                <h1 className="mt-1 text-xl font-semibold text-slate-900">
                  {student.full_name ?? "Unnamed student"}
                </h1>
                <p className="mt-0.5 text-sm text-slate-500">
                  {student.program_title ?? "No programme"} · {student.campus_name ?? "No campus"}
                </p>
              </div>
              <div className="text-right">
                <span className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                  {student.status}
                </span>
                {!student.account_active && (
                  <p className="mt-1 text-xs text-red-600">Account deactivated</p>
                )}
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
              <Field label="Email" value={student.email} />
              <Field label="Phone" value={student.phone} />
              <Field label="Admission no." value={student.admission_number} />
              <Field label="Student ID" value={student.student_id} />
              <Field label="Date of birth" value={student.date_of_birth} />
              <Field label="Nationality" value={student.nationality} />
              <Field label="Address" value={student.residential_address} />
              <Field label="City / Region" value={[student.city, student.region].filter(Boolean).join(", ")} />
              <Field label="Emergency contact" value={
                student.emergency_contact_name
                  ? `${student.emergency_contact_name}${student.emergency_contact_phone ? ` · ${student.emergency_contact_phone}` : ""}`
                  : null
              } />
            </dl>
          </div>

          {/* Account access / credentials */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">LMS account access</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {student.email ?? "No email"} ·{" "}
                  {student.account_active ? "account active" : "account deactivated"}
                </p>
              </div>
              <button
                disabled={credBusy || !student.user_id}
                onClick={issueCredentials}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {credBusy ? "Working…" : "Reset & send login credentials"}
              </button>
            </div>
            {credentials && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
                <p className="font-medium text-emerald-800">
                  Temporary credentials — share these with the student now
                </p>
                <p className="mt-2 text-emerald-900">
                  <span className="font-medium">Email:</span>{" "}
                  {credentials.email || student.email || "—"}
                </p>
                <p className="text-emerald-900">
                  <span className="font-medium">Temporary password:</span>{" "}
                  <code className="rounded bg-white px-1.5 py-0.5 font-mono">
                    {credentials.password}
                  </code>
                </p>
                <p className="mt-2 text-xs text-emerald-700">
                  The student must change this on first login. Shown once — it is
                  not stored or emailed in plain text.
                </p>
                <button
                  onClick={() => setCredentials(null)}
                  className="mt-3 rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>

          {/* Status actions */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">Student status</h2>
            {actionError && (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                {actionError}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {nextStudentStatuses.length === 0 && (
                <p className="text-sm text-slate-400">No further transitions from {student.status}.</p>
              )}
              {nextStudentStatuses.map((s) => (
                <button
                  key={s}
                  disabled={busy}
                  onClick={() => {
                    setDialogAction(`student:${s}`);
                    setReason("");
                    setActionError(null);
                  }}
                  className={`rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 ${
                    s === "ACTIVE" || s === "GRADUATED"
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : s === "SUSPENDED" || s === "DEFERRED"
                        ? "border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                        : "bg-red-600 text-white hover:bg-red-700"
                  }`}
                >
                  {s === "ACTIVE" ? "Reactivate" : `Set ${s}`}
                </button>
              ))}
            </div>
          </div>

          {/* Enrollments */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">Enrollments</h2>
            {enrollments.length === 0 ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-400">
                  No enrollment yet. Enroll the student to give them access to
                  their programme.
                </p>
                {(student.status === "ADMITTED" || student.status === "ENROLLED") && (
                  <button
                    disabled={busy}
                    onClick={openEnroll}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Enroll student
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {enrollments.map((e) => (
                  <div key={e.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs text-slate-500">{e.enrollment_number}</p>
                        <p className="text-sm font-medium text-slate-900">
                          {e.program_title} · {e.intake_name}
                          {e.session_name ? ` (${e.session_name})` : ""}
                        </p>
                        <p className="text-xs text-slate-500">
                          {e.campus_name ?? "No campus"} · status {e.status}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {e.status === "PENDING" && (
                          <button
                            disabled={busy}
                            onClick={() => runEnrollmentAction(e.id, "CONFIRM")}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Confirm &amp; activate
                          </button>
                        )}
                        {e.status === "ACTIVE" && (
                          <>
                            <button
                              disabled={busy || tuitionBusyId === e.id}
                              onClick={() => issueTuitionFor(e.id)}
                              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                              {tuitionBusyId === e.id ? "Issuing…" : "Issue tuition invoice"}
                            </button>
                            {["SUSPENDED", "DEFERRED", "COMPLETED", "WITHDRAWN"].map((action) => (
                              <button
                                key={action}
                                disabled={busy}
                                onClick={() => {
                                  setActiveEnrollmentId(e.id);
                                  setDialogAction(`enrollment:${action}`);
                                  setReason("");
                                  setActionError(null);
                                }}
                                className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                                  action === "COMPLETED"
                                    ? "bg-teal-600 text-white hover:bg-teal-700"
                                    : action === "WITHDRAWN"
                                      ? "bg-red-600 text-white hover:bg-red-700"
                                      : "border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                }`}
                              >
                                {action.charAt(0) + action.slice(1).toLowerCase()}
                              </button>
                            ))}
                          </>
                        )}
                        {(e.status === "SUSPENDED" || e.status === "DEFERRED") && (
                          <button
                            disabled={busy}
                            onClick={() => runEnrollmentAction(e.id, "ACTIVE")}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {tuitionNotice && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{tuitionNotice}</div>
                )}
              </div>
            )}
          </div>

          {/* Enroll-from-admission dialog */}
          {enrollDialog && (
            <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 px-4">
              <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                <h3 className="text-base font-semibold text-slate-900">Enroll student</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {student.full_name} · {student.index_number}
                </p>

                <label htmlFor="enroll-intake" className="mt-4 block text-sm font-medium text-slate-700">
                  Intake
                </label>
                {intakes.length === 0 ? (
                  <p className="mt-1 text-sm text-amber-700">
                    No OPEN/ACTIVE intake exists. Create one under Academics →
                    Intakes first.
                  </p>
                ) : (
                  <select
                    id="enroll-intake"
                    value={enrollIntakeId}
                    onChange={(e) => setEnrollIntakeId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  >
                    <option value="">Select an intake…</option>
                    {intakes.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.status}){i.session_name ? ` · ${i.session_name}` : ""}
                      </option>
                    ))}
                  </select>
                )}

                <label htmlFor="enroll-campus" className="mt-4 block text-sm font-medium text-slate-700">
                  Campus <span className="text-slate-400">(optional)</span>
                </label>
                <select
                  id="enroll-campus"
                  value={enrollCampusId}
                  onChange={(e) => setEnrollCampusId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                >
                  <option value="">No campus</option>
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                {actionError && (
                  <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                    {actionError}
                  </p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => setEnrollDialog(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={busy || !enrollIntakeId}
                    onClick={submitEnroll}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busy ? "Working…" : "Enroll & activate"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reason / confirm dialog */}
          {dialogAction && (
            <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 px-4">
              <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                <h3 className="text-base font-semibold text-slate-900">
                  Confirm {dialogAction.split(":")[1].toLowerCase()} action
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {dialogAction.startsWith("enrollment") && activeEnrollmentId
                    ? "This changes the enrollment and the student's academic status."
                    : "This changes the student's academic status."}
                </p>
                <label htmlFor="action-reason" className="mt-4 block text-sm font-medium text-slate-700">
                  Reason
                </label>
                <textarea
                  id="action-reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  placeholder="Recorded in the audit trail"
                />
                {actionError && (
                  <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                    {actionError}
                  </p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => setDialogAction(null)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      const [kind, action] = dialogAction.split(":");
                      if (kind === "student") runStudentStatus(action as StudentStatusValue);
                      else if (activeEnrollmentId) runEnrollmentAction(activeEnrollmentId, action);
                    }}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {busy ? "Working…" : "Confirm"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </RouteGuard>
  );
}
