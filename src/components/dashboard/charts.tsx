"use client";

import type { ReactNode } from "react";
import type { SeriesPoint } from "@/lib/api/contracts";

export type { SeriesPoint };

/**
 * Dependency-free responsive SVG charts (design-system consistent, no new
 * npm dependencies). Every chart supports loading, empty and zero states,
 * has text labels / legends, and renders inside a responsive viewBox so it
 * never breaks mobile layouts. Decorative-only charts are not rendered by
 * callers: each series carries its own label and context (Phase 8 §50).
 */

/** Brand-consistent categorical palette: sea blue, navy, teal, amber, red, slate. */
const PALETTE = ["#0994c4", "#0b2239", "#14b8a6", "#f3c614", "#ef4444", "#64748b", "#3db3da", "#264b62"];

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
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      <div className="mt-3">{children}</div>
      {legend && <div className="mt-3">{legend}</div>}
    </section>
  );
}

function LoadingBox() {
  return <div className="h-40 animate-pulse rounded-lg bg-slate-100" aria-hidden="true" />;
}

function ZeroBox({ message = "No data for this period yet." }: { message?: string }) {
  return (
    <div className="grid h-40 place-items-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">
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
    <ChartFrame title={title} description={description} legend={type === "donut" ? <Legend series={series} /> : undefined}>
      {type === "bar" && <BarChart series={series} />}
      {type === "line" && <LineChart series={series} />}
      {type === "area" && <AreaChart series={series} />}
      {type === "donut" && <DonutChart series={series} />}
      {type === "progress" && <ProgressChart series={series} />}
      {meta?.caption ? <p className="mt-2 text-xs text-slate-400">{String(meta.caption)}</p> : null}
    </ChartFrame>
  );
}

/* -------------------------------------------------------------------- bar */

function BarChart({ series }: { series: SeriesPoint[] }) {
  const data = series.slice(0, 12);
  const max = Math.max(...data.map((d) => d.value ?? 0), 1);
  return (
    <div className="flex h-40 items-end gap-2" role="img" aria-label={ariaFor(series, "bar")}>
      {data.map((d, i) => {
        const v = d.value ?? 0;
        const critical = d.meta?.level === "critical";
        const warning = d.meta?.level === "warning";
        return (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] font-medium text-slate-500">{fmtNum(v)}</span>
            <div
              className={`w-full rounded-t ${critical ? "bg-red-500" : warning ? "bg-amber-500" : "bg-slate-900"}`}
              style={{ height: `${Math.max(2, (v / max) * 110)}px` }}
              title={`${d.label}: ${fmtNum(v)}`}
            />
            <span className="w-full truncate text-center text-[10px] text-slate-400" title={d.label}>
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------- line */

function buildPath(values: number[], w: number, h: number, pad: number): { line: string; area: string; points: Array<[number, number]> } {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const points: Array<[number, number]> = values.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return [x, y];
  });
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${(pad + (values.length - 1) * step).toFixed(1)},${h - pad} L${pad},${h - pad} Z`;
  return { line, area, points };
}

function LineChart({ series }: { series: SeriesPoint[] }) {
  const values = series.map((p) => p.value ?? 0);
  const w = 320;
  const h = 140;
  const { line, points } = buildPath(values, w, h, 12);
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-36 w-full" role="img" aria-label={ariaFor(series, "line")}>
        <path d={line} fill="none" stroke="#0b2239" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.5" fill="#0b2239">
            <title>{`${series[i].label}: ${fmtNum(series[i].value ?? 0)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>{series[0]?.label}</span>
        {series.length > 2 && <span>{series[Math.floor(series.length / 2)]?.label}</span>}
        <span>{series[series.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function AreaChart({ series }: { series: SeriesPoint[] }) {
  const values = series.map((p) => p.value ?? 0);
  const w = 320;
  const h = 140;
  const { line, area } = buildPath(values, w, h, 12);
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-36 w-full" role="img" aria-label={ariaFor(series, "area")}>
        <path d={area} fill="#0994c4" opacity="0.15" />
        <path d={line} fill="none" stroke="#0994c4" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>{series[0]?.label}</span>
        <span>{series[series.length - 1]?.label}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ donut */

function DonutChart({ series }: { series: SeriesPoint[] }) {
  const data = series.filter((p) => (p.value ?? 0) > 0);
  const total = data.reduce((sum, p) => sum + (p.value ?? 0), 0) || 1;
  const R = 40;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-4">
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
              strokeWidth="14"
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-offset}
            >
              <title>{`${p.label}: ${fmtNum(p.value ?? 0)} (${Math.round(frac * 100)}%)`}</title>
            </circle>
          );
          offset += dash;
          return el;
        })}
      </svg>
      <ul className="space-y-1 text-xs">
        {data.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="text-slate-600">{p.label}</span>
            <span className="font-medium text-slate-900">{fmtNum(p.value ?? 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Legend({ series }: { series: SeriesPoint[] }) {
  return null; // donut renders its own list
}

/* --------------------------------------------------------------- progress */

function ProgressChart({ series }: { series: SeriesPoint[] }) {
  const data = series.slice(0, 6);
  return (
    <div className="space-y-3">
      {data.map((p, i) => {
        const pct = Math.max(0, Math.min(100, Math.round(p.value ?? 0)));
        return (
          <div key={i}>
            <div className="flex items-center justify-between text-xs">
              <span className="truncate text-slate-600" title={p.label}>{p.label}</span>
              <span className="font-medium text-slate-900">{pct}%</span>
            </div>
            <div
              className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${p.label} progress`}
            >
              <div className="h-full rounded-full bg-slate-900" style={{ width: `${pct}%` }} />
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

/* value may be optional in the contract type; charts coerce to 0 for geometry. */
