"use client";

/*
 * Dashboard template — /dashboard/demo
 *
 * A self-contained showcase of the institute's dashboard aesthetic: vertical
 * navigation sidebar on the left, main content filling the rest of the
 * viewport. Built entirely from the existing design tokens (globals.css
 * @theme: brand sea-blue, ink navy, slate neutrals, #f6f8fb canvas) and the
 * shared dashboard primitives (StatCard / ChartCard / SectionCard / DataTable
 * / UpcomingList / ProgressCard / ActivityFeed) so it stays pixel-consistent
 * with the live role dashboards.
 *
 * All figures on this page are SAMPLE content for template purposes — live
 * role dashboards read exclusively from /api/v1/analytics/*.
 */

import { useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/route-guard";
import { homeForRole, useAuth } from "@/components/auth-provider";
import {
  ActivityFeed,
  DataTable,
  ProgressCard,
  SectionCard,
  StatCard,
  StatusBadge,
  UpcomingList,
  formatMoney,
  formatPercent,
  type Column,
} from "@/components/dashboard/ui";
import { ChartCard } from "@/components/dashboard/charts";

/* ------------------------------------------------------------------ icons */
/* Same idiom as the shell: 24×24 grid, 1.8 stroke, round joins, no library. */

const ICON_PATHS: Record<string, string[]> = {
  home: ["M3 10.5 12 3l9 7.5", "M5 9.5V21h14V9.5"],
  chart: ["M4 20V10", "M10 20V4", "M16 20v-7", "M2 20h20"],
  layers: ["m12 3 9 5-9 5-9-5z", "m3 13 9 5 9-5"],
  users: ["M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2", "M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M21 21v-2a4 4 0 0 0-3-3.87"],
  wallet: ["M3 7h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M3 7V5a2 2 0 0 1 2-2h11", "M16 13.5h.01"],
  calendar: ["M8 2v4M16 2v4", "M3 6h18v16H3z", "M3 10h18"],
  clipboard: ["M9 3h6v3H9z", "M15 3h4v18H5V3h4"],
  bell: ["M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9", "M13.7 21a2 2 0 0 1-3.4 0"],
  settings: ["M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M19.4 15a1.7 1.7 0 0 0 .34 1.88l.02.02a2 2 0 1 1-2.83 2.83l-.02-.02a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.05a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.02.02a2 2 0 1 1-2.83-2.83l.02-.02a1.7 1.7 0 0 0 .34-1.88 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.05a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.02-.02a2 2 0 1 1 2.83-2.83l.02.02a1.7 1.7 0 0 0 1.88.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.05a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.02-.02a2 2 0 1 1 2.83 2.83l-.02.02a1.7 1.7 0 0 0-.34 1.88v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.05a1.7 1.7 0 0 0-1.55 1Z"],
};

function Icon({ name, className = "h-4 w-4 shrink-0" }: { name: string; className?: string }) {
  const paths = ICON_PATHS[name] ?? [];
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      {paths.map((d) => (
        <path key={d} d={d} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------- navigation */

interface DemoNav {
  label: string;
  icon: string;
  /** Sidebar links scroll to the matching section on this page (real anchors). */
  target: string;
}

const NAV_SECTIONS: { heading: string; items: DemoNav[] }[] = [
  {
    heading: "Overview",
    items: [
      { label: "Summary", icon: "home", target: "kpis" },
      { label: "Analytics", icon: "chart", target: "analytics" },
    ],
  },
  {
    heading: "Manage",
    items: [
      { label: "Courses", icon: "layers", target: "courses" },
      { label: "Schedule", icon: "calendar", target: "schedule" },
      { label: "Finance", icon: "wallet", target: "finance" },
      { label: "Activity", icon: "bell", target: "activity" },
    ],
  },
  {
    heading: "System",
    items: [{ label: "Settings", icon: "settings", target: "settings" }],
  },
];

const COLLAPSE_KEY = "km.demo.sidebar.collapsed";

/** Layout effect on the client (plain effect on the server — no SSR warning). */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/* ------------------------------------------------------------ sample data */

const KPIS = [
  { label: "Active students", value: "128", hint: "+6 this month", tone: "default" as const },
  { label: "Attendance rate", value: "86%", hint: "target 80%", tone: "good" as const },
  { label: "Outstanding fees", value: formatMoney(4_250_000), hint: "3 overdue invoices", tone: "warn" as const },
  { label: "Assignments to grade", value: 14, hint: "oldest submitted 3 days ago", tone: "default" as const },
];

interface CourseRow {
  id: string;
  course: string;
  code: string;
  students: number;
  attendance: number;
  progress: number;
  status: string;
}

const COURSES: CourseRow[] = [
  { id: "1", course: "Introduction to Broadcast Journalism", code: "BJ-101", students: 24, attendance: 91.5, progress: 62, status: "ACTIVE" },
  { id: "2", course: "Sound Engineering", code: "SE-101", students: 18, attendance: 84.0, progress: 45, status: "ACTIVE" },
  { id: "3", course: "Video Editing", code: "VE-101", students: 21, attendance: 78.5, progress: 71, status: "ACTIVE" },
  { id: "4", course: "Digital Marketing", code: "DM-101", students: 16, attendance: 88.0, progress: 30, status: "PLANNED" },
];

const ENROLMENT_TREND = [
  { label: "May", value: 8 },
  { label: "Jun", value: 12 },
  { label: "Jul", value: 9 },
  { label: "Aug", value: 17 },
  { label: "Sep", value: 23 },
  { label: "Oct", value: 19 },
];

const ATTENDANCE_MIX = [
  { label: "Present", value: 74 },
  { label: "Late", value: 18 },
  { label: "Absent", value: 21 },
  { label: "Excused", value: 7 },
];

const SCHEDULE = [
  { id: "s1", kind: "class", title: "Studio Practice — Newsroom Simulation", subtitle: "BJ-101 · Main Campus", at: { date: "2026-10-12", start: "09:00:00" }, state: "SCHEDULED", delivery_mode: "HYBRID", location: "Studio A, Main Campus", link: "#schedule" },
  { id: "s2", kind: "assignment", title: "News Package Critique", subtitle: "BJ-101 · 20 marks", at: { date: "2026-10-13", start: "23:59:00" }, state: "DUE_SOON", link: "#courses" },
  { id: "s3", kind: "assessment", title: "Broadcast Ethics Quiz", subtitle: "Quiz · 15 min · 10 marks", at: { date: "2026-10-15" }, state: "PUBLISHED", link: "#courses" },
];

const ACTIVITY = [
  { id: "a1", at: "2026-10-09T09:12:00Z", type: "enrollment", description: "New enrollment confirmed for Broadcast Journalism (SEP-2026 intake)." },
  { id: "a2", at: "2026-10-09T08:40:00Z", type: "payment", description: "Payment of GH₵ 500.00 verified against invoice INV-2026-000123." },
  { id: "a3", at: "2026-10-08T16:05:00Z", type: "grading", description: "12 submissions graded for Video Editing assignment VE-101/A2." },
  { id: "a4", at: "2026-10-08T11:20:00Z", type: "application", description: "Application APP/2026/00087 moved to UNDER_REVIEW." },
];

/* ------------------------------------------------------------------ page */

export default function DemoDashboardPage() {
  return (
    <RouteGuard allowedRoles={["ADMIN", "SUPERADMIN"]}>
      <DemoInner />
    </RouteGuard>
  );
}

function DemoInner() {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [active, setActive] = useState("kpis");
  const [widthAnimated, setWidthAnimated] = useState(false);

  // Persist the collapse preference (real, durable interaction). Restored
  // before paint via a layout effect; the width transition activates only a
  // couple of frames later so entering the page collapsed never animates.
  useIsomorphicLayoutEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);
  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setWidthAnimated(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((v) => {
      window.localStorage.setItem(COLLAPSE_KEY, v ? "0" : "1");
      return !v;
    });
  };

  const home = user ? homeForRole(user.roles) : "/login";
  const initials = (user?.full_name ?? "D").slice(0, 1).toUpperCase();

  const courseColumns: Column<CourseRow>[] = [
    {
      key: "course",
      header: "Course",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{r.course}</p>
          <p className="text-xs text-slate-400">{r.code}</p>
        </div>
      ),
    },
    { key: "students", header: "Students", render: (r) => r.students, hideBelow: "sm" },
    { key: "attendance", header: "Attendance", render: (r) => formatPercent(r.attendance) },
    {
      key: "progress",
      header: "Content delivered",
      hideBelow: "md",
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${r.course} progress ${r.progress}%`}>
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${r.progress}%` }} />
          </div>
          <span className="text-xs text-slate-500">{r.progress}%</span>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Brand block */}
      <div className={`flex items-center gap-2.5 border-b border-slate-200/80 px-4 py-4 ${collapsed ? "lg:justify-center lg:px-2" : ""}`}>
        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
          KM
        </span>
        {(!collapsed || drawerOpen) && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-ink-900">KM Media</p>
            <p className="truncate text-[11px] text-slate-400">Dashboard template</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav aria-label="Demo navigation" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.heading}>
            {(!collapsed || drawerOpen) ? (
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{section.heading}</p>
            ) : (
              <p className="mx-3 mb-2 border-t border-slate-100" aria-hidden="true" />
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = active === item.target;
                return (
                  <li key={item.target}>
                    <a
                      href={`#${item.target}`}
                      title={collapsed && !drawerOpen ? item.label : undefined}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => {
                        setActive(item.target);
                        setDrawerOpen(false);
                      }}
                      className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                        collapsed && !drawerOpen ? "lg:justify-center lg:px-0" : ""
                      } ${
                        isActive
                          ? "bg-brand-50 font-medium text-brand-800"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      {isActive && (
                        <span aria-hidden="true" className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-500" />
                      )}
                      <Icon name={item.icon} />
                      {(!collapsed || drawerOpen) && <span className="truncate">{item.label}</span>}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer: user chip + collapse toggle (desktop only) */}
      <div className="border-t border-slate-200/80 p-3">
        <div className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${collapsed && !drawerOpen ? "lg:justify-center lg:px-0" : ""}`}>
          <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">
            {initials}
          </span>
          {(!collapsed || drawerOpen) && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-800">{user?.full_name ?? "Demo user"}</p>
              <p className="truncate text-[11px] text-slate-400">{user?.roles?.join(" · ") ?? ""}</p>
            </div>
          )}
        </div>
        <div className={`mt-2 flex items-center gap-2 ${(!collapsed || drawerOpen) ? "" : "lg:flex-col"}`}>
          <Link href={home} className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-center text-xs font-medium text-slate-600 hover:bg-slate-50">
            My dashboard
          </Link>
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 lg:block"
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-3.5 w-3.5 transition-transform ${collapsed ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="m14 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-[#f6f8fb]">
      <a
        href="#demo-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      {/* Sidebar — desktop (collapsible) */}
      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 border-r border-slate-200/80 bg-white lg:block ${
          widthAnimated ? "transition-[width] duration-200" : ""
        } ${
          collapsed ? "w-[68px]" : "w-64"
        }`}
      >
        {sidebar}
      </aside>

      {/* Sidebar — mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-ink-950/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl">{sidebar}</div>
        </div>
      )}

      {/* Main column fills the rest of the viewport */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDrawerOpen(true)}
                aria-label="Open navigation menu"
                className="rounded-lg border border-slate-300 p-2 lg:hidden"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
                </svg>
              </button>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Demo — sample content</p>
                <h1 className="text-base font-bold tracking-tight text-ink-900">Institute Overview</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 sm:block">
                Period: last 30 days
              </span>
              <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800">
                {initials}
              </span>
            </div>
          </div>
        </header>

        <main id="demo-main" className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 sm:px-6">
          {/* KPI row */}
          <section id="kpis" aria-labelledby="kpis-h" className="scroll-mt-20">
            <h2 id="kpis-h" className="sr-only">Key figures</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {KPIS.map((k) => (
                <StatCard key={k.label} label={k.label} value={k.value} hint={k.hint} tone={k.tone} />
              ))}
            </div>
          </section>

          {/* Charts */}
          <section id="analytics" aria-labelledby="analytics-h" className="scroll-mt-20">
            <div className="mb-3 flex items-end justify-between gap-2">
              <div>
                <h2 id="analytics-h" className="text-sm font-semibold text-slate-900">Analytics</h2>
                <p className="mt-0.5 text-xs text-slate-500">Sample series rendered with the shared chart primitives</p>
              </div>
              <a href="#kpis" className="text-xs font-medium text-brand-700 hover:underline">Back to top ↑</a>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="New enrollments" description="Per month (sample)" type="bar" series={ENROLMENT_TREND} />
              <ChartCard title="Attendance mix" description="All marked sessions (sample)" type="donut" series={ATTENDANCE_MIX} />
            </div>
          </section>

          {/* Courses table + progress cards */}
          <section id="courses" aria-labelledby="courses-h" className="scroll-mt-20">
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <SectionCard
                  id="courses-card"
                  title="Course delivery"
                  description="Offerings with live roster counts (sample)"
                  action={<span className="text-xs font-medium text-slate-400">4 of 12 shown</span>}
                >
                  <DataTable columns={courseColumns} rows={COURSES} caption="Sample course rows — the live dashboards read from the analytics API" />
                </SectionCard>
              </div>
              <SectionCard title="Programme progress" description="Curriculum delivered to date (sample)">
                <div className="space-y-3">
                  <ProgressCard title="Broadcast Journalism" subtitle="24 students · BJ-101" percent={62} caption="31 of 50 lessons published" />
                  <ProgressCard title="Digital Marketing" subtitle="16 students · DM-101" percent={30} caption="Modules 1–3 of 10" />
                  <ProgressCard title="Sound Engineering" subtitle="18 students · SE-101" percent={45} caption="Studio hours on track" />
                </div>
              </SectionCard>
            </div>
          </section>

          {/* Schedule + finance */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section id="schedule" aria-labelledby="schedule-h" className="scroll-mt-20">
              <SectionCard title="Upcoming" description="Classes, deadlines and assessment windows (sample)">
                <UpcomingList items={SCHEDULE} />
              </SectionCard>
            </section>
            <section id="finance" aria-labelledby="finance-h" className="scroll-mt-20">
              <SectionCard title="Finance snapshot" description="Invoice position across the institute (sample)">
                <dl className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                    <dt className="text-slate-500">Billed this term</dt>
                    <dd className="font-semibold text-slate-900">{formatMoney(52_400_000)}</dd>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                    <dt className="text-slate-500">Collected</dt>
                    <dd className="font-semibold text-emerald-700">{formatMoney(48_150_000)}</dd>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                    <dt className="text-slate-500">Outstanding</dt>
                    <dd className="font-semibold text-amber-700">{formatMoney(4_250_000)}</dd>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3">
                    <dt className="text-red-700">Overdue</dt>
                    <dd className="font-semibold text-red-700">{formatMoney(960_000)}</dd>
                  </div>
                </dl>
              </SectionCard>
            </section>
          </div>

          {/* Activity + settings */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section id="activity" aria-labelledby="activity-h" className="scroll-mt-20">
              <SectionCard title="Recent activity" description="Latest events visible to your roles (sample)">
                <ActivityFeed items={ACTIVITY} />
              </SectionCard>
            </section>
            <section id="settings" aria-labelledby="settings-h" className="scroll-mt-20">
              <SectionCard title="Template notes" description="How to reuse this layout">
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
                  <li>Layout: <code className="rounded bg-slate-100 px-1 text-xs">flex min-h-dvh</code> — sticky <code className="rounded bg-slate-100 px-1 text-xs">aside</code> (w-64, collapsible to icon rail) + <code className="rounded bg-slate-100 px-1 text-xs">flex-1 min-w-0</code> main column.</li>
                  <li>Tokens: brand sea-blue <code className="rounded bg-slate-100 px-1 text-xs">brand-50…900</code>, ink navy headings, canvas <code className="rounded bg-slate-100 px-1 text-xs">#f6f8fb</code>, radius-xl cards — all from <code className="rounded bg-slate-100 px-1 text-xs">globals.css</code>.</li>
                  <li>Widgets: every card above is a shared primitive from <code className="rounded bg-slate-100 px-1 text-xs">components/dashboard/ui.tsx</code> and <code className="rounded bg-slate-100 px-1 text-xs">charts.tsx</code>.</li>
                  <li>Accessibility: skip link, landmark regions, aria-current nav, focus-visible styles, reduced-motion safe.</li>
                  <li>Mobile: sidebar becomes an overlay drawer below <code className="rounded bg-slate-100 px-1 text-xs">lg</code>; collapse preference persists in localStorage.</li>
                </ul>
              </SectionCard>
            </section>
          </div>
        </main>

        <footer className="border-t border-slate-200/80 bg-white px-6 py-3 text-center text-xs text-slate-400">
          KM Media Training Institute — dashboard template · sample data only, no live figures
        </footer>
      </div>
    </div>
  );
}
