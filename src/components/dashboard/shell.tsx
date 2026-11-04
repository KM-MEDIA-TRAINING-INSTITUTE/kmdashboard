"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { Avatar } from "@/components/avatar";
import { NotificationCenter } from "@/components/dashboard/notification-center";
import type { SearchHit } from "@/lib/api/contracts";
import type { Role } from "@/lib/api/types";

/** Layout effect on the client (plain effect on the server — no SSR warning). */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  /** Show only when the user holds one of these roles (permission-driven nav). */
  roles?: Role[];
  /** Show only when the user holds at least one of these permission codes. */
  permission?: string;
}

export interface NavSection {
  heading?: string;
  items: NavItem[];
}

/**
 * Role-aware navigation. Sections appear only when the user holds a matching
 * role; individual links can be additionally gated by `roles`. The backend
 * remains authoritative for every action these links lead to.
 * Routes are preserved exactly; redesign only grouped + iconified entries.
 */
export const NAVIGATION: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard/student", roles: ["STUDENT"], icon: "home" },
      { label: "Dashboard", href: "/dashboard/trainer", roles: ["TRAINER"], icon: "home" },
      { label: "Dashboard", href: "/dashboard/admin", roles: ["ADMIN"], icon: "home" },
      { label: "Dashboard", href: "/dashboard/superadmin", roles: ["SUPERADMIN"], icon: "home" },
    ],
  },
  {
    heading: "Learning",
    items: [
      { label: "My Learning", href: "/student/my-learning", roles: ["STUDENT"], icon: "book" },
      { label: "My Programmes", href: "/student/courses", roles: ["STUDENT"], icon: "layers" },
      { label: "Classes", href: "/student/classes", roles: ["STUDENT"], icon: "users" },
      { label: "Calendar", href: "/student/calendar", roles: ["STUDENT"], icon: "calendar" },
      { label: "Assignments", href: "/student/assignments", roles: ["STUDENT"], icon: "clipboard" },
      { label: "Assessments", href: "/student/assessments", roles: ["STUDENT"], icon: "check" },
      { label: "Attendance", href: "/student/attendance", roles: ["STUDENT"], icon: "presence" },
      { label: "Results", href: "/student/results", roles: ["STUDENT"], icon: "award" },
    ],
  },
  {
    heading: "Teaching",
    items: [
      { label: "My Courses", href: "/trainer", roles: ["TRAINER"], icon: "book" },
      { label: "Classes", href: "/trainer/classes", roles: ["TRAINER"], icon: "users" },
      { label: "Attendance", href: "/trainer/attendance", roles: ["TRAINER"], icon: "presence" },
      { label: "Assignments", href: "/trainer/assignments", roles: ["TRAINER"], icon: "clipboard" },
      { label: "Assessments", href: "/trainer/assessments", roles: ["TRAINER"], icon: "check" },
      { label: "Gradebook", href: "/trainer/gradebook", roles: ["TRAINER"], icon: "award" },
    ],
  },
  {
    heading: "Administration",
    items: [
      { label: "Applications", href: "/admin/applications", roles: ["ADMIN"], icon: "inbox" },
      { label: "Students", href: "/admin/students", roles: ["ADMIN"], icon: "users" },
      { label: "Admissions", href: "/admin/admissions", roles: ["ADMIN"], icon: "door" },
      { label: "Programmes", href: "/admin/programs", roles: ["ADMIN", "SUPERADMIN"], icon: "layers" },
      { label: "Academic structure", href: "/admin/academics", roles: ["ADMIN"], icon: "layers" },
      { label: "Course review", href: "/admin/courses", roles: ["ADMIN"], icon: "review" },
      { label: "Curricula", href: "/admin/curricula", roles: ["ADMIN"], icon: "book" },
      { label: "Academic operations", href: "/admin/academic", roles: ["ADMIN"], icon: "calendar" },
      { label: "Finance", href: "/admin/finance", roles: ["ADMIN"], icon: "wallet" },
    ],
  },
  {
    heading: "Account",
    items: [
      { label: "My profile", href: "/profile", roles: ["STUDENT"], icon: "users" },
      { label: "My finance", href: "/student/finance", roles: ["STUDENT"], icon: "wallet" },
      { label: "Sessions", href: "/sessions", icon: "lock" },
      { label: "Notifications", href: "/dashboard/student?focus=notifications", roles: ["STUDENT"], icon: "bell" },
    ],
  },
];

function firstDashboardFor(roles: Role[]): string {
  if (roles.includes("SUPERADMIN")) return "/dashboard/superadmin";
  if (roles.includes("ADMIN")) return "/dashboard/admin";
  if (roles.includes("TRAINER")) return "/dashboard/trainer";
  return "/dashboard/student";
}

/**
 * Dependency-free iconography (stroke inherits currentColor) — 24×24 grid,
 * 1.8 stroke, round joins. Names map to NAVIGATION entries only; unknown
 * names render nothing (icon-optional by design).
 */
const ICON_PATHS: Record<string, string[]> = {
  home: ["M3 10.5 12 3l9 7.5", "M5 9.5V21h14V9.5"],
  book: ["M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5z", "M4 18.5A2.5 2.5 0 0 1 6.5 16H20"],
  layers: ["m12 3 9 5-9 5-9-5z", "m3 13 9 5 9-5", "m3 17.5 9 5 9-5"],
  users: ["M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2", "M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M21 21v-2a4 4 0 0 0-3-3.87", "M15.5 3.13a4 4 0 0 1 0 7.75"],
  calendar: ["M8 2v4M16 2v4", "M3 6h18v16H3z", "M3 10h18"],
  clipboard: ["M9 3h6v3H9z", "M15 3h4v18H5V3h4"],
  check: ["M9 12.5 11.5 15 16 9.5", "M4 5h16v16H4z"],
  presence: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7v5l3.5 2"],
  award: ["M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z", "m8.5 13-1.5 8 5-2.5L17 21l-1.5-8"],
  inbox: ["M3 12h5l2 3h4l2-3h5", "M5 5h14l2 7v7H3v-7z"],
  door: ["M4 21h16", "M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17", "M14 12h.01"],
  review: ["m9 11 2 2 4-4.5", "M5 3h14v18l-3.5-2L12 21l-3.5-2L5 21z"],
  wallet: ["M3 7h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M3 7V5a2 2 0 0 1 2-2h11", "M16 13.5h.01"],
  lock: ["M7 11V7a5 5 0 0 1 10 0v4", "M5 11h14v10H5z"],
  bell: ["M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9", "M13.7 21a2 2 0 0 1-3.4 0"],
};

function NavIcon({ name }: { name?: string }) {
  const paths = ICON_PATHS[name ?? ""];
  if (!paths) return null;
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      {paths.map((d) => (
        <path key={d} d={d} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

function SidebarNav({
  sections,
  collapsed = false,
  onNavigate,
}: {
  sections: NavSection[];
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {sections.map((section, i) => (
        <div key={i}>
          {section.heading &&
            (collapsed ? (
              <p className="mx-3 mb-2.5 border-t border-slate-100" aria-hidden="true" />
            ) : (
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {section.heading}
              </p>
            ))}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href.split("?")[0] + "/"));
              return (
                <li key={item.label + item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      collapsed ? "justify-center px-0" : ""
                    } ${
                      active
                        ? "bg-brand-50 font-medium text-brand-800"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-500"
                      />
                    )}
                    <NavIcon name={item.icon} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { analyticsApi } = await import("@/lib/api/analytics");
        const res = await analyticsApi.search(q.trim());
        setHits(res.hits);
      } catch {
        setHits([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Search"
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-500 hover:border-brand-400 hover:bg-white"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border border-slate-200 bg-white px-1 text-[10px] text-slate-400 sm:inline">⌘K</kbd>
      </button>
      {open && (
        <div role="dialog" aria-label="Search" className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search courses, students…"
            aria-label="Search query"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          {hits.length > 0 && (
            <ul className="mt-2 max-h-80 space-y-1 overflow-auto">
              {hits.map((h) => (
                <li key={h.kind + h.id}>
                  <button
                    onClick={() => {
                      setOpen(false);
                      setQ("");
                      router.push(h.link);
                    }}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-brand-50"
                  >
                    <span className="font-medium text-slate-900">{h.title}</span>
                    <span className="ml-2 text-xs uppercase tracking-wide text-slate-400">{h.kind}</span>
                    {h.subtitle && <span className="block text-xs text-slate-500">{h.subtitle}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q.trim().length >= 2 && hits.length === 0 && (
            <p className="mt-2 px-1 text-xs text-slate-400">No matches.</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Desktop sidebar collapse preference — shared across every dashboard page. */
const COLLAPSE_KEY = "km.sidebar.collapsed";

/**
 * Sidebar column content: brand block, role-filtered navigation, and a footer
 * with the user chip (menu: sessions / sign out) + collapse toggle. Rendered
 * both in the fixed desktop aside and inside the mobile drawer.
 */
function SidebarBody({
  sections,
  collapsed,
  homeHref,
  user,
  roles,
  onSignOut,
  onNavigate,
  showCollapseToggle,
  onToggleCollapse,
}: {
  sections: NavSection[];
  collapsed: boolean;
  homeHref: string;
  user: { full_name: string; email: string; avatar_url?: string | null } | null;
  roles: Role[];
  onSignOut: () => void;
  onNavigate?: () => void;
  showCollapseToggle: boolean;
  onToggleCollapse: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className={`flex items-center gap-2.5 border-b border-slate-200/80 px-4 py-4 ${collapsed ? "justify-center px-2" : ""}`}>
        <Link
          href={homeHref}
          onClick={onNavigate}
          aria-label="KM Media Training Institute — dashboard home"
          className="flex min-w-0 items-center gap-2.5"
        >
          <Image
            src="/images/logo.jpeg"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain ring-1 ring-brand-100"
          />
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold tracking-tight text-ink-900">KM Media</span>
              <span className="block truncate text-[11px] text-slate-400">Training Institute</span>
            </span>
          )}
        </Link>
      </div>

      <SidebarNav sections={sections} collapsed={collapsed} onNavigate={onNavigate} />

      {/* Footer: user chip + menu + collapse toggle */}
      <div className="relative border-t border-slate-200/80 p-3">
        {menuOpen && (
          <div role="menu" className="absolute bottom-full left-3 right-3 z-40 mb-2 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <p className="px-3 py-1.5 text-xs text-slate-400">{user?.email}</p>
            <p className="px-3 pb-2 text-xs text-slate-400">{roles.join(" · ")}</p>
            {roles.includes("STUDENT") && (
              <Link href="/profile" role="menuitem" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-100">
                My profile
              </Link>
            )}
            <Link href="/sessions" role="menuitem" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-100">
              Active sessions
            </Link>
            <button
              role="menuitem"
              onClick={onSignOut}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              Sign out
            </button>
          </div>
        )}
        <div className={`flex items-center gap-2 ${collapsed ? "flex-col" : ""}`}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            title={collapsed ? user?.full_name : undefined}
            className={`flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100 ${collapsed ? "justify-center px-0" : "flex-1"}`}
          >
            <Avatar name={user?.full_name} avatarUrl={user?.avatar_url} size={28} />
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-slate-800">{user?.full_name}</span>
                <span className="block truncate text-[11px] text-slate-400">{roles.join(" · ")}</span>
              </span>
            )}
          </button>
          {showCollapseToggle && (
            <button
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
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
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Shared shell frame — demo-style layout: full-height vertical navigation
 * sidebar on the left (collapsible to an icon rail, persisted; overlay
 * drawer below `lg`) and a main column filling the rest of the viewport
 * with its own sticky topbar (search + notifications). Used by the role
 * dashboards (DashboardShell) and workspace pages (WorkspaceShell) so the
 * chrome never changes between views. Role-filtered nav; the backend
 * remains authoritative for every action these links lead to.
 */
function ShellFrame({ pageLabel, children }: { pageLabel: string; children: ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [widthAnimated, setWidthAnimated] = useState(false);
  const roles: Role[] = user?.roles ?? [];
  const sections = NAVIGATION.map((s) => ({
    ...s,
    items: s.items.filter(
      (item) => !item.roles || item.roles.some((r) => roles.includes(r))
    ),
  })).filter((s) => s.items.length > 0);

  // Restore the persisted rail width synchronously, before paint, so a shell
  // remount never flashes the expanded sidebar; the width transition is only
  // enabled a couple of frames later, so the restore itself never animates.
  useIsomorphicLayoutEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* private mode — stay expanded */
    }
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
      try {
        window.localStorage.setItem(COLLAPSE_KEY, v ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !v;
    });
  };

  const onSignOut = async () => {
    await logout();
    router.replace("/login");
  };

  const homeHref = firstDashboardFor(roles);

  return (
    <div className="flex min-h-dvh bg-[#f6f8fb]">
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      {/* Sidebar — desktop (collapsible icon rail) */}
      <aside
        className={`sticky top-0 z-20 hidden h-dvh shrink-0 border-r border-slate-200/80 bg-white lg:block ${
          widthAnimated ? "transition-[width] duration-200" : ""
        } ${collapsed ? "w-[68px]" : "w-64"}`}
      >
        <SidebarBody
          sections={sections}
          collapsed={collapsed}
          homeHref={homeHref}
          user={user}
          roles={roles}
          onSignOut={onSignOut}
          showCollapseToggle
          onToggleCollapse={toggleCollapsed}
        />
      </aside>

      {/* Sidebar — mobile/tablet drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-ink-950/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl">
            <SidebarBody
              sections={sections}
              collapsed={false}
              homeHref={homeHref}
              user={user}
              roles={roles}
              onSignOut={onSignOut}
              onNavigate={() => setDrawerOpen(false)}
              showCollapseToggle={false}
              onToggleCollapse={toggleCollapsed}
            />
          </div>
        </div>
      )}

      {/* Main column fills the rest of the viewport */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setDrawerOpen((v) => !v)}
                aria-expanded={drawerOpen}
                aria-label="Open navigation menu"
                className="rounded-lg border border-slate-300 p-2 lg:hidden"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
                </svg>
              </button>
              <p className="truncate text-sm font-semibold tracking-tight text-ink-900">{pageLabel}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <GlobalSearch />
              <NotificationCenter />
            </div>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

export function DashboardShell({
  children,
  breadcrumbs,
  page,
  quickActions,
}: {
  children: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  page: { title: string; description?: string; meta?: string; primaryAction?: ReactNode };
  quickActions?: NavItem[];
}) {
  const { user } = useAuth();
  const greeting = user?.full_name ? user.full_name.split(" ")[0] : "";

  return (
    <ShellFrame pageLabel={page.title}>
      <main id="dashboard-main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
              {breadcrumbs.map((b, i) => (
                <li key={i} className="flex items-center gap-1">
                  {b.href ? (
                    <Link href={b.href} className="hover:text-slate-900 hover:underline">{b.label}</Link>
                  ) : (
                    <span aria-current="page" className="text-slate-700">{b.label}</span>
                  )}
                  {i < breadcrumbs.length - 1 && <span aria-hidden="true">/</span>}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{page.title}</p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-ink-900">
              {greeting ? `Good ${dayPart()}, ${greeting}` : page.title}
            </h1>
            {page.description && <p className="mt-1 text-sm text-slate-500">{page.description}</p>}
            {page.meta && <p className="mt-0.5 text-xs text-slate-400">{page.meta}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {quickActions?.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                {a.label}
              </Link>
            ))}
            {page.primaryAction}
          </div>
        </div>
        {children}
      </main>
    </ShellFrame>
  );
}

/** Workspace pages (lists, forms, detail views) — same shell, simpler header. */
export function WorkspaceShell({ title, children }: { title?: string; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <ShellFrame pageLabel={title ?? workspaceLabel(pathname)}>
      <main id="dashboard-main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </ShellFrame>
  );
}

/** "admin/students/" → "Students" — topbar context from the route. */
function workspaceLabel(pathname: string): string {
  const segs = pathname
    .split("/")
    .filter((s) => s && !s.startsWith("[") && !s.startsWith("dashboard") && !/^[0-9a-f-]{20,}$/i.test(s));
  const last = segs[segs.length - 1] ?? "";
  return last
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function dayPart(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
