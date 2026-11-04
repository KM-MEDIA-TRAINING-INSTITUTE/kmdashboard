import { api } from "./client";
import type { ChartOut, DashboardResponse } from "./contracts";
import type { NotificationListOut } from "./contracts";
import type { SearchOut } from "./contracts";

/** Typed client for the Phase 8 analytics surface. */
export const analyticsApi = {
  dashboard(role: "student" | "trainer" | "admin" | "superadmin", params?: {
    preset?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<DashboardResponse> {
    const qs = new URLSearchParams();
    if (params?.preset) qs.set("preset", params.preset);
    if (params?.date_from) qs.set("date_from", params.date_from);
    if (params?.date_to) qs.set("date_to", params.date_to);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return api<DashboardResponse>(`/analytics/${role}${suffix}`);
  },

  notifications(limit = 30): Promise<NotificationListOut> {
    return api<NotificationListOut>(`/analytics/notifications?limit=${limit}`);
  },

  markNotificationRead(id: string): Promise<void> {
    return api<void>(`/analytics/notifications/${id}/read`, { method: "POST" });
  },

  markAllNotificationsRead(): Promise<void> {
    return api<void>("/analytics/notifications/read-all", { method: "POST" });
  },

  search(q: string): Promise<SearchOut> {
    return api<SearchOut>(`/analytics/search?q=${encodeURIComponent(q)}`);
  },

  exportCsv(report: string, preset: string): Promise<{ blob: Blob; filename: string }> {
    // Hand-rolled fetch: we need the raw body (CSV), not parsed JSON.
    return apiImplementationAwareFetch(`/analytics/admin/export?report=${encodeURIComponent(report)}&preset=${encodeURIComponent(preset)}`);
  },
};

async function apiImplementationAwareFetch(path: string): Promise<{ blob: Blob; filename: string }> {
  const { tokenStore } = await import("./token-store");
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1");
  const res = await fetch(`${base}${path}`, {
    headers: tokenStore.getAccess() ? { Authorization: `Bearer ${tokenStore.getAccess()}` } : {},
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const match = cd.match(/filename="?([^"]+)"?/);
  return { blob, filename: match?.[1] ?? "export.csv" };
}

export type { ChartOut };
