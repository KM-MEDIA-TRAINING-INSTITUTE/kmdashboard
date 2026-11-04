"use client";

import { useEffect, useState, type ReactNode } from "react";

/* ------------------------------------------------------------ primitives */

export function SectionCard({
  title,
  description,
  action,
  children,
  className = "",
  id,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** DOM id — used as the target for ?focus=… deep links from the API. */
  id?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-20 rounded-xl border border-slate-200 bg-white p-5 ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
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
  tone = "default",
  loading = false,
}: {
  label: string;
  value: string | number | null | undefined;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad";
  loading?: boolean;
}) {
  const tones: Record<string, string> = {
    default: "text-slate-900",
    good: "text-emerald-700",
    warn: "text-amber-700",
    bad: "text-red-700",
  };
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5" aria-hidden="true">
        <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-7 w-16 animate-pulse rounded bg-slate-200" />
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>
        {value === null || value === undefined || value === "" ? "—" : value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

const BADGE_TONES: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  SUCCESS: "bg-emerald-100 text-emerald-700",
  OK: "bg-emerald-100 text-emerald-700",
  OVERDUE: "bg-red-100 text-red-700",
  CRITICAL: "bg-red-100 text-red-700",
  FAILED: "bg-red-100 text-red-700",
  DUE_TODAY: "bg-amber-100 text-amber-800",
  DUE_SOON: "bg-amber-100 text-amber-800",
  WARNING: "bg-amber-100 text-amber-800",
  PENDING: "bg-amber-100 text-amber-800",
  PUBLISHED_AT: "bg-slate-100 text-slate-600",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = BADGE_TONES[status.toUpperCase()] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          BADGE_TONES[status.toUpperCase()]?.includes("emerald")
            ? "bg-emerald-500"
            : BADGE_TONES[status.toUpperCase()]?.includes("red")
              ? "bg-red-500"
              : BADGE_TONES[status.toUpperCase()]?.includes("amber")
                ? "bg-amber-500"
                : "bg-slate-400"
        }`}
      />
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
    <div className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
          {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
        <span className="shrink-0 text-sm font-semibold text-slate-900">{percent == null ? "—" : `${pct}%`}</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${title} progress`}
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100"
      >
        <div className="h-full rounded-full bg-slate-900" style={{ width: `${pct}%` }} />
      </div>
      {caption && <p className="mt-2 text-xs text-slate-400">{caption}</p>}
      {href && actionLabel && (
        <span className="mt-2 inline-block text-xs font-medium text-brand-700">
          {actionLabel} →
        </span>
      )}
    </div>
  );
  return href ? (
    <a href={href} className="block">{body}</a>
  ) : (
    body
  );
}

export function EmptyState({
  title,
  detail,
  icon = false,
}: {
  title: string;
  detail?: string;
  icon?: boolean;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
      {icon && (
        <div className="mx-auto mb-2 h-8 w-8 rounded-full bg-slate-100" aria-hidden="true" />
      )}
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
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
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5">
      <p className="text-sm font-semibold text-red-800">{title}</p>
      {detail && <p className="mt-1 text-xs text-red-700">{detail}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function LoadingSkeleton({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 id="confirm-title" className="text-base font-semibold text-slate-900">{title}</h2>
        {detail && <p className="mt-2 text-sm text-slate-600">{detail}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {cancelLabel}
          </button>
          <button
            autoFocus
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-slate-900 hover:bg-slate-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ lists */

export function ActivityFeed({
  items,
}: {
  items: Array<{ id: string; at: string; type: string; description: string; link?: string | null }>;
}) {
  if (items.length === 0) {
    return <EmptyState title="No recent activity" detail="Events you can see will appear here." />;
  }
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3 text-sm">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-slate-800">{item.description}</p>
            <p className="text-xs text-slate-400">
              <time dateTime={item.at}>{formatWhen(item.at)}</time>
              {item.link && (
                <>
                  {" · "}
                  <a href={item.link} className="text-slate-500 hover:underline">View</a>
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
    return <EmptyState title={emptyTitle} detail={emptyDetail} />;
  }
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.kind + item.id} className="rounded-lg border border-slate-200 p-3.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-slate-900">{item.title}</p>
                {item.state && <StatusBadge status={item.state} />}
                {item.delivery_mode && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                    {item.delivery_mode}
                  </span>
                )}
              </div>
              {item.subtitle && <p className="mt-0.5 text-xs text-slate-500">{item.subtitle}</p>}
            </div>
            <div className="shrink-0 text-right">
              {item.at?.date && (
                <p className="text-xs font-medium text-slate-700">
                  <time dateTime={item.at.start ?? item.at.date ?? undefined}>{formatDay(item.at.date)}</time>
                </p>
              )}
              {item.at?.start && <p className="text-xs text-slate-500">{shortTime(item.at.start)}</p>}
              {item.link && (
                <a href={item.link} className="mt-0.5 block text-xs text-slate-500 hover:underline">Open →</a>
              )}
            </div>
          </div>
          {item.location && <p className="mt-1.5 text-xs text-slate-400">📍 {item.location}</p>}
          {item.meeting_url && (
            <a href={item.meeting_url} className="mt-1 inline-block text-xs text-teal-700 hover:underline" rel="noreferrer">
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
    return <EmptyState title={emptyTitle} detail={emptyDetail} />;
  }
  const hideClass: Record<string, string> = {
    sm: "hidden sm:table-cell",
    md: "hidden md:table-cell",
    lg: "hidden lg:table-cell",
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`px-3 py-2 font-medium ${c.hideBelow ? hideClass[c.hideBelow] : ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={(row as { id?: unknown }).id ? String((row as { id?: unknown }).id) : i} className="border-b border-slate-100 last:border-0">
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2.5 align-top ${c.hideBelow ? hideClass[c.hideBelow] : ""}`}>
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
  INFO: { box: "border-sky-200 bg-sky-50 text-sky-900", dot: "bg-sky-500", label: "Info" },
  SUCCESS: { box: "border-emerald-200 bg-emerald-50 text-emerald-900", dot: "bg-emerald-500", label: "Success" },
  WARNING: { box: "border-amber-200 bg-amber-50 text-amber-900", dot: "bg-amber-500", label: "Warning" },
  CRITICAL: { box: "border-red-200 bg-red-50 text-red-900", dot: "bg-red-500", label: "Critical" },
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
      <div className="flex min-w-0 items-start gap-2">
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
        <a href={link} className="text-xs font-medium underline opacity-90 hover:opacity-100">
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
      <label className="text-xs text-slate-500" htmlFor="date-preset">Period</label>
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
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
      >
        {PRESETS.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
        <option value="CUSTOM">Custom…</option>
      </select>
      {showCustom && (
        <span className="flex items-center gap-1.5">
          <input
            type="date"
            aria-label="From date"
            value={f}
            onChange={(e) => setF(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
          <span className="text-xs text-slate-400">→</span>
          <input
            type="date"
            aria-label="To date"
            value={t}
            onChange={(e) => setT(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
          <button
            onClick={() => f && t && onCustom(f, t)}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
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
        <label key={f.key} className="flex items-center gap-1.5 text-xs text-slate-500">
          {f.label}
          <select
            value={values[f.key] ?? ""}
            onChange={(e) => onChange(f.key, e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
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
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {busy ? "Exporting…" : label}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

/* -------------------------------------------------------------- formatting */

export function formatMoney(minor: number | null | undefined, currency = "GHS"): string {
  if (minor == null) return "—";
  return new Intl.NumberFormat("en-GH", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    minor / 100
  );
}

export function formatPercent(v: number | null | undefined): string {
  return v == null ? "—" : `${Math.round(v)}%`;
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
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
    if (t.includes("T")) return new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    return t.slice(0, 5);
  } catch {
    return t;
  }
}
