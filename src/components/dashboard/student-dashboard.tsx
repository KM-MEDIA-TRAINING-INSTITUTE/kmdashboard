"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileCheck,
  GraduationCap,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { RouteGuard } from "@/components/route-guard";
import { DashboardShell } from "@/components/dashboard/shell";
import {
  ActivityFeed,
  AlertBanner,
  EmptyState,
  ErrorState,
  ProgressCard,
  SectionCard,
  StatCard,
  UpcomingList,
  formatMoney,
  formatPercent,
} from "@/components/dashboard/ui";
import { ChartCard } from "@/components/dashboard/charts";
import { useDashboard, useDashboardFocus } from "@/components/dashboard/use-dashboard";
import { StaggerGrid, StaggerItem } from "@/components/ui/motion";
import { studentsApi, type MyProgram } from "@/lib/api/admissions";

/**
 * Student dashboard — "What should I do next?"
 * Data: GET /api/v1/analytics/student (canonical services server-side).
 */
export function StudentDashboardPage({ children: _children }: { children?: ReactNode }) {
  return (
    <RouteGuard allowedRoles={["STUDENT", "TRAINER", "ADMIN", "SUPERADMIN"]}>
      <StudentInner />
    </RouteGuard>
  );
}

function StudentInner() {
  const { status, data, error, retry } = useDashboard("student");
  const loading = status === "loading";
  useDashboardFocus(status === "ready");

  const [prog, setProg] = useState<MyProgram | null>(null);
  useEffect(() => {
    let cancelled = false;
    studentsApi
      .myProgram()
      .then((p) => {
        if (!cancelled) setProg(p);
      })
      .catch(() => {
        /* staff viewing this page, or no admission record — strip hidden */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const quick = [
    { label: "My learning", href: "/student/my-learning" },
    { label: "Schedule", href: "/student/calendar" },
    { label: "Attendance", href: "/student/attendance" },
    { label: "Finance", href: "/student/finance" },
    { label: "Results", href: "/student/results" },
  ];

  const balance = data?.summary.finance?.balance_minor ?? 0;
  const overdue = data?.summary.assignments?.overdue ?? 0;

  return (
    <DashboardShell
      breadcrumbs={[{ label: "Dashboard" }]}
      page={{
        title: "Student dashboard",
        description: "Here's what is happening with your learning today.",
        meta: data
          ? `Period: ${data.date_range.preset.replace(/_/g, " ")} · updated ${new Date(
              data.generated_at
            ).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
          : undefined,
      }}
      quickActions={quick}
    >
      {prog && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-ink-900 via-ink-800 to-brand-900 px-6 py-5 text-white shadow-[var(--shadow-card)]">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand-300 ring-1 ring-white/15">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-300">
                Your programme
              </p>
              <p className="mt-0.5 text-lg font-bold tracking-tight text-white">
                {prog.program.title}
              </p>
              <p className="mt-0.5 text-xs text-slate-300">
                <span className="font-mono text-brand-200">{prog.index_number}</span> · Admission{" "}
                {prog.admission_number} · {String(prog.admission_status).toLowerCase()}
                {prog.enrollment_status && prog.enrollment_status !== "NONE"
                  ? ` · Enrolment: ${String(prog.enrollment_status).toLowerCase()}`
                  : ""}
              </p>
            </div>
          </div>
          <a
            href="/student"
            className="inline-flex h-9 items-center rounded-lg bg-white/10 px-4 text-xs font-semibold text-white ring-1 ring-white/20 transition-colors hover:bg-white/20"
          >
            View full programme →
          </a>
        </div>
      )}

      {status === "error" && (
        <ErrorState
          title="Could not load your dashboard"
          detail={error ?? undefined}
          onRetry={retry}
        />
      )}

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCard key={i} label="" value="" loading />
          ))}
        </div>
      )}

      {status === "ready" && data && (
        <div className="space-y-6">
          {data.alerts.length > 0 && (
            <div className="space-y-2">
              {data.alerts.map((a) => (
                <AlertBanner
                  key={a.id}
                  severity={a.severity}
                  title={a.title}
                  detail={a.detail}
                  link={a.link}
                />
              ))}
            </div>
          )}

          {/* KPIs */}
          <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StaggerItem>
              <StatCard
                label="Active courses"
                value={data.summary.active_courses ?? 0}
                icon={<BookOpen className="h-4 w-4" />}
                tone="brand"
                loading={loading}
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Overall progress"
                value={formatPercent(data.summary.overall_progress)}
                icon={<TrendingUp className="h-4 w-4" />}
                loading={loading}
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Attendance"
                value={formatPercent(data.summary.attendance_rate)}
                icon={<CheckCircle2 className="h-4 w-4" />}
                tone={
                  (data.summary.attendance_rate ?? 100) < 70
                    ? "bad"
                    : (data.summary.attendance_rate ?? 100) < 80
                      ? "warn"
                      : "good"
                }
                loading={loading}
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Outstanding balance"
                value={formatMoney(balance, data.summary.finance?.currency)}
                icon={<Wallet className="h-4 w-4" />}
                tone={balance > 0 ? "warn" : "good"}
                hint={
                  data.summary.financial_standing
                    ? String(data.summary.financial_standing).replace(/_/g, " ")
                    : undefined
                }
                loading={loading}
              />
            </StaggerItem>
          </StaggerGrid>

          {/* Continue learning */}
          <section aria-labelledby="continue-learning">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="continue-learning" className="text-base font-bold tracking-tight text-ink-900">
                Continue learning
              </h2>
              <a
                href="/student/my-learning"
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
              >
                All my learning →
              </a>
            </div>
            {data.summary.courses_progress?.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {data.summary.courses_progress.map(
                  (c: {
                    offering_id: string;
                    course_title: string;
                    progress: number;
                    lessons_completed: number;
                    lessons_total: number;
                    status: string;
                  }) => (
                    <ProgressCard
                      key={c.offering_id}
                      title={c.course_title}
                      subtitle={`Status: ${String(c.status).toLowerCase()}`}
                      percent={c.progress}
                      caption={`${c.lessons_completed}/${c.lessons_total} lessons completed`}
                      href="/student/my-learning"
                      actionLabel="Resume learning"
                    />
                  )
                )}
              </div>
            ) : (
              <EmptyState
                icon={<BookOpen className="h-5 w-5" />}
                title="No active courses yet"
                detail="Once the institute publishes your programme, your courses appear here."
              />
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SectionCard
                id="schedule"
                title="Upcoming"
                description="Today's classes, deadlines and assessment windows"
                icon={<Calendar className="h-4 w-4" />}
                action={
                  <a href="/student/calendar" className="text-xs font-semibold text-brand-600 hover:underline">
                    Full calendar →
                  </a>
                }
              >
                <UpcomingList
                  items={data.upcoming}
                  emptyTitle="No upcoming classes or deadlines"
                  emptyDetail="Your schedule is currently clear."
                />
              </SectionCard>
            </div>

            <SectionCard
              id="finance"
              title="My finance"
              description="From your official invoices"
              icon={<Wallet className="h-4 w-4" />}
              action={
                <a href="/student/finance" className="text-xs font-semibold text-brand-600 hover:underline">
                  Open finance →
                </a>
              }
            >
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Tuition billed</dt>
                  <dd className="font-semibold tabular-nums text-ink-900">
                    {formatMoney(data.summary.finance?.billed_minor, data.summary.finance?.currency)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Paid</dt>
                  <dd className="font-semibold tabular-nums text-emerald-700">
                    {formatMoney(data.summary.finance?.paid_minor, data.summary.finance?.currency)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-3">
                  <dt className="font-medium text-ink-900">Outstanding</dt>
                  <dd className="font-bold tabular-nums text-ink-900">
                    {formatMoney(data.summary.finance?.balance_minor, data.summary.finance?.currency)}
                  </dd>
                </div>
              </dl>
              {data.summary.next_installment ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 text-xs">
                  <p className="font-semibold text-amber-900">
                    Next installment:{" "}
                    {formatMoney(
                      data.summary.next_installment.balance_minor ??
                        data.summary.next_installment.amount_minor,
                      data.summary.next_installment.currency
                    )}
                  </p>
                  <p className="mt-0.5 text-amber-700">Due {data.summary.next_installment.due_date}</p>
                  <a href="/student/finance" className="mt-2 inline-block font-semibold text-amber-900 underline">
                    Make payment →
                  </a>
                </div>
              ) : (
                <p className="mt-4 text-xs text-slate-400">No installment plan on file.</p>
              )}
            </SectionCard>
          </div>

          <div id="attendance" className="grid gap-4 lg:grid-cols-3">
            {data.charts
              .filter((c) => c.type === "donut" || c.type === "progress")
              .slice(0, 3)
              .map((c) => (
                <ChartCard
                  key={c.id}
                  title={c.title}
                  description={c.description}
                  type={c.type}
                  series={c.series}
                  meta={c.meta}
                />
              ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              id="assignments"
              title="Assignments"
              description="Submissions and deadlines across your courses"
              icon={<ClipboardList className="h-4 w-4" />}
              action={
                <a href="/student/assignments" className="text-xs font-semibold text-brand-600 hover:underline">
                  Open assignments →
                </a>
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <StatCard
                  label="Due soon"
                  value={data.summary.assignments?.upcoming ?? 0}
                  tone={(data.summary.assignments?.upcoming ?? 0) > 0 ? "warn" : "default"}
                />
                <StatCard label="Overdue" value={overdue} tone={overdue > 0 ? "bad" : "good"} />
              </div>
            </SectionCard>
            <SectionCard
              id="assessments"
              title="Assessments"
              description="Windows and completion at a glance"
              icon={<FileCheck className="h-4 w-4" />}
              action={
                <a href="/student/assessments" className="text-xs font-semibold text-brand-600 hover:underline">
                  Open assessments →
                </a>
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <StatCard label="Available" value={data.summary.assessments?.available ?? 0} />
                <StatCard label="Completed" value={data.summary.assessments?.completed ?? 0} tone="good" />
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              title="Recent activity"
              description="Your learning events"
              icon={<Activity className="h-4 w-4" />}
            >
              <ActivityFeed items={data.recent_activity} />
            </SectionCard>
            <SectionCard
              title="Latest results"
              description={
                data.summary.results?.average != null
                  ? `Average ${data.summary.results.average}% across released results`
                  : "Released results appear here"
              }
              icon={<Award className="h-4 w-4" />}
              action={
                <a href="/student/results" className="text-xs font-semibold text-brand-600 hover:underline">
                  All results →
                </a>
              }
            >
              {data.summary.results?.recent?.length ? (
                <ul className="space-y-2 text-sm">
                  {data.summary.results.recent
                    .slice(0, 5)
                    .map((r: { offering_id: string; percentage: number | null; letter: string | null }, i: number) => {
                      const course = data.summary.courses_progress?.find(
                        (c: { offering_id: string }) => c.offering_id === r.offering_id
                      );
                      return (
                        <li
                          key={i}
                          className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-3.5 py-2.5"
                        >
                          <span className="truncate font-medium text-ink-800">
                            {course?.course_title ?? "Released result"}
                          </span>
                          <span className="shrink-0 font-bold tabular-nums text-brand-700">
                            {r.letter ?? "—"}
                            {r.percentage != null ? ` · ${Math.round(r.percentage)}%` : ""}
                          </span>
                        </li>
                      );
                    })}
                </ul>
              ) : (
                <EmptyState icon={<Clock className="h-4 w-4" />} title="No results released yet" />
              )}
            </SectionCard>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
