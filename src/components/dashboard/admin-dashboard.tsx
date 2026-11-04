"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/route-guard";
import { DashboardShell } from "@/components/dashboard/shell";
import {
  AlertBanner,
  DateRangePicker,
  DataTable,
  ErrorState,
  ExportButton,
  SectionCard,
  StatCard,
  UpcomingList,
  formatMoney,
  formatPercent,
} from "@/components/dashboard/ui";
import { ChartCard } from "@/components/dashboard/charts";
import { ActivityFeed } from "@/components/dashboard/ui";
import { useDashboard } from "@/components/dashboard/use-dashboard";

/**
 * Admin dashboard — "What is happening across admissions, students, training,
 * finance and operations?" Server-aware filters: the date preset is sent to
 * the backend and applied to server queries (never filtered client-side).
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
    { label: "Finance", href: "/admin/finance" },
  ];

  return (
    <DashboardShell
      breadcrumbs={[{ label: "Dashboard" }, { label: "Administration" }]}
      page={{
        title: "Administration",
        description: "Admissions, students, training, finance and operations at a glance.",
        meta: data ? `Period: ${data.date_range.preset.replace(/_/g, " ")} (${data.date_range.from} → ${data.date_range.to}) · ${data.date_range.timezone}` : undefined,
      }}
      quickActions={quick}
    >
      {status === "error" && <ErrorState title="Could not load the admin dashboard" detail={error ?? undefined} onRetry={retry} />}

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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <DateRangePicker preset={preset} from={custom.date_from} to={custom.date_to} onPreset={onPreset} onCustom={onCustom} />
            <ExportButton report="applications" preset={preset} label="Export applications (CSV)" />
          </div>

          {data.alerts.length > 0 && (
            <div className="space-y-2">
              {data.alerts.map((a) => (
                <AlertBanner key={a.id} severity={a.severity} title={a.title} detail={a.detail} link={a.link} />
              ))}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total students" value={data.summary.students_total ?? 0} />
            <StatCard label="Active students" value={data.summary.students_active ?? 0} tone="good" />
            <StatCard
              label="Applications awaiting review"
              value={
                (data.summary.applications?.SUBMITTED ?? 0) +
                (data.summary.applications?.UNDER_REVIEW ?? 0) +
                (data.summary.applications?.MORE_INFO ?? 0)
              }
              tone={(data.summary.applications?.SUBMITTED ?? 0) > 0 ? "warn" : "default"}
            />
            <StatCard label="Applications in period" value={data.summary.applications_in_range ?? 0} />
            <StatCard label="Admissions in period" value={data.summary.admissions_in_range ?? 0} />
            <StatCard label="Active offerings" value={data.summary.active_offerings ?? 0} />
            <StatCard label="Today's classes" value={data.summary.todays_sessions ?? 0} />
            <StatCard
              label="Avg attendance"
              value={formatPercent(data.summary.average_attendance)}
              tone={(data.summary.average_attendance ?? 100) < 70 ? "bad" : (data.summary.average_attendance ?? 100) < 80 ? "warn" : "good"}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Billed" value={formatMoney(data.summary.finance?.billed_minor)} />
            <StatCard label="Revenue (collected)" value={formatMoney(data.summary.finance?.collected_minor)} tone="good" />
            <StatCard label="Outstanding" value={formatMoney(data.summary.finance?.outstanding_minor)} tone={(data.summary.finance?.outstanding_minor ?? 0) > 0 ? "warn" : "good"} />
            <StatCard label="Overdue" value={formatMoney(data.summary.finance?.overdue_minor)} tone={(data.summary.finance?.overdue_minor ?? 0) > 0 ? "bad" : "default"} />
            <StatCard label="New enrollments (period)" value={data.summary.new_enrollments_in_range ?? 0} />
          </div>

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
              className="lg:col-span-2"
              action={<a href="/admin/academic" className="text-xs font-medium text-brand-700 hover:underline">Academic operations →</a>}
            >
              <UpcomingList
                items={data.upcoming}
                emptyTitle="No upcoming sessions or intakes"
                emptyDetail="Scheduled classes and intake starts appear here."
              />
            </SectionCard>
            <SectionCard title="Enrollment status" description="All enrollments by lifecycle state">
              <DataTable<{ label: string; value: number }>
                columns={[
                  { key: "label", header: "Status", render: (r) => r.label },
                  { key: "value", header: "Enrollments", render: (r) => r.value },
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
            >
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                  <dt className="text-slate-600">Pending assignment grading</dt>
                  <dd className="text-lg font-semibold">{data.summary.pending_grading?.assignment_submissions ?? 0}</dd>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                  <dt className="text-slate-600">Pending assessment grading</dt>
                  <dd className="text-lg font-semibold">{data.summary.pending_grading?.assessment_attempts ?? 0}</dd>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                  <dt className="text-slate-600">Students below attendance threshold</dt>
                  <dd className="text-lg font-semibold">{data.summary.at_risk_students ?? 0}</dd>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                  <dt className="text-slate-600">Average published score</dt>
                  <dd className="text-lg font-semibold">{formatPercent(data.summary.average_published_score)}</dd>
                </div>
              </dl>
            </SectionCard>
            <SectionCard
              title="Institution activity"
              description="Recent audited actions (staff events only)"
            >
              <ActivityFeed items={data.recent_activity} />
            </SectionCard>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
