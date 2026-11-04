/** Phase 8 analytics contract types (mirror of backend/app/schemas/dashboard.py). */

export type Severity = "INFO" | "SUCCESS" | "WARNING" | "CRITICAL";
export type ChartType = "line" | "bar" | "area" | "donut" | "progress";

export interface SeriesPoint {
  label: string;
  value?: number | null;
  meta?: Record<string, unknown> | null;
}

export interface ChartOut {
  id: string;
  title: string;
  description?: string;
  type: ChartType;
  series: SeriesPoint[];
  meta?: Record<string, unknown>;
}

export interface UpcomingItem {
  id: string;
  kind: string;
  title: string;
  subtitle?: string;
  at?: { date?: string | null; start?: string | null; end?: string | null; time?: string | null } | null;
  link?: string | null;
  [key: string]: unknown;
}

export interface ActivityItem {
  id: string;
  at: string;
  type: string;
  description: string;
  link?: string | null;
}

export interface AlertItem {
  id: string;
  severity: Severity;
  title: string;
  detail?: string;
  link?: string | null;
}

export interface DateRangeInfo {
  preset: string;
  from: string;
  to: string;
  timezone: string;
}

export interface DashboardResponse {
  generated_at: string;
  date_range: DateRangeInfo;
  summary: Record<string, any>;
  charts: ChartOut[];
  upcoming: UpcomingItem[];
  recent_activity: ActivityItem[];
  alerts: AlertItem[];
}

export interface NotificationItem {
  id: string;
  channel: string;
  subject: string | null;
  snippet: string;
  status: string;
  created_at: string;
  read: boolean;
}

export interface NotificationListOut {
  unread: number;
  items: NotificationItem[];
}

export interface SearchHit {
  kind: string;
  id: string;
  title: string;
  subtitle?: string | null;
  link: string;
}

export interface SearchOut {
  query: string;
  hits: SearchHit[];
}
