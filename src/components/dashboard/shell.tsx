"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Award,
  Bell,
  BookOpen,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  Clock,
  DoorOpen,
  FileCheck,
  HelpCircle,
  Home,
  Inbox,
  Layers,
  Lock,
  LogOut,
  Menu,
  Search,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Avatar } from "@/components/avatar";
import { NotificationCenter } from "@/components/dashboard/notification-center";
import { MOTION_EASE, PageTransition } from "@/components/ui/motion";
import type { SearchHit } from "@/lib/api/contracts";
import type { Role } from "@/lib/api/types";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  roles?: Role[];
  permission?: string;
}

export interface NavSection {
  heading?: string;
  items: NavItem[];
}

/**
 * Role-aware navigation. Routes and permission filters preserved exactly.
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
      { label: "Staff & Trainers", href: "/admin/staff", roles: ["ADMIN", "SUPERADMIN"], icon: "users" },
      { label: "Programmes", href: "/admin/programs", roles: ["ADMIN", "SUPERADMIN"], icon: "layers" },
      { label: "Academic structure", href: "/admin/academics", roles: ["ADMIN"], icon: "layers" },
      { label: "Course review", href: "/admin/courses", roles: ["ADMIN"], icon: "review" },
      { label: "Curricula", href: "/admin/curricula", roles: ["ADMIN"], icon: "book" },
      { label: "Academic operations", href: "/admin/academic", roles: ["ADMIN"], icon: "calendar" },
      { label: "Finance", href: "/admin/finance", roles: ["ADMIN"], icon: "wallet" },
      { label: "Notifications & SMS", href: "/admin/notifications", roles: ["ADMIN", "SUPERADMIN"], icon: "bell" },
    ],
  },
  {
    heading: "Account",
    items: [
      { label: "My profile", href: "/profile", icon: "user" },
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

function NavIcon({ name }: { name?: string }) {
  const cls = "h-4 w-4 shrink-0";
  switch (name) {
    case "home":
      return <Home className={cls} aria-hidden="true" />;
    case "book":
      return <BookOpen className={cls} aria-hidden="true" />;
    case "layers":
      return <Layers className={cls} aria-hidden="true" />;
    case "users":
      return <Users className={cls} aria-hidden="true" />;
    case "user":
      return <User className={cls} aria-hidden="true" />;
    case "calendar":
      return <Calendar className={cls} aria-hidden="true" />;
    case "clipboard":
      return <ClipboardList className={cls} aria-hidden="true" />;
    case "check":
      return <CheckSquare className={cls} aria-hidden="true" />;
    case "presence":
      return <Clock className={cls} aria-hidden="true" />;
    case "award":
      return <Award className={cls} aria-hidden="true" />;
    case "inbox":
      return <Inbox className={cls} aria-hidden="true" />;
    case "door":
      return <DoorOpen className={cls} aria-hidden="true" />;
    case "review":
      return <FileCheck className={cls} aria-hidden="true" />;
    case "wallet":
      return <Wallet className={cls} aria-hidden="true" />;
    case "lock":
      return <Lock className={cls} aria-hidden="true" />;
    case "bell":
      return <Bell className={cls} aria-hidden="true" />;
    default:
      return null;
  }
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
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (heading: string) => {
    setClosedGroups((prev) => ({ ...prev, [heading]: !prev[heading] }));
  };

  return (
    <nav aria-label="Dashboard" className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
      {sections.map((section, i) => {
        const heading = section.heading;
        const isClosed = !collapsed && heading ? Boolean(closedGroups[heading]) : false;

        return (
          <div key={heading ?? i}>
            {heading &&
              (collapsed ? (
                <div className="mx-3 mb-2.5 border-t border-slate-100" aria-hidden="true" />
              ) : (
                <button
                  type="button"
                  onClick={() => toggleGroup(heading)}
                  aria-expanded={!isClosed}
                  className="mb-1 flex w-full items-center justify-between rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 transition-colors hover:text-ink-700"
                >
                  <span>{heading}</span>
                  <ChevronDown
                    className={`h-3 w-3 transition-transform duration-200 ${
                      isClosed ? "-rotate-90" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>
              ))}

            <AnimatePresence initial={false}>
              {!isClosed && (
                <motion.ul
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18, ease: MOTION_EASE }}
                  className="space-y-0.5 overflow-hidden"
                >
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
                          className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-all duration-150 ${
                            collapsed ? "justify-center px-0" : ""
                          } ${
                            active
                              ? "bg-brand-50/90 font-semibold text-brand-800 shadow-2xs"
                              : "font-medium text-slate-600 hover:bg-slate-100/80 hover:text-ink-900"
                          }`}
                        >
                          {active && (
                            <motion.span
                              layoutId="sidebar-active-bar"
                              transition={{ duration: 0.2, ease: MOTION_EASE }}
                              aria-hidden="true"
                              className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-600"
                            />
                          )}
                          <span
                            className={`transition-colors ${
                              active ? "text-brand-600" : "text-slate-400 group-hover:text-ink-700"
                            }`}
                          >
                            <NavIcon name={item.icon} />
                          </span>
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        );
      })}
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
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Search"
        className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 text-xs font-medium text-slate-500 transition-colors hover:border-brand-300 hover:bg-white hover:text-ink-900"
      >
        <Search className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-400 sm:inline">
          ⌘K
        </kbd>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: MOTION_EASE }}
            role="dialog"
            aria-label="Search"
            className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200/90 bg-white p-3 shadow-[var(--shadow-popover)] sm:w-96"
          >
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search courses, students, programmes…"
                aria-label="Search query"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-sm text-ink-900 placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none"
              />
            </div>
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
                      className="w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-brand-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-ink-900">{h.title}</span>
                        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          {h.kind}
                        </span>
                      </div>
                      {h.subtitle && (
                        <span className="mt-0.5 block truncate text-xs text-slate-500">
                          {h.subtitle}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {q.trim().length >= 2 && hits.length === 0 && (
              <p className="mt-3 px-1 text-center text-xs text-slate-400">No matches found.</p>
            )}
            {q.trim().length < 2 && (
              <p className="mt-2.5 px-1 text-[11px] text-slate-400">
                Type at least 2 characters to search across the platform.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HelpPopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Help and support"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-ink-900"
      >
        <HelpCircle className="h-4 w-4" aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: MOTION_EASE }}
            className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-slate-200/90 bg-white p-4 shadow-[var(--shadow-popover)]"
          >
            <p className="text-sm font-semibold text-ink-900">KM Media Support</p>
            <p className="mt-1 text-xs text-slate-500">
              Learn. Create. Lead. Need help with your account, enrolment, or portal access?
            </p>
            <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-2.5 py-1.5 font-medium text-ink-800 hover:bg-brand-50 hover:text-brand-700"
              >
                Account &amp; Profile Settings
              </Link>
              <Link
                href="/sessions"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-2.5 py-1.5 font-medium text-ink-800 hover:bg-brand-50 hover:text-brand-700"
              >
                Active Security Sessions
              </Link>
              <Link
                href="/track"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-2.5 py-1.5 font-medium text-ink-800 hover:bg-brand-50 hover:text-brand-700"
              >
                Application Status Tracker
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TopbarUserMenu({
  user,
  roles,
  onSignOut,
}: {
  user: { full_name: string; email: string; avatar_url?: string | null } | null;
  roles: Role[];
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white py-1 pl-1.5 pr-2.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
      >
        <Avatar name={user?.full_name} avatarUrl={user?.avatar_url} size={26} />
        <span className="hidden max-w-[120px] truncate text-xs font-semibold text-ink-900 md:inline">
          {user?.full_name?.split(" ")[0] ?? "Account"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: MOTION_EASE }}
            role="menu"
            className="absolute right-0 z-40 mt-2 w-60 rounded-xl border border-slate-200/90 bg-white p-2 shadow-[var(--shadow-popover)]"
          >
            <div className="border-b border-slate-100 px-3 py-2">
              <p className="truncate text-sm font-semibold text-ink-900">{user?.full_name}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {roles.map((r) => (
                  <span
                    key={r}
                    className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-1 space-y-0.5">
              <Link
                href="/profile"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-ink-800 hover:bg-slate-100"
              >
                <User className="h-3.5 w-3.5 text-slate-400" />
                My profile
              </Link>
              <Link
                href="/sessions"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-ink-800 hover:bg-slate-100"
              >
                <Lock className="h-3.5 w-3.5 text-slate-400" />
                Active sessions
              </Link>
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onSignOut();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const COLLAPSE_KEY = "km.sidebar.collapsed";

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
    <div className="flex h-full flex-col bg-white">
      {/* Brand */}
      <div
        className={`flex items-center gap-2.5 border-b border-slate-200/80 px-4 py-3.5 ${
          collapsed ? "justify-center px-2" : ""
        }`}
      >
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
            className="h-9 w-9 shrink-0 rounded-xl bg-white object-contain shadow-2xs ring-1 ring-brand-200/80"
          />
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold tracking-tight text-ink-900">
                KM Media
              </span>
              <span className="block truncate text-[10px] font-medium tracking-wide text-brand-600">
                Learn. Create. Lead.
              </span>
            </span>
          )}
        </Link>
      </div>

      <SidebarNav sections={sections} collapsed={collapsed} onNavigate={onNavigate} />

      {/* Footer: user chip + menu + collapse toggle */}
      <div className="relative border-t border-slate-200/80 p-3">
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.18, ease: MOTION_EASE }}
              role="menu"
              className="absolute bottom-full left-3 right-3 z-40 mb-2 rounded-xl border border-slate-200 bg-white p-2 shadow-[var(--shadow-popover)]"
            >
              <p className="truncate px-3 py-1 text-xs font-medium text-ink-900">{user?.email}</p>
              <p className="px-3 pb-2 text-[11px] text-slate-400">{roles.join(" · ")}</p>
              <Link
                href="/profile"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2 text-xs font-medium text-ink-800 hover:bg-slate-100"
              >
                My profile
              </Link>
              <Link
                href="/sessions"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2 text-xs font-medium text-ink-800 hover:bg-slate-100"
              >
                Active sessions
              </Link>
              <button
                role="menuitem"
                onClick={onSignOut}
                className="block w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Sign out
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <div className={`flex items-center gap-2 ${collapsed ? "flex-col" : ""}`}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            title={collapsed ? user?.full_name : undefined}
            className={`flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-100 ${
              collapsed ? "justify-center px-0" : "flex-1"
            }`}
          >
            <Avatar name={user?.full_name} avatarUrl={user?.avatar_url} size={28} />
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-ink-900">
                  {user?.full_name}
                </span>
                <span className="block truncate text-[10px] font-medium text-slate-400">
                  {roles.join(" · ")}
                </span>
              </span>
            )}
          </button>
          {showCollapseToggle && (
            <button
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="shrink-0 rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-ink-900"
            >
              <ChevronLeft
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  collapsed ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

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
      <AnimatePresence>
        {drawerOpen && (
          <div
            className="fixed inset-0 z-40 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-ink-950/45 backdrop-blur-[2px]"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.24, ease: MOTION_EASE }}
              className="absolute left-0 top-0 h-full w-72 bg-white shadow-2xl"
            >
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation menu"
                className="absolute right-3 top-3.5 z-10 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink-900"
              >
                <X className="h-4 w-4" />
              </button>
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md supports-[backdrop-filter]:bg-white/80">
          <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setDrawerOpen((v) => !v)}
                aria-expanded={drawerOpen}
                aria-label="Open navigation menu"
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
              >
                <Menu className="h-4 w-4" aria-hidden="true" />
              </button>
              <p className="truncate text-sm font-semibold tracking-tight text-ink-900">
                {pageLabel}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
              <GlobalSearch />
              <NotificationCenter />
              <HelpPopover />
              <TopbarUserMenu user={user} roles={roles} onSignOut={onSignOut} />
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
      <main id="dashboard-main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <PageTransition>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="mb-2">
              <ol className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                {breadcrumbs.map((b, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    {b.href ? (
                      <Link href={b.href} className="transition-colors hover:text-brand-700">
                        {b.label}
                      </Link>
                    ) : (
                      <span aria-current="page" className="font-medium text-ink-800">
                        {b.label}
                      </span>
                    )}
                    {i < breadcrumbs.length - 1 && <span aria-hidden="true">/</span>}
                  </li>
                ))}
              </ol>
            </nav>
          )}
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">
                {page.title}
              </p>
              <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-ink-900">
                {greeting ? `Good ${dayPart()}, ${greeting}` : page.title}
              </h1>
              {page.description && (
                <p className="mt-1 text-sm text-slate-500">{page.description}</p>
              )}
              {page.meta && <p className="mt-1 text-xs text-slate-400">{page.meta}</p>}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {quickActions?.map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-ink-800 shadow-2xs transition-all hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700"
                >
                  {a.label}
                </Link>
              ))}
              {page.primaryAction}
            </div>
          </div>
          {children}
        </PageTransition>
      </main>
    </ShellFrame>
  );
}

/** Workspace pages (lists, forms, detail views) — same shell, consistent container & page transition. */
export function WorkspaceShell({ title, children }: { title?: string; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <ShellFrame pageLabel={title ?? workspaceLabel(pathname)}>
      <main id="dashboard-main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <PageTransition>{children}</PageTransition>
      </main>
    </ShellFrame>
  );
}

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
