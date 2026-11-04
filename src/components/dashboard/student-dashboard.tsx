"use client";

import { RouteGuard } from "@/components/route-guard";
import { DashboardShell } from "@/components/dashboard/shell";
import {
  AlertBanner,
  ErrorState,
  ProgressCard,
  SectionCard,
  StatCard,
  UpcomingList,
  formatMoney,
  formatPercent,
} from "@/components/dashboard/ui";
import { ChartCard } from "@/components/dashboard/charts";
import { ActivityFeed } from "@/components/dashboard/ui";
import { useDashboard, useDashboardFocus } from "@/components/dashboard/use-dashboard";
import { useEffect, useState } from "react";
import { studentsApi, type MyProgram } from "@/lib/api/admissions";
import type { ReactNode } from "react";

/**
 * Student dashboard — "What should I do next?"
 * Data: GET /api/v1/analytics/student (canonical services server-side).
 */
export function StudentDashboardPage({ children }: { children?: ReactNode }) {
  return (
    <RouteGuard allowedRoles={["STUDENT", "TRAINER", "ADMIN", "SUPERADMIN"]}>
      <StudentInner />
    </RouteGuard>
  );
}

function StudentInner() {
  const { status, data, error, retry } = useDashboard("student");
  const loading = status === "loading";
  // Make the ?focus=… links emitted by the analytics API real (scroll+flash).
  useDashboardFocus(status === "ready");

  // The programme the student was admitted into — from their admission record,
  // visible even before any course is published or they are enrolled.
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
        meta: data ? `Period: ${data.date_range.preset.replace(/_/g, " ")} · updated ${new Date(data.generated_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : undefined,
      }}
      quickActions={quick}
    >
      {prog && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-brand-700">Your programme</p>
            <p className="mt-0.5 text-base font-semibold text-slate-900">{prog.program.title}</p>
            <p className="text-xs text-slate-600">
              {prog.index_number} · Admission {prog.admission_number} · {String(prog.admission_status).toLowerCase()}
              {prog.enrollment_status && prog.enrollment_status !== "NONE" ? ` · Enrolment: ${String(prog.enrollment_status).toLowerCase()}` : ""}
            </p>
          </div>
          <a href="/student" className="text-sm font-medium text-brand-700 hover:underline">
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
          {/* Alerts — the most time-sensitive information first */}
          {data.alerts.length > 0 && (
            <div className="space-y-2">
              {data.alerts.map((a) => (
                <AlertBanner key={a.id} severity={a.severity} title={a.title} detail={a.detail} link={a.link} />
              ))}
            </div>
          )}

          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active courses" value={data.summary.active_courses ?? 0} loading={loading} />
            <StatCard label="Overall progress" value={formatPercent(data.summary.overall_progress)} loading={loading} />
            <StatCard
              label="Attendance"
              value={formatPercent(data.summary.attendance_rate)}
              tone={(data.summary.attendance_rate ?? 100) < 70 ? "bad" : (data.summary.attendance_rate ?? 100) < 80 ? "warn" : "good"}
              loading={loading}
            />
            <StatCard
              label="Outstanding balance"
              value={formatMoney(balance, data.summary.finance?.currency)}
              tone={balance > 0 ? "warn" : "good"}
              hint={data.summary.financial_standing ? String(data.summary.financial_standing).replace(/_/g, " ") : undefined}
              loading={loading}
            />
          </div>

          {/* Continue learning — the student's primary task */}
          <section aria-labelledby="continue-learning">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="continue-learning" className="text-base font-semibold text-ink-900">Continue learning</h2>
              <a href="/student/my-learning" className="text-xs font-medium text-brand-700 hover:underline">
                All my learning →
              </a>
            </div>
            {data.summary.courses_progress?.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {data.summary.courses_progress.map((c: { offering_id: string; course_title: string; progress: number; lessons_completed: number; lessons_total: number; status: string }) => (
                  <ProgressCard
                    key={c.offering_id}
                    title={c.course_title}
                    subtitle={`Status: ${String(c.status).toLowerCase()}`}
                    percent={c.progress}
                    caption={`${c.lessons_completed}/${c.lessons_total} lessons completed`}
                    href="/student/my-learning"
                    actionLabel="Resume learning"
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
                No active courses yet — once the institute publishes your programme, your courses appear here.
              </div>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Upcoming — spans 2 columns */}
            <div className="lg:col-span-2">
              <SectionCard
                id="schedule"
                title="Upcoming"
                description="Today's classes, deadlines and assessment windows"
                action={<a href="/student/calendar" className="text-xs font-medium text-brand-700 hover:underline">Full calendar →</a>}
              >
                <UpcomingList
                  items={data.upcoming}
                  emptyTitle="No upcoming classes or deadlines"
                  emptyDetail="Your schedule is currently clear."
                />
              </SectionCard>
            </div>

            {/* Finance */}
            <SectionCard
              id="finance"
              title="My finance"
              description="From your official invoices"
              action={<a href="/student/finance" className="text-xs font-medium text-brand-700 hover:underline">Open finance →</a>}
            >
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Tuition billed</dt>
                  <dd className="font-medium">{formatMoney(data.summary.finance?.billed_minor, data.summary.finance?.currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Paid</dt>
                  <dd className="font-medium text-emerald-700">{formatMoney(data.summary.finance?.paid_minor, data.summary.finance?.currency)}</dd>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2.5">
                  <dt className="text-slate-500">Outstanding</dt>
                  <dd className="font-semibold">{formatMoney(data.summary.finance?.balance_minor, data.summary.finance?.currency)}</dd>
                </div>
              </dl>
              {data.summary.next_installment ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
                  <p className="font-medium text-amber-900">
                    Next installment: {formatMoney(data.summary.next_installment.balance_minor ?? data.summary.next_installment.amount_minor, data.summary.next_installment.currency)}
                  </p>
                  <p className="text-amber-700">Due {data.summary.next_installment.due_date}</p>
                  <a href="/student/finance" className="mt-1.5 inline-block font-medium underline">
                    Make payment →
                  </a>
                </div>
              ) : (
                <p className="mt-4 text-xs text-slate-400">No installment plan on file.</p>
              )}
            </SectionCard>
          </div>

          {/* Attendance + performance charts */}
          <div id="attendance" className="grid gap-4 lg:grid-cols-3">
            {data.charts
              .filter((c) => c.type === "donut" || c.type === "progress")
              .slice(0, 3)
              .map((c) => (
                <ChartCard key={c.id} title={c.title} description={c.description} type={c.type} series={c.series} meta={c.meta} />
              ))}
          </div>

          {/* Assignments & assessments — next action made obvious, links to
              the existing workspaces (this dashboard never manages them) */}
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              id="assignments"
              title="Assignments"
              description="Submissions and deadlines across your courses"
              action={<a href="/student/assignments" className="text-xs font-medium text-brand-700 hover:underline">Open assignments →</a>}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <StatCard label="Due soon" value={data.summary.assignments?.upcoming ?? 0} tone={(data.summary.assignments?.upcoming ?? 0) > 0 ? "warn" : "default"} />
                <StatCard label="Overdue" value={overdue} tone={overdue > 0 ? "bad" : "good"} />
              </div>
            </SectionCard>
            <SectionCard
              id="assessments"
              title="Assessments"
              description="Windows and completion at a glance"
              action={<a href="/student/assessments" className="text-xs font-medium text-brand-700 hover:underline">Open assessments →</a>}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <StatCard label="Available" value={data.summary.assessments?.available ?? 0} />
                <StatCard label="Completed" value={data.summary.assessments?.completed ?? 0} tone="good" />
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Recent activity" description="Your learning events">
              <ActivityFeed items={data.recent_activity} />
            </SectionCard>
            <SectionCard
              title="Latest results"
              description={data.summary.results?.average != null ? `Average ${data.summary.results.average}% across released results` : "Released results appear here"}
              action={<a href="/student/results" className="text-xs font-medium text-brand-700 hover:underline">All results →</a>}
            >
              {data.summary.results?.recent?.length ? (
                <ul className="space-y-2 text-sm">
                  {data.summary.results.recent.slice(0, 5).map((r: { offering_id: string; percentage: number | null; letter: string | null }, i: number) => {
                    const course = data.summary.courses_progress?.find((c: { offering_id: string }) => c.offering_id === r.offering_id);
                    return (
                      <li key={i} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                        <span className="truncate text-slate-600">{course?.course_title ?? "Released result"}</span>
                        <span className="shrink-0 font-medium">{r.letter ?? "—"}{r.percentage != null ? ` · ${Math.round(r.percentage)}%` : ""}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">No results released yet.</p>
              )}
            </SectionCard>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
