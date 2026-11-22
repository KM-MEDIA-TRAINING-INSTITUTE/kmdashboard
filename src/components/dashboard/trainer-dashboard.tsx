"use client";

import { RouteGuard } from "@/components/route-guard";
import { DashboardShell } from "@/components/dashboard/shell";
import {
  AlertBanner,
  DataTable,
  ErrorState,
  SectionCard,
  StatCard,
  StatusBadge,
  UpcomingList,
  formatPercent,
} from "@/components/dashboard/ui";
import { ChartCard } from "@/components/dashboard/charts";
import { ActivityFeed } from "@/components/dashboard/ui";
import { useDashboard, useDashboardFocus } from "@/components/dashboard/use-dashboard";
import { useAuth } from "@/components/auth-provider";

/**
 * Trainer dashboard — "What do I teach, review, grade, monitor today?"
 * Data: GET /api/v1/analytics/trainer (scope: own ACTIVE assignments only).
 */
export function TrainerDashboardPage() {
  return (
    <RouteGuard allowedRoles={["TRAINER", "ADMIN", "SUPERADMIN"]}>
      <TrainerInner />
    </RouteGuard>
  );
}

interface CourseRow {
  offering_id: string;
  course: string;
  code: string;
  status: string;
  students: number;
  attendance_rate: number | null;
  delivery_mode: string;
}

function TrainerInner() {
  const { user } = useAuth();
  const { status, data, error, retry } = useDashboard("trainer");
  const loading = status === "loading";
  // Real targets for the API's ?focus=… links (schedule, grading, attendance…).
  useDashboardFocus(status === "ready");

  const assignedPrograms =
    (data?.summary?.assigned_programs as Array<{
      id: string;
      slug: string;
      code: string;
      title: string;
      category?: string;
      certificate?: string;
      duration_weeks?: number | null;
      description?: string;
    }>) ||
    user?.assigned_programs ||
    [];

  const quick = [
    { label: "Take attendance", href: "/trainer/attendance" },
    { label: "Grade", href: "/trainer/gradebook" },
    { label: "My classes", href: "/trainer/classes" },
  ];

  const gradingQueue = data
    ? data.upcoming.filter((u) => u.kind === "grading_assignment" || u.kind === "grading_attempts")
    : [];

  const assessmentItems = data
    ? data.upcoming.filter((u) => u.kind === "assessment")
    : [];

  return (
    <DashboardShell
      breadcrumbs={[{ label: "Dashboard" }]}
      page={{
        title: "Trainer dashboard",
        description:
          assignedPrograms.length > 0
            ? `Assigned programme${assignedPrograms.length > 1 ? "s" : ""}: ${assignedPrograms.map((p) => `${p.title} (${p.code})`).join(", ")}`
            : "What to teach, review, grade and monitor today.",
        meta: data ? `Period: ${data.date_range.preset.replace(/_/g, " ")} · updated ${new Date(data.generated_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : undefined,
      }}
      quickActions={quick}
    >
      {status === "error" && <ErrorState title="Could not load your dashboard" detail={error ?? undefined} onRetry={retry} />}

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatCard key={i} label="" value="" loading />
          ))}
        </div>
      )}

      {status === "ready" && data && (
        <div className="space-y-6">
          {data.alerts.length > 0 && (
            <div className="space-y-2">
              {data.alerts.map((a) => (
                <AlertBanner key={a.id} severity={a.severity} title={a.title} detail={a.detail} link={a.link} />
              ))}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label="Assigned programmes"
              value={assignedPrograms.length}
              tone={assignedPrograms.length > 0 ? "good" : "warn"}
            />
            <StatCard label="Active courses" value={data.summary.active_courses ?? 0} />
            <StatCard label="Students" value={data.summary.students ?? 0} />
            <StatCard label="Today's classes" value={data.summary.todays_classes ?? 0} />
            <StatCard
              label="Pending grades"
              value={data.summary.pending_grading?.total ?? 0}
              tone={(data.summary.pending_grading?.total ?? 0) > 0 ? "warn" : "good"}
            />
            <StatCard
              label="Avg attendance"
              value={formatPercent(data.summary.average_attendance)}
              tone={(data.summary.average_attendance ?? 100) < 70 ? "bad" : (data.summary.average_attendance ?? 100) < 80 ? "warn" : "good"}
            />
          </div>

          {/* Assigned Academic Programmes */}
          <SectionCard
            id="programmes"
            title="My Assigned Programmes"
            description="Academic programmes you are appointed to teach and facilitate"
          >
            {assignedPrograms.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-700">No academic programmes assigned yet</p>
                <p className="mt-1 text-xs text-slate-400">
                  When an administrator assigns you to one or more academic programmes, they will appear here.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {assignedPrograms.map((p) => (
                  <div
                    key={p.id}
                    className="relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300 hover:shadow transition"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="inline-flex items-center rounded-md bg-brand-50 px-2.5 py-0.5 font-mono text-xs font-bold text-brand-700 ring-1 ring-brand-700/10">
                          {p.code}
                        </span>
                        {p.certificate && (
                          <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                            {p.certificate}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-slate-900 text-sm leading-snug">
                        {p.title}
                      </h3>
                      {p.category && (
                        <p className="mt-1 text-xs text-slate-500">{p.category}</p>
                      )}
                      {p.duration_weeks && (
                        <p className="mt-0.5 text-xs text-slate-400">
                          Duration: {p.duration_weeks} weeks
                        </p>
                      )}
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <a
                        href="/trainer"
                        className="font-medium text-brand-700 hover:text-brand-900 hover:underline"
                      >
                        Teaching courses →
                      </a>
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        Assigned
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SectionCard
                id="schedule"
                title="Today's schedule"
                description="Sessions for today across your courses"
                action={<a href="/trainer/classes" className="text-xs font-medium text-brand-700 hover:underline">All classes →</a>}
              >
                <UpcomingList
                  items={data.upcoming.filter((u) => u.kind === "class_session")}
                  emptyTitle="No sessions scheduled today"
                  emptyDetail="Your teaching schedule is clear."
                />
              </SectionCard>
            </div>
            <SectionCard
              id="grading"
              title="Grading queue"
              description="Oldest deadlines first"
              action={<a href="/trainer/gradebook" className="text-xs font-medium text-brand-700 hover:underline">Open gradebook →</a>}
            >
              {data.summary.pending_grading?.total ? (
                <ul className="space-y-2 text-sm">
                  {gradingQueue.slice(0, 6).map((g) => (
                    <li key={String(g.id)} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-medium text-slate-900">{g.title}</p>
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          {String((g as { count?: number }).count ?? "")}
                        </span>
                      </div>
                      {g.subtitle && <p className="mt-0.5 text-xs text-slate-500">{g.subtitle}</p>}
                      {g.link && (
                        <a href={g.link} className="mt-1 inline-block text-xs font-medium text-brand-700 hover:underline">
                          Review submissions →
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">Nothing awaiting grading. 🎉</p>
              )}
            </SectionCard>
          </div>

          <SectionCard
            id="courses"
            title="My courses"
            description="Roster size and pooled attendance per offering — open a course to manage its classes"
            action={<a href="/trainer" className="text-xs font-medium text-brand-700 hover:underline">Manage courses →</a>}
          >
            <DataTable<CourseRow>
              caption="Your course offerings"
              columns={[
                {
                  key: "course",
                  header: "Course",
                  render: (r) => (
                    <a
                      href={`/trainer/classes?offering=${encodeURIComponent(r.offering_id)}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {r.course}
                    </a>
                  ),
                },
                { key: "code", header: "Offering", render: (r) => <span className="font-mono text-xs text-slate-500">{r.code}</span> },
                { key: "students", header: "Students", render: (r) => r.students },
                { key: "attendance", header: "Attendance", render: (r) => formatPercent(r.attendance_rate) },
                { key: "mode", header: "Mode", hideBelow: "md", render: (r) => r.delivery_mode },
                { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
              ]}
              rows={data.summary.courses ?? []}
              emptyTitle="No assigned offerings"
              emptyDetail="Offerings assigned to you by the academic office appear here."
            />
          </SectionCard>

          <div id="attendance" className="grid gap-4 lg:grid-cols-2">
            {data.charts.slice(0, 2).map((c) => (
              <ChartCard key={c.id} title={c.title} description={c.description} type={c.type} series={c.series} meta={c.meta} />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard id="classes" title="Recent sessions" description="Attendance records per completed session">
              <ActivityFeed items={data.recent_activity} />
            </SectionCard>
            <SectionCard
              id="assessments"
              title="Assignments & assessments"
              description="Counts across your offerings"
              action={<a href="/trainer/assessments" className="text-xs font-medium text-brand-700 hover:underline">Manage assessments →</a>}
            >
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-slate-100 p-3">
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Assignments published</dt>
                  <dd className="mt-1 text-xl font-semibold">{data.summary.assignments?.published ?? 0}</dd>
                </div>
                <div className="rounded-lg border border-slate-100 p-3">
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Assessments open</dt>
                  <dd className="mt-1 text-xl font-semibold">{data.summary.assessments?.open ?? 0}</dd>
                </div>
                <div className="rounded-lg border border-slate-100 p-3">
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Assignment drafts</dt>
                  <dd className="mt-1 text-xl font-semibold">{data.summary.assignments?.draft ?? 0}</dd>
                </div>
                <div className="rounded-lg border border-slate-100 p-3">
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Assessment drafts</dt>
                  <dd className="mt-1 text-xl font-semibold">{data.summary.assessments?.draft ?? 0}</dd>
                </div>
              </dl>
              {assessmentItems.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Published &amp; open assessments
                  </p>
                  <UpcomingList
                    items={assessmentItems}
                    emptyTitle="No published assessments"
                    emptyDetail="Assessments you publish appear here with attempt counts."
                  />
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
