"use client";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { MOTION_EASE } from "@/components/ui/motion";

/* ------------------------------------------------------------------ Button */

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300",
  secondary:
    "bg-ink-900 text-white shadow-sm hover:bg-ink-800 active:bg-ink-950 disabled:bg-slate-300",
  outline:
    "border border-slate-200 bg-white text-ink-900 shadow-xs hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50",
  ghost:
    "text-slate-600 hover:bg-slate-100 hover:text-ink-900 disabled:opacity-50",
  danger:
    "bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800 disabled:bg-red-300",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-9 px-4 text-sm gap-2 rounded-lg",
  lg: "h-10 px-5 text-sm gap-2 rounded-xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  children,
  className = "",
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}

/* -------------------------------------------------------------- PageHeader */

export function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6">
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
                {i < breadcrumbs.length - 1 && (
                  <ChevronRight className="h-3 w-3 text-slate-400" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-ink-900">
            {title}
          </h1>
          {description && (
            <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- Tabs */

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  layoutId = "km-tabs",
  className = "",
}: {
  tabs: Array<{ id: T; label: string; count?: number; icon?: ReactNode }>;
  active: T;
  onChange: (id: T) => void;
  layoutId?: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={`inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200/80 bg-slate-100/80 p-1 ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              isActive ? "text-ink-900" : "text-slate-600 hover:text-ink-900"
            }`}
          >
            {isActive && (
              <motion.span
                layoutId={layoutId}
                transition={{ duration: 0.2, ease: MOTION_EASE }}
                className="absolute inset-0 rounded-lg bg-white shadow-xs ring-1 ring-slate-200/60"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold tabular-nums ${
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "bg-slate-200/70 text-slate-600"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- Pagination */

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (nextPage: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
      <p className="tabular-nums">
        Showing <span className="font-medium text-ink-900">{start}</span>–
        <span className="font-medium text-ink-900">{end}</span> of{" "}
        <span className="font-medium text-ink-900">{total}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0}
          onClick={() => onPageChange(Math.max(0, page - 1))}
          icon={<ChevronLeft className="h-3.5 w-3.5" />}
        >
          Previous
        </Button>
        <span className="px-2 tabular-nums text-slate-600">
          Page {page + 1} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page + 1 >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Form Inputs */

const INPUT_BASE =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15 disabled:bg-slate-50 disabled:text-slate-500";

export function Input({
  label,
  error,
  hint,
  className = "",
  id,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-ink-800">
          {label}
        </label>
      )}
      <input id={id} className={`${INPUT_BASE} ${error ? "border-red-400 focus:border-red-500 focus:ring-red-500/15" : ""} ${className}`} {...rest} />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {!error && hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function Select({
  label,
  error,
  children,
  className = "",
  id,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
}) {
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-ink-800">
          {label}
        </label>
      )}
      <select id={id} className={`${INPUT_BASE} ${error ? "border-red-400" : ""} ${className}`} {...rest}>
        {children}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Textarea({
  label,
  error,
  className = "",
  id,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
}) {
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-ink-800">
          {label}
        </label>
      )}
      <textarea id={id} className={`${INPUT_BASE} ${error ? "border-red-400" : ""} ${className}`} {...rest} />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-ink-900 placeholder:text-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
      />
    </div>
  );
}
