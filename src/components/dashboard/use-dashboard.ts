"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { analyticsApi } from "@/lib/api/analytics";
import { ApiError } from "@/lib/api/client";
import type { DashboardResponse } from "@/lib/api/contracts";

export type DashStatus = "loading" | "ready" | "error";

export interface UseDashboardResult {
  status: DashStatus;
  data: DashboardResponse | null;
  error: string | null;
  /** True when the error is an expired/invalid session (401 after refresh). */
  sessionExpired: boolean;
  retry: () => void;
  reload: () => void;
}

/**
 * One dashboard = one analytics request (Phase 8 §46). Handles loading,
 * error-with-retry, and session expiry: the api client already redirects to
 * /login?reason=expired when the refresh chain is dead; we surface a friendly
 * state in the meantime and never leave the dashboard flashing empty data.
 */
export function useDashboard(
  role: "student" | "trainer" | "admin" | "superadmin",
  params?: { preset?: string; date_from?: string; date_to?: string }
): UseDashboardResult {
  const [status, setStatus] = useState<DashStatus>("loading");
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [tick, setTick] = useState(0);

  const retry = useCallback(() => {
    setStatus("loading");
    setError(null);
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await analyticsApi.dashboard(role, params);
        if (cancelled) return;
        setData(res);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setSessionExpired(true);
        }
        setError(err instanceof Error ? err.message : "Could not load the dashboard");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // params is a new object each render; the callers memoize the primitive fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, tick, params?.preset, params?.date_from, params?.date_to]);

  return { status, data, error, sessionExpired, retry, reload: retry };
}

/**
 * Deep-link support for the `/dashboard/{role}?focus=…` links the backend
 * analytics services emit (alerts, schedule items, grading queue, sidebar
 * Notifications). Every section a link can target carries an id equal to its
 * focus key, so clicking a link scrolls that section into view and flashes it.
 * `focus=notifications` opens the shell notification panel via a window event.
 * Unknown focus values are a silent no-op — we never fake a destination.
 */
export function useDashboardFocus(ready: boolean) {
  const params = useSearchParams();
  const focus = params.get("focus");

  useEffect(() => {
    if (!focus || !ready) return;
    if (focus === "notifications") {
      window.dispatchEvent(new CustomEvent("km:open-notifications"));
      return;
    }
    const el = document.getElementById(focus);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    el.classList.add("focus-flash");
    const t = window.setTimeout(() => el.classList.remove("focus-flash"), 1800);
    return () => window.clearTimeout(t);
  }, [focus, ready]);
}

export function dashboardErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return "You do not have permission to view this dashboard.";
    if (err.status === 429) return "Too many requests — please wait a moment and retry.";
  }
  return err instanceof Error ? err.message : "Something went wrong";
}
