"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Banknote,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  GraduationCap,
  Layers,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { RouteGuard } from "@/components/route-guard";
import { DashboardShell } from "@/components/dashboard/shell";
import {
  ActivityFeed,
  AlertBanner,
  DateRangePicker,
  DataTable,
  ErrorState,
  ExportButton,
  SectionCard,
  StatCard,
  StatusBadge,
  UpcomingList,
  formatMoney,
  formatPercent,
} from "@/components/dashboard/ui";
import { ChartCard } from "@/components/dashboard/charts";
import { useDashboard } from "@/components/dashboard/use-dashboard";
import { StaggerGrid, StaggerItem } from "@/components/ui/motion";

/**
 * Admin dashboard — "What is happening across admissions, students, training,
 * finance and operations?" Server-aware filters preserved.
 */
export function AdminDashboardPage() {
  return (
    <RouteGuard allowedRoles={["ADMIN", "SUPERADMIN"]}>
      <AdminInner />
    </RouteGuard>
  );
}

function AdminInner() {
  const [preset, setPreset] = useState("LAST_30_DAYS");
  const [custom, setCustom] = useState<{ date_from?: string; date_to?: string }>({});
  const { status, data, error, retry } = useDashboard("admin", {
    preset,
    date_from: custom.date_from,
    date_to: custom.date_to,
  });
  const loading = status === "loading";

  const onPreset = (p: string) => {
    setPreset(p);
    setCustom({});
  };
  const onCustom = (from: string, to: string) => {
    setPreset("CUSTOM");
    setCustom({ date_from: from, date_to: to });
  };

  const quick = [
    { label: "Review applications", href: "/admin/applications" },
    { label: "Students", href: "/admin/students" },
    { label: "Staff & Trainers", href: "/admin/staff" },
    { label: "Finance", href: "/admin/finance" },
  ];

  return (
    <DashboardShell
      breadcrumbs={[{ label: "Dashboard" }, { label: "Administration" }]}
      page={{
        title: "Administration",
        description: "Admissions, students, training, finance and operations at a glance.",
        meta: data
          ? `Period: ${data.date_range.preset.replace(/_/g, " ")} (${data.date_range.from} → ${data.date_range.to}) · ${data.date_range.timezone}`
          : undefined,
      }}
      quickActions={quick}
    >
      {status === "error" && (
        <ErrorState
          title="Could not load the admin dashboard"
          detail={error ?? undefined}
          onRetry={retry}
        />
      )}

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <StatCard key={i} label="" value="" loading />
          ))}
        </div>
      )}

      {status === "ready" && data && (
        <div className="space-y-6">
          {/* Server-aware date filter */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-[var(--shadow-card)]">
            <DateRangePicker
              preset={preset}
              from={custom.date_from}
              to={custom.date_to}
              onPreset={onPreset}
              onCustom={onCustom}
            />
            <ExportButton report="applications" preset={preset} label="Export applications (CSV)" />
          </div>

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

          <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StaggerItem>
              <StatCard
                label="Total students"
                value={data.summary.students_total ?? 0}
                icon={<Users className="h-4 w-4" />}
                tone="brand"
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Active students"
                value={data.summary.students_active ?? 0}
                icon={<UserCheck className="h-4 w-4" />}
                tone="good"
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Applications awaiting review"
                value={
                  (data.summary.applications?.SUBMITTED ?? 0) +
                  (data.summary.applications?.UNDER_REVIEW ?? 0) +
                  (data.summary.applications?.MORE_INFO ?? 0)
                }
                icon={<FileText className="h-4 w-4" />}
                tone={(data.summary.applications?.SUBMITTED ?? 0) > 0 ? "warn" : "default"}
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Applications in period"
                value={data.summary.applications_in_range ?? 0}
                icon={<ClipboardCheck className="h-4 w-4" />}
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Admissions in period"
                value={data.summary.admissions_in_range ?? 0}
                icon={<GraduationCap className="h-4 w-4" />}
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Active offerings"
                value={data.summary.active_offerings ?? 0}
                icon={<BookOpen className="h-4 w-4" />}
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Today's classes"
                value={data.summary.todays_sessions ?? 0}
                icon={<Calendar className="h-4 w-4" />}
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

          <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StaggerItem>
              <StatCard
                label="Billed"
                value={formatMoney(data.summary.finance?.billed_minor)}
                icon={<Wallet className="h-4 w-4" />}
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Revenue (collected)"
                value={formatMoney(data.summary.finance?.collected_minor)}
                icon={<Banknote className="h-4 w-4" />}
                tone="good"
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Outstanding"
                value={formatMoney(data.summary.finance?.outstanding_minor)}
                icon={<Clock className="h-4 w-4" />}
                tone={(data.summary.finance?.outstanding_minor ?? 0) > 0 ? "warn" : "good"}
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Overdue"
                value={formatMoney(data.summary.finance?.overdue_minor)}
                icon={<AlertTriangle className="h-4 w-4" />}
                tone={(data.summary.finance?.overdue_minor ?? 0) > 0 ? "bad" : "default"}
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="New enrollments (period)"
                value={data.summary.new_enrollments_in_range ?? 0}
                icon={<UserPlus className="h-4 w-4" />}
                tone="brand"
              />
            </StaggerItem>
          </StaggerGrid>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ChartCard
                title="Revenue trend"
                description="Verified payments bucketed in the institution timezone"
                type="area"
                series={data.charts.find((c) => c.id === "revenue_trend")?.series ?? []}
                meta={data.charts.find((c) => c.id === "revenue_trend")?.meta}
              />
            </div>
            <ChartCard
              title="Applications pipeline"
              description="Live counts by status"
              type="donut"
              series={data.charts.find((c) => c.id === "applications")?.series ?? []}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Active enrollments by programme"
              type="bar"
              series={data.charts.find((c) => c.id === "students_by_program")?.series ?? []}
            />
            {data.charts.find((c) => c.id === "payment_methods") && (
              <ChartCard
                title="Payment channels (successful)"
                type="donut"
                series={data.charts.find((c) => c.id === "payment_methods")!.series}
              />
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <SectionCard
              id="schedule"
              title="Academic schedule"
              description="Upcoming classes and intake milestones"
              icon={<Calendar className="h-4 w-4" />}
              className="lg:col-span-2"
              action={
                <a href="/admin/academic" className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline">
                  Academic operations →
                </a>
              }
            >
              <UpcomingList
                items={data.upcoming}
                emptyTitle="No upcoming sessions or intakes"
                emptyDetail="Scheduled classes and intake starts appear here."
              />
            </SectionCard>
            <SectionCard
              title="Enrollment status"
              description="All enrollments by lifecycle state"
              icon={<Layers className="h-4 w-4" />}
            >
              <DataTable<{ label: string; value: number }>
                columns={[
                  {
                    key: "label",
                    header: "Status",
                    render: (r) => <StatusBadge status={r.label.replace(/ /g, "_")} label={r.label} />,
                  },
                  {
                    key: "value",
                    header: "Enrollments",
                    render: (r) => <span className="font-semibold tabular-nums text-ink-900">{r.value}</span>,
                  },
                ]}
                rows={Object.entries(data.summary.enrollments_by_status ?? {}).map(([k, v]) => ({
                  id: k,
                  label: k.replace(/_/g, " "),
                  value: Number(v),
                }))}
                emptyTitle="No enrollments yet"
              />
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              title="Operational metrics"
              description="Grading backlog and at-risk thresholds (config-driven)"
              icon={<Activity className="h-4 w-4" />}
            >
              <dl className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                  <dt className="text-slate-600">Pending assignment grading</dt>
                  <dd className="text-lg font-bold tabular-nums text-ink-900">
                    {data.summary.pending_grading?.assignment_submissions ?? 0}
                  </dd>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                  <dt className="text-slate-600">Pending assessment grading</dt>
                  <dd className="text-lg font-bold tabular-nums text-ink-900">
                    {data.summary.pending_grading?.assessment_attempts ?? 0}
                  </dd>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                  <dt className="text-slate-600">Students below attendance threshold</dt>
                  <dd className="text-lg font-bold tabular-nums text-ink-900">
                    {data.summary.at_risk_students ?? 0}
                  </dd>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                  <dt className="text-slate-600">Average published score</dt>
                  <dd className="text-lg font-bold tabular-nums text-brand-700">
                    {formatPercent(data.summary.average_published_score)}
                  </dd>
                </div>
              </dl>
            </SectionCard>
            <SectionCard
              title="Institution activity"
              description="Recent audited actions (staff events only)"
              icon={<Clock className="h-4 w-4" />}
            >
              <ActivityFeed items={data.recent_activity} />
            </SectionCard>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
