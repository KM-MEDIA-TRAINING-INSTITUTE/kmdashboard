"use client";

import { useState, type ReactNode } from "react";
import {
  AlertCircle,
  Calendar,
  Download,
  Inbox,
  MapPin,
  RefreshCw,
  Video,
} from "lucide-react";
import { AnimatedCounter, AnimatedModal } from "@/components/ui/motion";

/* ------------------------------------------------------------ primitives */

export function SectionCard({
  title,
  description,
  action,
  icon,
  children,
  className = "",
  id,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  /** DOM id — used as the target for ?focus=… deep links from the API. */
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-20 rounded-xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-card)] transition-shadow duration-200 ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          {icon && (
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              {icon}
            </div>
          )}
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-ink-900">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-xs text-slate-500">{description}</p>
            )}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  delta,
  icon,
  tone = "default",
  loading = false,
}: {
  label: string;
  value: string | number | null | undefined;
  hint?: string;
  delta?: string;
  icon?: ReactNode;
  tone?: "default" | "good" | "warn" | "bad" | "brand";
  loading?: boolean;
}) {
  const tones: Record<string, string> = {
    default: "text-ink-900",
    good: "text-emerald-700",
    warn: "text-amber-700",
    bad: "text-red-700",
    brand: "text-brand-700",
  };
  const iconBg: Record<string, string> = {
    default: "bg-slate-100 text-slate-600",
    good: "bg-emerald-50 text-emerald-600",
    warn: "bg-amber-50 text-amber-600",
    bad: "bg-red-50 text-red-600",
    brand: "bg-brand-50 text-brand-600",
  };

  if (loading) {
    return (
      <div
        className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-card)]"
        aria-hidden="true"
      >
        <div className="flex items-center justify-between">
          <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
          <div className="h-7 w-7 animate-pulse rounded-lg bg-slate-100" />
        </div>
        <div className="mt-3 h-7 w-20 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-2.5 w-24 animate-pulse rounded bg-slate-100" />
      </div>
    );
  }

  const isEmpty = value === null || value === undefined || value === "";

  return (
    <div className="group rounded-xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300/80 hover:shadow-[var(--shadow-card-hover)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        {icon && (
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105 ${iconBg[tone]}`}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className={`text-2xl font-bold tracking-tight tabular-nums ${tones[tone]}`}>
          {isEmpty ? (
            "—"
          ) : typeof value === "number" ? (
            <AnimatedCounter value={value} />
          ) : (
            value
          )}
        </p>
        {delta && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {delta}
          </span>
        )}
      </div>
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

const BADGE_TONES: Record<string, { pill: string; dot: string }> = {
  ACTIVE: { pill: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15", dot: "bg-emerald-500" },
  PUBLISHED: { pill: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15", dot: "bg-emerald-500" },
  COMPLETED: { pill: "bg-teal-50 text-teal-700 ring-1 ring-teal-600/15", dot: "bg-teal-500" },
  SUCCESS: { pill: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15", dot: "bg-emerald-500" },
  OK: { pill: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15", dot: "bg-emerald-500" },
  PAID: { pill: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15", dot: "bg-emerald-500" },
  APPROVED: { pill: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15", dot: "bg-emerald-500" },
  ADMITTED: { pill: "bg-sky-50 text-sky-700 ring-1 ring-sky-600/15", dot: "bg-sky-500" },
  ENROLLED: { pill: "bg-brand-50 text-brand-700 ring-1 ring-brand-600/15", dot: "bg-brand-500" },
  GRADUATED: { pill: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/15", dot: "bg-indigo-500" },
  ISSUED: { pill: "bg-sky-50 text-sky-700 ring-1 ring-sky-600/15", dot: "bg-sky-500" },
  SUBMITTED: { pill: "bg-sky-50 text-sky-700 ring-1 ring-sky-600/15", dot: "bg-sky-500" },
  OVERDUE: { pill: "bg-red-50 text-red-700 ring-1 ring-red-600/15", dot: "bg-red-500" },
  CRITICAL: { pill: "bg-red-50 text-red-700 ring-1 ring-red-600/15", dot: "bg-red-500" },
  FAILED: { pill: "bg-red-50 text-red-700 ring-1 ring-red-600/15", dot: "bg-red-500" },
  REJECTED: { pill: "bg-red-50 text-red-700 ring-1 ring-red-600/15", dot: "bg-red-500" },
  WITHDRAWN: { pill: "bg-red-50 text-red-700 ring-1 ring-red-600/15", dot: "bg-red-500" },
  EXPELLED: { pill: "bg-rose-50 text-rose-700 ring-1 ring-rose-600/15", dot: "bg-rose-500" },
  DUE_TODAY: { pill: "bg-amber-50 text-amber-800 ring-1 ring-amber-600/15", dot: "bg-amber-500" },
  DUE_SOON: { pill: "bg-amber-50 text-amber-800 ring-1 ring-amber-600/15", dot: "bg-amber-500" },
  WARNING: { pill: "bg-amber-50 text-amber-800 ring-1 ring-amber-600/15", dot: "bg-amber-500" },
  DEGRADED: { pill: "bg-amber-50 text-amber-800 ring-1 ring-amber-600/15", dot: "bg-amber-500" },
  PENDING: { pill: "bg-amber-50 text-amber-800 ring-1 ring-amber-600/15", dot: "bg-amber-500" },
  PARTIALLY_PAID: { pill: "bg-amber-50 text-amber-800 ring-1 ring-amber-600/15", dot: "bg-amber-500" },
  UNDER_REVIEW: { pill: "bg-amber-50 text-amber-800 ring-1 ring-amber-600/15", dot: "bg-amber-500" },
  SUSPENDED: { pill: "bg-amber-50 text-amber-800 ring-1 ring-amber-600/15", dot: "bg-amber-500" },
  MORE_INFO: { pill: "bg-purple-50 text-purple-700 ring-1 ring-purple-600/15", dot: "bg-purple-500" },
  DEFERRED: { pill: "bg-purple-50 text-purple-700 ring-1 ring-purple-600/15", dot: "bg-purple-500" },
  DRAFT: { pill: "bg-slate-100 text-slate-600 ring-1 ring-slate-500/10", dot: "bg-slate-400" },
  CANCELLED: { pill: "bg-slate-100 text-slate-500 ring-1 ring-slate-500/10", dot: "bg-slate-400" },
  REVERSED: { pill: "bg-slate-100 text-slate-500 ring-1 ring-slate-500/10", dot: "bg-slate-400" },
  PUBLISHED_AT: { pill: "bg-slate-100 text-slate-600 ring-1 ring-slate-500/10", dot: "bg-slate-400" },
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const key = status.toUpperCase();
  const tone = BADGE_TONES[key] ?? {
    pill: "bg-slate-100 text-slate-600 ring-1 ring-slate-500/10",
    dot: "bg-slate-400",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${tone.pill}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}

export function ProgressCard({
  title,
  subtitle,
  percent,
  caption,
  href,
  actionLabel,
}: {
  title: string;
  subtitle?: string;
  percent: number | null;
  caption?: string;
  href?: string;
  actionLabel?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(percent ?? 0)));
  const body = (
    <div className="group rounded-xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[var(--shadow-card-hover)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-900 group-hover:text-brand-700 transition-colors">
            {title}
          </p>
          {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
        <span className="shrink-0 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-brand-700">
          {percent == null ? "—" : `${pct}%`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${title} progress`}
        className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        {caption ? <p className="text-xs text-slate-400">{caption}</p> : <span />}
        {href && actionLabel && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 group-hover:text-brand-700">
            {actionLabel} →
          </span>
        )}
      </div>
    </div>
  );
  return href ? (
    <a href={href} className="block">
      {body}
    </a>
  ) : (
    body
  );
}

export function EmptyState({
  title,
  detail,
  icon = false,
  action,
}: {
  title: string;
  detail?: string;
  icon?: boolean | ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300/90 bg-white/70 p-8 text-center">
      {icon && (
        <div
          className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400"
          aria-hidden="true"
        >
          {typeof icon === "boolean" ? <Inbox className="h-5 w-5" /> : icon}
        </div>
      )}
      <p className="text-sm font-semibold text-ink-900">{title}</p>
      {detail && <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">{detail}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50/90 p-5"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-red-900">{title}</p>
          {detail && <p className="mt-1 text-xs text-red-700">{detail}</p>}
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  );
}

export function LoadingSkeleton({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2.5 ${className}`} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-11 animate-pulse rounded-xl border border-slate-100 bg-slate-100/80"
        />
      ))}
    </div>
  );
}

export function ConfirmationDialog({
  open,
  title,
  detail,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AnimatedModal open={open} onClose={onCancel} maxWidth="max-w-md" labelledBy="confirm-title">
      <h2 id="confirm-title" className="text-base font-semibold text-ink-900">
        {title}
      </h2>
      {detail && <p className="mt-2 text-sm text-slate-600">{detail}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          {cancelLabel}
        </button>
        <button
          autoFocus
          onClick={onConfirm}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-all active:scale-[0.98] ${
            danger ? "bg-red-600 hover:bg-red-700" : "bg-brand-600 hover:bg-brand-700"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </AnimatedModal>
  );
}

/* ------------------------------------------------------------------ lists */

export function ActivityFeed({
  items,
}: {
  items: Array<{ id: string; at: string; type: string; description: string; link?: string | null }>;
}) {
  if (items.length === 0) {
    return <EmptyState icon title="No recent activity" detail="Events you can see will appear here." />;
  }
  return (
    <ol className="relative space-y-3.5 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-slate-200/80">
      {items.map((item) => (
        <li key={item.id} className="relative flex gap-3.5 pl-5 text-sm">
          <span
            className="absolute left-1 top-1.5 h-2 w-2 rounded-full bg-brand-500 ring-4 ring-white"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-ink-800">{item.description}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              <time dateTime={item.at}>{formatWhen(item.at)}</time>
              {item.link && (
                <>
                  {" · "}
                  <a href={item.link} className="font-medium text-brand-600 hover:underline">
                    View
                  </a>
                </>
              )}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function UpcomingList({
  items,
  emptyTitle = "Nothing scheduled",
  emptyDetail = "Your schedule is currently clear.",
}: {
  items: Array<{
    id: string;
    kind: string;
    title: string;
    subtitle?: string;
    at?: { date?: string | null; start?: string | null; time?: string | null } | null;
    link?: string | null;
    state?: string;
    delivery_mode?: string;
    location?: string | null;
    meeting_url?: string | null;
  }>;
  emptyTitle?: string;
  emptyDetail?: string;
}) {
  if (items.length === 0) {
    return <EmptyState icon title={emptyTitle} detail={emptyDetail} />;
  }
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li
          key={item.kind + item.id}
          className="rounded-xl border border-slate-200/80 bg-white p-3.5 transition-colors hover:border-brand-200 hover:bg-brand-50/20"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-ink-900">{item.title}</p>
                {item.state && <StatusBadge status={item.state} />}
                {item.delivery_mode && (
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                    {item.delivery_mode}
                  </span>
                )}
              </div>
              {item.subtitle && <p className="mt-0.5 text-xs text-slate-500">{item.subtitle}</p>}
            </div>
            <div className="shrink-0 text-right">
              {item.at?.date && (
                <p className="flex items-center justify-end gap-1 text-xs font-medium text-ink-800">
                  <Calendar className="h-3 w-3 text-slate-400" aria-hidden="true" />
                  <time dateTime={item.at.start ?? item.at.date ?? undefined}>
                    {formatDay(item.at.date)}
                  </time>
                </p>
              )}
              {item.at?.start && (
                <p className="text-xs tabular-nums text-slate-500">{shortTime(item.at.start)}</p>
              )}
              {item.link && (
                <a
                  href={item.link}
                  className="mt-1 inline-block text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline"
                >
                  Open →
                </a>
              )}
            </div>
          </div>
          {item.location && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="h-3 w-3 text-slate-400" aria-hidden="true" />
              {item.location}
            </p>
          )}
          {item.meeting_url && (
            <a
              href={item.meeting_url}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
              rel="noreferrer"
            >
              <Video className="h-3 w-3" aria-hidden="true" />
              Join online →
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ table */

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Hide this column below the given breakpoint (responsive tables). */
  hideBelow?: "sm" | "md" | "lg";
}

export function DataTable<T>({
  columns,
  rows,
  emptyTitle = "No records",
  emptyDetail,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  emptyTitle?: string;
  emptyDetail?: string;
  caption?: string;
}) {
  if (rows.length === 0) {
    return <EmptyState icon title={emptyTitle} detail={emptyDetail} />;
  }
  const hideClass: Record<string, string> = {
    sm: "hidden sm:table-cell",
    md: "hidden md:table-cell",
    lg: "hidden lg:table-cell",
  };
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/70">
      <table className="w-full text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`px-3.5 py-2.5 font-semibold ${c.hideBelow ? hideClass[c.hideBelow] : ""}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row, i) => (
            <tr
              key={(row as { id?: unknown }).id ? String((row as { id?: unknown }).id) : i}
              className="transition-colors hover:bg-slate-50/80"
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-3.5 py-3 align-middle ${c.hideBelow ? hideClass[c.hideBelow] : ""}`}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ----------------------------------------------------------------- alerts */

const ALERT_TONES: Record<string, { box: string; dot: string; label: string }> = {
  INFO: { box: "border-brand-200 bg-brand-50/80 text-brand-950", dot: "bg-brand-500", label: "Info" },
  SUCCESS: { box: "border-emerald-200 bg-emerald-50/80 text-emerald-950", dot: "bg-emerald-500", label: "Success" },
  WARNING: { box: "border-amber-200 bg-amber-50/90 text-amber-950", dot: "bg-amber-500", label: "Warning" },
  CRITICAL: { box: "border-red-200 bg-red-50/90 text-red-950", dot: "bg-red-500", label: "Critical" },
};

export function AlertBanner({
  severity,
  title,
  detail,
  link,
}: {
  severity: "INFO" | "SUCCESS" | "WARNING" | "CRITICAL";
  title: string;
  detail?: string;
  link?: string | null;
}) {
  const tone = ALERT_TONES[severity] ?? ALERT_TONES.INFO;
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3.5 ${tone.box}`}>
      <div className="flex min-w-0 items-start gap-2.5">
        <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
        <div className="min-w-0">
          <p className="text-sm font-medium">
            <span className="sr-only">{tone.label}: </span>
            {title}
          </p>
          {detail && <p className="text-xs opacity-80">{detail}</p>}
        </div>
      </div>
      {link && (
        <a
          href={link}
          className="rounded-lg bg-white/70 px-2.5 py-1 text-xs font-semibold shadow-2xs transition-colors hover:bg-white"
        >
          Take action →
        </a>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- filters */

export function DateRangePicker({
  preset,
  from,
  to,
  onPreset,
  onCustom,
}: {
  preset: string;
  from?: string;
  to?: string;
  onPreset: (preset: string) => void;
  onCustom: (from: string, to: string) => void;
}) {
  const [showCustom, setShowCustom] = useState(preset === "CUSTOM");
  const [f, setF] = useState(from ?? "");
  const [t, setT] = useState(to ?? "");
  const PRESETS: Array<{ value: string; label: string }> = [
    { value: "TODAY", label: "Today" },
    { value: "YESTERDAY", label: "Yesterday" },
    { value: "LAST_7_DAYS", label: "Last 7 days" },
    { value: "LAST_30_DAYS", label: "Last 30 days" },
    { value: "THIS_MONTH", label: "This month" },
    { value: "LAST_MONTH", label: "Last month" },
    { value: "THIS_SESSION", label: "This session" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs font-medium text-slate-500" htmlFor="date-preset">
        Period
      </label>
      <select
        id="date-preset"
        value={preset}
        onChange={(e) => {
          if (e.target.value === "CUSTOM") {
            setShowCustom(true);
            onPreset("CUSTOM");
          } else {
            setShowCustom(false);
            onPreset(e.target.value);
          }
        }}
        className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-ink-900 focus:border-brand-500 focus:outline-none"
      >
        {PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
        <option value="CUSTOM">Custom…</option>
      </select>
      {showCustom && (
        <span className="flex flex-wrap items-center gap-1.5">
          <input
            type="date"
            aria-label="From date"
            value={f}
            onChange={(e) => setF(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 px-2 text-xs"
          />
          <span className="text-xs text-slate-400">→</span>
          <input
            type="date"
            aria-label="To date"
            value={t}
            onChange={(e) => setT(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 px-2 text-xs"
          />
          <button
            onClick={() => f && t && onCustom(f, t)}
            className="h-8 rounded-lg bg-brand-600 px-3 text-xs font-medium text-white hover:bg-brand-700"
          >
            Apply
          </button>
        </span>
      )}
    </div>
  );
}

export function FilterBar({
  filters,
  values,
  onChange,
}: {
  filters: Array<{ key: string; label: string; options: Array<{ value: string; label: string }> }>;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  if (filters.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((f) => (
        <label key={f.key} className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          {f.label}
          <select
            value={values[f.key] ?? ""}
            onChange={(e) => onChange(f.key, e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-ink-900"
          >
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

export function ExportButton({
  report,
  preset,
  label = "Export CSV",
}: {
  report: string;
  preset: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doExport = async () => {
    setBusy(true);
    setError(null);
    try {
      const { analyticsApi } = await import("@/lib/api/analytics");
      const res = await analyticsApi.exportCsv(report, preset);
      const url = URL.createObjectURL(res.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        onClick={doExport}
        disabled={busy}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-ink-900 shadow-2xs transition-colors hover:bg-slate-50 disabled:opacity-50"
      >
        <Download className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
        {busy ? "Exporting…" : label}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

/* -------------------------------------------------------------- formatting */

export function formatMoney(minor: number | null | undefined, currency = "GHS"): string {
  if (minor == null) return "—";
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

export function formatPercent(v: number | null | undefined): string {
  return v == null ? "—" : `${Math.round(v)}%`;
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDay(iso: string): string {
  try {
    const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) return "Today";
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  } catch {
    return iso;
  }
}

function shortTime(t?: string | null): string {
  if (!t) return "";
  try {
    if (t.includes("T")) {
      return new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    }
    return t.slice(0, 5);
  } catch {
    return t;
  }
}
