"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, GraduationCap, KeyRound, ShieldCheck, User } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ErrorState, LoadingSkeleton, SectionCard, StatusBadge } from "@/components/dashboard/ui";
import { AnimatedModal } from "@/components/ui/motion";
import { Button, Tabs } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
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
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-ink-900">{value || "—"}</dd>
    </div>
  );
}

export default function StudentDetailPage() {
  const params = useParams<{ studentId: string }>();
  const studentId = params.studentId;
  const toast = useToast();

  const [tab, setTab] = useState<"overview" | "enrollments" | "access">("overview");
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [dialogAction, setDialogAction] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [activeEnrollmentId, setActiveEnrollmentId] = useState<string | null>(null);

  const [enrollDialog, setEnrollDialog] = useState(false);
  const [intakes, setIntakes] = useState<IntakeRow[]>([]);
  const [campuses, setCampuses] = useState<CampusRow[]>([]);
  const [enrollIntakeId, setEnrollIntakeId] = useState("");
  const [enrollCampusId, setEnrollCampusId] = useState("");

  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [credBusy, setCredBusy] = useState(false);

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
      toast.success("Student status updated", `Status set to ${status}`);
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
      toast.success("Enrolment updated");
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
      const msg = `Tuition invoice ${inv.invoice_number} issued — ${formatMoney(inv.total_minor, inv.currency)}. The student now sees it under My finance.`;
      setTuitionNotice(msg);
      toast.success("Tuition invoice issued", inv.invoice_number);
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
      setActionError(err instanceof ApiError ? err.message : ("Failed to load intakes" as string));
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
      await enrollmentsApi.confirm(created.id);
      setEnrollDialog(false);
      toast.success("Student enrolled and activated");
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
      toast.success("Temporary credentials issued");
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
          <ErrorState title="Could not load student" detail={error} onRetry={load} />
        </AppShell>
      </RouteGuard>
    );
  }

  if (!student) {
    return (
      <RouteGuard allowedRoles={["ADMIN", "SUPERADMIN"]}>
        <AppShell>
          <LoadingSkeleton rows={5} />
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
          <Link
            href="/admin/students"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-brand-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            All students
          </Link>

          {/* Profile header */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs font-semibold text-brand-600">
                  {student.index_number}
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">
                  {student.full_name ?? "Unnamed student"}
                </h1>
                <p className="mt-0.5 text-sm text-slate-500">
                  {student.program_title ?? "No programme"} · {student.campus_name ?? "No campus"}
                </p>
              </div>
              <div className="text-right">
                <StatusBadge status={student.status} />
                {!student.account_active && (
                  <p className="mt-1.5 text-xs font-medium text-red-600">Account deactivated</p>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <Tabs
                layoutId="student-detail-tabs"
                active={tab}
                onChange={setTab}
                tabs={[
                  { id: "overview", label: "Overview & Personal Info", icon: <User className="h-3.5 w-3.5" /> },
                  {
                    id: "enrollments",
                    label: "Academic & Enrolments",
                    count: enrollments.length,
                    icon: <GraduationCap className="h-3.5 w-3.5" />,
                  },
                  { id: "access", label: "Account & Status", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
                ]}
              />
            </div>
          </div>

          {tab === "overview" && (
            <SectionCard title="Personal & Admission Details" description="Canonical student record">
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Email" value={student.email} />
                <Field label="Phone" value={student.phone} />
                <Field label="Admission no." value={student.admission_number} />
                <Field label="Student ID" value={student.student_id} />
                <Field label="Date of birth" value={student.date_of_birth} />
                <Field label="Nationality" value={student.nationality} />
                <Field label="Address" value={student.residential_address} />
                <Field
                  label="City / Region"
                  value={[student.city, student.region].filter(Boolean).join(", ")}
                />
                <Field
                  label="Emergency contact"
                  value={
                    student.emergency_contact_name
                      ? `${student.emergency_contact_name}${
                          student.emergency_contact_phone ? ` · ${student.emergency_contact_phone}` : ""
                        }`
                      : null
                  }
                />
              </dl>
            </SectionCard>
          )}

          {tab === "enrollments" && (
            <SectionCard
              title="Enrolments"
              description="Programme enrolments, status transitions, and tuition invoicing"
              icon={<GraduationCap className="h-4 w-4" />}
            >
              {enrollments.length === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <p className="text-sm text-slate-500">
                    No enrolment yet. Enrol the student to give them access to their programme.
                  </p>
                  {(student.status === "ADMITTED" || student.status === "ENROLLED") && (
                    <Button variant="primary" disabled={busy} onClick={openEnroll}>
                      Enroll student
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {enrollments.map((e) => (
                    <div
                      key={e.id}
                      className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs text-slate-500">{e.enrollment_number}</p>
                          <p className="text-sm font-semibold text-ink-900">
                            {e.program_title} · {e.intake_name}
                            {e.session_name ? ` (${e.session_name})` : ""}
                          </p>
                          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                            <span>{e.campus_name ?? "No campus"}</span>
                            <StatusBadge status={e.status} />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {e.status === "PENDING" && (
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={busy}
                              onClick={() => runEnrollmentAction(e.id, "CONFIRM")}
                            >
                              Confirm &amp; activate
                            </Button>
                          )}
                          {e.status === "ACTIVE" && (
                            <>
                              <Button
                                size="sm"
                                variant="primary"
                                loading={tuitionBusyId === e.id}
                                disabled={busy}
                                onClick={() => issueTuitionFor(e.id)}
                              >
                                {tuitionBusyId === e.id ? "Issuing…" : "Issue tuition invoice"}
                              </Button>
                              {["SUSPENDED", "DEFERRED", "COMPLETED", "WITHDRAWN"].map((action) => (
                                <Button
                                  key={action}
                                  size="sm"
                                  variant={action === "WITHDRAWN" ? "danger" : "outline"}
                                  disabled={busy}
                                  onClick={() => {
                                    setActiveEnrollmentId(e.id);
                                    setDialogAction(`enrollment:${action}`);
                                    setReason("");
                                    setActionError(null);
                                  }}
                                >
                                  {action.charAt(0) + action.slice(1).toLowerCase()}
                                </Button>
                              ))}
                            </>
                          )}
                          {(e.status === "SUSPENDED" || e.status === "DEFERRED") && (
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={busy}
                              onClick={() => runEnrollmentAction(e.id, "ACTIVE")}
                            >
                              Reactivate
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {tuitionNotice && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
                      {tuitionNotice}
                    </div>
                  )}
                </div>
              )}
            </SectionCard>
          )}

          {tab === "access" && (
            <div className="space-y-6">
              <SectionCard
                title="LMS Account Access"
                description={`${student.email ?? "No email"} · ${
                  student.account_active ? "account active" : "account deactivated"
                }`}
                icon={<KeyRound className="h-4 w-4" />}
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={credBusy}
                    disabled={!student.user_id}
                    onClick={issueCredentials}
                  >
                    Reset &amp; send login credentials
                  </Button>
                }
              >
                {credentials ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
                    <p className="font-semibold text-emerald-900">
                      Temporary credentials — share these with the student now
                    </p>
                    <p className="mt-2 text-emerald-900">
                      <span className="font-medium">Email:</span>{" "}
                      {credentials.email || student.email || "—"}
                    </p>
                    <p className="text-emerald-900">
                      <span className="font-medium">Temporary password:</span>{" "}
                      <code className="rounded bg-white px-2 py-0.5 font-mono font-semibold">
                        {credentials.password}
                      </code>
                    </p>
                    <p className="mt-2 text-xs text-emerald-700">
                      Credentials have also been sent via email. The student must change their password on first login.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => setCredentials(null)}
                    >
                      Dismiss
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Use the button above to issue a fresh temporary password and email it to the student.
                  </p>
                )}
              </SectionCard>

              <SectionCard
                title="Student Lifecycle Status"
                description="Transition the student's academic standing (recorded in the audit trail)"
              >
                {actionError && (
                  <p className="mb-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700">
                    {actionError}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {nextStudentStatuses.length === 0 && (
                    <p className="text-sm text-slate-400">No further transitions from {student.status}.</p>
                  )}
                  {nextStudentStatuses.map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={
                        s === "ACTIVE" || s === "GRADUATED"
                          ? "primary"
                          : s === "SUSPENDED" || s === "DEFERRED"
                            ? "outline"
                            : "danger"
                      }
                      disabled={busy}
                      onClick={() => {
                        setDialogAction(`student:${s}`);
                        setReason("");
                        setActionError(null);
                      }}
                    >
                      {s === "ACTIVE" ? "Reactivate" : `Set ${s}`}
                    </Button>
                  ))}
                </div>
              </SectionCard>
            </div>
          )}

          {/* Enroll-from-admission dialog */}
          <AnimatedModal open={enrollDialog} onClose={() => setEnrollDialog(false)} maxWidth="max-w-md">
            <h3 className="text-base font-bold text-ink-900">Enroll student</h3>
            <p className="mt-1 text-xs text-slate-500">
              {student.full_name} · {student.index_number}
            </p>

            <label htmlFor="enroll-intake" className="mt-4 block text-xs font-semibold text-ink-800">
              Intake
            </label>
            {intakes.length === 0 ? (
              <p className="mt-1 text-xs text-amber-700">
                No OPEN/ACTIVE intake exists. Create one under Academics → Intakes first.
              </p>
            ) : (
              <select
                id="enroll-intake"
                value={enrollIntakeId}
                onChange={(e) => setEnrollIntakeId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              >
                <option value="">Select an intake…</option>
                {intakes.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.status}){i.session_name ? ` · ${i.session_name}` : ""}
                  </option>
                ))}
              </select>
            )}

            <label htmlFor="enroll-campus" className="mt-4 block text-xs font-semibold text-ink-800">
              Campus <span className="text-slate-400">(optional)</span>
            </label>
            <select
              id="enroll-campus"
              value={enrollCampusId}
              onChange={(e) => setEnrollCampusId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            >
              <option value="">No campus</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {actionError && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                {actionError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEnrollDialog(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={busy} disabled={!enrollIntakeId} onClick={submitEnroll}>
                Enroll &amp; activate
              </Button>
            </div>
          </AnimatedModal>

          {/* Reason / confirm dialog */}
          <AnimatedModal open={Boolean(dialogAction)} onClose={() => setDialogAction(null)} maxWidth="max-w-md">
            <h3 className="text-base font-bold text-ink-900">
              Confirm {dialogAction?.split(":")[1].toLowerCase()} action
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {dialogAction?.startsWith("enrollment") && activeEnrollmentId
                ? "This changes the enrolment and the student's academic status."
                : "This changes the student's academic status."}
            </p>
            <label htmlFor="action-reason" className="mt-4 block text-xs font-semibold text-ink-800">
              Reason
            </label>
            <textarea
              id="action-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              placeholder="Recorded in the audit trail"
            />
            {actionError && (
              <p className="mt-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                {actionError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogAction(null)}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                loading={busy}
                onClick={() => {
                  if (!dialogAction) return;
                  const [kind, action] = dialogAction.split(":");
                  if (kind === "student") runStudentStatus(action as StudentStatusValue);
                  else if (activeEnrollmentId) runEnrollmentAction(activeEnrollmentId, action);
                }}
              >
                Confirm
              </Button>
            </div>
          </AnimatedModal>
        </div>
      </AppShell>
    </RouteGuard>
  );
}
