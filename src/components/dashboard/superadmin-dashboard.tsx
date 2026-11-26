"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  FileSpreadsheet,
  GraduationCap,
  KeyRound,
  Server,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { RouteGuard } from "@/components/route-guard";
import { DashboardShell } from "@/components/dashboard/shell";
import {
  ActivityFeed,
  AlertBanner,
  DataTable,
  ErrorState,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/dashboard/ui";
import { ChartCard } from "@/components/dashboard/charts";
import { useDashboard, useDashboardFocus } from "@/components/dashboard/use-dashboard";
import { StaggerGrid, StaggerItem } from "@/components/ui/motion";
import { api } from "@/lib/api/client";

/**
 * Superadmin dashboard — system, security and platform-wide view.
 */
export function SuperadminDashboardPage() {
  return (
    <RouteGuard allowedRoles={["SUPERADMIN"]}>
      <SuperadminInner />
    </RouteGuard>
  );
}

interface ExportAudit {
  id: string;
  at: string;
  actor: string | null;
  report: string | null;
  detail: string | null;
}

function SuperadminInner() {
  const { status, data, error, retry } = useDashboard("superadmin");
  const loading = status === "loading";
  useDashboardFocus(status === "ready");
  const [exportAudits, setExportAudits] = useState<ExportAudit[]>([]);

  useEffect(() => {
    let cancelled = false;
    api<ExportAudit[]>("/analytics/export-audits")
      .then((rows) => {
        if (!cancelled) setExportAudits(rows);
      })
      .catch(() => {
        /* panel degrades to empty state */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const health = (data?.summary.system_health ?? {}) as Record<
    string,
    { status: string; [k: string]: unknown }
  >;

  return (
    <DashboardShell
      breadcrumbs={[{ label: "Dashboard" }, { label: "System" }]}
      page={{
        title: "Superadmin",
        description: "Platform health, identity, security and configuration.",
        meta: data
          ? `Updated ${new Date(data.generated_at).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}`
          : undefined,
      }}
      quickActions={[
        { label: "Students", href: "/admin/students" },
        { label: "Finance", href: "/admin/finance" },
        { label: "Academic ops", href: "/admin/academic" },
      ]}
    >
      {status === "error" && (
        <ErrorState
          title="Could not load the system dashboard"
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
                label="Total users"
                value={data.summary.users_total ?? 0}
                icon={<Users className="h-4 w-4" />}
                tone="brand"
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Active users"
                value={data.summary.users_active ?? 0}
                icon={<UserCheck className="h-4 w-4" />}
                tone="good"
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Active sessions"
                value={data.summary.active_sessions ?? 0}
                icon={<KeyRound className="h-4 w-4" />}
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label="Students"
                value={data.summary.students_total ?? 0}
                icon={<GraduationCap className="h-4 w-4" />}
              />
            </StaggerItem>
          </StaggerGrid>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              id="health"
              title="System health"
              description="Live runtime checks — no infrastructure secrets exposed"
              icon={<Server className="h-4 w-4" />}
            >
              <dl className="space-y-2.5 text-sm">
                {Object.entries(health).map(([name, info]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-2.5"
                  >
                    <dt className="font-medium capitalize text-ink-800">{name}</dt>
                    <dd className="flex items-center gap-2">
                      {info.status !== "ok" && info.status !== "degraded" && (
                        <span className="text-xs text-red-600">{String(info.detail ?? "")}</span>
                      )}
                      <StatusBadge
                        status={info.status === "ok" ? "OK" : info.status.toUpperCase()}
                        label={info.status}
                      />
                    </dd>
                  </div>
                ))}
              </dl>
            </SectionCard>

            <SectionCard
              id="security"
              title="Security summary"
              description="Real identity signals from the last window"
              icon={<ShieldAlert className="h-4 w-4" />}
            >
              <dl className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                  <dt className="text-slate-600">Users with failed logins</dt>
                  <dd className="text-lg font-bold tabular-nums text-ink-900">
                    {data.summary.users_with_failed_logins ?? 0}
                  </dd>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                  <dt className="text-slate-600">Accounts currently locked</dt>
                  <dd className="text-lg font-bold tabular-nums text-ink-900">
                    {data.summary.locked_accounts ?? 0}
                  </dd>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                  <dt className="text-slate-600">Awaiting first password change</dt>
                  <dd className="text-lg font-bold tabular-nums text-ink-900">
                    {data.summary.must_change_password ?? 0}
                  </dd>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                  <dt className="text-slate-600">Revoked sessions</dt>
                  <dd className="text-lg font-bold tabular-nums text-ink-900">
                    {data.summary.revoked_sessions ?? 0}
                  </dd>
                </div>
              </dl>
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="New users per week"
              description="Last 12 weeks, institution timezone"
              type="line"
              series={data.charts.find((c) => c.id === "new_users")?.series ?? []}
            />
            <ChartCard
              title="Authentication events"
              description="Audit-sourced, current window"
              type="bar"
              series={data.charts.find((c) => c.id === "auth_events")?.series ?? []}
            />
          </div>

          <SectionCard
            title="Users by role"
            description="From the RBAC role table"
            icon={<ShieldCheck className="h-4 w-4" />}
          >
            <DataTable<{ label: string; value: number }>
              columns={[
                { key: "label", header: "Role", render: (r) => <StatusBadge status={r.label} /> },
                {
                  key: "value",
                  header: "Users",
                  render: (r) => <span className="font-semibold tabular-nums">{r.value}</span>,
                },
              ]}
              rows={Object.entries(data.summary.users_by_role ?? {}).map(([k, v]) => ({
                id: k,
                label: k,
                value: Number(v),
              }))}
              emptyTitle="No users yet"
            />
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              title="System activity"
              description="Audit log — latest events across the platform"
              icon={<Activity className="h-4 w-4" />}
            >
              <ActivityFeed items={data.recent_activity} />
            </SectionCard>
            <SectionCard
              title="Report exports"
              description="Audited trail of CSV exports (who, what, when)"
              icon={<FileSpreadsheet className="h-4 w-4" />}
            >
              <DataTable<ExportAudit>
                columns={[
                  {
                    key: "at",
                    header: "When",
                    render: (r) =>
                      new Date(r.at).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                  },
                  { key: "actor", header: "Who", render: (r) => r.actor ?? "—" },
                  { key: "report", header: "Report", render: (r) => r.report ?? "—" },
                ]}
                rows={exportAudits}
                emptyTitle="No exports recorded"
                emptyDetail="Every CSV export is audited here."
              />
            </SectionCard>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
