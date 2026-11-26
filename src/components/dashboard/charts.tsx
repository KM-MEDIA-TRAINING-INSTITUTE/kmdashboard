"use client";

import { useState, type ReactNode } from "react";
import type { SeriesPoint } from "@/lib/api/contracts";

export type { SeriesPoint };

/**
 * Dependency-free interactive SVG charts with hover tooltips, subtle gridlines,
 * brand-consistent palette, and loading/empty/zero states.
 */
const PALETTE = [
  "#0994c4",
  "#0b2239",
  "#14b8a6",
  "#f3c614",
  "#ef4444",
  "#64748b",
  "#3db3da",
  "#264b62",
];

function ChartFrame({
  title,
  description,
  children,
  legend,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  legend?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-card)]">
      <h3 className="text-sm font-semibold tracking-tight text-ink-900">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      <div className="mt-4">{children}</div>
      {legend && <div className="mt-3">{legend}</div>}
    </section>
  );
}

function LoadingBox() {
  return <div className="h-44 animate-pulse rounded-xl bg-slate-100" aria-hidden="true" />;
}

function ZeroBox({ message = "No data for this period yet." }: { message?: string }) {
  return (
    <div className="grid h-44 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 text-xs font-medium text-slate-400">
      {message}
    </div>
  );
}

export function ChartCard({
  title,
  description,
  type,
  series,
  meta,
  loading = false,
}: {
  title: string;
  description?: string;
  type: "line" | "bar" | "area" | "donut" | "progress";
  series: SeriesPoint[];
  meta?: Record<string, unknown>;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <ChartFrame title={title} description={description}>
        <LoadingBox />
      </ChartFrame>
    );
  }
  const hasData = series.some((p) => p.value != null && p.value !== 0);
  if (!hasData) {
    return (
      <ChartFrame title={title} description={description}>
        <ZeroBox />
      </ChartFrame>
    );
  }
  return (
    <ChartFrame
      title={title}
      description={description}
      legend={type === "donut" ? <Legend series={series} /> : undefined}
    >
      {type === "bar" && <BarChart series={series} />}
      {type === "line" && <LineChart series={series} />}
      {type === "area" && <AreaChart series={series} />}
      {type === "donut" && <DonutChart series={series} />}
      {type === "progress" && <ProgressChart series={series} />}
      {meta?.caption ? <p className="mt-2.5 text-xs text-slate-400">{String(meta.caption)}</p> : null}
    </ChartFrame>
  );
}

/* -------------------------------------------------------------------- bar */

function BarChart({ series }: { series: SeriesPoint[] }) {
  const data = series.slice(0, 12);
  const max = Math.max(...data.map((d) => d.value ?? 0), 1);
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="relative flex h-44 items-end gap-2 pt-4" role="img" aria-label={ariaFor(series, "bar")}>
      {data.map((d, i) => {
        const v = d.value ?? 0;
        const critical = d.meta?.level === "critical";
        const warning = d.meta?.level === "warning";
        const active = hovered === i;
        return (
          <div
            key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className="relative flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
          >
            {active && (
              <div className="pointer-events-none absolute -top-7 z-10 whitespace-nowrap rounded-md bg-ink-900 px-2 py-1 text-[10px] font-semibold text-white shadow-md">
                {d.label}: {fmtNum(v)}
              </div>
            )}
            <span className="text-[10px] font-semibold tabular-nums text-slate-500">{fmtNum(v)}</span>
            <div
              className={`w-full max-w-[40px] rounded-t-md transition-all duration-200 ${
                critical
                  ? "bg-red-500"
                  : warning
                    ? "bg-amber-500"
                    : active
                      ? "bg-brand-500"
                      : "bg-brand-600/90"
              }`}
              style={{ height: `${Math.max(4, (v / max) * 114)}px` }}
              title={`${d.label}: ${fmtNum(v)}`}
            />
            <span className="w-full truncate text-center text-[10px] font-medium text-slate-400" title={d.label}>
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------- line */

function buildPath(
  values: number[],
  w: number,
  h: number,
  pad: number
): { line: string; area: string; points: Array<[number, number]> } {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const points: Array<[number, number]> = values.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return [x, y];
  });
  const line = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${(pad + (values.length - 1) * step).toFixed(1)},${h - pad} L${pad},${h - pad} Z`;
  return { line, area, points };
}

function LineChart({ series }: { series: SeriesPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const values = series.map((p) => p.value ?? 0);
  const w = 360;
  const h = 148;
  const { line, points } = buildPath(values, w, h, 14);

  return (
    <div className="relative">
      {hovered !== null && series[hovered] && (
        <div className="pointer-events-none absolute right-2 top-0 z-10 rounded-md bg-ink-900 px-2.5 py-1 text-[11px] font-semibold text-white shadow-md">
          {series[hovered].label}: {fmtNum(series[hovered].value ?? 0)}
        </div>
      )}
      <svg viewBox={`0 0 ${w} ${h}`} className="h-36 w-full" role="img" aria-label={ariaFor(series, "line")}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="14"
            x2={w - 14}
            y1={14 + f * (h - 28)}
            y2={14 + f * (h - 28)}
            stroke="#e2e8f0"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
        ))}
        <path d={line} fill="none" stroke="#0b2239" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map(([x, y], i) => (
          <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <circle cx={x} cy={y} r="8" fill="transparent" />
            <circle
              cx={x}
              cy={y}
              r={hovered === i ? "4.5" : "3"}
              fill={hovered === i ? "#0994c4" : "#0b2239"}
              stroke="#ffffff"
              strokeWidth="1.5"
            >
              <title>{`${series[i].label}: ${fmtNum(series[i].value ?? 0)}`}</title>
            </circle>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] font-medium text-slate-400">
        <span>{series[0]?.label}</span>
        {series.length > 2 && <span>{series[Math.floor(series.length / 2)]?.label}</span>}
        <span>{series[series.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function AreaChart({ series }: { series: SeriesPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const values = series.map((p) => p.value ?? 0);
  const w = 360;
  const h = 148;
  const { line, area, points } = buildPath(values, w, h, 14);
  const gradId = "km-area-grad";

  return (
    <div className="relative">
      {hovered !== null && series[hovered] && (
        <div className="pointer-events-none absolute right-2 top-0 z-10 rounded-md bg-ink-900 px-2.5 py-1 text-[11px] font-semibold text-white shadow-md">
          {series[hovered].label}: {fmtNum(series[hovered].value ?? 0)}
        </div>
      )}
      <svg viewBox={`0 0 ${w} ${h}`} className="h-36 w-full" role="img" aria-label={ariaFor(series, "area")}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0994c4" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#0994c4" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="14"
            x2={w - 14}
            y1={14 + f * (h - 28)}
            y2={14 + f * (h - 28)}
            stroke="#e2e8f0"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
        ))}
        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke="#0994c4" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map(([x, y], i) => (
          <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <circle cx={x} cy={y} r="8" fill="transparent" />
            <circle
              cx={x}
              cy={y}
              r={hovered === i ? "4.5" : "2.5"}
              fill={hovered === i ? "#0b2239" : "#0994c4"}
              stroke="#ffffff"
              strokeWidth="1.5"
            >
              <title>{`${series[i].label}: ${fmtNum(series[i].value ?? 0)}`}</title>
            </circle>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] font-medium text-slate-400">
        <span>{series[0]?.label}</span>
        {series.length > 2 && <span>{series[Math.floor(series.length / 2)]?.label}</span>}
        <span>{series[series.length - 1]?.label}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ donut */

function DonutChart({ series }: { series: SeriesPoint[] }) {
  const data = series.filter((p) => (p.value ?? 0) > 0);
  const total = data.reduce((sum, p) => sum + (p.value ?? 0), 0) || 1;
  const [hovered, setHovered] = useState<number | null>(null);
  const R = 38;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90" role="img" aria-label={ariaFor(series, "donut")}>
          {data.map((p, i) => {
            const frac = (p.value ?? 0) / total;
            const dash = frac * C;
            const el = (
              <circle
                key={i}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth={hovered === i ? "16" : "13"}
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-offset}
                className="transition-all duration-200"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                <title>{`${p.label}: ${fmtNum(p.value ?? 0)} (${Math.round(frac * 100)}%)`}</title>
              </circle>
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-base font-bold tabular-nums text-ink-900">
            {hovered !== null && data[hovered]
              ? fmtNum(data[hovered].value ?? 0)
              : fmtNum(total)}
          </span>
          <span className="max-w-[60px] truncate text-[9px] font-medium uppercase tracking-wider text-slate-400">
            {hovered !== null && data[hovered] ? data[hovered].label : "Total"}
          </span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
        {data.map((p, i) => {
          const pct = Math.round(((p.value ?? 0) / total) * 100);
          return (
            <li
              key={i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              className={`flex items-center justify-between gap-2 rounded-md px-1.5 py-0.5 transition-colors ${
                hovered === i ? "bg-slate-100" : ""
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: PALETTE[i % PALETTE.length] }}
                />
                <span className="truncate text-slate-600">{p.label}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-ink-900">
                {fmtNum(p.value ?? 0)}{" "}
                <span className="font-normal text-slate-400">({pct}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Legend({ series: _series }: { series: SeriesPoint[] }) {
  return null;
}

/* --------------------------------------------------------------- progress */

function ProgressChart({ series }: { series: SeriesPoint[] }) {
  const data = series.slice(0, 6);
  return (
    <div className="space-y-3.5">
      {data.map((p, i) => {
        const pct = Math.max(0, Math.min(100, Math.round(p.value ?? 0)));
        return (
          <div key={i}>
            <div className="flex items-center justify-between text-xs">
              <span className="truncate font-medium text-slate-600" title={p.label}>
                {p.label}
              </span>
              <span className="font-semibold tabular-nums text-ink-900">{pct}%</span>
            </div>
            <div
              className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${p.label} progress`}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- shared */

function fmtNum(v: number): string {
  if (Number.isInteger(v)) return v.toLocaleString();
  return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function ariaFor(series: SeriesPoint[], kind: string): string {
  const summary = series
    .slice(0, 6)
    .map((p) => `${p.label}: ${fmtNum(p.value ?? 0)}`)
    .join(", ");
  return `${kind} chart. ${summary}`;
}
