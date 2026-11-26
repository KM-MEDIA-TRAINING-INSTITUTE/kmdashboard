"use client";

import {
  Activity,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileCheck,
  GraduationCap,
  Layers,
  Users,
} from "lucide-react";
import { RouteGuard } from "@/components/route-guard";
import { DashboardShell } from "@/components/dashboard/shell";
import {
  ActivityFeed,
  AlertBanner,
  DataTable,
  EmptyState,
  ErrorState,
  SectionCard,
  StatCard,
  StatusBadge,
  UpcomingList,
  formatPercent,
} from "@/components/dashboard/ui";
import { ChartCard } from "@/components/dashboard/charts";
import { useDashboard, useDashboardFocus } from "@/components/dashboard/use-dashboard";
import { useAuth } from "@/components/auth-provider";
import { StaggerGrid, StaggerItem } from "@/components/ui/motion";

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
        meta: data
          ? `Period: ${data.date_range.preset.replace(/_/g, " ")} · updated ${new Date(
              data.generated_at
            ).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
          : undefined,
      }}
      quickActions={quick}
    >
      {status === "error" && (
        <ErrorState
          title="Could not load your dashboard"
          detail={error ?? undefined}
          onRetry={retry}
        />
      )}

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

          <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StaggerItem>
              <StatCard
                label="Assigned programmes"
                value={assignedPrograms.length}
                icon={<GraduationCap className="h-4 w-4" />}
                tone={assignedPrograms.length > 0 ? "good" : "warn"}
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Active courses"
                value={data.summary.active_courses ?? 0}
                icon={<BookOpen className="h-4 w-4" />}
                tone="brand"
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Students"
                value={data.summary.students ?? 0}
                icon={<Users className="h-4 w-4" />}
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Today's classes"
                value={data.summary.todays_classes ?? 0}
                icon={<Calendar className="h-4 w-4" />}
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Pending grades"
                value={data.summary.pending_grading?.total ?? 0}
                icon={<ClipboardCheck className="h-4 w-4" />}
                tone={(data.summary.pending_grading?.total ?? 0) > 0 ? "warn" : "good"}
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Avg attendance"
                value={formatPercent(data.summary.average_attendance)}
                icon={<CheckCircle2 className="h-4 w-4" />}
                tone={
                  (data.summary.average_attendance ?? 100) < 70
                    ? "bad"
                    : (data.summary.average_attendance ?? 100) < 80
                      ? "warn"
                      : "good"
                }
              />
            </StaggerItem>
          </StaggerGrid>

          <SectionCard
            id="programmes"
            title="My Assigned Programmes"
            description="Academic programmes you are appointed to teach and facilitate"
            icon={<Layers className="h-4 w-4" />}
          >
            {assignedPrograms.length === 0 ? (
              <EmptyState
                icon={<Layers className="h-5 w-5" />}
                title="No academic programmes assigned yet"
                detail="When an administrator assigns you to one or more academic programmes, they will appear here."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {assignedPrograms.map((p) => (
                  <div
                    key={p.id}
                    className="group relative flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[var(--shadow-card-hover)]"
                  >
                    <div>
                      <div className="mb-2.5 flex items-center justify-between gap-2">
                        <span className="inline-flex items-center rounded-md bg-brand-50 px-2.5 py-0.5 font-mono text-xs font-bold text-brand-700 ring-1 ring-brand-600/15">
                          {p.code}
                        </span>
                        {p.certificate && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                            {p.certificate}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold leading-snug text-ink-900 group-hover:text-brand-700 transition-colors">
                        {p.title}
                      </h3>
                      {p.category && <p className="mt-1 text-xs text-slate-500">{p.category}</p>}
                      {p.duration_weeks && (
                        <p className="mt-0.5 text-xs text-slate-400">
                          Duration: {p.duration_weeks} weeks
                        </p>
                      )}
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                      <a
                        href="/trainer"
                        className="font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                      >
                        Teaching courses →
                      </a>
                      <StatusBadge status="ACTIVE" label="Assigned" />
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
                icon={<Calendar className="h-4 w-4" />}
                action={
                  <a href="/trainer/classes" className="text-xs font-semibold text-brand-600 hover:underline">
                    All classes →
                  </a>
                }
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
              icon={<Award className="h-4 w-4" />}
              action={
                <a href="/trainer/gradebook" className="text-xs font-semibold text-brand-600 hover:underline">
                  Open gradebook →
                </a>
              }
            >
              {data.summary.pending_grading?.total ? (
                <ul className="space-y-2.5 text-sm">
                  {gradingQueue.slice(0, 6).map((g) => (
                    <li
                      key={String(g.id)}
                      className="rounded-xl border border-slate-200/80 bg-white p-3.5 transition-colors hover:border-brand-200"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold text-ink-900">{g.title}</p>
                        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-800 ring-1 ring-amber-600/15">
                          {String((g as { count?: number }).count ?? "")}
                        </span>
                      </div>
                      {g.subtitle && <p className="mt-0.5 text-xs text-slate-500">{g.subtitle}</p>}
                      {g.link && (
                        <a
                          href={g.link}
                          className="mt-1.5 inline-block text-xs font-semibold text-brand-600 hover:underline"
                        >
                          Review submissions →
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                  title="All caught up"
                  detail="Nothing awaiting grading right now."
                />
              )}
            </SectionCard>
          </div>

          <SectionCard
            id="courses"
            title="My courses"
            description="Roster size and pooled attendance per offering — open a course to manage its classes"
            icon={<BookOpen className="h-4 w-4" />}
            action={
              <a href="/trainer" className="text-xs font-semibold text-brand-600 hover:underline">
                Manage courses →
              </a>
            }
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
                      className="font-semibold text-brand-700 hover:underline"
                    >
                      {r.course}
                    </a>
                  ),
                },
                {
                  key: "code",
                  header: "Offering",
                  render: (r) => <span className="font-mono text-xs text-slate-500">{r.code}</span>,
                },
                {
                  key: "students",
                  header: "Students",
                  render: (r) => <span className="tabular-nums font-medium">{r.students}</span>,
                },
                {
                  key: "attendance",
                  header: "Attendance",
                  render: (r) => (
                    <span className="tabular-nums font-medium">{formatPercent(r.attendance_rate)}</span>
                  ),
                },
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
              id="classes"
              title="Recent sessions"
              description="Attendance records per completed session"
              icon={<Activity className="h-4 w-4" />}
            >
              <ActivityFeed items={data.recent_activity} />
            </SectionCard>
            <SectionCard
              id="assessments"
              title="Assignments & assessments"
              description="Counts across your offerings"
              icon={<FileCheck className="h-4 w-4" />}
              action={
                <a href="/trainer/assessments" className="text-xs font-semibold text-brand-600 hover:underline">
                  Manage assessments →
                </a>
              }
            >
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Assignments published
                  </dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums text-ink-900">
                    {data.summary.assignments?.published ?? 0}
                  </dd>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Assessments open
                  </dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums text-ink-900">
                    {data.summary.assessments?.open ?? 0}
                  </dd>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Assignment drafts
                  </dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums text-ink-900">
                    {data.summary.assignments?.draft ?? 0}
                  </dd>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Assessment drafts
                  </dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums text-ink-900">
                    {data.summary.assessments?.draft ?? 0}
                  </dd>
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
